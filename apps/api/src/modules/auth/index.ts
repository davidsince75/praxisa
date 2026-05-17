import fp from "fastify-plugin";
import type {
  DoneFn,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { eq } from "drizzle-orm";
import { emitEvent } from "@praxisa/audit-sdk";
import { users } from "../../db/schema/index.js";
import type { AppConfig } from "../../shared/config.js";
import {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "./service.js";
import {
  loginBodySchema,
  registerBodySchema,
  type AuthResponse,
  type JwtPayload,
} from "./types.js";

interface AuthPluginOptions {
  config: AppConfig;
}

export const authPlugin = fp(
  (fastify: FastifyInstance, opts: AuthPluginOptions, done: DoneFn) => {
    const { config } = opts;

    // ── authenticate preHandler ──────────────────────────────────────────────

    async function authenticate(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        await reply.status(401).send({ error: "Unauthorized" });
        return;
      }
      try {
        request.jwtPayload = await verifyToken(
          authHeader.slice(7),
          config.jwt.publicKey,
        );
      } catch {
        await reply.status(401).send({ error: "Invalid or expired token" });
      }
    }

    fastify.decorate("authenticate", authenticate);

    // ── POST /register ───────────────────────────────────────────────────────

    fastify.post("/register", async (request, reply) => {
      const parse = registerBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const existing = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      const passwordHash = await hashPassword(body.password);

      const returned = await fastify.db
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          role: body.role,
          firstName: body.firstName,
          lastName: body.lastName,
        })
        .returning();

      const user = returned[0];
      if (user === undefined) {
        throw new Error("Insert returned no rows");
      }

      await emitEvent({
        actorUserId: user.id,
        eventType: "auth.register",
        entityType: "user",
        entityId: user.id,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      const token = await signToken(
        { sub: user.id, role: user.role, email: user.email },
        config.jwt.privateKey,
      );

      return reply.status(201).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      } satisfies AuthResponse);
    });

    // ── POST /login ──────────────────────────────────────────────────────────

    fastify.post("/login", async (request, reply) => {
      const parse = loginBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const results = await fastify.db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      const user = results[0];

      // Always run argon2 to prevent email enumeration via timing
      if (user === undefined || !user.isActive || user.deletedAt !== null) {
        await hashPassword(body.password); // constant-time equaliser
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const valid = await verifyPassword(user.passwordHash, body.password);
      if (!valid) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      await fastify.db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      await emitEvent({
        actorUserId: user.id,
        eventType: "auth.login",
        entityType: "user",
        entityId: user.id,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      const token = await signToken(
        { sub: user.id, role: user.role, email: user.email },
        config.jwt.privateKey,
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      } satisfies AuthResponse);
    });

    // ── GET /me ──────────────────────────────────────────────────────────────

    fastify.get(
      "/me",
      { preHandler: [authenticate] },
      async (request, reply) => {
        const results = await fastify.db
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, request.jwtPayload.sub))
          .limit(1);

        const user = results[0];
        if (user === undefined) {
          return reply.status(404).send({ error: "User not found" });
        }

        return reply.send({ user });
      },
    );
    done();
  },
  { name: "auth", dependencies: ["db"] },
);

// ── Fastify type augmentation ──────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    jwtPayload: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
