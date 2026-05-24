import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import { users, userPreferences, gdprRequests } from "../../db/schema/index.js";

const profileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Must contain uppercase, lowercase, and number",
    ),
});

const prefsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  locale: z.enum(["fr", "en"]).optional(),
  emailNotifications: z
    .object({
      messages: z.boolean(),
      grading: z.boolean(),
      campaigns: z.boolean(),
      forums: z.boolean(),
    })
    .optional(),
});

export function settingsPlugin(fastify: FastifyInstance) {
  // ── GET /settings/profile ─────────────────────────────────────────────────
  fastify.get(
    "/settings/profile",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const rows = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const user = rows[0];
      if (user === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      return reply.send({ profile: user });
    },
  );

  // ── PATCH /settings/profile ───────────────────────────────────────────────
  fastify.patch(
    "/settings/profile",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const parse = profileSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      await fastify.db
        .update(users)
        .set({
          ...(parse.data.firstName !== undefined
            ? { firstName: parse.data.firstName }
            : {}),
          ...(parse.data.lastName !== undefined
            ? { lastName: parse.data.lastName }
            : {}),
          ...(parse.data.email !== undefined
            ? { email: parse.data.email }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      const updated = await fastify.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return reply.send({ profile: updated[0] });
    },
  );

  // ── POST /settings/password ───────────────────────────────────────────────
  fastify.post(
    "/settings/password",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const parse = passwordSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const rows = await fastify.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const user = rows[0];
      if (user === undefined) {
        return reply.status(404).send({ error: "Utilisateur introuvable" });
      }

      const valid = await verify(user.passwordHash, parse.data.currentPassword);
      if (!valid) {
        return reply
          .status(400)
          .send({ error: "Le mot de passe actuel est incorrect" });
      }

      const newHash = await hash(parse.data.newPassword);
      await fastify.db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return reply.send({ message: "Password updated" });
    },
  );

  // ── GET /settings/preferences ─────────────────────────────────────────────
  fastify.get(
    "/settings/preferences",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const rows = await fastify.db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (rows.length === 0) {
        // Return defaults
        return reply.send({
          preferences: {
            theme: "system",
            locale: "fr",
            emailNotifications: {
              messages: true,
              grading: true,
              campaigns: true,
              forums: true,
            },
          },
        });
      }

      return reply.send({ preferences: rows[0] });
    },
  );

  // ── PATCH /settings/preferences ───────────────────────────────────────────
  fastify.patch(
    "/settings/preferences",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const parse = prefsSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const existing = await fastify.db
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        // Insert
        const inserted = await fastify.db
          .insert(userPreferences)
          .values({
            userId,
            ...parse.data,
          })
          .returning();

        return reply.send({ preferences: inserted[0] });
      }

      // Update
      await fastify.db
        .update(userPreferences)
        .set({ ...parse.data, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId));

      const updated = await fastify.db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return reply.send({ preferences: updated[0] });
    },
  );

  // ── POST /settings/data-export ────────────────────────────────────────────
  // GDPR Art. 15: Subject Access Request — creates a DSR request
  fastify.post(
    "/settings/data-export",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const inserted = await fastify.db
        .insert(gdprRequests)
        .values({
          userId,
          type: "export",
          status: "pending",
        })
        .returning();

      return reply.status(201).send({
        request: inserted[0],
        message: "Data export request submitted",
      });
    },
  );

  // ── POST /settings/data-deletion ──────────────────────────────────────────
  // GDPR Art. 17: Right to Erasure — creates a deletion request
  fastify.post(
    "/settings/data-deletion",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const inserted = await fastify.db
        .insert(gdprRequests)
        .values({
          userId,
          type: "erasure",
          status: "pending",
        })
        .returning();

      return reply.status(201).send({
        request: inserted[0],
        message:
          "Data deletion request submitted. An administrator will review it.",
      });
    },
  );

  // ── POST /settings/account-deletion ───────────────────────────────────────
  // Account closure request — distinct from data deletion
  fastify.post(
    "/settings/account-deletion",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const inserted = await fastify.db
        .insert(gdprRequests)
        .values({
          userId,
          type: "erasure",
          status: "pending",
          notes: "Account deletion requested by user",
        })
        .returning();

      return reply.status(201).send({
        request: inserted[0],
        message: "Account deletion request submitted.",
      });
    },
  );
}
