import type { FastifyInstance } from "fastify";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { tags, documentTags, studentDocuments } from "../../db/schema/index.js";

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).default("#0d9488"),
});

const tagDocSchema = z.object({
  tagId: z.string().uuid(),
});

export function tagsPlugin(fastify: FastifyInstance) {
  // ── GET /tags ────────────────────────────────────────────────────────────
  // Returns the user's own tags.
  fastify.get(
    "/tags",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const rows = await fastify.db
        .select()
        .from(tags)
        .where(eq(tags.userId, userId))
        .orderBy(desc(tags.createdAt));

      return reply.send({ tags: rows });
    },
  );

  // ── POST /tags ───────────────────────────────────────────────────────────
  fastify.post(
    "/tags",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;

      const parse = createTagSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const inserted = await fastify.db
        .insert(tags)
        .values({
          name: parse.data.name,
          color: parse.data.color,
          userId,
        })
        .returning();

      const tag = inserted[0];
      if (tag === undefined) throw new Error("Insert returned no rows");

      return reply.status(201).send({ tag });
    },
  );

  // ── DELETE /tags/:id ─────────────────────────────────────────────────────
  fastify.delete(
    "/tags/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id } = request.params as { id: string };

      const rows = await fastify.db
        .select({ userId: tags.userId })
        .from(tags)
        .where(eq(tags.id, id))
        .limit(1);

      const tag = rows[0];
      if (tag === undefined) {
        return reply.status(404).send({ error: "Tag not found" });
      }
      if (tag.userId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      await fastify.db.delete(tags).where(eq(tags.id, id));
      return reply.status(204).send();
    },
  );

  // ── POST /documents/:id/tags ─────────────────────────────────────────────
  // Add a tag to a document.
  fastify.post(
    "/documents/:id/tags",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id: documentId } = request.params as { id: string };

      const parse = tagDocSchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      // Verify document ownership
      const docRows = await fastify.db
        .select({ studentId: studentDocuments.studentId })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, documentId))
        .limit(1);

      const doc = docRows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document not found" });
      }
      if (doc.studentId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Verify tag ownership
      const tagRows = await fastify.db
        .select({ userId: tags.userId })
        .from(tags)
        .where(eq(tags.id, parse.data.tagId))
        .limit(1);

      const tag = tagRows[0];
      if (tag === undefined) {
        return reply.status(404).send({ error: "Tag not found" });
      }
      if (tag.userId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      // Upsert — ignore if already exists
      await fastify.db
        .insert(documentTags)
        .values({ documentId, tagId: parse.data.tagId })
        .onConflictDoNothing();

      return reply.status(201).send({ ok: true });
    },
  );

  // ── DELETE /documents/:id/tags/:tagId ────────────────────────────────────
  // Remove a tag from a document.
  fastify.delete(
    "/documents/:id/tags/:tagId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { sub: userId } = request.jwtPayload;
      const { id: documentId, tagId } = request.params as {
        id: string;
        tagId: string;
      };

      // Verify document ownership
      const docRows = await fastify.db
        .select({ studentId: studentDocuments.studentId })
        .from(studentDocuments)
        .where(eq(studentDocuments.id, documentId))
        .limit(1);

      const doc = docRows[0];
      if (doc === undefined) {
        return reply.status(404).send({ error: "Document not found" });
      }
      if (doc.studentId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      await fastify.db
        .delete(documentTags)
        .where(
          and(
            eq(documentTags.documentId, documentId),
            eq(documentTags.tagId, tagId),
          ),
        );

      return reply.status(204).send();
    },
  );

  // ── GET /documents/:id/tags ──────────────────────────────────────────────
  // Get tags for a document.
  fastify.get(
    "/documents/:id/tags",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: documentId } = request.params as { id: string };

      const rows = await fastify.db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          userId: tags.userId,
          createdAt: tags.createdAt,
        })
        .from(documentTags)
        .innerJoin(tags, eq(tags.id, documentTags.tagId))
        .where(eq(documentTags.documentId, documentId))
        .orderBy(tags.name);

      return reply.send({ tags: rows });
    },
  );
}
