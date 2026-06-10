import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  courseModules,
  courses,
  enrolments,
  exercises,
  lessonProgress,
  lessons,
  quizAttempts,
  users,
} from "../../db/schema/index.js";
import {
  canManageCourse,
  computeCompletion,
  findActiveCourse,
  isInstructor,
} from "./service.js";

export function instructorRoutes(fastify: FastifyInstance): void {
  // ═════════════════════════════════════════════════════════════════════════
  // INSTRUCTOR VIEWS
  // ═════════════════════════════════════════════════════════════════════════

  // GET /courses/:courseId/students
  // Returns enrolled students with completion % — admin + course instructor
  fastify.get(
    "/courses/:courseId/students",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      // Fetch enrolments with student info
      const rows = await fastify.db
        .select({
          enrolmentId: enrolments.id,
          status: enrolments.status,

          enrolledAt: enrolments.createdAt,
          completedAt: enrolments.completedAt,
          studentId: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(enrolments)
        .innerJoin(users, eq(users.id, enrolments.studentId))
        .where(
          and(eq(enrolments.courseId, courseId), isNull(enrolments.deletedAt)),
        )
        .orderBy(asc(users.lastName), asc(users.firstName));

      // Attach completion % per enrolment
      const withProgress = await Promise.all(
        rows.map(async (row) => {
          const progress = await fastify.db
            .select()
            .from(lessonProgress)
            .where(eq(lessonProgress.enrolmentId, row.enrolmentId));
          return { ...row, completionPct: computeCompletion(progress) };
        }),
      );

      return reply.send({ students: withProgress });
    },
  );

  // GET /courses/:courseId/progress
  // Aggregate progress stats for a course — admin + course instructor
  fastify.get(
    "/courses/:courseId/progress",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const [totals] = await fastify.db
        .select({
          total: count(),
          completed: sql<number>`sum(case when ${enrolments.status} = 'completed' then 1 else 0 end)::int`,
          active: sql<number>`sum(case when ${enrolments.status} = 'active' then 1 else 0 end)::int`,
          cancelled: sql<number>`sum(case when ${enrolments.status} = 'cancelled' then 1 else 0 end)::int`,
        })
        .from(enrolments)
        .where(
          and(eq(enrolments.courseId, courseId), isNull(enrolments.deletedAt)),
        );

      // Lesson-level completion breakdown
      const lessonStats = await fastify.db
        .select({
          lessonId: lessonProgress.lessonId,
          completedCount: count(),
        })
        .from(lessonProgress)
        .innerJoin(
          enrolments,
          and(
            eq(enrolments.id, lessonProgress.enrolmentId),
            eq(enrolments.courseId, courseId),
          ),
        )
        .where(eq(lessonProgress.status, "completed"))
        .groupBy(lessonProgress.lessonId)
        .orderBy(desc(count()));

      return reply.send({
        totals: {
          enrolled: totals?.total ?? 0,
          completed: totals?.completed ?? 0,
          active: totals?.active ?? 0,
          cancelled: totals?.cancelled ?? 0,
        },
        lessonCompletions: lessonStats,
      });
    },
  );

  // GET /students/:studentId/detail
  // Forensic breakdown of a student's entire course history — instructor + admin
  fastify.get(
    "/students/:studentId/detail",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const { role, sub } = request.jwtPayload;

      if (role !== "admin" && role !== "instructor") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      // Get student info
      const studentRows = await fastify.db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1);

      const student = studentRows[0];
      if (student === undefined) {
        return reply.status(404).send({ error: "Student not found" });
      }

      // Get all enrolments for this student
      const enrolmentRows = await fastify.db
        .select({
          enrolmentId: enrolments.id,
          courseId: courses.id,
          courseTitle: courses.title,
          courseSlug: courses.slug,
          status: enrolments.status,
          enrolledAt: enrolments.createdAt,
          completedAt: enrolments.completedAt,
        })
        .from(enrolments)
        .innerJoin(courses, eq(courses.id, enrolments.courseId))
        .where(
          and(
            eq(enrolments.studentId, studentId),
            isNull(enrolments.deletedAt),
          ),
        )
        .orderBy(desc(enrolments.createdAt));

      // Build detailed progress for each enrolment
      const detailed = await Promise.all(
        enrolmentRows.map(async (enrol) => {
          // If instructor, verify they teach this course
          if (role === "instructor") {
            const courseCheck = await findActiveCourse(
              fastify.db,
              enrol.courseId,
            );
            if (courseCheck === undefined || !isInstructor(courseCheck, sub)) {
              return null;
            }
          }

          // Get modules and lessons for the course
          const modulesRows = await fastify.db
            .select()
            .from(courseModules)
            .where(eq(courseModules.courseId, enrol.courseId))
            .orderBy(asc(courseModules.position));

          const moduleIds = modulesRows.map((m) => m.id);
          const lessonsRows =
            moduleIds.length > 0
              ? await fastify.db
                  .select()
                  .from(lessons)
                  .where(inArray(lessons.moduleId, moduleIds))
                  .orderBy(asc(lessons.position))
              : [];

          // Get lesson progress for this enrolment
          const progressRows = await fastify.db
            .select()
            .from(lessonProgress)
            .where(eq(lessonProgress.enrolmentId, enrol.enrolmentId));

          const progressMap = new Map(progressRows.map((p) => [p.lessonId, p]));

          // Build module->lesson tree with progress
          const moduleTree = modulesRows.map((mod) => {
            const modLessons = lessonsRows
              .filter((l) => l.moduleId === mod.id)
              .map((l) => {
                const prog = progressMap.get(l.id);
                return {
                  id: l.id,
                  title: l.title,
                  contentType: l.contentType,
                  durationMinutes: l.durationMinutes,
                  status: prog?.status ?? "not_started",
                  startedAt: prog?.startedAt ?? null,
                  completedAt: prog?.completedAt ?? null,
                  timeSpentSeconds: prog?.timeSpentSeconds ?? 0,
                };
              });
            return {
              id: mod.id,
              title: mod.title,
              position: mod.position,
              lessons: modLessons,
            };
          });

          // Get quiz attempts for this student in this course
          const quizRows = await fastify.db
            .select({
              attemptId: quizAttempts.id,
              exerciseId: quizAttempts.exerciseId,
              exerciseTitle: exercises.title,
              score: quizAttempts.score,
              maxScore: quizAttempts.maxScore,
              completedAt: quizAttempts.completedAt,
            })
            .from(quizAttempts)
            .innerJoin(exercises, eq(exercises.id, quizAttempts.exerciseId))
            .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
            .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
            .where(
              and(
                eq(quizAttempts.studentId, studentId),
                eq(quizAttempts.enrolmentId, enrol.enrolmentId),
                eq(courseModules.courseId, enrol.courseId),
              ),
            )
            .orderBy(desc(quizAttempts.createdAt));

          // Compute completion
          const completionPct = computeCompletion(progressRows);

          // Compute total time spent
          const totalTimeSeconds = progressRows.reduce(
            (sum, p) => sum + p.timeSpentSeconds,
            0,
          );

          return {
            enrolmentId: enrol.enrolmentId,
            courseId: enrol.courseId,
            courseTitle: enrol.courseTitle,
            courseSlug: enrol.courseSlug,
            status: enrol.status,
            enrolledAt: enrol.enrolledAt,
            completedAt: enrol.completedAt,
            completionPct,
            totalTimeSeconds,
            modules: moduleTree,
            quizAttempts: quizRows,
          };
        }),
      );

      // Filter out nulls (courses instructor doesn't teach)
      const enrolmentsResult = detailed.filter(
        (e): e is NonNullable<typeof e> => e !== null,
      );

      return reply.send({
        student,
        enrolments: enrolmentsResult,
      });
    },
  );
}
