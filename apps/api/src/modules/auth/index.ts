import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema/index.js";
import { emitEvent } from "@praxisa/audit-sdk";
import {
  hashPassword,
  verifyPassword,
  signToken,
  signEmailToken,
  verifyEmailToken,
  passwordInvalidationKey,
  resetTokenUsedKey,
  RESET_TOKEN_TTL_SECONDS,
  TOKEN_TTL_SECONDS,
} from "./service.js";
import {
  registerBodySchema,
  loginBodySchema,
  verifyEmailBodySchema,
  resendVerificationBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
} from "./types.js";
import type { AppConfig } from "../../shared/config.js";

interface AuthPluginOptions {
  config: AppConfig;
}

export const authPlugin = (
  fastify: FastifyInstance,
  opts: AuthPluginOptions,
  done: (err?: Error) => void,
): void => {
  const { config } = opts;

  // ── POST /register ───────────────────────────────────────────────────────────

  fastify.post(
    "/register",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
        return reply
          .status(409)
          .send({ error: "Cette adresse email est déjà enregistrée" });
      }

      const passwordHash = await hashPassword(body.password);
      const inserted = await fastify.db
        .insert(users)
        .values({
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          passwordHash,
          // Self-registration is always a student account — staff roles are
          // granted only through the admin users API.
          role: "student",
          // Prospects who sign up themselves start with restricted (trial)
          // access — 1 formation, first 3 modules. An admin lifts the
          // restriction from the users UI to grant full access.
          isRestricted: true,
        })
        .returning();

      const user = inserted[0];
      if (user === undefined) throw new Error("Insert returned no rows");

      await emitEvent({
        actorUserId: user.id,
        eventType: "auth.user.registered",
        entityType: "user",
        entityId: user.id,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      // Send verification email — fire-and-forget (don't fail registration)
      const token = await signEmailToken(
        user.id,
        "email_verify",
        config.jwt.privateKey,
      );
      fastify.comms
        .sendVerificationEmail(
          { email: user.email, firstName: user.firstName },
          token,
        )
        .catch((err: unknown) => {
          fastify.log.error({ err }, "Failed to send verification email");
        });

      const jwtToken = await signToken(
        { sub: user.id, role: user.role, email: user.email },
        config.jwt.privateKey,
      );

      return reply.status(201).send({
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isRestricted: user.isRestricted,
        },
      });
    },
  );

  // ── POST /login ──────────────────────────────────────────────────────────────

  fastify.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = loginBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const body = parse.data;

      const rows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
          isActive: users.isActive,
          isRestricted: users.isRestricted,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      const user = rows[0];

      // Always run argon2 to prevent email enumeration via timing
      const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy";
      const valid = user
        ? await verifyPassword(user.passwordHash, body.password)
        : await verifyPassword(dummyHash, body.password).then(() => false);

      if (!user || !valid) {
        return reply.status(401).send({ error: "Identifiants incorrects" });
      }
      if (!user.isActive) {
        return reply.status(403).send({ error: "Compte désactivé" });
      }

      await fastify.db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      await emitEvent({
        actorUserId: user.id,
        eventType: "auth.user.login",
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
          isRestricted: user.isRestricted,
        },
      });
    },
  );

  // ── GET /me ──────────────────────────────────────────────────────────────────

  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub } = request.jwtPayload;

      const rows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
          emailVerified: users.emailVerified,
          isRestricted: users.isRestricted,
        })
        .from(users)
        .where(eq(users.id, sub))
        .limit(1);

      const user = rows[0];
      if (user === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }
      return reply.send({ user });
    },
  );

  // ── POST /verify-email ───────────────────────────────────────────────────────

  fastify.post(
    "/verify-email",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = verifyEmailBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      let userId: string;
      try {
        ({ userId } = await verifyEmailToken(
          parse.data.token,
          "email_verify",
          config.jwt.publicKey,
        ));
      } catch {
        return reply.status(400).send({ error: "Jeton invalide ou expiré" });
      }

      await fastify.db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, userId));

      await emitEvent({
        actorUserId: userId,
        eventType: "auth.user.email_verified",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ ok: true });
    },
  );

  // ── POST /resend-verification ────────────────────────────────────────────────

  fastify.post(
    "/resend-verification",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = resendVerificationBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const rows = await fastify.db
        .select({
          id: users.id,
          firstName: users.firstName,
          email: users.email,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.email, parse.data.email))
        .limit(1);

      const user = rows[0];

      // Always return 200 to prevent email enumeration
      if (user && !user.emailVerified) {
        const token = await signEmailToken(
          user.id,
          "email_verify",
          config.jwt.privateKey,
        );
        fastify.comms
          .sendVerificationEmail(
            { email: user.email, firstName: user.firstName },
            token,
          )
          .catch((err: unknown) => {
            fastify.log.error({ err }, "Failed to resend verification email");
          });
      }

      return reply.send({ ok: true });
    },
  );

  // ── POST /forgot-password ────────────────────────────────────────────────────

  fastify.post(
    "/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = forgotPasswordBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const rows = await fastify.db
        .select({
          id: users.id,
          firstName: users.firstName,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.email, parse.data.email))
        .limit(1);

      const user = rows[0];

      // Always return 200 to prevent email enumeration
      if (user?.isActive) {
        const token = await signEmailToken(
          user.id,
          "pwd_reset",
          config.jwt.privateKey,
        );
        fastify.comms
          .sendPasswordResetEmail(
            { email: user.email, firstName: user.firstName },
            token,
          )
          .catch((err: unknown) => {
            fastify.log.error({ err }, "Failed to send password reset email");
          });
      }

      return reply.send({ ok: true });
    },
  );

  // ── POST /reset-password ─────────────────────────────────────────────────────

  fastify.post(
    "/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = resetPasswordBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      let userId: string;
      let jti: string | null;
      try {
        ({ userId, jti } = await verifyEmailToken(
          parse.data.token,
          "pwd_reset",
          config.jwt.publicKey,
        ));
      } catch {
        return reply.status(400).send({ error: "Jeton invalide ou expiré" });
      }

      // Single-use: SET NX atomically claims the jti — a second attempt with
      // the same token fails even within its 30-minute validity window.
      if (jti !== null) {
        const claimed = await fastify.redis.set(
          resetTokenUsedKey(jti),
          "1",
          "EX",
          RESET_TOKEN_TTL_SECONDS,
          "NX",
        );
        if (claimed === null) {
          return reply.status(400).send({ error: "Jeton invalide ou expiré" });
        }
      }

      const passwordHash = await hashPassword(parse.data.password);
      await fastify.db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, userId));

      // Invalidate every session JWT issued before this reset. The decorator
      // rejects tokens whose iat is older than this watermark.
      await fastify.redis.set(
        passwordInvalidationKey(userId),
        String(Math.floor(Date.now() / 1000)),
        "EX",
        TOKEN_TTL_SECONDS,
      );

      await emitEvent({
        actorUserId: userId,
        eventType: "auth.user.password_reset",
        entityType: "user",
        entityId: userId,
        dataClassification: "pii:direct",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.send({ ok: true });
    },
  );

  done();
};
