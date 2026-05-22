import type { FastifyInstance } from "fastify";
import { and, eq, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import {
  submissions,
  exercises,
  enrolments,
  courses,
  lessons,
  courseModules,
  users,
} from "../../db/schema/index.js";
import { createNotification } from "../notifications/service.js";

const submitSchema = z.object({
  body: z.string().min(1).max(20000),
  fileUrl: z.string().url().optional(),
});

const gradeSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().min(1).max(5000),
});

export function submissionsPlugin(fastify: FastifyInstance) {
  // ── POST /enrolments/:enrolmentId/exercises/:exerciseId/submit ─────────────
  // Student submits a response to an assignment or reflection exercise.
  fastify.post(
    "/enrolments/:enrolmentId/exercises/:exerciseId/submit",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: studentId, role } = request.jwtPayload;
      const { enrolmentId, exerciseId } = request.params as {
        enrolmentId: string;
        exerciseId: string;
      };

      if (role !== "student" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parse = submitSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Verify enrolment belongs to this student (or admin bypass)
      const enrolRows = await fastify.db
        .select({ id: enrolments.id, studentId: enrolments.studentId })
        .from(enrolments)
        .where(
          and(eq(enrolments.id, enrolmentId), isNull(enrolments.deletedAt)),
        )
        .limit(1);

      const enrol = enrolRows[0];
      if (enrol === undefined) {
        return reply.status(404).send({ error: "Enrolment not found" });
      }
      if (role !== "admin" && enrol.studentId !== studentId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Verify exercise exists and is submittable type
      const exRows = await fastify.db
        .select({ id: exercises.id, type: exercises.type })
        .from(exercises)
        .where(eq(exercises.id, exerciseId))
        .limit(1);

      const exercise = exRows[0];
      if (exercise === undefined) {
        return reply.status(404).send({ error: "Exercise not found" });
      }
      if (exercise.type === "quiz") {
        return reply
          .status(400)
          .send({ error: "Quiz exercises use the quiz endpoint" });
      }

      // One submission per student per exercise — upsert logic: if exists update
      const existing = await fastify.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.exerciseId, exerciseId),
            eq(submissions.enrolmentId, enrolmentId),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0] !== undefined) {
        // Re-submission: reset to submitted, clear grade
        await fastify.db
          .update(submissions)
          .set({
            body: parse.data.body,
            fileUrl: parse.data.fileUrl ?? null,
            status: "submitted",
            score: null,
            feedback: null,
            gradedBy: null,
            gradedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(submissions.id, existing[0].id));

        const updated = await fastify.db
          .select()
          .from(submissions)
          .where(eq(submissions.id, existing[0].id))
          .limit(1);

        return reply.send({ submission: updated[0] });
      }

      const inserted = await fastify.db
        .insert(submissions)
        .values({
          exerciseId,
          enrolmentId,
          studentId: enrol.studentId,
          body: parse.data.body,
          fileUrl: parse.data.fileUrl ?? null,
        })
        .returning();

      const submission = inserted[0];
      if (submission === undefined) throw new Error("Insert returned no rows");

      return reply.status(201).send({ submission });
    },
  );

  // ── GET /enrolments/:enrolmentId/exercises/:exerciseId/submission ──────────
  // Student views their own submission for an exercise.
  fastify.get(
    "/enrolments/:enrolmentId/exercises/:exerciseId/submission",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { enrolmentId, exerciseId } = request.params as {
        enrolmentId: string;
        exerciseId: string;
      };

      const enrolRows = await fastify.db
        .select({ studentId: enrolments.studentId })
        .from(enrolments)
        .where(eq(enrolments.id, enrolmentId))
        .limit(1);

      const enrol = enrolRows[0];
      if (enrol === undefined) {
        return reply.status(404).send({ error: "Enrolment not found" });
      }
      if (role !== "admin" && enrol.studentId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const rows = await fastify.db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.exerciseId, exerciseId),
            eq(submissions.enrolmentId, enrolmentId),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        return reply.status(404).send({ error: "No submission found" });
      }

      return reply.send({ submission: rows[0] });
    },
  );

  // ── GET /courses/:courseId/submissions ─────────────────────────────────────
  // Teacher views all submissions for their course, optionally filtered by
  // status (default: submitted + grading = pending review).
  fastify.get(
    "/courses/:courseId/submissions",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };
      const { status } = request.query as { status?: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Ownership check for instructors
      if (role === "instructor") {
        const courseRows = await fastify.db
          .select({ instructorId: courses.instructorId })
          .from(courses)
          .where(eq(courses.id, courseId))
          .limit(1);

        const course = courseRows[0];
        if (course === undefined) {
          return reply.status(404).send({ error: "Course not found" });
        }
        if (course.instructorId !== actorId) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      // Build query: join submissions → exercises → lessons → modules → course
      const rows = await fastify.db
        .select({
          id: submissions.id,
          status: submissions.status,
          score: submissions.score,
          feedback: submissions.feedback,
          createdAt: submissions.createdAt,
          updatedAt: submissions.updatedAt,
          gradedAt: submissions.gradedAt,
          exerciseId: submissions.exerciseId,
          exerciseTitle: exercises.title,
          exerciseType: exercises.type,
          maxScore: exercises.maxScore,
          enrolmentId: submissions.enrolmentId,
          studentId: submissions.studentId,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .innerJoin(users, eq(users.id, submissions.studentId))
        .where(
          and(
            eq(courseModules.courseId, courseId),
            status !== undefined && status !== ""
              ? eq(
                  submissions.status,
                  status as "submitted" | "grading" | "graded",
                )
              : undefined,
          ),
        )
        .orderBy(desc(submissions.createdAt));

      return reply.send({ submissions: rows });
    },
  );

  // ── GET /submissions/:submissionId ─────────────────────────────────────────
  // View full submission detail including the body text.
  fastify.get(
    "/submissions/:submissionId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { submissionId } = request.params as { submissionId: string };

      const rows = await fastify.db
        .select({
          submission: submissions,
          exerciseTitle: exercises.title,
          exerciseType: exercises.type,
          maxScore: exercises.maxScore,
          courseId: courseModules.courseId,
          instructorId: courses.instructorId,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, courseModules.courseId))
        .where(eq(submissions.id, submissionId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.status(404).send({ error: "Submission not found" });
      }

      // Access: student owns it, or instructor owns the course, or admin
      const isOwner = row.submission.studentId === userId;
      const isInstructor = role === "instructor" && row.instructorId === userId;
      const isAdmin = role === "admin";

      if (!isOwner && !isInstructor && !isAdmin) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return reply.send({
        submission: row.submission,
        exerciseTitle: row.exerciseTitle,
        exerciseType: row.exerciseType,
        maxScore: row.maxScore,
      });
    },
  );

  // ── PATCH /submissions/:submissionId/grade ─────────────────────────────────
  // Teacher grades a submission: sets score, feedback, status → graded.
  fastify.patch(
    "/submissions/:submissionId/grade",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: graderId, role } = request.jwtPayload;
      const { submissionId } = request.params as { submissionId: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parse = gradeSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Load submission + course ownership
      const rows = await fastify.db
        .select({
          id: submissions.id,
          status: submissions.status,
          instructorId: courses.instructorId,
          maxScore: exercises.maxScore,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, courseModules.courseId))
        .where(eq(submissions.id, submissionId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.status(404).send({ error: "Submission not found" });
      }

      if (role === "instructor" && row.instructorId !== graderId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Validate score against maxScore if set
      if (row.maxScore !== null && parse.data.score > row.maxScore) {
        return reply.status(400).send({
          error: `Score ${parse.data.score.toString()} exceeds max score ${row.maxScore.toString()}`,
        });
      }

      await fastify.db
        .update(submissions)
        .set({
          score: parse.data.score,
          feedback: parse.data.feedback,
          status: "graded",
          gradedBy: graderId,
          gradedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId));

      const updated = await fastify.db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submissionId))
        .limit(1);

      if (updated[0] !== undefined) {
        await createNotification(
          fastify.db,
          updated[0].studentId,
          "grading_returned",
          "Travail noté",
          "Votre travail a été évalué.",
          "submission",
          submissionId,
        );
      }

      return reply.send({ submission: updated[0] });
    },
  );

  // ── GET /courses/:courseId/submissions/stats ───────────────────────────────
  // Summary counts by status for the teacher dashboard badge.
  fastify.get(
    "/courses/:courseId/submissions/stats",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: actorId, role } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      if (role === "instructor") {
        const courseRows = await fastify.db
          .select({ instructorId: courses.instructorId })
          .from(courses)
          .where(eq(courses.id, courseId))
          .limit(1);

        if (courseRows[0]?.instructorId !== actorId) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      const rows = await fastify.db
        .select({
          status: submissions.status,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .where(eq(courseModules.courseId, courseId));

      const stats = { submitted: 0, grading: 0, graded: 0 };
      for (const r of rows) {
        stats[r.status] += 1;
      }

      return reply.send({ stats });
    },
  );

  // ── GET /students/:studentId/submissions ──────────────────────────────────
  // All submissions for a specific student — instructor / admin only.
  fastify.get(
    "/students/:studentId/submissions",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      const { studentId } = request.params as { studentId: string };

      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const rows = await fastify.db
        .select({
          id: submissions.id,
          body: submissions.body,
          status: submissions.status,
          score: submissions.score,
          feedback: submissions.feedback,
          createdAt: submissions.createdAt,
          gradedAt: submissions.gradedAt,
          exerciseId: submissions.exerciseId,
          exerciseTitle: exercises.title,
          exerciseType: exercises.type,
          maxScore: exercises.maxScore,
          enrolmentId: submissions.enrolmentId,
          courseTitle: courses.title,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, courseModules.courseId))
        .where(eq(submissions.studentId, studentId))
        .orderBy(desc(submissions.createdAt));

      return reply.send({ submissions: rows });
    },
  );
}
