import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { emitEvent } from "@praxisa/audit-sdk";
import { hasClinicalIntent, hasPii } from "./safety.js";
import { ingestLesson } from "./embedding.service.js";
import {
  retrieveChunks,
  generateAnswer,
  generateAdminDraft,
} from "./rag.service.js";
import {
  aiQueryBodySchema,
  aiAdminDraftBodySchema,
  aiIngestBodySchema,
} from "./types.js";

interface AiPluginOptions {
  mistralApiKey?: string;
}

export const aiPlugin = (
  fastify: FastifyInstance,
  opts: AiPluginOptions,
  done: (err?: Error) => void,
) => {
  const { mistralApiKey } = opts;

  // ── POST /v1/ai/ingest ─────────────────────────────────────────────────────
  // Instructor or admin uploads lesson text for embedding.

  fastify.post(
    "/ai/ingest",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parse = aiIngestBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      if (!mistralApiKey) {
        return reply.status(503).send({ error: "AI service not configured" });
      }

      const { lessonId, text } = parse.data;

      const chunkCount = await ingestLesson(
        fastify.db,
        lessonId,
        text,
        mistralApiKey,
      );

      await emitEvent({
        actorUserId: request.jwtPayload.sub,
        eventType: "ai.lesson.ingested",
        entityType: "lesson",
        entityId: lessonId,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { chunkCount },
      });

      return reply.status(200).send({ lessonId, chunkCount });
    },
  );

  // ── POST /v1/ai/query ──────────────────────────────────────────────────────
  // Student Q&A — Tier 1 RAG.

  fastify.post(
    "/ai/query",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parse = aiQueryBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { question, lessonId } = parse.data;

      // Safety gates
      if (hasClinicalIntent(question)) {
        return reply.status(422).send({
          error:
            "Query contains clinical or crisis content — please contact support.",
        });
      }
      if (hasPii(question)) {
        return reply.status(422).send({
          error: "Query appears to contain personal data — please rephrase.",
        });
      }

      if (!mistralApiKey) {
        return reply.status(503).send({ error: "AI service not configured" });
      }

      const chunks = await retrieveChunks(fastify.db, question, mistralApiKey);

      // Filter to lesson if specified
      const relevant = lessonId
        ? chunks.filter((c) => c.lessonId === lessonId)
        : chunks;

      let answer: string;
      let escalated = false;

      if (relevant.length === 0) {
        answer =
          "Je n'ai pas trouvé de contenu suffisant pour répondre à cette question dans les cours disponibles.";
        escalated = true;
      } else {
        answer = await generateAnswer(question, relevant, mistralApiKey);
      }

      await emitEvent({
        actorUserId: request.jwtPayload.sub,
        eventType: "ai.query.answered",
        entityType: "lesson",
        entityId: lessonId ?? "global",
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { chunkCount: relevant.length, escalated },
      });

      return reply.send({ answer, chunks: relevant, escalated });
    },
  );

  // ── POST /v1/ai/admin/draft ────────────────────────────────────────────────
  // Admin draft generation — Tier 2. Draft is NEVER sent automatically.

  fastify.post(
    "/ai/admin/draft",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const parse = aiAdminDraftBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { intent, context } = parse.data;

      if (hasPii(intent)) {
        return reply.status(422).send({
          error: "Intent contains personal data — please rephrase.",
        });
      }

      if (!mistralApiKey) {
        return reply.status(503).send({ error: "AI service not configured" });
      }

      const draft = await generateAdminDraft(
        intent,
        context ?? {},
        mistralApiKey,
      );

      await emitEvent({
        actorUserId: request.jwtPayload.sub,
        eventType: "ai.admin.draft_generated",
        entityType: "admin",
        entityId: request.jwtPayload.sub,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { intentClassification: draft.intentClassification },
      });

      return reply.send({ draft });
    },
  );

  done();
};
