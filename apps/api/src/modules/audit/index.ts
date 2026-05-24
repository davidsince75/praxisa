import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { auditEvents } from "../../db/schema/index.js";

// ── Query schema ───────────────────────────────────────────────────────────────

const auditQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Plugin ─────────────────────────────────────────────────────────────────────

export const auditPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── GET /audit/events ──────────────────────────────────────────────────────
  // Admin-only. Returns a filtered, paginated view of audit_events.
  //
  // Query params (all optional):
  //   actorUserId  — filter to a specific user's actions
  //   entityType   — filter by entity domain (e.g. "user", "migration_batch")
  //   entityId     — filter by specific entity ID
  //   eventType    — filter by event type (e.g. "auth.user.login")
  //   from         — ISO 8601 datetime lower bound (inclusive)
  //   to           — ISO 8601 datetime upper bound (inclusive)
  //   limit        — page size (default 100, max 500)
  //   offset       — pagination offset (default 0)

  fastify.get(
    "/audit/events",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = auditQuerySchema.safeParse(request.query);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const {
        actorUserId,
        entityType,
        entityId,
        eventType,
        from,
        to,
        limit,
        offset,
      } = parse.data;

      const conditions = [];
      if (actorUserId !== undefined)
        conditions.push(eq(auditEvents.actorUserId, actorUserId));
      if (entityType !== undefined)
        conditions.push(eq(auditEvents.entityType, entityType));
      if (entityId !== undefined)
        conditions.push(eq(auditEvents.entityId, entityId));
      if (eventType !== undefined)
        conditions.push(eq(auditEvents.eventType, eventType));
      if (from !== undefined)
        conditions.push(gte(auditEvents.eventAt, new Date(from)));
      if (to !== undefined)
        conditions.push(lte(auditEvents.eventAt, new Date(to)));

      const rows = await fastify.db
        .select({
          id: auditEvents.id,
          eventAt: auditEvents.eventAt,
          actorUserId: auditEvents.actorUserId,
          eventType: auditEvents.eventType,
          entityType: auditEvents.entityType,
          entityId: auditEvents.entityId,
          dataClassification: auditEvents.dataClassification,
          requestId: auditEvents.requestId,
          sourceIp: auditEvents.sourceIp,
          metadata: auditEvents.metadata,
        })
        .from(auditEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.eventAt))
        .limit(limit)
        .offset(offset);

      return reply.send({
        events: rows,
        pagination: { limit, offset, count: rows.length },
      });
    },
  );

  done();
};
