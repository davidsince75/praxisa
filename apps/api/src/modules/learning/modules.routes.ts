import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { courseModules } from "../../db/schema/index.js";
import {
  createModuleSchema,
  reorderModulesSchema,
  updateModuleSchema,
} from "./types.js";
import { canManageCourse, findActiveCourse, findModule } from "./service.js";

export function modulesRoutes(fastify: FastifyInstance): void {
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
}
