import type { FastifyInstance } from "fastify";
import { inArray } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { emitEvent } from "@praxisa/audit-sdk";
import { users, courses, enrolments } from "../../db/schema/index.js";

// ── Validation schemas ──────────────────────────────────────────────────────

const importUserRowSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["student", "instructor"]).default("student"),
});

const importUsersSchema = z.object({
  rows: z.array(importUserRowSchema).min(1).max(500),
  defaultPassword: z.string().min(8).max(100).default("Praxisa2024!"),
});

const importEnrolmentRowSchema = z.object({
  studentEmail: z.string().email(),
  courseSlug: z.string().min(1),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  enrolledAt: z.string().optional(),
  completedAt: z.string().optional(),
});

const importEnrolmentsSchema = z.object({
  rows: z.array(importEnrolmentRowSchema).min(1).max(1000),
});

// ── Plugin ──────────────────────────────────────────────────────────────────

export const importPlugin = (
  fastify: FastifyInstance,
  _opts: unknown,
  done: (err?: Error) => void,
) => {
  // ── POST /import/users ──────────────────────────────────────────────────
  fastify.post(
    "/import/users",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = importUsersSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { rows, defaultPassword } = parse.data;

      // Hash the default password once
      const passwordHash = await hash(defaultPassword, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      // Check existing emails
      const emails = rows.map((r) => r.email.toLowerCase());
      const existingRows = await fastify.db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, emails));
      const existingEmails = new Set(existingRows.map((r) => r.email));

      const created: string[] = [];
      const skipped: string[] = [];

      for (const row of rows) {
        const email = row.email.toLowerCase();
        if (existingEmails.has(email)) {
          skipped.push(email);
          continue;
        }

        await fastify.db.insert(users).values({
          email,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          passwordHash,
          isActive: true,
          emailVerified: false,
        });

        created.push(email);
        existingEmails.add(email);
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "import.users.completed",
        entityType: "import",
        entityId: "bulk",
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: {
          created: created.length,
          skipped: skipped.length,
        },
      });

      return reply.send({
        created: created.length,
        skipped: skipped.length,
        skippedEmails: skipped,
      });
    },
  );

  // ── POST /import/enrolments ─────────────────────────────────────────────
  fastify.post(
    "/import/enrolments",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = importEnrolmentsSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { rows } = parse.data;

      // Pre-fetch all referenced users and courses
      const uniqueEmails = [
        ...new Set(rows.map((r) => r.studentEmail.toLowerCase())),
      ];
      const uniqueSlugs = [...new Set(rows.map((r) => r.courseSlug))];

      const userRows = await fastify.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, uniqueEmails));
      const emailToUser = new Map(userRows.map((u) => [u.email, u.id]));

      const courseRows = await fastify.db
        .select({ id: courses.id, slug: courses.slug })
        .from(courses)
        .where(inArray(courses.slug, uniqueSlugs));
      const slugToCourse = new Map(courseRows.map((c) => [c.slug, c.id]));

      const created: number[] = [];
      const errors: { row: number; reason: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row === undefined) continue;

        const studentId = emailToUser.get(row.studentEmail.toLowerCase());
        if (studentId === undefined) {
          errors.push({
            row: i + 1,
            reason: `Student not found: ${row.studentEmail}`,
          });
          continue;
        }

        const courseId = slugToCourse.get(row.courseSlug);
        if (courseId === undefined) {
          errors.push({
            row: i + 1,
            reason: `Course not found: ${row.courseSlug}`,
          });
          continue;
        }

        const enrolledAt = row.enrolledAt
          ? new Date(row.enrolledAt)
          : new Date();
        const completedAt = row.completedAt ? new Date(row.completedAt) : null;

        await fastify.db.insert(enrolments).values({
          studentId,
          courseId,
          status: row.status,
          enrolledBy: sub,
          createdAt: enrolledAt,
          completedAt,
        });

        created.push(i + 1);
      }

      await emitEvent({
        actorUserId: sub,
        eventType: "import.enrolments.completed",
        entityType: "import",
        entityId: "bulk",
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: {
          created: created.length,
          errors: errors.length,
        },
      });

      return reply.send({
        created: created.length,
        errors,
      });
    },
  );

  done();
};
