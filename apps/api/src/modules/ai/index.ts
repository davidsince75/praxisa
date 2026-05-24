import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { emitEvent } from "@praxisa/audit-sdk";
import { hasClinicalIntent, hasPii } from "./safety.js";
import { ingestLesson } from "./embedding.service.js";
import {
  retrieveChunks,
  generateAnswer,
  generateAdminDraft,
  generateGradingSuggestion,
} from "./rag.service.js";
import {
  aiQueryBodySchema,
  aiAdminDraftBodySchema,
  aiIngestBodySchema,
  aiGradeSuggestBodySchema,
} from "./types.js";
import {
  submissions,
  exercises,
  lessons,
  courseModules,
  courses,
} from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

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
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = aiIngestBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
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
            "Votre question semble contenir du contenu clinique ou de crise — veuillez contacter le support.",
        });
      }
      if (hasPii(question)) {
        return reply.status(422).send({
          error:
            "Votre question semble contenir des données personnelles — veuillez reformuler.",
        });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
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
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = aiAdminDraftBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { intent, context } = parse.data;

      if (hasPii(intent)) {
        return reply.status(422).send({
          error:
            "L'intention semble contenir des données personnelles — veuillez reformuler.",
        });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
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

  // ── POST /v1/ai/grade-suggest ────────────────────────────────────────────────
  // Teacher requests AI-powered grading suggestion for a student submission.
  // The suggestion is NEVER applied automatically — teacher must review and confirm.

  fastify.post(
    "/ai/grade-suggest",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: actorId, role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const parse = aiGradeSuggestBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
      }

      const { submissionId } = parse.data;

      // Load submission + exercise details + course ownership check
      const rows = await fastify.db
        .select({
          body: submissions.body,
          exerciseTitle: exercises.title,
          exerciseType: exercises.type,
          maxScore: exercises.maxScore,
          instructorId: courses.instructorId,
        })
        .from(submissions)
        .innerJoin(exercises, eq(exercises.id, submissions.exerciseId))
        .innerJoin(lessons, eq(lessons.id, exercises.lessonId))
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .innerJoin(courses, eq(courses.id, courseModules.courseId))
        .where(eq(submissions.id, submissionId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.status(404).send({ error: "Soumission introuvable" });
      }

      if (role === "instructor" && row.instructorId !== actorId) {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      const suggestion = await generateGradingSuggestion(
        row.body,
        row.exerciseTitle,
        row.exerciseType,
        row.maxScore ?? 20,
        mistralApiKey,
      );

      await emitEvent({
        actorUserId: actorId,
        eventType: "ai.grade.suggestion_generated",
        entityType: "submission",
        entityId: submissionId,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
        metadata: { suggestedScore: suggestion.suggestedScore },
      });

      return reply.send(suggestion);
    },
  );

  done();
};
