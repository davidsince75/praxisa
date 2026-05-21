import type { FastifyInstance } from "fastify";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courses,
  enrolments,
  lessons,
  courseModules,
  lessonProgress,
  users,
} from "../../db/schema/index.js";

const teacherEnrolSchema = z.object({
  email: z.string().email(),
});

export function certificatesPlugin(fastify: FastifyInstance) {
  // ── GET /enrolments/:enrolmentId/certificate ──────────────────────────────
  // Returns certificate data for a completed enrolment.
  // Only accessible by the enrolled student or an admin.
  fastify.get(
    "/enrolments/:enrolmentId/certificate",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { enrolmentId } = request.params as { enrolmentId: string };

      const rows = await fastify.db
        .select({
          enrolmentId: enrolments.id,
          studentId: enrolments.studentId,
          status: enrolments.status,
          completedAt: enrolments.completedAt,
          courseTitle: courses.title,
          courseId: courses.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(enrolments)
        .innerJoin(courses, eq(courses.id, enrolments.courseId))
        .innerJoin(users, eq(users.id, enrolments.studentId))
        .where(
          and(eq(enrolments.id, enrolmentId), isNull(enrolments.deletedAt)),
        )
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.status(404).send({ error: "Enrolment not found" });
      }

      // Access control: only the student themselves or an admin
      if (role !== "admin" && row.studentId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      if (row.status !== "completed") {
        return reply
          .status(400)
          .send({ error: "Course not yet completed", status: row.status });
      }

      return reply.send({
        certificate: {
          enrolmentId: row.enrolmentId,
          studentName: `${row.firstName} ${row.lastName}`,
          courseTitle: row.courseTitle,
          courseId: row.courseId,
          completedAt: row.completedAt,
          issuedAt: new Date().toISOString(),
        },
      });
    },
  );

  // ── POST /courses/:courseId/teacher-enrol ─────────────────────────────────
  // Instructor or admin enrols a student by email.
  fastify.post(
    "/courses/:courseId/teacher-enrol",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parse = teacherEnrolSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Load course + check ownership
      const courseRows = await fastify.db
        .select({
          id: courses.id,
          title: courses.title,
          instructorId: courses.instructorId,
          status: courses.status,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      const course = courseRows[0];
      if (course === undefined) {
        return reply.status(404).send({ error: "Course not found" });
      }

      if (role === "instructor" && course.instructorId !== actorId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Find student by email
      const studentRows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users)
        .where(
          and(eq(users.email, parse.data.email), eq(users.role, "student")),
        )
        .limit(1);

      const student = studentRows[0];
      if (student === undefined) {
        return reply
          .status(404)
          .send({ error: "No student account found for that email" });
      }

      // Check for existing active enrolment
      const existingRows = await fastify.db
        .select({ id: enrolments.id })
        .from(enrolments)
        .where(
          and(
            eq(enrolments.studentId, student.id),
            eq(enrolments.courseId, courseId),
            isNull(enrolments.deletedAt),
          ),
        )
        .limit(1);

      if (existingRows.length > 0) {
        return reply
          .status(409)
          .send({ error: "Student is already enrolled in this course" });
      }

      const returned = await fastify.db
        .insert(enrolments)
        .values({
          studentId: student.id,
          courseId,
          enrolledBy: actorId,
        })
        .returning();

      const enrolment = returned[0];
      if (enrolment === undefined) throw new Error("Insert returned no rows");

      await emitEvent({
        actorUserId: actorId,
        eventType: "learning.enrolment.created",
        entityType: "enrolment",
        entityId: enrolment.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      // Fire-and-forget confirmation email
      fastify.comms
        .sendEnrolmentConfirmation(
          { email: student.email, firstName: student.firstName },
          { id: course.id, title: course.title },
        )
        .catch((err: unknown) => {
          fastify.log.error({ err }, "Failed to send enrolment confirmation");
        });

      return reply.status(201).send({ enrolment });
    },
  );

  // ── DELETE /enrolments/:enrolmentId ───────────────────────────────────────
  // Instructor who owns the course, or admin, can remove an enrolment.
  fastify.delete(
    "/enrolments/:enrolmentId/remove",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      const { enrolmentId } = request.params as { enrolmentId: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Load enrolment + course
      const rows = await fastify.db
        .select({
          id: enrolments.id,
          courseId: enrolments.courseId,
          instructorId: courses.instructorId,
        })
        .from(enrolments)
        .innerJoin(courses, eq(courses.id, enrolments.courseId))
        .where(
          and(eq(enrolments.id, enrolmentId), isNull(enrolments.deletedAt)),
        )
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.status(404).send({ error: "Enrolment not found" });
      }

      if (role === "instructor" && row.instructorId !== actorId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      await fastify.db
        .update(enrolments)
        .set({ deletedAt: new Date(), status: "cancelled" })
        .where(eq(enrolments.id, enrolmentId));

      await emitEvent({
        actorUserId: actorId,
        eventType: "learning.enrolment.removed",
        entityType: "enrolment",
        entityId: enrolmentId,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(204).send();
    },
  );

  // ── GET /courses/:courseId/lesson-count ───────────────────────────────────
  // Returns total lesson count for a course (used for completion check).
  fastify.get(
    "/courses/:courseId/lesson-count",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };

      const rows = await fastify.db
        .select({ total: sql<number>`count(${lessons.id})::int` })
        .from(lessons)
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .where(eq(courseModules.courseId, courseId));

      return reply.send({ total: rows[0]?.total ?? 0 });
    },
  );

  // ── GET /enrolments/:enrolmentId/completion ───────────────────────────────
  // Returns completion percentage for an enrolment (used by certificate page).
  fastify.get(
    "/enrolments/:enrolmentId/completion",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { enrolmentId } = request.params as { enrolmentId: string };

      const enrolRows = await fastify.db
        .select({
          studentId: enrolments.studentId,
          courseId: enrolments.courseId,
        })
        .from(enrolments)
        .where(
          and(eq(enrolments.id, enrolmentId), isNull(enrolments.deletedAt)),
        )
        .limit(1);

      const enrol = enrolRows[0];
      if (enrol === undefined) {
        return reply.status(404).send({ error: "Enrolment not found" });
      }

      if (role !== "admin" && enrol.studentId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const totalRows = await fastify.db
        .select({ total: sql<number>`count(${lessons.id})::int` })
        .from(lessons)
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .where(eq(courseModules.courseId, enrol.courseId));

      const total = totalRows[0]?.total ?? 0;

      const doneRows = await fastify.db
        .select({ done: sql<number>`count(${lessonProgress.id})::int` })
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrolmentId, enrolmentId),
            eq(lessonProgress.status, "completed"),
          ),
        );

      const done = doneRows[0]?.done ?? 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      return reply.send({ total, done, pct });
    },
  );
}
