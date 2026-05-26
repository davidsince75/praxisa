import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import { campaigns, users, enrolments } from "../../db/schema/index.js";

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  targetType: z
    .enum(["all_students", "course_enrolled"])
    .default("all_students"),
  targetCourseId: z.string().uuid().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  targetType: z.enum(["all_students", "course_enrolled"]).optional(),
  targetCourseId: z.string().uuid().nullable().optional(),
});

export function campaignsPlugin(fastify: FastifyInstance) {
  // ── GET /campaigns ──────────────────────────────────────────────────────────
  fastify.get(
    "/campaigns",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const rows = await fastify.db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          subject: campaigns.subject,
          targetType: campaigns.targetType,
          targetCourseId: campaigns.targetCourseId,
          status: campaigns.status,
          recipientCount: campaigns.recipientCount,
          sentAt: campaigns.sentAt,
          createdAt: campaigns.createdAt,
          updatedAt: campaigns.updatedAt,
        })
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt));

      return reply.send({ campaigns: rows });
    },
  );

  // ── POST /campaigns ─────────────────────────────────────────────────────────
  fastify.post(
    "/campaigns",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = createCampaignSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { name, subject, body, targetType, targetCourseId } = parse.data;

      if (targetType === "course_enrolled" && targetCourseId === undefined) {
        return reply.status(400).send({
          error: "targetCourseId required for course_enrolled target",
        });
      }

      const returned = await fastify.db
        .insert(campaigns)
        .values({
          name,
          subject,
          body,
          targetType,
          ...(targetCourseId !== undefined ? { targetCourseId } : {}),
          createdBy: actorId,
        })
        .returning();

      const campaign = returned[0];
      if (campaign === undefined) throw new Error("Insert returned no rows");

      await emitEvent({
        actorUserId: actorId,
        eventType: "campaign.created",
        entityType: "campaign",
        entityId: campaign.id,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({ campaign });
    },
  );

  // ── GET /campaigns/:id ──────────────────────────────────────────────────────
  fastify.get(
    "/campaigns/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1);

      const campaign = rows[0];
      if (campaign === undefined) {
        return reply.status(404).send({ error: "Campagne introuvable" });
      }

      return reply.send({ campaign });
    },
  );

  // ── PATCH /campaigns/:id ────────────────────────────────────────────────────
  fastify.patch(
    "/campaigns/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select({ id: campaigns.id, status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1);

      const existing = rows[0];
      if (existing === undefined) {
        return reply.status(404).send({ error: "Campagne introuvable" });
      }
      if (existing.status !== "draft") {
        return reply.status(409).send({
          error: "Seules les campagnes en brouillon peuvent être modifiées",
        });
      }

      const parse = updateCampaignSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const updated = await fastify.db
        .update(campaigns)
        .set({ ...parse.data, updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning();

      await emitEvent({
        actorUserId: actorId,
        eventType: "campaign.updated",
        entityType: "campaign",
        entityId: id,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ campaign: updated[0] });
    },
  );

  // ── DELETE /campaigns/:id ───────────────────────────────────────────────────
  fastify.delete(
    "/campaigns/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select({ id: campaigns.id, status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1);

      const existing = rows[0];
      if (existing === undefined) {
        return reply.status(404).send({ error: "Campagne introuvable" });
      }
      if (existing.status !== "draft") {
        return reply.status(409).send({
          error: "Seules les campagnes en brouillon peuvent être supprimées",
        });
      }

      await fastify.db.delete(campaigns).where(eq(campaigns.id, id));

      await emitEvent({
        actorUserId: actorId,
        eventType: "campaign.deleted",
        entityType: "campaign",
        entityId: id,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(204).send();
    },
  );

  // ── POST /campaigns/:id/send ────────────────────────────────────────────────
  fastify.post(
    "/campaigns/:id/send",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1);

      const campaign = rows[0];
      if (campaign === undefined) {
        return reply.status(404).send({ error: "Campagne introuvable" });
      }
      if (campaign.status !== "draft") {
        return reply
          .status(409)
          .send({ error: "Cette campagne a déjà été envoyée" });
      }

      // Mark as sending
      await fastify.db
        .update(campaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(campaigns.id, id));

      // Resolve recipients
      let recipients: { email: string; firstName: string; lastName: string }[];

      if (campaign.targetType === "all_students") {
        recipients = await fastify.db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(and(eq(users.role, "student"), isNull(users.deletedAt)));
      } else {
        // course_enrolled
        if (campaign.targetCourseId === null) {
          await fastify.db
            .update(campaigns)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(campaigns.id, id));
          return reply
            .status(400)
            .send({ error: "Aucun cours cible configuré" });
        }
        const enrolRows = await fastify.db
          .select({
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(enrolments)
          .innerJoin(users, eq(users.id, enrolments.studentId))
          .where(
            and(
              eq(enrolments.courseId, campaign.targetCourseId),
              isNull(enrolments.deletedAt),
              isNull(users.deletedAt),
            ),
          );
        recipients = enrolRows;
      }

      // Deduplicate by email
      const seen = new Set<string>();
      const unique = recipients.filter((r) => {
        if (seen.has(r.email)) return false;
        seen.add(r.email);
        return true;
      });

      // Send emails (fire-and-forget per recipient, log errors)
      let sent = 0;
      await Promise.all(
        unique.map(async (r) => {
          try {
            await fastify.comms.sendCampaignEmail(
              { email: r.email, name: `${r.firstName} ${r.lastName}` },
              campaign.subject,
              campaign.body,
            );
            sent++;
          } catch (err: unknown) {
            fastify.log.error({ err, email: r.email }, "Campaign email failed");
          }
        }),
      );

      // Mark as sent
      await fastify.db
        .update(campaigns)
        .set({
          status: "sent",
          recipientCount: sent,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, id));

      await emitEvent({
        actorUserId: actorId,
        eventType: "campaign.sent",
        entityType: "campaign",
        entityId: id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { recipientCount: sent },
      });

      return reply.send({ sent, recipientCount: sent });
    },
  );
}
