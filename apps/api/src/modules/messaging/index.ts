import type { FastifyInstance } from "fastify";
import { and, eq, or, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { messageThreads, messages, users, enrolments, courses } from "../../db/schema/index.js";

const createThreadSchema = z.object({
  recipientId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  body: z.string().min(1).max(4000),
});

const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export function messagingPlugin(fastify: FastifyInstance) {
  // ── GET /messages/threads ─────────────────────────────────────────────────
  // List all threads for the current user, newest-first, with last message
  // preview and unread count.
  fastify.get(
    "/messages/threads",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      // Fetch threads where user is either participant
      const threadRows = await fastify.db
        .select({
          id: messageThreads.id,
          participantA: messageThreads.participantA,
          participantB: messageThreads.participantB,
          courseId: messageThreads.courseId,
          updatedAt: messageThreads.updatedAt,
        })
        .from(messageThreads)
        .where(
          or(
            eq(messageThreads.participantA, userId),
            eq(messageThreads.participantB, userId),
          ),
        )
        .orderBy(sql`${messageThreads.updatedAt} DESC`);

      if (threadRows.length === 0) {
        return reply.send({ threads: [] });
      }

      const threadIds = threadRows.map((t) => t.id);

      // Collect other-participant IDs
      const otherIds = threadRows.map((t) =>
        t.participantA === userId ? t.participantB : t.participantA,
      );

      // Load other participants
      const uniqueOtherIds = [...new Set(otherIds)];
      const participantRows = await fastify.db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        })
        .from(users)
        .where(
          uniqueOtherIds.length === 1
            ? eq(users.id, uniqueOtherIds[0]!)
            : sql`${users.id} = ANY(ARRAY[${sql.join(
                uniqueOtherIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )}])`,
        );

      const participantMap = new Map(participantRows.map((p) => [p.id, p]));

      // For each thread: last message + unread count via subqueries
      const enriched = await Promise.all(
        threadRows.map(async (thread) => {
          const otherId =
            thread.participantA === userId
              ? thread.participantB
              : thread.participantA;

          const lastMsgRows = await fastify.db
            .select({
              id: messages.id,
              body: messages.body,
              senderId: messages.senderId,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.threadId, thread.id))
            .orderBy(sql`${messages.createdAt} DESC`)
            .limit(1);

          const unreadRows = await fastify.db
            .select({ count: sql<number>`count(*)::int` })
            .from(messages)
            .where(
              and(
                eq(messages.threadId, thread.id),
                isNull(messages.readAt),
                sql`${messages.senderId} != ${userId}::uuid`,
              ),
            );

          return {
            id: thread.id,
            courseId: thread.courseId,
            updatedAt: thread.updatedAt,
            other: participantMap.get(otherId) ?? null,
            lastMessage: lastMsgRows[0] ?? null,
            unreadCount: unreadRows[0]?.count ?? 0,
          };
        }),
      );

      return reply.send({ threads: enriched });
    },
  );

  // ── POST /messages/threads ─────────────────────────────────────────────────
  // Create a new thread (or return existing one) and send the first message.
  fastify.post(
    "/messages/threads",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: senderId, role } = request.jwtPayload;

      const parse = createThreadSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { recipientId, courseId, body } = parse.data;

      if (recipientId === senderId) {
        return reply.status(400).send({ error: "Cannot message yourself" });
      }

      // Access control: verify relationship exists
      if (role === "student") {
        // Student may only message an instructor of a course they are enrolled in
        const enrolRows = await fastify.db
          .select({ id: enrolments.id })
          .from(enrolments)
          .innerJoin(courses, eq(courses.id, enrolments.courseId))
          .where(
            and(
              eq(enrolments.studentId, senderId),
              eq(courses.instructorId, recipientId),
              isNull(enrolments.deletedAt),
            ),
          )
          .limit(1);

        if (enrolRows.length === 0) {
          return reply.status(403).send({
            error: "You can only message instructors of courses you are enrolled in",
          });
        }
      } else if (role === "instructor") {
        // Instructor may only message students enrolled in their courses
        const enrolRows = await fastify.db
          .select({ id: enrolments.id })
          .from(enrolments)
          .innerJoin(courses, eq(courses.id, enrolments.courseId))
          .where(
            and(
              eq(enrolments.studentId, recipientId),
              eq(courses.instructorId, senderId),
              isNull(enrolments.deletedAt),
            ),
          )
          .limit(1);

        if (enrolRows.length === 0) {
          return reply.status(403).send({
            error: "You can only message students enrolled in your courses",
          });
        }
      }
      // admin: no restriction

      // Find or create thread
      const existingRows = await fastify.db
        .select({ id: messageThreads.id })
        .from(messageThreads)
        .where(
          or(
            and(
              eq(messageThreads.participantA, senderId),
              eq(messageThreads.participantB, recipientId),
            ),
            and(
              eq(messageThreads.participantA, recipientId),
              eq(messageThreads.participantB, senderId),
            ),
          ),
        )
        .limit(1);

      let threadId: string;

      if (existingRows.length > 0 && existingRows[0] !== undefined) {
        threadId = existingRows[0].id;
      } else {
        const inserted = await fastify.db
          .insert(messageThreads)
          .values({
            participantA: senderId,
            participantB: recipientId,
            courseId: courseId ?? null,
          })
          .returning({ id: messageThreads.id });

        if (inserted[0] === undefined) throw new Error("Thread insert failed");
        threadId = inserted[0].id;
      }

      // Insert message
      const msgInserted = await fastify.db
        .insert(messages)
        .values({ threadId, senderId, body })
        .returning();

      const msg = msgInserted[0];
      if (msg === undefined) throw new Error("Message insert failed");

      // Update thread updatedAt
      await fastify.db
        .update(messageThreads)
        .set({ updatedAt: new Date() })
        .where(eq(messageThreads.id, threadId));

      return reply.status(201).send({ threadId, message: msg });
    },
  );

  // ── GET /messages/threads/:threadId ───────────────────────────────────────
  // Fetch thread metadata + all messages, mark incoming as read.
  fastify.get(
    "/messages/threads/:threadId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { threadId } = request.params as { threadId: string };

      // Verify user is a participant
      const threadRows = await fastify.db
        .select()
        .from(messageThreads)
        .where(
          and(
            eq(messageThreads.id, threadId),
            or(
              eq(messageThreads.participantA, userId),
              eq(messageThreads.participantB, userId),
            ),
          ),
        )
        .limit(1);

      const thread = threadRows[0];
      if (thread === undefined) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      // Load messages
      const msgRows = await fastify.db
        .select()
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(sql`${messages.createdAt} ASC`);

      // Mark unread incoming messages as read
      await fastify.db
        .update(messages)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(messages.threadId, threadId),
            isNull(messages.readAt),
            sql`${messages.senderId} != ${userId}::uuid`,
          ),
        );

      return reply.send({ thread, messages: msgRows });
    },
  );

  // ── POST /messages/threads/:threadId/messages ─────────────────────────────
  // Send a message in an existing thread.
  fastify.post(
    "/messages/threads/:threadId/messages",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: senderId } = request.jwtPayload;
      const { threadId } = request.params as { threadId: string };

      const parse = sendMessageSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Verify participant
      const threadRows = await fastify.db
        .select({ id: messageThreads.id })
        .from(messageThreads)
        .where(
          and(
            eq(messageThreads.id, threadId),
            or(
              eq(messageThreads.participantA, senderId),
              eq(messageThreads.participantB, senderId),
            ),
          ),
        )
        .limit(1);

      if (threadRows.length === 0) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      const inserted = await fastify.db
        .insert(messages)
        .values({ threadId, senderId, body: parse.data.body })
        .returning();

      const msg = inserted[0];
      if (msg === undefined) throw new Error("Message insert failed");

      await fastify.db
        .update(messageThreads)
        .set({ updatedAt: new Date() })
        .where(eq(messageThreads.id, threadId));

      return reply.status(201).send({ message: msg });
    },
  );

  // ── PATCH /messages/threads/:threadId/read ────────────────────────────────
  // Mark all incoming messages in a thread as read.
  fastify.patch(
    "/messages/threads/:threadId/read",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { threadId } = request.params as { threadId: string };

      // Verify participant
      const threadRows = await fastify.db
        .select({ id: messageThreads.id })
        .from(messageThreads)
        .where(
          and(
            eq(messageThreads.id, threadId),
            or(
              eq(messageThreads.participantA, userId),
              eq(messageThreads.participantB, userId),
            ),
          ),
        )
        .limit(1);

      if (threadRows.length === 0) {
        return reply.status(404).send({ error: "Thread not found" });
      }

      await fastify.db
        .update(messages)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(messages.threadId, threadId),
            isNull(messages.readAt),
            sql`${messages.senderId} != ${userId}::uuid`,
          ),
        );

      return reply.status(204).send();
    },
  );

  // ── GET /messages/unread-count ─────────────────────────────────────────────
  // Total unread messages across all threads (for nav badge).
  fastify.get(
    "/messages/unread-count",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const threadRows = await fastify.db
        .select({ id: messageThreads.id })
        .from(messageThreads)
        .where(
          or(
            eq(messageThreads.participantA, userId),
            eq(messageThreads.participantB, userId),
          ),
        );

      if (threadRows.length === 0) {
        return reply.send({ unread: 0 });
      }

      const threadIds = threadRows.map((t) => t.id);

      const countRows = await fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            sql`${messages.threadId} = ANY(ARRAY[${sql.join(
              threadIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}])`,
            isNull(messages.readAt),
            sql`${messages.senderId} != ${userId}::uuid`,
          ),
        );

      return reply.send({ unread: countRows[0]?.count ?? 0 });
    },
  );
}
