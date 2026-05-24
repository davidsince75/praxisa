import type { FastifyInstance } from "fastify";
import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  forumThreads,
  forumReplies,
  enrolments,
  users,
} from "../../db/schema/index.js";
import { createNotification } from "../notifications/service.js";

const threadSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  lessonId: z.string().uuid().optional(),
});

const replySchema = z.object({
  body: z.string().min(1).max(10000),
});

export function forumsPlugin(fastify: FastifyInstance) {
  // ── GET /courses/:courseId/forums ──────────────────────────────────────────
  // List threads for a course. Accessible to enrolled students + instructor + admin.
  fastify.get(
    "/courses/:courseId/forums",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId, role } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      // Verify access: enrolled student, course instructor, or admin
      if (role === "student") {
        const enrolRows = await fastify.db
          .select({ id: enrolments.id })
          .from(enrolments)
          .where(
            and(
              eq(enrolments.courseId, courseId),
              eq(enrolments.studentId, userId),
            ),
          )
          .limit(1);

        if (enrolRows.length === 0) {
          return reply
            .status(403)
            .send({ error: "Vous n'êtes pas inscrit(e) à ce cours" });
        }
      }

      const rows = await fastify.db
        .select({
          id: forumThreads.id,
          courseId: forumThreads.courseId,
          lessonId: forumThreads.lessonId,
          title: forumThreads.title,
          body: forumThreads.body,
          isPinned: forumThreads.isPinned,
          isLocked: forumThreads.isLocked,
          createdAt: forumThreads.createdAt,
          authorId: forumThreads.authorId,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorRole: users.role,
          replyCount: sql<number>`(SELECT count(*) FROM forum_replies WHERE thread_id = ${forumThreads.id})::int`,
        })
        .from(forumThreads)
        .innerJoin(users, eq(users.id, forumThreads.authorId))
        .where(eq(forumThreads.courseId, courseId))
        .orderBy(desc(forumThreads.isPinned), desc(forumThreads.createdAt));

      return reply.send({ threads: rows });
    },
  );

  // ── GET /forums/:threadId ─────────────────────────────────────────────────
  // Get thread detail with all replies.
  fastify.get(
    "/forums/:threadId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string };

      const threadRows = await fastify.db
        .select({
          id: forumThreads.id,
          courseId: forumThreads.courseId,
          lessonId: forumThreads.lessonId,
          title: forumThreads.title,
          body: forumThreads.body,
          isPinned: forumThreads.isPinned,
          isLocked: forumThreads.isLocked,
          createdAt: forumThreads.createdAt,
          authorId: forumThreads.authorId,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorRole: users.role,
        })
        .from(forumThreads)
        .innerJoin(users, eq(users.id, forumThreads.authorId))
        .where(eq(forumThreads.id, threadId))
        .limit(1);

      const thread = threadRows[0];
      if (thread === undefined) {
        return reply
          .status(404)
          .send({ error: "Fil de discussion introuvable" });
      }

      const replies = await fastify.db
        .select({
          id: forumReplies.id,
          body: forumReplies.body,
          createdAt: forumReplies.createdAt,
          authorId: forumReplies.authorId,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorRole: users.role,
        })
        .from(forumReplies)
        .innerJoin(users, eq(users.id, forumReplies.authorId))
        .where(eq(forumReplies.threadId, threadId))
        .orderBy(forumReplies.createdAt);

      return reply.send({ thread, replies });
    },
  );

  // ── POST /courses/:courseId/forums ────────────────────────────────────────
  // Create a new thread.
  fastify.post(
    "/courses/:courseId/forums",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { courseId } = request.params as { courseId: string };

      const parse = threadSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const inserted = await fastify.db
        .insert(forumThreads)
        .values({
          courseId,
          authorId: userId,
          title: parse.data.title,
          body: parse.data.body,
          lessonId: parse.data.lessonId ?? null,
        })
        .returning();

      const thread = inserted[0];
      if (thread === undefined) throw new Error("Insert returned no rows");

      return reply.status(201).send({ thread });
    },
  );

  // ── POST /forums/:threadId/replies ────────────────────────────────────────
  // Add a reply to a thread.
  fastify.post(
    "/forums/:threadId/replies",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { threadId } = request.params as { threadId: string };

      const parse = replySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Check thread exists and is not locked
      const threadRows = await fastify.db
        .select({
          isLocked: forumThreads.isLocked,
          authorId: forumThreads.authorId,
          title: forumThreads.title,
        })
        .from(forumThreads)
        .where(eq(forumThreads.id, threadId))
        .limit(1);

      const thread = threadRows[0];
      if (thread === undefined) {
        return reply
          .status(404)
          .send({ error: "Fil de discussion introuvable" });
      }
      if (thread.isLocked) {
        return reply
          .status(400)
          .send({ error: "Ce fil de discussion est verrouillé" });
      }

      const inserted = await fastify.db
        .insert(forumReplies)
        .values({
          threadId,
          authorId: userId,
          body: parse.data.body,
        })
        .returning();

      // Notify thread author if the replier is different
      if (thread.authorId !== userId) {
        const snippet = parse.data.body.slice(0, 80);
        await createNotification(
          fastify.db,
          thread.authorId,
          "new_message",
          "Nouvelle réponse",
          `Réponse sur "${thread.title}" : ${snippet}`,
          "forum_thread",
          threadId,
        );
      }

      return reply.status(201).send({ reply: inserted[0] });
    },
  );

  // ── PATCH /forums/:threadId/pin ───────────────────────────────────────────
  // Teacher/admin pins/unpins a thread.
  fastify.patch(
    "/forums/:threadId/pin",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { threadId } = request.params as { threadId: string };
      const { isPinned } = request.body as { isPinned: boolean };

      await fastify.db
        .update(forumThreads)
        .set({ isPinned, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));

      return reply.status(204).send();
    },
  );

  // ── PATCH /forums/:threadId/lock ──────────────────────────────────────────
  // Teacher/admin locks/unlocks a thread.
  fastify.patch(
    "/forums/:threadId/lock",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const { threadId } = request.params as { threadId: string };
      const { isLocked } = request.body as { isLocked: boolean };

      await fastify.db
        .update(forumThreads)
        .set({ isLocked, updatedAt: new Date() })
        .where(eq(forumThreads.id, threadId));

      return reply.status(204).send();
    },
  );
}
