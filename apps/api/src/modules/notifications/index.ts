import type { FastifyInstance } from "fastify";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { notifications } from "../../db/schema/index.js";

export function notificationsPlugin(fastify: FastifyInstance) {
  // GET /notifications — list for the authenticated user
  fastify.get(
    "/notifications",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const rows = await fastify.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      const unreadRows = await fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(eq(notifications.userId, userId), isNull(notifications.readAt)),
        );

      return reply.send({
        notifications: rows,
        unreadCount: unreadRows[0]?.count ?? 0,
      });
    },
  );

  // PATCH /notifications/:id/read — mark one as read
  fastify.patch(
    "/notifications/:id/read",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id } = request.params as { id: string };

      await fastify.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

      return reply.status(204).send();
    },
  );

  // POST /notifications/read-all — mark all unread as read
  fastify.post(
    "/notifications/read-all",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const result = await fastify.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(eq(notifications.userId, userId), isNull(notifications.readAt)),
        )
        .returning({ id: notifications.id });

      return reply.send({ updated: result.length });
    },
  );
}
