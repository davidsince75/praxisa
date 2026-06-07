import type { FastifyInstance } from "fastify";
import { and, asc, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import { users } from "../../db/schema/index.js";

// ── Validation schemas ─────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(["admin", "instructor", "student", "migration_lead"]),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a digit"),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "instructor", "student", "migration_lead"]).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

const listUsersQuerySchema = z.object({
  role: z.enum(["admin", "instructor", "student", "migration_lead"]).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ── Plugin ─────────────────────────────────────────────────────────────────────

export const usersPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── GET /users ───────────────────────────────────────────────────────────────

  fastify.get(
    "/users",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const qParse = listUsersQuerySchema.safeParse(request.query);
      if (!qParse.success) {
        return reply.status(400).send({ error: qParse.error.flatten() });
      }
      const { role: filterRole, search, page, limit } = qParse.data;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions = [isNull(users.deletedAt)];
      if (filterRole !== undefined) {
        conditions.push(eq(users.role, filterRole));
      }
      if (search !== undefined && search.length > 0) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(users.email, pattern),
            ilike(users.firstName, pattern),
            ilike(users.lastName, pattern),
          ) ?? sql`true`,
        );
      }

      const where = and(...conditions);

      const [rows, totalRows] = await Promise.all([
        fastify.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            isActive: users.isActive,
            emailVerified: users.emailVerified,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(where)
          .orderBy(asc(users.createdAt))
          .limit(limit)
          .offset(offset),
        fastify.db.select({ n: count() }).from(users).where(where),
      ]);

      const total = totalRows[0]?.n ?? 0;

      // Enrich with provisional enrolment info for admin visibility
      const provisionalMap = new Map<string, Date>();
      try {
        const userIds = rows.map((r) => r.id);
        if (userIds.length > 0) {
          const enrolRows = await fastify.db.execute(
            sql`SELECT DISTINCT student_id, provisional_until 
                FROM enrolments 
                WHERE student_id = ANY(${userIds}::uuid[])
                  AND deleted_at IS NULL
                  AND provisional_until > now()`,
          );
          for (const row of enrolRows.rows as {
            student_id: string;
            provisional_until: Date;
          }[]) {
            provisionalMap.set(row.student_id, row.provisional_until);
          }
        }
      } catch (err: unknown) {
        fastify.log.error(
          { err },
          "Failed to enrich users with provisional info",
        );
      }

      const enriched = rows.map((u) => {
        const prov = provisionalMap.get(u.id);
        return {
          ...u,
          provisionalUntil: prov ?? null,
          isRestricted: prov !== undefined,
        };
      });

      return reply.send({
        users: enriched,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      });
    },
  );

  // ── GET /users/search ────────────────────────────────────────────────────────
  // Lightweight user search for all authenticated users (compose message, etc.)
  fastify.get(
    "/users/search",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: currentId } = request.jwtPayload;
      const { q } = request.query as { q?: string };

      if (q === undefined || q.trim().length < 2) {
        return reply.send({ users: [] });
      }

      const pattern = `%${q.trim()}%`;
      const rows = await fastify.db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.isActive, true),
            sql`${users.id} != ${currentId}`,
            or(
              ilike(users.email, pattern),
              ilike(users.firstName, pattern),
              ilike(users.lastName, pattern),
            ) ?? sql`true`,
          ),
        )
        .orderBy(asc(users.lastName))
        .limit(10);

      return reply.send({ users: rows });
    },
  );

  // ── GET /users/:userId ───────────────────────────────────────────────────────

  fastify.get(
    "/users/:userId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const { userId } = request.params as { userId: string };

      // Admin can view anyone; users can view their own profile
      if (role !== "admin" && sub !== userId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const rows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          emailVerified: users.emailVerified,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

      if (rows[0] === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      return reply.send({ user: rows[0] });
    },
  );

  // ── POST /users ──────────────────────────────────────────────────────────────

  fastify.post(
    "/users",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = createUserSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      // Check for existing email
      const existing = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1);
      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ error: "Cette adresse email est déjà utilisée" });
      }

      const passwordHash = await hash(body.password, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      const returned = await fastify.db
        .insert(users)
        .values({
          email: body.email.toLowerCase(),
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
          passwordHash,
          isActive: body.isActive,
          emailVerified: false,
        })
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
        });

      const user = returned[0];
      if (user === undefined) throw new Error("Insert returned no rows");

      await emitEvent({
        actorUserId: sub,
        eventType: "admin.user.created",
        entityType: "user",
        entityId: user.id,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(201).send({ user });
    },
  );

  // ── PATCH /users/:userId ─────────────────────────────────────────────────────

  fastify.patch(
    "/users/:userId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const { userId } = request.params as { userId: string };

      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const existing = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      if (existing[0] === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      const parse = updateUserSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const updated = await fastify.db
        .update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          emailVerified: users.emailVerified,
          updatedAt: users.updatedAt,
        });

      await emitEvent({
        actorUserId: sub,
        eventType: "admin.user.updated",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ user: updated[0] });
    },
  );

  // ── DELETE /users/:userId (soft) ─────────────────────────────────────────────

  fastify.delete(
    "/users/:userId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      const { userId } = request.params as { userId: string };

      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      if (userId === sub) {
        return reply
          .status(409)
          .send({ error: "Impossible de désactiver votre propre compte" });
      }

      const existing = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);
      if (existing[0] === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      // Anonymize email so the address can be reused for a new account
      const anonymizedEmail = `deleted_${userId}@deleted.invalid`;
      await fastify.db
        .update(users)
        .set({
          email: anonymizedEmail,
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await emitEvent({
        actorUserId: sub,
        eventType: "admin.user.deactivated",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(204).send();
    },
  );

  done();
};
