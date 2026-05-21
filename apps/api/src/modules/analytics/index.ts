import type { FastifyInstance } from "fastify";
import { sql, eq, and } from "drizzle-orm";
import { users, courses } from "../../db/schema/index.js";

export function analyticsPlugin(fastify: FastifyInstance) {
  // ── GET /analytics/overview  (admin only) ─────────────────────────────────
  fastify.get(
    "/analytics/overview",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (request.jwtPayload.role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Users by role
      const usersByRoleRows = await fastify.db
        .select({ role: users.role, count: sql<number>`count(*)::int` })
        .from(users)
        .groupBy(users.role);

      const usersByRole: Record<string, number> = {};
      for (const r of usersByRoleRows) {
        usersByRole[r.role] = r.count;
      }

      const totalUsers = usersByRoleRows.reduce((s, r) => s + r.count, 0);

      // Enrolments by month (last 6 months)
      const enrolmentTrendRows = await fastify.db.execute<{
        month: string;
        count: number;
      }>(sql`
        SELECT to_char(date_trunc('month', enrolled_at), 'YYYY-MM') AS month,
               count(*)::int AS count
        FROM enrolments
        WHERE enrolled_at >= now() - interval '6 months'
        GROUP BY month
        ORDER BY month
      `);

      // Course stats
      const courseStatsRows = await fastify.db.execute<{
        id: string;
        title: string;
        status: string;
        enrolled: number;
        active: number;
        completed: number;
      }>(sql`
        SELECT c.id,
               c.title,
               c.status,
               count(e.id)::int                                              AS enrolled,
               count(e.id) FILTER (WHERE e.status = 'active')::int          AS active,
               count(e.id) FILTER (WHERE e.status = 'completed')::int        AS completed
        FROM courses c
        LEFT JOIN enrolments e ON e.course_id = c.id
        GROUP BY c.id, c.title, c.status
        ORDER BY enrolled DESC
      `);

      const totalEnrolled = courseStatsRows.rows.reduce(
        (s, r) => s + r.enrolled,
        0,
      );
      const totalCompleted = courseStatsRows.rows.reduce(
        (s, r) => s + r.completed,
        0,
      );

      return reply.send({
        totalUsers,
        usersByRole,
        totalCourses: courseStatsRows.rows.length,
        totalEnrolled,
        totalCompleted,
        completionRate:
          totalEnrolled > 0
            ? Math.round((totalCompleted / totalEnrolled) * 100)
            : 0,
        enrolmentTrend: enrolmentTrendRows.rows,
        courseStats: courseStatsRows.rows,
      });
    },
  );

  // ── GET /analytics/courses/:courseId  (instructor or admin) ───────────────
  fastify.get(
    "/analytics/courses/:courseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub: userId } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      if (role === "instructor") {
        const course = await fastify.db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(eq(courses.id, courseId), eq(courses.instructorId, userId)),
          )
          .limit(1);
        if (course.length === 0) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      } else if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Enrolment counts
      const enrolCountRows = await fastify.db.execute<{
        enrolled: number;
        active: number;
        completed: number;
      }>(sql`
        SELECT count(*)::int                                             AS enrolled,
               count(*) FILTER (WHERE status = 'active')::int           AS active,
               count(*) FILTER (WHERE status = 'completed')::int         AS completed
        FROM enrolments
        WHERE course_id = ${courseId}
      `);

      const enrolCounts = enrolCountRows.rows[0] ?? {
        enrolled: 0,
        active: 0,
        completed: 0,
      };

      // Lesson completion funnel
      const funnelRows = await fastify.db.execute<{
        lesson_id: string;
        title: string;
        position: number;
        completed_count: number;
      }>(sql`
        SELECT l.id   AS lesson_id,
               l.title,
               l.position,
               count(lp.id) FILTER (WHERE lp.status = 'completed')::int AS completed_count
        FROM course_modules m
        JOIN lessons l ON l.module_id = m.id
        LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
        WHERE m.course_id = ${courseId}
        GROUP BY l.id, l.title, l.position
        ORDER BY l.position
      `);

      // Quiz stats
      const quizRows = await fastify.db.execute<{
        exercise_id: string;
        title: string;
        max_score: number;
        attempt_count: number;
        avg_score: number;
        pass_count: number;
      }>(sql`
        SELECT ex.id   AS exercise_id,
               ex.title,
               ex.max_score,
               count(qa.id)::int                                           AS attempt_count,
               coalesce(round(avg(qa.score)::numeric, 1), 0)::float        AS avg_score,
               count(qa.id) FILTER (
                 WHERE qa.score::float / nullif(ex.max_score, 0) >= 0.7
               )::int                                                       AS pass_count
        FROM course_modules m
        JOIN lessons l ON l.module_id = m.id
        JOIN exercises ex ON ex.lesson_id = l.id AND ex.type = 'quiz'
        LEFT JOIN quiz_attempts qa ON qa.exercise_id = ex.id
        WHERE m.course_id = ${courseId}
        GROUP BY ex.id, ex.title, ex.max_score
      `);

      // Progress distribution buckets
      const distRows = await fastify.db.execute<{
        bucket: string;
        count: number;
      }>(sql`
        WITH enrol_progress AS (
          SELECT e.id,
                 count(l.id)                                           AS total_lessons,
                 count(lp.id) FILTER (WHERE lp.status = 'completed') AS done
          FROM enrolments e
          JOIN course_modules m ON m.course_id = e.course_id
          JOIN lessons l ON l.module_id = m.id
          LEFT JOIN lesson_progress lp
            ON lp.lesson_id = l.id AND lp.enrolment_id = e.id
          WHERE e.course_id = ${courseId}
          GROUP BY e.id
        ),
        pct AS (
          SELECT CASE
            WHEN total_lessons = 0 THEN 0
            ELSE round(done * 100.0 / total_lessons)
          END AS pct
          FROM enrol_progress
        )
        SELECT CASE
          WHEN pct = 0    THEN '0%'
          WHEN pct <= 25  THEN '1-25%'
          WHEN pct <= 50  THEN '26-50%'
          WHEN pct <= 75  THEN '51-75%'
          WHEN pct < 100  THEN '76-99%'
          ELSE '100%'
        END AS bucket,
        count(*)::int AS count
        FROM pct
        GROUP BY bucket
        ORDER BY bucket
      `);

      return reply.send({
        enrolments: enrolCounts,
        lessonFunnel: funnelRows.rows,
        quizStats: quizRows.rows,
        progressDistribution: distRows.rows,
      });
    },
  );

  // ── GET /analytics/me  (student) ─────────────────────────────────────────
  fastify.get(
    "/analytics/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const progressRows = await fastify.db.execute<{
        enrolment_id: string;
        course_title: string;
        status: string;
        enrolled_at: string;
        total_lessons: number;
        completed_lessons: number;
      }>(sql`
        SELECT e.id    AS enrolment_id,
               c.title AS course_title,
               e.status,
               e.enrolled_at,
               count(l.id)::int                                            AS total_lessons,
               count(lp.id) FILTER (WHERE lp.status = 'completed')::int  AS completed_lessons
        FROM enrolments e
        JOIN courses c ON c.id = e.course_id
        JOIN course_modules m ON m.course_id = c.id
        JOIN lessons l ON l.module_id = m.id
        LEFT JOIN lesson_progress lp
          ON lp.lesson_id = l.id AND lp.enrolment_id = e.id
        WHERE e.student_id = ${userId}
        GROUP BY e.id, c.title, e.status, e.enrolled_at
        ORDER BY e.enrolled_at DESC
      `);

      const quizHistoryRows = await fastify.db.execute<{
        exercise_title: string;
        course_title: string;
        score: number;
        max_score: number;
        passed: boolean;
        completed_at: string;
      }>(sql`
        SELECT ex.title  AS exercise_title,
               c.title   AS course_title,
               qa.score,
               qa.max_score,
               (qa.score::float / nullif(qa.max_score, 0) >= 0.7) AS passed,
               qa.completed_at
        FROM quiz_attempts qa
        JOIN exercises ex ON ex.id = qa.exercise_id
        JOIN lessons l ON l.id = ex.lesson_id
        JOIN course_modules m ON m.id = l.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE qa.student_id = ${userId}
        ORDER BY qa.completed_at DESC
        LIMIT 20
      `);

      const coursesData = progressRows.rows;
      const totalEnrolled = coursesData.length;
      const totalCompleted = coursesData.filter(
        (r) => r.status === "completed",
      ).length;
      const totalLessonsCompleted = coursesData.reduce(
        (s, r) => s + r.completed_lessons,
        0,
      );

      return reply.send({
        totalEnrolled,
        totalCompleted,
        totalLessonsCompleted,
        courseProgress: coursesData.map((r) => ({
          enrolmentId: r.enrolment_id,
          courseTitle: r.course_title,
          status: r.status,
          enrolledAt: r.enrolled_at,
          totalLessons: r.total_lessons,
          completedLessons: r.completed_lessons,
          completionPct:
            r.total_lessons > 0
              ? Math.round((r.completed_lessons / r.total_lessons) * 100)
              : 0,
        })),
        quizHistory: quizHistoryRows.rows.map((r) => ({
          exerciseTitle: r.exercise_title,
          courseTitle: r.course_title,
          score: r.score,
          maxScore: r.max_score,
          passed: r.passed,
          completedAt: r.completed_at,
        })),
      });
    },
  );
}
