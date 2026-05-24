import { sql } from "drizzle-orm";
import { chatComplete, embedTexts, MISTRAL_SMALL } from "./mistral-client.js";
import type { AiQueryChunk } from "./types.js";
import type { Db } from "../../db/index.js";

// Minimum cosine similarity for a chunk to be used as context.
// Queries with no chunk above this threshold are escalated rather than hallucinated.
const SIMILARITY_THRESHOLD = 0.75;
const TOP_K = 5;

// ── Retrieval ──────────────────────────────────────────────────────────────────

/**
 * Embed the query, retrieve the top-K most similar chunks above the threshold.
 * The query string must already be PII-scanned by the caller.
 */
export async function retrieveChunks(
  db: Db,
  query: string,
  mistralApiKey: string,
  topK = TOP_K,
  threshold = SIMILARITY_THRESHOLD,
): Promise<AiQueryChunk[]> {
  const [queryEmbedding] = await embedTexts([query], mistralApiKey);
  if (queryEmbedding === undefined) return [];

  // pgvector cosine similarity: 1 - (embedding <=> query_vector)
  const embeddingLiteral = `'[${queryEmbedding.join(",")}]'::vector`;

  const result = await db.execute<{
    lesson_id: string;
    chunk_index: number;
    chunk_text: string;
    similarity: number;
  }>(sql`
    SELECT
      lesson_id,
      chunk_index,
      chunk_text,
      1 - (embedding <=> ${sql.raw(embeddingLiteral)}) AS similarity
    FROM material_embeddings
    ORDER BY embedding <=> ${sql.raw(embeddingLiteral)}
    LIMIT ${sql.raw(String(topK))}
  `);

  return result.rows
    .filter((r) => Number(r.similarity) >= threshold)
    .map((r) => ({
      lessonId: r.lesson_id,
      chunkIndex: Number(r.chunk_index),
      chunkText: r.chunk_text,
      similarity: Number(r.similarity),
    }));
}

// ── Generation ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful learning assistant for Praxisa, a French professional 
development platform. Answer the student's question using ONLY the provided course material. 
Be concise. If the material does not contain enough information to answer, say so explicitly 
rather than speculating. Respond in the same language as the question (French or English).`;

/**
 * Generate a grounded answer from retrieved context chunks.
 * Returns the answer string.
 */
export async function generateAnswer(
  question: string,
  chunks: AiQueryChunk[],
  mistralApiKey: string,
): Promise<string> {
  const context = chunks
    .map((c, i) => `[${String(i + 1)}] ${c.chunkText}`)
    .join("\n\n");

  return chatComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Course material:\n${context}\n\nQuestion: ${question}`,
      },
    ],
    MISTRAL_SMALL,
    mistralApiKey,
  );
}

// ── Tier 2: Admin draft ────────────────────────────────────────────────────────

const ADMIN_SYSTEM_PROMPT = `You are an administrative assistant for Praxisa. 
Generate a professional draft message based on the intent and context provided. 
Output structured JSON with fields: { "subject": string, "body": string, "intentClassification": string }.
Be concise and professional. Use French unless the context specifies otherwise.`;

export interface AdminDraft {
  subject: string;
  body: string;
  intentClassification: string;
}

/**
 * Generate an admin communication draft for Tier 2 review.
 * The draft is NEVER sent automatically — it must be reviewed and confirmed by an admin.
 */
export async function generateAdminDraft(
  intent: string,
  context: Record<string, unknown>,
  mistralApiKey: string,
): Promise<AdminDraft> {
  const contextStr = JSON.stringify(context);

  const raw = await chatComplete(
    [
      { role: "system", content: ADMIN_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Intent: ${intent}\nContext: ${contextStr}`,
      },
    ],
    MISTRAL_SMALL,
    mistralApiKey,
  );

  // Parse JSON response — if malformed, return a safe fallback
  try {
    const parsed = JSON.parse(raw) as Partial<AdminDraft>;
    return {
      subject: parsed.subject ?? "(No subject generated)",
      body: parsed.body ?? raw,
      intentClassification: parsed.intentClassification ?? "unknown",
    };
  } catch {
    return {
      subject: "(Draft — review required)",
      body: raw,
      intentClassification: "unknown",
    };
  }
}

// ── Tier 3: Grading suggestion ────────────────────────────────────────────────

const GRADING_SYSTEM_PROMPT = `Tu es un assistant pédagogique pour Praxisa, une plateforme de formation en psychologie clinique.
Tu reçois le travail soumis par un étudiant pour un exercice. Évalue la qualité de la réponse et propose une note et un commentaire constructif.

Retourne ton évaluation au format JSON strict :
{
  "suggestedScore": <nombre entier>,
  "suggestedFeedback": "<commentaire en français>"
}

Le commentaire doit :
- Reconnaître les points forts du travail
- Identifier les axes d'amélioration
- Être encourageant et pédagogiquement constructif
- Faire 2 à 4 phrases
- Être rédigé en français`;

export interface GradingSuggestion {
  suggestedScore: number;
  suggestedFeedback: string;
}

/**
 * Generate a grading suggestion for a student submission.
 * The suggestion is NEVER applied automatically — the teacher must review and confirm.
 */
export async function generateGradingSuggestion(
  submissionBody: string,
  exerciseTitle: string,
  exerciseType: string,
  maxScore: number,
  mistralApiKey: string,
): Promise<GradingSuggestion> {
  const raw = await chatComplete(
    [
      { role: "system", content: GRADING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Exercice : ${exerciseTitle} (type : ${exerciseType})\nNote maximale : ${String(maxScore)}\n\nTravail de l'étudiant :\n${submissionBody}`,
      },
    ],
    MISTRAL_SMALL,
    mistralApiKey,
  );

  try {
    const parsed = JSON.parse(raw) as Partial<GradingSuggestion>;
    const score = parsed.suggestedScore ?? Math.round(maxScore * 0.7);
    return {
      suggestedScore: Math.min(Math.max(score, 0), maxScore),
      suggestedFeedback: parsed.suggestedFeedback ?? raw,
    };
  } catch {
    return {
      suggestedScore: Math.round(maxScore * 0.7),
      suggestedFeedback: raw,
    };
  }
}
