import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courseModules,
  courseRatings,
  courses,
  exercises,
  lessons,
  users,
} from "../../db/schema/index.js";
import { createCourseSchema, updateCourseSchema } from "./types.js";
import { canManageCourse, findActiveCourse } from "./service.js";

export function coursesRoutes(fastify: FastifyInstance): void {
  // ═════════════════════════════════════════════════════════════════════════
  // COURSES
  // ═════════════════════════════════════════════════════════════════════════

  // GET /courses
  fastify.get(
    "/courses",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      const rows =
        role === "admin" || role === "instructor"
          ? await fastify.db
              .select()
              .from(courses)
              .where(isNull(courses.deletedAt))
              .orderBy(asc(courses.createdAt))
          : await fastify.db
              .select()
              .from(courses)
              .where(
                and(isNull(courses.deletedAt), eq(courses.status, "published")),
              )
              .orderBy(asc(courses.createdAt));

      // Enrich with instructor names
      const instructorIds = [
        ...new Set(
          rows
            .map((r) => r.instructorId)
            .filter((id): id is string => id !== null),
        ),
      ];
      const instructorMap = new Map<string, string>();
      if (instructorIds.length > 0) {
        const instructorRows = await fastify.db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, instructorIds));
        for (const i of instructorRows) {
          instructorMap.set(i.id, `${i.firstName} ${i.lastName}`);
        }
      }

      // Enrich with average ratings
      const courseIds = rows.map((r) => r.id);
      const ratingMap = new Map<string, { avg: number; count: number }>();
      if (courseIds.length > 0) {
        const ratingRows = await fastify.db
          .select({
            courseId: courseRatings.courseId,
            avg: sql<string>`coalesce(round(avg(${courseRatings.rating})::numeric, 1), 0)`,
            cnt: sql<number>`count(*)::int`,
          })
          .from(courseRatings)
          .where(inArray(courseRatings.courseId, courseIds))
          .groupBy(courseRatings.courseId);
        for (const r of ratingRows) {
          ratingMap.set(r.courseId, {
            avg: parseFloat(r.avg),
            count: r.cnt,
          });
        }
      }

      const enriched = rows.map((c) => ({
        ...c,
        instructorName:
          c.instructorId !== null
            ? (instructorMap.get(c.instructorId) ?? null)
            : null,
        averageRating: ratingMap.get(c.id)?.avg ?? 0,
        totalRatings: ratingMap.get(c.id)?.count ?? 0,
      }));

      return reply.send({ courses: enriched });
    },
  );

  // POST /courses
  fastify.post(
    "/courses",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin" && role !== "instructor") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = createCourseSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const existing = await fastify.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.slug, body.slug))
        .limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: "Slug already in use" });
      }

      const instructorId =
        body.instructorId ?? (role === "instructor" ? sub : null);
      const returned = await fastify.db
        .insert(courses)
        .values({
          slug: body.slug,
          title: body.title,
          description: body.description ?? null,
          instructorId: instructorId ?? null,
          language: body.language,
          thumbnailUrl: body.thumbnailUrl ?? null,
        })
        .returning();
      const course = returned[0];
      if (course === undefined) throw new Error("Insert returned no rows");

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.course.created",
        entityType: "course",
        entityId: course.id,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({ course });
    },
  );

  // GET /courses/:courseId
  fastify.get(
    "/courses/:courseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      const { role } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (role === "student" && course.status !== "published") {
        return reply.status(404).send({ error: "Cours introuvable" });
      }

      const mods = await fastify.db
        .select()
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId))
        .orderBy(asc(courseModules.position));

      // Fetch lessons per module
      const lessonsByModule: Record<string, (typeof lessons.$inferSelect)[]> =
        {};
      for (const mod of mods) {
        const ls = await fastify.db
          .select()
          .from(lessons)
          .where(eq(lessons.moduleId, mod.id))
          .orderBy(asc(lessons.position));
        lessonsByModule[mod.id] = ls;
      }

      // Collect all lesson ids and fetch their exercises in one pass
      const allLessons = Object.values(lessonsByModule).flat();
      const exercisesByLesson: Record<
        string,
        {
          id: string;
          title: string;
          type: string;
          position: number;
          dueAt: Date | null;
        }[]
      > = {};
      for (const les of allLessons) {
        const exs = await fastify.db
          .select({
            id: exercises.id,
            title: exercises.title,
            type: exercises.type,
            position: exercises.position,
            dueAt: exercises.dueAt,
          })
          .from(exercises)
          .where(eq(exercises.lessonId, les.id))
          .orderBy(asc(exercises.position));
        exercisesByLesson[les.id] = exs;
      }

      const tree = mods.map((mod) => ({
        ...mod,
        lessons: (lessonsByModule[mod.id] ?? []).map((l) => ({
          ...l,
          exercises: exercisesByLesson[l.id] ?? [],
        })),
      }));

      return reply.send({ course: { ...course, modules: tree } });
    },
  );

  // PATCH /courses/:courseId
  fastify.patch(
    "/courses/:courseId",
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

      const parse = updateCourseSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      if (body.slug !== undefined) {
        const conflict = await fastify.db
          .select({ id: courses.id })
          .from(courses)
          .where(and(eq(courses.slug, body.slug), ne(courses.id, courseId)))
          .limit(1);
        if (conflict.length > 0) {
          return reply.status(409).send({ error: "Slug already in use" });
        }
      }

      const updated = await fastify.db
        .update(courses)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(courses.id, courseId))
        .returning();

      return reply.send({ course: updated[0] });
    },
  );

  // POST /courses/:courseId/publish
  fastify.post(
    "/courses/:courseId/publish",
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
      if (course.status === "published") {
        return reply.status(409).send({ error: "Course is already published" });
      }

      const updated = await fastify.db
        .update(courses)
        .set({
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(courses.id, courseId))
        .returning();

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.course.published",
        entityType: "course",
        entityId: courseId,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ course: updated[0] });
    },
  );

  // DELETE /courses/:courseId
  fastify.delete(
    "/courses/:courseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId } = request.params as { courseId: string };
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }

      await fastify.db
        .update(courses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(courses.id, courseId));

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.course.deleted",
        entityType: "course",
        entityId: courseId,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(204).send();
    },
  );
}
