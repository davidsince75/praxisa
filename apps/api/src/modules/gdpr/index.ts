import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  auditEvents,
  enrolments,
  gdprRequests,
  lessonProgress,
  policyConsents,
  users,
} from "../../db/schema/index.js";
import {
  completeRequestBodySchema,
  completeRequestParamsSchema,
  recordConsentBodySchema,
  rectifyBodySchema,
} from "./types.js";

export const gdprPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── GET /gdpr/export ───────────────────────────────────────────────────────
  // Authenticated user downloads a structured JSON copy of all their data.

  fastify.get(
    "/gdpr/export",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;

      const [userRows, enrolmentRows, consentRows] = await Promise.all([
        fastify.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            isActive: users.isActive,
            emailVerified: users.emailVerified,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, sub))
          .limit(1),
        fastify.db
          .select()
          .from(enrolments)
          .where(
            and(eq(enrolments.studentId, sub), isNull(enrolments.deletedAt)),
          ),
        fastify.db
          .select({
            policyType: policyConsents.policyType,
            policyVersion: policyConsents.policyVersion,
            acceptedAt: policyConsents.acceptedAt,
          })
          .from(policyConsents)
          .where(eq(policyConsents.userId, sub))
          .orderBy(desc(policyConsents.acceptedAt)),
      ]);

      const user = userRows[0];
      if (user === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      const enrolmentIds = enrolmentRows.map((e) => e.id);
      const progressRows =
        enrolmentIds.length > 0
          ? await Promise.all(
              enrolmentIds.map((eid) =>
                fastify.db
                  .select()
                  .from(lessonProgress)
                  .where(eq(lessonProgress.enrolmentId, eid)),
              ),
            ).then((results) => results.flat())
          : [];

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.export.requested",
        entityType: "user",
        entityId: sub,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({
        exportedAt: new Date().toISOString(),
        user,
        enrolments: enrolmentRows,
        lessonProgress: progressRows,
        policyConsents: consentRows,
      });
    },
  );

  // ── POST /gdpr/erasure ─────────────────────────────────────────────────────
  // Authenticated user requests erasure. Immediately soft-deletes their
  // account and all active enrolments, then creates a pending request for
  // admin to confirm any downstream hard-delete steps.

  fastify.post(
    "/gdpr/erasure",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;
      const now = new Date();

      // Check user exists and is not already deleted
      const userRows = await fastify.db
        .select({ id: users.id, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, sub))
        .limit(1);
      const user = userRows[0];
      if (user === undefined || user.deletedAt !== null) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      // Check no duplicate pending erasure request
      const existing = await fastify.db
        .select({ id: gdprRequests.id })
        .from(gdprRequests)
        .where(
          and(
            eq(gdprRequests.userId, sub),
            eq(gdprRequests.type, "erasure"),
            eq(gdprRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ error: "Une demande de suppression est déjà en cours" });
      }

      // Soft-delete user
      await fastify.db
        .update(users)
        .set({ deletedAt: now, isActive: false, updatedAt: now })
        .where(eq(users.id, sub));

      // Soft-delete all active enrolments
      await fastify.db
        .update(enrolments)
        .set({ deletedAt: now, status: "cancelled", updatedAt: now })
        .where(
          and(eq(enrolments.studentId, sub), isNull(enrolments.deletedAt)),
        );

      // Create erasure request for admin queue
      const inserted = await fastify.db
        .insert(gdprRequests)
        .values({ userId: sub, type: "erasure" })
        .returning();
      const gdprRequest = inserted[0];
      if (gdprRequest === undefined) {
        throw new Error("Insert returned no rows");
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.erasure.requested",
        entityType: "user",
        entityId: sub,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(202).send({ requestId: gdprRequest.id });
    },
  );

  // ── POST /gdpr/rectify ─────────────────────────────────────────────────────
  // Authenticated user corrects their own first name or last name.
  // Email correction is handled separately (requires re-verification).

  fastify.post(
    "/gdpr/rectify",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;

      const parse = rectifyBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const now = new Date();
      const updates: Partial<{
        firstName: string;
        lastName: string;
        updatedAt: Date;
      }> = { updatedAt: now };
      if (body.firstName !== undefined) updates.firstName = body.firstName;
      if (body.lastName !== undefined) updates.lastName = body.lastName;

      const updated = await fastify.db
        .update(users)
        .set(updates)
        .where(and(eq(users.id, sub), isNull(users.deletedAt)))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        });

      if (updated.length === 0) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      // Record rectification for audit trail
      await fastify.db.insert(gdprRequests).values({
        userId: sub,
        type: "rectification",
        status: "completed",
        completedAt: now,
        completedBy: sub,
        notes: `Fields updated: ${Object.keys(body).join(", ")}`,
      });

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.rectification.completed",
        entityType: "user",
        entityId: sub,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ user: updated[0] });
    },
  );

  // ── GET /gdpr/requests ─────────────────────────────────────────────────────
  // Admin: list all DSR requests, optionally filtered by status.

  fastify.get(
    "/gdpr/requests",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { status } = request.query as { status?: string };

      const rows =
        status !== undefined
          ? await fastify.db
              .select()
              .from(gdprRequests)
              .where(
                eq(
                  gdprRequests.status,
                  status as
                    | "pending"
                    | "in_progress"
                    | "completed"
                    | "rejected",
                ),
              )
              .orderBy(gdprRequests.createdAt)
          : await fastify.db
              .select()
              .from(gdprRequests)
              .orderBy(gdprRequests.createdAt);

      return reply.send({ requests: rows });
    },
  );

  // ── PATCH /gdpr/requests/:userId/complete ──────────────────────────────────
  // Admin: mark all pending requests for a user as completed.

  fastify.patch(
    "/gdpr/requests/:userId/complete",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const paramsParse = completeRequestParamsSchema.safeParse(request.params);
      if (!paramsParse.success) {
        return reply.status(400).send({ error: paramsParse.error.flatten() });
      }

      const bodyParse = completeRequestBodySchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply.status(400).send({ error: bodyParse.error.flatten() });
      }

      const { userId } = paramsParse.data;
      const { notes } = bodyParse.data;
      const now = new Date();

      const updated = await fastify.db
        .update(gdprRequests)
        .set({
          status: "completed",
          completedAt: now,
          completedBy: sub,
          notes: notes ?? null,
          updatedAt: now,
        })
        .where(
          and(
            eq(gdprRequests.userId, userId),
            eq(gdprRequests.status, "pending"),
          ),
        )
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({
          error: "Aucune demande en attente trouvée pour cet utilisateur",
        });
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.request.completed",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ completed: updated.length, requests: updated });
    },
  );

  // ── POST /gdpr/consents ────────────────────────────────────────────────────
  // Record the authenticated user's acceptance of a versioned policy.
  // Append-only — calling this multiple times creates multiple records,
  // which is correct (each acceptance is a distinct event).

  fastify.post(
    "/gdpr/consents",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;

      const parse = recordConsentBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { policyType, policyVersion } = parse.data;
      const now = new Date();

      const inserted = await fastify.db
        .insert(policyConsents)
        .values({
          userId: sub,
          policyType,
          policyVersion,
          acceptedAt: now,
          requestId: request.id,
          sourceIp: request.ip,
        })
        .returning();

      const consent = inserted[0];
      if (consent === undefined) {
        throw new Error("Insert returned no rows");
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.consent.recorded",
        entityType: "policy_consent",
        entityId: consent.id,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { policyType, policyVersion },
      });

      return reply.status(201).send({
        id: consent.id,
        policyType: consent.policyType,
        policyVersion: consent.policyVersion,
        acceptedAt: consent.acceptedAt,
      });
    },
  );

  // ── GET /gdpr/consents/me ──────────────────────────────────────────────────
  // Return the authenticated user's full consent history, newest first.

  fastify.get(
    "/gdpr/consents/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;

      const rows = await fastify.db
        .select({
          id: policyConsents.id,
          policyType: policyConsents.policyType,
          policyVersion: policyConsents.policyVersion,
          acceptedAt: policyConsents.acceptedAt,
        })
        .from(policyConsents)
        .where(eq(policyConsents.userId, sub))
        .orderBy(desc(policyConsents.acceptedAt));

      return reply.send({ consents: rows });
    },
  );

  // ── GET /gdpr/users/:userId/export ────────────────────────────────────────
  // Admin-only. Returns a complete data package for any user, for use by the
  // DPO when responding to formal Subject Access Requests (Art. 15 GDPR).
  // Includes: user record, enrolments, lesson progress, consent history,
  // and the last 500 audit events attributed to this user.

  fastify.get(
    "/gdpr/users/:userId/export",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const paramsParse = z
        .object({ userId: z.string().uuid() })
        .safeParse(request.params);
      if (!paramsParse.success) {
        return reply.status(400).send({ error: paramsParse.error.flatten() });
      }
      const { userId } = paramsParse.data;

      const [userRows, enrolmentRows, consentRows, auditRows] =
        await Promise.all([
          fastify.db
            .select({
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              role: users.role,
              createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1),
          fastify.db
            .select()
            .from(enrolments)
            .where(eq(enrolments.studentId, userId)),
          fastify.db
            .select({
              id: policyConsents.id,
              policyType: policyConsents.policyType,
              policyVersion: policyConsents.policyVersion,
              acceptedAt: policyConsents.acceptedAt,
              // source_ip intentionally omitted — may be null post-erasure
            })
            .from(policyConsents)
            .where(eq(policyConsents.userId, userId))
            .orderBy(desc(policyConsents.acceptedAt)),
          fastify.db
            .select({
              id: auditEvents.id,
              eventAt: auditEvents.eventAt,
              eventType: auditEvents.eventType,
              entityType: auditEvents.entityType,
              entityId: auditEvents.entityId,
              dataClassification: auditEvents.dataClassification,
              requestId: auditEvents.requestId,
              metadata: auditEvents.metadata,
            })
            .from(auditEvents)
            .where(eq(auditEvents.actorUserId, userId))
            .orderBy(desc(auditEvents.eventAt))
            .limit(500),
        ]);

      const user = userRows[0];
      if (user === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      const enrolmentIds = enrolmentRows.map((e) => e.id);
      const progressRows =
        enrolmentIds.length > 0
          ? await Promise.all(
              enrolmentIds.map((eid) =>
                fastify.db
                  .select()
                  .from(lessonProgress)
                  .where(eq(lessonProgress.enrolmentId, eid)),
              ),
            ).then((results) => results.flat())
          : [];

      await emitEvent({
        actorUserId: sub,
        eventType: "gdpr.sar.admin_export",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { requestedBy: sub },
      });

      return reply.send({
        exportedAt: new Date().toISOString(),
        requestedBy: sub,
        subject: { userId },
        user,
        enrolments: enrolmentRows,
        lessonProgress: progressRows,
        policyConsents: consentRows,
        auditEvents: auditRows,
      });
    },
  );

  done();
};
