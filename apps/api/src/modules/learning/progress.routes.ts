import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courses,
  enrolments,
  lessonProgress,
  users,
} from "../../db/schema/index.js";
import { upsertProgressSchema } from "./types.js";
import {
  computeCompletion,
  enrolmentHasFullAccess,
  findActiveEnrolment,
  isLessonWithinModuleLimit,
  isProvisionalEnrolment,
  maybeClearExpiredProvisional,
  readProvisionalUntil,
  TRIAL_MODULE_LIMIT,
  upsertLessonProgress,
} from "./service.js";

export function progressRoutes(fastify: FastifyInstance): void {
  // ═════════════════════════════════════════════════════════════════════════
  // PROGRESS
  // ═════════════════════════════════════════════════════════════════════════

  // GET /enrolments/:enrolmentId/progress
  fastify.get(
    "/enrolments/:enrolmentId/progress",
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

      const progress = await fastify.db
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.enrolmentId, enrolmentId));

      return reply.send({
        progress,
        completionPct: computeCompletion(progress),
      });
    },
  );

  // PUT /enrolments/:enrolmentId/progress/:lessonId
  fastify.put(
    "/enrolments/:enrolmentId/progress/:lessonId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { enrolmentId, lessonId } = request.params as {
        enrolmentId: string;
        lessonId: string;
      };
      const { role, sub } = request.jwtPayload;

      const rawEnrolment = await findActiveEnrolment(fastify.db, enrolmentId);
      if (rawEnrolment === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (role !== "admin" && rawEnrolment.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const provisionalUntilForProgress = await readProvisionalUntil(
        fastify.db,
        rawEnrolment.id,
      );
      const rawWithProvisional = {
        ...rawEnrolment,
        provisionalUntil: provisionalUntilForProgress,
      };
      const cleared = await maybeClearExpiredProvisional(
        fastify.db,
        rawWithProvisional,
      );
      const enrolment = {
        ...rawEnrolment,
        provisionalUntil: cleared.provisionalUntil,
      };

      if (enrolment.status !== "active") {
        return reply.status(409).send({
          error: "Cannot update progress on a non-active enrolment",
        });
      }

      // First-3-modules cap. A paid (or comped) order lifts it entirely;
      // otherwise it applies to a 14-day trial (provisional) enrolment AND to
      // any account an admin has flagged as restricted. Enforced here so the
      // cap holds even if a client bypasses the UI module lock.
      const hasFullAccess = enrolmentHasFullAccess(rawEnrolment);
      let moduleCapped = !hasFullAccess && isProvisionalEnrolment(enrolment);
      let capError =
        "Accès limité aux 3 premiers modules pendant la période d'essai";
      if (!hasFullAccess && !moduleCapped && role !== "admin") {
        const studentRows = await fastify.db
          .select({ isRestricted: users.isRestricted })
          .from(users)
          .where(eq(users.id, rawEnrolment.studentId))
          .limit(1);
        if (studentRows[0]?.isRestricted === true) {
          moduleCapped = true;
          capError =
            "Votre compte est en accès restreint. Accès limité aux 3 premiers modules.";
        }
      }

      if (moduleCapped) {
        const allowed = await isLessonWithinModuleLimit(
          fastify.db,
          enrolment.courseId,
          lessonId,
          TRIAL_MODULE_LIMIT,
        );
        if (!allowed) {
          return reply.status(403).send({ error: capError });
        }
      }

      const parse = upsertProgressSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { status, timeSpentSeconds } = parse.data;

      const progress = await upsertLessonProgress(
        fastify.db,
        enrolmentId,
        lessonId,
        status,
        timeSpentSeconds,
      );

      // Auto-complete enrolment if all lessons are done
      if (status === "completed") {
        const allProgress = await fastify.db
          .select()
          .from(lessonProgress)
          .where(eq(lessonProgress.enrolmentId, enrolmentId));
        if (computeCompletion(allProgress) === 100) {
          await fastify.db
            .update(enrolments)
            .set({
              status: "completed",
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(enrolments.id, enrolmentId));

          await emitEvent({
            actorUserId: sub,
            eventType: "learning.enrolment.completed",
            entityType: "enrolment",
            entityId: enrolmentId,
            dataClassification: "pii:pseudonymous",
            requestId: request.id,
            sourceIp: request.ip,
          });

          // Send course completion email — fire-and-forget
          fastify.db
            .select({
              email: users.email,
              firstName: users.firstName,
            })
            .from(users)
            .where(eq(users.id, enrolment.studentId))
            .limit(1)
            .then((rows) => {
              const student = rows[0];
              if (student) {
                // Fetch course title
                return fastify.db
                  .select({ title: courses.title })
                  .from(courses)
                  .where(eq(courses.id, enrolment.courseId))
                  .limit(1)
                  .then((courseRows) => {
                    const course = courseRows[0];
                    if (course) {
                      return fastify.comms.sendCourseCompletionEmail(
                        {
                          email: student.email,
                          firstName: student.firstName,
                        },
                        course.title,
                      );
                    }
                  });
              }
            })
            .catch((err: unknown) => {
              fastify.log.error(
                { err },
                "Failed to send course completion email",
              );
            });
        }
      }

      return reply.send({ progress });
    },
  );
}
