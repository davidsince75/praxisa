import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courses,
  enrolments,
  lessonProgress,
  users,
} from "../../db/schema/index.js";
import { createEnrolmentSchema } from "./types.js";
import {
  computeCompletion,
  enrolmentHasFullAccess,
  findActiveCourse,
  findActiveEnrolment,
  findExistingEnrolment,
  isProvisionalEnrolment,
  maybeClearExpiredProvisional,
  readProvisionalUntil,
  setProvisionalUntil,
} from "./service.js";

export function enrolmentsRoutes(fastify: FastifyInstance): void {
  // ═════════════════════════════════════════════════════════════════════════
  // ENROLMENTS
  // ═════════════════════════════════════════════════════════════════════════

  // POST /enrolments
  fastify.post(
    "/enrolments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;

      const parse = createEnrolmentSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      // Admin can enrol someone else; students and instructors can only self-enrol
      const targetStudentId =
        role === "admin" && body.studentId !== undefined ? body.studentId : sub;

      if (body.studentId !== undefined && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const course = await findActiveCourse(fastify.db, body.courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (role === "student" && course.status !== "published") {
        return reply.status(404).send({ error: "Cours introuvable" });
      }

      const existing = await findExistingEnrolment(
        fastify.db,
        targetStudentId,
        body.courseId,
      );
      if (existing !== undefined) {
        return reply
          .status(409)
          .send({ error: "Student is already enrolled in this course" });
      }

      const isSelfEnrol = role !== "admin" || body.studentId === undefined;
      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

      // Restricted users can only be enrolled in 1 course total
      if (role === "student") {
        const userRows = await fastify.db
          .select({ isRestricted: users.isRestricted })
          .from(users)
          .where(eq(users.id, targetStudentId))
          .limit(1);
        if (userRows[0]?.isRestricted === true) {
          const activeCount = await fastify.db
            .select({ n: count() })
            .from(enrolments)
            .where(
              and(
                eq(enrolments.studentId, targetStudentId),
                isNull(enrolments.deletedAt),
              ),
            );
          if ((activeCount[0]?.n ?? 0) > 0) {
            return reply.status(403).send({
              error:
                "Votre compte est en mode restreint. Vous ne pouvez vous inscrire qu'à une seule formation.",
            });
          }
        }
      }

      // During trial: student can only be enrolled in 1 course at a time.
      // Wrapped in try-catch so enrollment still works even if column is missing.
      if (isSelfEnrol) {
        try {
          const activeEnrolments = await fastify.db
            .select({ id: enrolments.id })
            .from(enrolments)
            .where(
              and(
                eq(enrolments.studentId, targetStudentId),
                isNull(enrolments.deletedAt),
                eq(enrolments.status, "active"),
                sql`"enrolments"."provisional_until" > now()`,
              ),
            )
            .limit(1);
          if (activeEnrolments.length > 0) {
            return reply.status(403).send({
              error:
                "Vous êtes déjà inscrit à un cours en période d'essai. Confirmez votre inscription actuelle pour accéder à d'autres cours.",
            });
          }
        } catch (err: unknown) {
          fastify.log.warn(
            { err },
            "Provisional enrolment check failed — column may not exist yet, skipping check",
          );
        }
      }

      // Insert without provisionalUntil (not in Drizzle schema — set via raw SQL below)
      const returned = await fastify.db
        .insert(enrolments)
        .values({
          studentId: targetStudentId,
          courseId: body.courseId,
          enrolledBy: isSelfEnrol ? null : sub,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .returning();
      const enrolment = returned[0];
      if (enrolment === undefined) throw new Error("Insert returned no rows");

      // Set provisional_until via raw SQL (column may not exist yet — handled gracefully)
      if (isSelfEnrol) {
        const provisionalUntilDate = new Date(Date.now() + FOURTEEN_DAYS_MS);
        await setProvisionalUntil(
          fastify.db,
          enrolment.id,
          provisionalUntilDate,
        );
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.enrolment.created",
        entityType: "enrolment",
        entityId: enrolment.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      // Send enrolment confirmation — fire-and-forget
      fastify.db
        .select({
          email: users.email,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, targetStudentId))
        .limit(1)
        .then((rows) => {
          const student = rows[0];
          if (student) {
            return fastify.comms.sendEnrolmentConfirmation(
              { email: student.email, firstName: student.firstName },
              { id: course.id, title: course.title },
            );
          }
        })
        .catch((err: unknown) => {
          fastify.log.error({ err }, "Failed to send enrolment confirmation");
        });

      return reply.status(201).send({ enrolment });
    },
  );

  // GET /enrolments
  fastify.get(
    "/enrolments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;

      const rows =
        role === "admin"
          ? await fastify.db
              .select()
              .from(enrolments)
              .where(isNull(enrolments.deletedAt))
          : await fastify.db
              .select()
              .from(enrolments)
              .where(
                and(
                  eq(enrolments.studentId, sub),
                  isNull(enrolments.deletedAt),
                ),
              );

      return reply.send({ enrolments: rows });
    },
  );

  // GET /enrolments/:enrolmentId
  fastify.get(
    "/enrolments/:enrolmentId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { enrolmentId } = request.params as { enrolmentId: string };
      const { role, sub } = request.jwtPayload;

      const raw = await findActiveEnrolment(fastify.db, enrolmentId);
      if (raw === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (role !== "admin" && raw.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const provisionalUntilRaw = await readProvisionalUntil(
        fastify.db,
        enrolmentId,
      );
      const enrolmentWithProvisional = {
        ...raw,
        provisionalUntil: provisionalUntilRaw,
      };
      const enrolment = await maybeClearExpiredProvisional(
        fastify.db,
        enrolmentWithProvisional,
      );

      const progress = await fastify.db
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.enrolmentId, enrolmentId));

      const provisional = isProvisionalEnrolment(enrolment);

      return reply.send({
        enrolment: { ...raw, ...enrolment },
        progress,
        completionPct: computeCompletion(progress),
        isProvisional: provisional,
        provisionalUntil: enrolment.provisionalUntil,
        hasFullAccess: enrolmentHasFullAccess(raw),
      });
    },
  );

  // POST /enrolments/:enrolmentId/confirm
  fastify.post(
    "/enrolments/:enrolmentId/confirm",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { enrolmentId } = request.params as { enrolmentId: string };
      const { sub } = request.jwtPayload;

      const enrolment = await findActiveEnrolment(fastify.db, enrolmentId);
      if (enrolment === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (enrolment.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const confirmProvUntil = await readProvisionalUntil(
        fastify.db,
        enrolmentId,
      );
      if (!isProvisionalEnrolment({ provisionalUntil: confirmProvUntil })) {
        return reply
          .status(409)
          .send({ error: "L'inscription n'est pas en période d'essai" });
      }

      const rows = await fastify.db
        .update(enrolments)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(enrolments.id, enrolmentId))
        .returning();

      await setProvisionalUntil(fastify.db, enrolmentId, null);

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.enrolment.confirmed",
        entityType: "enrolment",
        entityId: enrolmentId,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ enrolment: rows[0] });
    },
  );

  // PATCH /enrolments/:enrolmentId/cancel
  fastify.patch(
    "/enrolments/:enrolmentId/cancel",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { enrolmentId } = request.params as { enrolmentId: string };
      const { role, sub } = request.jwtPayload;

      const enrolment = await findActiveEnrolment(fastify.db, enrolmentId);
      if (enrolment === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (role !== "admin" && enrolment.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const updated = await fastify.db
        .update(enrolments)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(enrolments.id, enrolmentId))
        .returning();

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.enrolment.cancelled",
        entityType: "enrolment",
        entityId: enrolmentId,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ enrolment: updated[0] });
    },
  );
  // ═════════════════════════════════════════════════════════════════════════
  // STUDENT: MY ENROLMENTS
  // ═════════════════════════════════════════════════════════════════════════

  // GET /enrolments/my
  // Returns a student's own enrolments with course details + completion %
  // Must be registered BEFORE /enrolments/:enrolmentId to avoid "my" being
  // treated as a UUID param.
  fastify.get(
    "/enrolments/my",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub } = request.jwtPayload;

      const rows = await fastify.db
        .select({
          enrolmentId: enrolments.id,
          status: enrolments.status,
          enrolledAt: enrolments.createdAt,
          completedAt: enrolments.completedAt,
          expiresAt: enrolments.expiresAt,
          paidOrderId: enrolments.paidOrderId,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
          courseDescription: courses.description,
          courseThumbnailUrl: courses.thumbnailUrl,
          courseLanguage: courses.language,
        })
        .from(enrolments)
        .innerJoin(courses, eq(courses.id, enrolments.courseId))
        .where(and(eq(enrolments.studentId, sub), isNull(enrolments.deletedAt)))
        .orderBy(desc(enrolments.createdAt));

      const withProgress = await Promise.all(
        rows.map(async (row) => {
          const provUntil = await readProvisionalUntil(
            fastify.db,
            row.enrolmentId,
          );
          const cleared = await maybeClearExpiredProvisional(fastify.db, {
            id: row.enrolmentId,
            provisionalUntil: provUntil,
          });
          const progress = await fastify.db
            .select()
            .from(lessonProgress)
            .where(eq(lessonProgress.enrolmentId, row.enrolmentId));
          return {
            ...row,
            provisionalUntil: cleared.provisionalUntil,
            isProvisional: isProvisionalEnrolment(cleared),
            hasFullAccess: enrolmentHasFullAccess({
              paidOrderId: row.paidOrderId,
            }),
            completionPct: computeCompletion(progress),
          };
        }),
      );

      return reply.send({ enrolments: withProgress });
    },
  );
}
