import { eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../../db/index.js";
import {
  documentEmbeddings,
  documentIngests,
  uploadedFiles,
} from "../../db/schema/index.js";
import type { OutlineSection } from "../../db/schema/index.js";
import { embedTexts } from "./mistral-client.js";
import { extractPdfPages, hasUsableText } from "./pdf-extract.js";
import { buildOutline } from "./outline.service.js";

// ── Page-aware chunking (pure, unit-tested) ────────────────────────────────────

const CHUNK_WORD_BUDGET = 450; // matches the 512-word lesson chunks, minus overhead
const MIN_CHUNK_WORDS = 15; // drop near-empty chunks (blank or decorative pages)
const EMBED_BATCH_SIZE = 16; // Mistral allows up to 32 inputs per call

export interface DocumentChunk {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  text: string;
}

/**
 * Build retrieval chunks from per-page text, preserving page provenance.
 * Consecutive small pages are grouped until the word budget is reached;
 * oversized pages are split into several chunks sharing the same page number.
 */
export function buildDocumentChunks(
  pages: string[],
  wordBudget = CHUNK_WORD_BUDGET,
  minWords = MIN_CHUNK_WORDS,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let bufferWords: string[] = [];
  let bufferStart = 0; // 1-based page where the current buffer began
  let bufferEnd = 0; // 1-based last page actually present in the buffer

  const flush = (): void => {
    if (bufferWords.length >= minWords) {
      chunks.push({
        chunkIndex: chunks.length,
        pageStart: bufferStart,
        pageEnd: bufferEnd,
        text: bufferWords.join(" "),
      });
    }
    bufferWords = [];
  };

  for (let i = 0; i < pages.length; i++) {
    const pageNo = i + 1;
    const page = pages[i] ?? "";
    const words = page.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) continue;

    if (words.length > wordBudget) {
      // Oversized page: flush the buffer, then split the page on its own.
      flush();
      for (let w = 0; w < words.length; w += wordBudget) {
        const slice = words.slice(w, w + wordBudget);
        if (slice.length >= minWords) {
          chunks.push({
            chunkIndex: chunks.length,
            pageStart: pageNo,
            pageEnd: pageNo,
            text: slice.join(" "),
          });
        }
      }
      continue;
    }

    if (bufferWords.length === 0) {
      bufferStart = pageNo;
    } else if (bufferWords.length + words.length > wordBudget) {
      flush();
      bufferStart = pageNo;
    }
    bufferWords = [...bufferWords, ...words];
    bufferEnd = pageNo;
  }

  flush();
  return chunks;
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

interface IngestPatch {
  status?: string;
  stage?: string | null;
  error?: string | null;
  pageCount?: number;
  chunkCount?: number;
  outline?: OutlineSection[];
  startedAt?: Date;
  completedAt?: Date;
}

async function patchIngest(
  db: Db,
  fileId: string,
  patch: IngestPatch,
): Promise<void> {
  await db
    .update(documentIngests)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(documentIngests.fileId, fileId));
}

/**
 * Full ingest pipeline for an uploaded course PDF:
 *   extraction -> outline (map-reduce) -> chunk + embed.
 * Designed to run detached from the request (fire-and-forget); progress and
 * errors land in document_ingests. Idempotent: re-running replaces previous
 * outline and embeddings.
 *
 * NOTE: runs in-process. If ingest volume ever grows beyond occasional
 * teacher uploads, move this into a BullMQ job in apps/workers.
 */
export async function runDocumentIngest(
  db: Db,
  fileId: string,
  mistralApiKey: string,
  log: FastifyBaseLogger,
): Promise<void> {
  try {
    // Upsert the status row — visible to polling clients immediately.
    await db
      .insert(documentIngests)
      .values({
        fileId,
        status: "processing",
        stage: "extraction",
        error: null,
        startedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: documentIngests.fileId,
        set: {
          status: "processing",
          stage: "extraction",
          error: null,
          startedAt: new Date(),
          completedAt: null,
          updatedAt: new Date(),
        },
      });

    const fileRows = await db
      .select({ data: uploadedFiles.data })
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);
    const file = fileRows[0];
    if (file === undefined) {
      throw new Error("Fichier introuvable");
    }

    const pages = await extractPdfPages(file.data);
    if (!hasUsableText(pages)) {
      throw new Error(
        "Le PDF ne contient pas de texte exploitable (document scanné sans OCR ?)",
      );
    }
    await patchIngest(db, fileId, { stage: "plan", pageCount: pages.length });

    const outline = await buildOutline(pages, mistralApiKey);
    await patchIngest(db, fileId, { stage: "indexation", outline });

    const chunks = buildDocumentChunks(pages);
    await db
      .delete(documentEmbeddings)
      .where(eq(documentEmbeddings.fileId, fileId));

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const embeddings = await embedTexts(
        batch.map((c) => c.text),
        mistralApiKey,
      );
      await db.insert(documentEmbeddings).values(
        batch.map((c, idx) => ({
          fileId,
          chunkIndex: c.chunkIndex,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          chunkText: c.text,
          embedding: embeddings[idx] ?? [],
        })),
      );
    }

    await patchIngest(db, fileId, {
      status: "ready",
      stage: null,
      chunkCount: chunks.length,
      completedAt: new Date(),
    });
    log.info({ fileId, chunks: chunks.length }, "Document ingest completed");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    log.error({ err, fileId }, "Document ingest failed");
    await patchIngest(db, fileId, {
      status: "failed",
      stage: null,
      error: message.slice(0, 500),
      completedAt: new Date(),
    }).catch((patchErr: unknown) => {
      log.error({ err: patchErr, fileId }, "Failed to record ingest failure");
    });
  }
}
