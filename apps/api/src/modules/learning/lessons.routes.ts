import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { exercises, lessons } from "../../db/schema/index.js";
import {
  createExerciseSchema,
  createLessonSchema,
  updateExerciseSchema,
  updateLessonSchema,
} from "./types.js";
import {
  canManageCourse,
  findActiveCourse,
  findLesson,
  findModule,
} from "./service.js";

export function lessonsRoutes(fastify: FastifyInstance): void {
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
          contentBody: body.contentBody ?? null,
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
}
