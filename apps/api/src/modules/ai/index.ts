import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { emitEvent } from "@praxisa/audit-sdk";
import { hasClinicalIntent, hasPii } from "./safety.js";
import { ingestLesson } from "./embedding.service.js";
import { runDocumentIngest } from "./document-ingest.service.js";
import { outlineToPromptText } from "./outline.service.js";
import {
  retrieveChunks,
  retrieveDocumentChunks,
  generateAnswer,
  generateAdminDraft,
  generateGradingSuggestion,
} from "./rag.service.js";
import {
  aiQueryBodySchema,
  aiAdminDraftBodySchema,
  aiIngestBodySchema,
  aiGradeSuggestBodySchema,
  aiDocumentParamsSchema,
  aiDraftLessonBodySchema,
} from "./types.js";
import {
  submissions,
  exercises,
  lessons,
  courseModules,
  courses,
  documentIngests,
  uploadedFiles,
} from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

const DRAFT_LESSON_SYSTEM_PROMPT = `Tu es un concepteur pédagogique pour Praxisa. À partir des extraits du support de cours fournis, rédige le contenu d'une leçon en Markdown, en français.

RÈGLES STRICTES :
- Appuie-toi UNIQUEMENT sur les extraits fournis — n'invente aucun fait.
- Structure : une courte introduction, 2 à 4 sous-parties avec des titres ##, puis une liste « Points clés ».
- 400 à 800 mots.
- Cite les pages sources entre parenthèses, par exemple (p. 12-14), d'après les indications de pages des extraits.
- Si les extraits ne suffisent pas pour traiter le sujet, dis-le explicitement à la fin.`;

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

  // ── POST /v1/ai/course-structure ─────────────────────────────────────────
  // Suggests a module-by-module course structure from a free-text description
  // OR from the stored outline of an ingested course PDF (fileId mode, with
  // page ranges per module).

  fastify.post(
    "/ai/course-structure",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
      }

      const bodySchema = z
        .object({
          description: z.string().min(10).max(5000).optional(),
          fileId: z.string().uuid().optional(),
          moduleCount: z.number().int().min(2).max(12).default(5),
        })
        .refine((b) => b.description !== undefined || b.fileId !== undefined, {
          message: "description ou fileId requis",
        });
      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { description, fileId, moduleCount } = parse.data;

      let sourceBlock: string;
      if (fileId !== undefined) {
        const ingestRows = await fastify.db
          .select()
          .from(documentIngests)
          .where(eq(documentIngests.fileId, fileId))
          .limit(1);
        const ingest = ingestRows[0];
        if (
          ingest === undefined ||
          ingest.status !== "ready" ||
          ingest.outline === null
        ) {
          return reply.status(409).send({
            error:
              "Le document n'est pas encore indexé — lancez d'abord la préparation.",
          });
        }
        sourceBlock = `Plan du document source (${String(ingest.pageCount ?? 0)} pages) :\n${outlineToPromptText(ingest.outline)}`;
      } else {
        sourceBlock = `Description de la formation :\n${description ?? ""}`;
      }

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const formatLine =
        fileId !== undefined
          ? `{"modules":[{"title":"string","description":"string","pageStart":N,"pageEnd":N},...]}`
          : `{"modules":[{"title":"string","description":"string"},...]}`;
      const pagesRule =
        fileId !== undefined
          ? `\n- Chaque module indique pageStart et pageEnd (entiers) : la plage de pages du document qu'il couvre. Les plages se suivent et couvrent l'ensemble du document.`
          : "";
      const systemPrompt = `Tu es un expert en conception pédagogique. On te donne ${fileId !== undefined ? "le plan d'un document de cours" : "une description de formation"} et tu dois proposer une structure de modules.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : ${formatLine}
- Nombre de modules : exactement ${String(moduleCount)}
- Chaque module a un titre court (max 60 chars) et une description (1-2 phrases)
- Titre et description en français${pagesRule}`;

      const raw = await chatComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: sourceBlock },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      interface RawModule {
        title?: unknown;
        description?: unknown;
        pageStart?: unknown;
        pageEnd?: unknown;
      }
      let modules: {
        title: string;
        description: string;
        pageStart?: number;
        pageEnd?: number;
      }[];
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch === null) throw new Error("No JSON found");
        const parsed = JSON.parse(jsonMatch[0]) as { modules?: RawModule[] };
        if (!Array.isArray(parsed.modules)) throw new Error("Invalid shape");
        modules = parsed.modules.map((m) => ({
          title: String(m.title ?? "").slice(0, 120),
          description: String(m.description ?? ""),
          ...(typeof m.pageStart === "number"
            ? { pageStart: Math.max(1, Math.round(m.pageStart)) }
            : {}),
          ...(typeof m.pageEnd === "number"
            ? { pageEnd: Math.max(1, Math.round(m.pageEnd)) }
            : {}),
        }));
      } catch {
        return reply
          .status(502)
          .send({ error: "Réponse IA invalide — réessayez." });
      }

      return reply.send({ modules });
    },
  );

  // ── POST /v1/ai/documents/:fileId/ingest ──────────────────────────────────
  // Prepares an uploaded course PDF for AI use: extraction → outline →
  // embeddings. Runs detached from the request; poll the GET for progress.

  fastify.post(
    "/ai/documents/:fileId/ingest",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role, sub } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const parseParams = aiDocumentParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return reply
          .status(400)
          .send({ error: "Identifiant de fichier invalide" });
      }
      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
      }
      const { fileId } = parseParams.data;

      const fileRows = await fastify.db
        .select({ id: uploadedFiles.id })
        .from(uploadedFiles)
        .where(eq(uploadedFiles.id, fileId))
        .limit(1);
      if (fileRows[0] === undefined) {
        return reply.status(404).send({ error: "Fichier introuvable" });
      }

      const ingestRows = await fastify.db
        .select({
          status: documentIngests.status,
          startedAt: documentIngests.startedAt,
        })
        .from(documentIngests)
        .where(eq(documentIngests.fileId, fileId))
        .limit(1);
      const existing = ingestRows[0];
      const STALE_PROCESSING_MS = 15 * 60 * 1000;
      if (
        existing !== undefined &&
        existing.status === "processing" &&
        existing.startedAt !== null &&
        Date.now() - existing.startedAt.getTime() < STALE_PROCESSING_MS
      ) {
        return reply
          .status(409)
          .send({ error: "La préparation de ce document est déjà en cours" });
      }

      // Fire and forget — progress and errors land in document_ingests.
      void runDocumentIngest(fastify.db, fileId, mistralApiKey, request.log);

      await emitEvent({
        actorUserId: sub,
        eventType: "ai.document.ingest_started",
        entityType: "file",
        entityId: fileId,
        dataClassification: "non-pii",
        requestId: request.id,
        sourceIp: request.ip,
      });

      return reply.status(202).send({ fileId, status: "processing" });
    },
  );

  // ── GET /v1/ai/documents/:fileId/ingest ───────────────────────────────────
  // Polling endpoint for ingest progress. Status "none" = never prepared.

  fastify.get(
    "/ai/documents/:fileId/ingest",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const parseParams = aiDocumentParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return reply
          .status(400)
          .send({ error: "Identifiant de fichier invalide" });
      }

      const rows = await fastify.db
        .select({
          status: documentIngests.status,
          stage: documentIngests.stage,
          error: documentIngests.error,
          pageCount: documentIngests.pageCount,
          chunkCount: documentIngests.chunkCount,
          updatedAt: documentIngests.updatedAt,
        })
        .from(documentIngests)
        .where(eq(documentIngests.fileId, parseParams.data.fileId))
        .limit(1);

      const row = rows[0];
      if (row === undefined) {
        return reply.send({ status: "none" });
      }
      return reply.send(row);
    },
  );

  // ── POST /v1/ai/draft-lesson-from-file ────────────────────────────────────
  // Drafts lesson content from an ingested course PDF: page-aware retrieval
  // over document_embeddings, then grounded generation with page citations.

  fastify.post(
    "/ai/draft-lesson-from-file",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }
      const parse = aiDraftLessonBodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
      }
      const { fileId, lessonTitle, pageStart, pageEnd } = parse.data;

      const ingestRows = await fastify.db
        .select({ status: documentIngests.status })
        .from(documentIngests)
        .where(eq(documentIngests.fileId, fileId))
        .limit(1);
      if (ingestRows[0]?.status !== "ready") {
        return reply.status(409).send({
          error:
            "Le document n'est pas encore indexé — lancez d'abord la préparation.",
        });
      }

      const chunks = await retrieveDocumentChunks(
        fastify.db,
        fileId,
        lessonTitle,
        mistralApiKey,
        pageStart !== undefined && pageEnd !== undefined
          ? { pageStart, pageEnd }
          : {},
      );
      if (chunks.length === 0) {
        return reply.status(422).send({
          error:
            "Aucun extrait pertinent trouvé dans le document pour ce titre",
        });
      }

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const excerpts = chunks
        .map(
          (c, i) =>
            `[${String(i + 1)}] (p. ${String(c.pageStart)}-${String(c.pageEnd)}) ${c.chunkText}`,
        )
        .join("\n\n");
      const content = await chatComplete(
        [
          { role: "system", content: DRAFT_LESSON_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Titre de la leçon : ${lessonTitle}\n\nExtraits du support de cours :\n${excerpts}`,
          },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      return reply.send({
        content,
        sources: chunks.map((c) => ({
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          excerpt: c.chunkText.slice(0, 200),
        })),
      });
    },
  );

  // ── POST /v1/ai/generate-mcq ──────────────────────────────────────────────
  // Generates multiple-choice questions for a quiz exercise.

  fastify.post(
    "/ai/generate-mcq",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { role } = request.jwtPayload;
      if (role !== "instructor" && role !== "admin") {
        return reply.status(403).send({ error: "Accès interdit" });
      }

      if (!mistralApiKey) {
        return reply
          .status(503)
          .send({ error: "Le service IA n'est pas configuré" });
      }

      const bodySchema = z.object({
        topic: z.string().min(3).max(500),
        context: z.string().max(3000).optional(),
        count: z.number().int().min(1).max(10).default(5),
      });
      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }

      const { topic, context, count } = parse.data;

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const systemPrompt = `Tu es un expert en évaluation pédagogique. Génère des questions QCM en JSON.

RÈGLES STRICTES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre.
- Format exact : {"questions":[{"questionText":"string","options":[{"id":"a","text":"string"},{"id":"b","text":"string"},{"id":"c","text":"string"},{"id":"d","text":"string"}],"correctOptionId":"a","explanation":"string"},...]};
- Exactement ${String(count)} questions
- Exactement 4 options par question (id: a, b, c, d)
- correctOptionId est l'id de la bonne réponse
- explanation explique pourquoi c'est la bonne réponse (1-2 phrases)
- Tout en français`;

      const userMsg =
        context !== undefined
          ? `Sujet : ${topic}\n\nContexte :\n${context}`
          : `Sujet : ${topic}`;

      const raw = await chatComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      interface MCQQuestion {
        questionText: string;
        options: { id: string; text: string }[];
        correctOptionId: string;
        explanation: string;
      }

      let parsed: { questions: MCQQuestion[] };
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch === null) throw new Error("No JSON found");
        parsed = JSON.parse(jsonMatch[0]) as { questions: MCQQuestion[] };
        if (!Array.isArray(parsed.questions)) throw new Error("Invalid shape");
      } catch {
        return reply
          .status(502)
          .send({ error: "Réponse IA invalide — réessayez." });
      }

      return reply.send({ questions: parsed.questions });
    },
  );

  done();
};
