// AI course-authoring routes: lesson content, homework subjects and external
// resource suggestions. All endpoints are suggestion-only — nothing is written
// to the course; the teacher reviews and applies results from the web client.

import { z } from "zod";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { documentIngests } from "../../db/schema/index.js";
import { retrieveDocumentChunks } from "./rag.service.js";
import {
  LESSON_CONTENT_FREE_PROMPT,
  LESSON_CONTENT_GROUNDED_PROMPT,
  RESOURCE_SUGGESTIONS_PROMPT,
  homeworkSystemPrompt,
  parseHomeworkSuggestion,
  parseResourceSuggestions,
  sanitizeGeneratedHtml,
} from "./authoring.service.js";
import { resolveResources } from "./resources.service.js";

interface AiAuthoringPluginOptions {
  mistralApiKey?: string;
  youtubeApiKey?: string;
}

interface DocumentChunkLike {
  pageStart: number;
  pageEnd: number;
  chunkText: string;
}

function excerptsBlock(chunks: DocumentChunkLike[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${String(i + 1)}] (p. ${String(c.pageStart)}-${String(c.pageEnd)}) ${c.chunkText}`,
    )
    .join("\n\n");
}

export const aiAuthoringPlugin = (
  fastify: FastifyInstance,
  opts: AiAuthoringPluginOptions,
  done: (err?: Error) => void,
) => {
  const { mistralApiKey, youtubeApiKey } = opts;

  async function isIngestReady(fileId: string): Promise<boolean> {
    const rows = await fastify.db
      .select({ status: documentIngests.status })
      .from(documentIngests)
      .where(eq(documentIngests.fileId, fileId))
      .limit(1);
    return rows[0]?.status === "ready";
  }

  // ── POST /v1/ai/generate-lesson-content ───────────────────────────────────
  // Generates the HTML body of a lesson, grounded on an ingested course
  // document when fileId is provided, otherwise from the model's knowledge.

  fastify.post(
    "/ai/generate-lesson-content",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
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
        lessonTitle: z.string().min(3).max(200),
        fileId: z.string().uuid().optional(),
        instructions: z.string().max(1000).optional(),
      });
      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { lessonTitle, fileId, instructions } = parse.data;

      let systemPrompt = LESSON_CONTENT_FREE_PROMPT;
      let sources: { pageStart: number; pageEnd: number; excerpt: string }[] =
        [];
      const userParts = [`Titre de la leçon : ${lessonTitle}`];
      if (instructions !== undefined && instructions.trim().length > 0) {
        userParts.push(`Consignes de l'enseignant :\n${instructions.trim()}`);
      }

      if (fileId !== undefined) {
        if (!(await isIngestReady(fileId))) {
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
          { topK: 8 },
        );
        if (chunks.length === 0) {
          return reply.status(422).send({
            error:
              "Aucun extrait pertinent trouvé dans le document pour ce titre",
          });
        }
        systemPrompt = LESSON_CONTENT_GROUNDED_PROMPT;
        userParts.push(
          `Extraits du support de cours :\n${excerptsBlock(chunks)}`,
        );
        sources = chunks.map((c) => ({
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          excerpt: c.chunkText.slice(0, 200),
        }));
      }

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const raw = await chatComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts.join("\n\n") },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      const html = sanitizeGeneratedHtml(raw);
      if (html.length === 0) {
        return reply
          .status(502)
          .send({ error: "Réponse IA invalide — réessayez." });
      }

      return reply.send({ html, sources });
    },
  );

  // ── POST /v1/ai/generate-homework ─────────────────────────────────────────
  // Suggests a homework subject (devoir or réflexion) for a lesson. The
  // exercise itself is created by the client through the learning routes.

  fastify.post(
    "/ai/generate-homework",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
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
        lessonTitle: z.string().min(3).max(200),
        type: z.enum(["assignment", "reflection"]),
        fileId: z.string().uuid().optional(),
        context: z.string().max(3000).optional(),
      });
      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { lessonTitle, type, fileId, context } = parse.data;

      const userParts = [`Titre de la leçon : ${lessonTitle}`];
      if (context !== undefined && context.trim().length > 0) {
        userParts.push(`Contexte :\n${context.trim()}`);
      }
      // Grounding is best-effort here — homework can be set without excerpts.
      if (fileId !== undefined && (await isIngestReady(fileId))) {
        const chunks = await retrieveDocumentChunks(
          fastify.db,
          fileId,
          lessonTitle,
          mistralApiKey,
          { topK: 6 },
        );
        if (chunks.length > 0) {
          userParts.push(
            `Extraits du support de cours :\n${excerptsBlock(chunks)}`,
          );
        }
      }

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const raw = await chatComplete(
        [
          { role: "system", content: homeworkSystemPrompt(type) },
          { role: "user", content: userParts.join("\n\n") },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      const suggestion = parseHomeworkSuggestion(raw);
      if (suggestion === null) {
        return reply
          .status(502)
          .send({ error: "Réponse IA invalide — réessayez." });
      }

      return reply.send({ homework: { ...suggestion, type } });
    },
  );

  // ── POST /v1/ai/suggest-resources ─────────────────────────────────────────
  // Suggests external resources (lectures, vidéos, images libres) for a
  // lesson. The model only proposes queries and citations; every link in the
  // response is resolved against a real public API (Wikipédia, Openverse,
  // YouTube) so no hallucinated URL ever reaches a course.

  fastify.post(
    "/ai/suggest-resources",
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    },
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
        lessonTitle: z.string().min(3).max(200),
        context: z.string().max(2000).optional(),
      });
      const parse = bodySchema.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: parse.error.flatten() });
      }
      const { lessonTitle, context } = parse.data;

      const userParts = [`Titre de la leçon : ${lessonTitle}`];
      if (context !== undefined && context.trim().length > 0) {
        userParts.push(`Contexte :\n${context.trim()}`);
      }

      const { chatComplete, MISTRAL_SMALL } =
        await import("./mistral-client.js");
      const raw = await chatComplete(
        [
          { role: "system", content: RESOURCE_SUGGESTIONS_PROMPT },
          { role: "user", content: userParts.join("\n\n") },
        ],
        MISTRAL_SMALL,
        mistralApiKey,
      );

      const suggestions = parseResourceSuggestions(raw);
      if (suggestions === null) {
        return reply
          .status(502)
          .send({ error: "Réponse IA invalide — réessayez." });
      }

      const resolved = await resolveResources(suggestions, {
        ...(youtubeApiKey !== undefined ? { youtubeApiKey } : {}),
        logger: request.log,
      });

      return reply.send(resolved);
    },
  );

  done();
};
