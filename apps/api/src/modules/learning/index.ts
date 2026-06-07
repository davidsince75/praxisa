import type { FastifyInstance } from "fastify";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  courseModules,
  courseRatings,
  courses,
  enrolments,
  exercises,
  lessonProgress,
  lessons,
  quizAttempts,
  quizQuestions,
  users,
} from "../../db/schema/index.js";
import {
  createCourseSchema,
  createEnrolmentSchema,
  createExerciseSchema,
  createLessonSchema,
  createModuleSchema,
  reorderModulesSchema,
  updateCourseSchema,
  updateExerciseSchema,
  updateLessonSchema,
  updateModuleSchema,
  upsertProgressSchema,
} from "./types.js";
import {
  computeCompletion,
  findActiveCourse,
  findActiveEnrolment,
  findExistingEnrolment,
  findLesson,
  findModule,
  isInstructor,
  isProvisionalEnrolment,
  maybeClearExpiredProvisional,
  readProvisionalUntil,
  setProvisionalUntil,
  upsertLessonProgress,
} from "./service.js";

export const learningPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── Helpers ──────────────────────────────────────────────────────────────

  function canManageCourse(
    course: { instructorId: string | null },
    userId: string,
    role: string,
  ): boolean {
    return role === "admin" || isInstructor(course, userId);
  }

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

  // ═════════════════════════════════════════════════════════════════════════
  // MODULES
  // ═════════════════════════════════════════════════════════════════════════

  // POST /courses/:courseId/modules
  fastify.post(
    "/courses/:courseId/modules",
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

      const parse = createModuleSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const returned = await fastify.db
        .insert(courseModules)
        .values({ courseId, ...body, description: body.description ?? null })
        .returning();

      return reply.status(201).send({ module: returned[0] });
    },
  );

  // PATCH /courses/:courseId/modules/:moduleId
  fastify.patch(
    "/courses/:courseId/modules/:moduleId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId } = request.params as {
        courseId: string;
        moduleId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const mod = await findModule(fastify.db, moduleId, courseId);
      if (mod === undefined) {
        return reply.status(404).send({ error: "Module not found" });
      }

      const parse = updateModuleSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const updated = await fastify.db
        .update(courseModules)
        .set({ ...parse.data, updatedAt: new Date() })
        .where(eq(courseModules.id, moduleId))
        .returning();

      return reply.send({ module: updated[0] });
    },
  );

  // PUT /courses/:courseId/modules/reorder
  fastify.put(
    "/courses/:courseId/modules/reorder",
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

      const parse = reorderModulesSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      await Promise.all(
        parse.data.order.map(({ id, position }) =>
          fastify.db
            .update(courseModules)
            .set({ position, updatedAt: new Date() })
            .where(
              and(
                eq(courseModules.id, id),
                eq(courseModules.courseId, courseId),
              ),
            ),
        ),
      );

      return reply.status(204).send();
    },
  );

  // DELETE /courses/:courseId/modules/:moduleId
  fastify.delete(
    "/courses/:courseId/modules/:moduleId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId } = request.params as {
        courseId: string;
        moduleId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const mod = await findModule(fastify.db, moduleId, courseId);
      if (mod === undefined) {
        return reply.status(404).send({ error: "Module not found" });
      }

      await fastify.db
        .delete(courseModules)
        .where(eq(courseModules.id, moduleId));

      return reply.status(204).send();
    },
  );

  // ═════════════════════════════════════════════════════════════════════════
  // LESSONS
  // ═════════════════════════════════════════════════════════════════════════

  // POST /courses/:courseId/modules/:moduleId/lessons
  fastify.post(
    "/courses/:courseId/modules/:moduleId/lessons",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId } = request.params as {
        courseId: string;
        moduleId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const mod = await findModule(fastify.db, moduleId, courseId);
      if (mod === undefined) {
        return reply.status(404).send({ error: "Module not found" });
      }

      const parse = createLessonSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const returned = await fastify.db
        .insert(lessons)
        .values({
          moduleId,
          title: body.title,
          description: body.description ?? null,
          position: body.position,
          contentType: body.contentType,
          contentUrl: body.contentUrl ?? null,
          durationMinutes: body.durationMinutes ?? null,
          isFreePreview: body.isFreePreview,
        })
        .returning();

      return reply.status(201).send({ lesson: returned[0] });
    },
  );

  // PATCH /courses/:courseId/modules/:moduleId/lessons/:lessonId
  fastify.patch(
    "/courses/:courseId/modules/:moduleId/lessons/:lessonId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId, lessonId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const lesson = await findLesson(fastify.db, lessonId, moduleId);
      if (lesson === undefined) {
        return reply.status(404).send({ error: "Lesson not found" });
      }

      const parse = updateLessonSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const updated = await fastify.db
        .update(lessons)
        .set({ ...parse.data, updatedAt: new Date() })
        .where(eq(lessons.id, lessonId))
        .returning();

      return reply.send({ lesson: updated[0] });
    },
  );

  // DELETE /courses/:courseId/modules/:moduleId/lessons/:lessonId
  fastify.delete(
    "/courses/:courseId/modules/:moduleId/lessons/:lessonId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId, lessonId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const lesson = await findLesson(fastify.db, lessonId, moduleId);
      if (lesson === undefined) {
        return reply.status(404).send({ error: "Lesson not found" });
      }

      await fastify.db.delete(lessons).where(eq(lessons.id, lessonId));
      return reply.status(204).send();
    },
  );

  // ═════════════════════════════════════════════════════════════════════════
  // EXERCISES
  // ═════════════════════════════════════════════════════════════════════════

  // POST /courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises
  fastify.post(
    "/courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId, lessonId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const lesson = await findLesson(fastify.db, lessonId, moduleId);
      if (lesson === undefined) {
        return reply.status(404).send({ error: "Lesson not found" });
      }

      const parse = createExerciseSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const returned = await fastify.db
        .insert(exercises)
        .values({
          lessonId,
          title: body.title,
          description: body.description ?? null,
          position: body.position,
          type: body.type,
          maxScore: body.maxScore ?? null,
          isRequired: body.isRequired,
          dueAt:
            body.dueAt !== undefined && body.dueAt !== null
              ? new Date(body.dueAt)
              : null,
        })
        .returning();

      return reply.status(201).send({ exercise: returned[0] });
    },
  );

  // PATCH /courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises/:exerciseId
  fastify.patch(
    "/courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises/:exerciseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId, lessonId, exerciseId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
        exerciseId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const lesson = await findLesson(fastify.db, lessonId, moduleId);
      if (lesson === undefined) {
        return reply.status(404).send({ error: "Lesson not found" });
      }

      const parse = updateExerciseSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const setData: Record<string, unknown> = {
        ...parse.data,
        updatedAt: new Date(),
      };
      if ("dueAt" in parse.data) {
        setData["dueAt"] =
          parse.data.dueAt !== undefined && parse.data.dueAt !== null
            ? new Date(parse.data.dueAt)
            : null;
      }

      const updated = await fastify.db
        .update(exercises)
        .set(setData)
        .where(
          and(eq(exercises.id, exerciseId), eq(exercises.lessonId, lessonId)),
        )
        .returning();

      if (updated[0] === undefined) {
        return reply.status(404).send({ error: "Exercice introuvable" });
      }

      return reply.send({ exercise: updated[0] });
    },
  );

  // DELETE /courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises/:exerciseId
  fastify.delete(
    "/courses/:courseId/modules/:moduleId/lessons/:lessonId/exercises/:exerciseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { courseId, moduleId, lessonId, exerciseId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
        exerciseId: string;
      };
      const { role, sub } = request.jwtPayload;

      const course = await findActiveCourse(fastify.db, courseId);
      if (course === undefined) {
        return reply.status(404).send({ error: "Cours introuvable" });
      }
      if (!canManageCourse(course, sub, role)) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const lesson = await findLesson(fastify.db, lessonId, moduleId);
      if (lesson === undefined) {
        return reply.status(404).send({ error: "Lesson not found" });
      }

      await fastify.db
        .delete(exercises)
        .where(
          and(eq(exercises.id, exerciseId), eq(exercises.lessonId, lessonId)),
        );

      return reply.status(204).send();
    },
  );

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

      // Provisional: restrict to first 3 modules only
      if (isProvisionalEnrolment(enrolment)) {
        const PROVISIONAL_MODULE_LIMIT = 3;

        const lessonRow = await fastify.db
          .select({ moduleId: lessons.moduleId })
          .from(lessons)
          .where(eq(lessons.id, lessonId))
          .limit(1);

        if (lessonRow[0] !== undefined) {
          const allowedModules = await fastify.db
            .select({ id: courseModules.id })
            .from(courseModules)
            .where(eq(courseModules.courseId, enrolment.courseId))
            .orderBy(asc(courseModules.position))
            .limit(PROVISIONAL_MODULE_LIMIT);

          const allowedIds = new Set(allowedModules.map((m) => m.id));

          if (!allowedIds.has(lessonRow[0].moduleId)) {
            return reply.status(403).send({
              error:
                "Accès limité aux 3 premiers modules pendant la période d'essai",
            });
          }
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
            completionPct: computeCompletion(progress),
          };
        }),
      );

      return reply.send({ enrolments: withProgress });
    },
  );

  // ═════════════════════════════════════════════════════════════════════════
  // QUIZ SUBMISSION
  // ═════════════════════════════════════════════════════════════════════════

  // POST /exercises/:exerciseId/attempt
  // Submit a quiz attempt; calculates score, stores result, marks lesson progress
  fastify.post(
    "/exercises/:exerciseId/attempt",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId } = request.params as { exerciseId: string };
      const { sub, role } = request.jwtPayload;

      const attemptSchema = z.object({
        enrolmentId: z.string().uuid(),
        // { [questionId]: selectedOptionId }
        answers: z.record(z.string(), z.string()),
      });

      const parse = attemptSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { enrolmentId, answers } = parse.data;

      // Verify enrolment ownership
      const enrolment = await findActiveEnrolment(fastify.db, enrolmentId);
      if (enrolment === undefined) {
        return reply.status(404).send({ error: "Inscription introuvable" });
      }
      if (role !== "admin" && enrolment.studentId !== sub) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      // Fetch exercise
      const exerciseRows = await fastify.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, exerciseId))
        .limit(1);
      const exercise = exerciseRows[0];
      if (exercise === undefined) {
        return reply.status(404).send({ error: "Exercice introuvable" });
      }
      if (exercise.type !== "quiz") {
        return reply.status(400).send({ error: "Exercise is not a quiz" });
      }

      // Fetch questions and grade
      const questions = await fastify.db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.exerciseId, exerciseId))
        .orderBy(asc(quizQuestions.position));

      let score = 0;
      const maxScore = questions.length;
      const feedback: {
        questionId: string;
        correct: boolean;
        correctOptionId: string;
        explanation: string | null;
      }[] = [];

      for (const q of questions) {
        const selected = answers[q.id];
        const correct = selected === q.correctOptionId;
        if (correct) score += 1;
        feedback.push({
          questionId: q.id,
          correct,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation ?? null,
        });
      }

      // Persist attempt
      const attemptReturned = await fastify.db
        .insert(quizAttempts)
        .values({
          exerciseId,
          studentId: sub,
          enrolmentId,
          answers: JSON.stringify(answers),
          score,
          maxScore,
          completedAt: new Date(),
        })
        .returning();
      const attempt = attemptReturned[0];
      if (attempt === undefined) throw new Error("Insert returned no rows");

      // Mark the parent lesson as completed if passed (≥ 70%)
      const passed = maxScore === 0 || score / maxScore >= 0.7;
      if (passed) {
        await upsertLessonProgress(
          fastify.db,
          enrolmentId,
          exercise.lessonId,
          "completed",
          0,
        );
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "learning.quiz.attempted",
        entityType: "quiz_attempt",
        entityId: attempt.id,
        dataClassification: "pii:pseudonymous",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({
        attempt: {
          id: attempt.id,
          score,
          maxScore,
          passed,
          completedAt: attempt.completedAt,
        },
        feedback,
      });
    },
  );

  // ═════════════════════════════════════════════════════════════════════════
  // EXERCISES
  // ═════════════════════════════════════════════════════════════════════════

  // GET /exercises/:exerciseId
  // Returns exercise details with quiz questions.
  // correctOptionId is stripped for non-admin roles.
  fastify.get(
    "/exercises/:exerciseId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { exerciseId } = request.params as { exerciseId: string };
      const { role } = request.jwtPayload;

      const exerciseRows = await fastify.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, exerciseId))
        .limit(1);
      const exercise = exerciseRows[0];
      if (exercise === undefined) {
        return reply.status(404).send({ error: "Exercice introuvable" });
      }

      const questions = await fastify.db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.exerciseId, exerciseId))
        .orderBy(asc(quizQuestions.position));

      const sanitised = questions.map((q) => ({
        id: q.id,
        position: q.position,
        questionText: q.questionText,
        options: JSON.parse(q.options) as { id: string; text: string }[],
        explanation: q.explanation,
        // Only admins see the answer key
        ...(role === "admin" ? { correctOptionId: q.correctOptionId } : {}),
      }));

      return reply.send({ exercise, questions: sanitised });
    },
  );

  done();
};
