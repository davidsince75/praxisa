import type { Db } from "../../db/index.js";
import { materialEmbeddings } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { embedTexts } from "./mistral-client.js";

// ── Text chunking ──────────────────────────────────────────────────────────────

const CHUNK_SIZE = 512; // tokens (approximated as words here)
const CHUNK_OVERLAP = 64; // tokens of overlap between adjacent chunks

/**
 * Split text into overlapping word-based chunks.
 * Word-based splitting is a safe approximation when no tokenizer is available.
 * Each chunk is at most CHUNK_SIZE words with CHUNK_OVERLAP words shared with
 * the next chunk.
 */
export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const words = trimmed.split(/\s+/);

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

// ── Ingest pipeline ────────────────────────────────────────────────────────────

const EMBED_BATCH_SIZE = 16; // Mistral allows up to 32 inputs per call

/**
 * Ingest a lesson's text content:
 * 1. Delete any existing embeddings for the lesson (idempotent re-ingest).
 * 2. Chunk the text.
 * 3. Embed chunks in batches.
 * 4. Persist all embeddings.
 *
 * Returns the number of chunks stored.
 */
export async function ingestLesson(
  db: Db,
  lessonId: string,
  text: string,
  mistralApiKey: string,
): Promise<number> {
  // Delete existing chunks for idempotent re-ingest
  await db
    .delete(materialEmbeddings)
    .where(eq(materialEmbeddings.lessonId, lessonId));

  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  // Embed in batches
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await embedTexts(batch, mistralApiKey);
    allEmbeddings.push(...batchEmbeddings);
  }

  // Persist
  await db.insert(materialEmbeddings).values(
    chunks.map((chunkText, idx) => ({
      lessonId,
      chunkIndex: idx,
      chunkText,
      embedding: allEmbeddings[idx] ?? [],
    })),
  );

  return chunks.length;
}
