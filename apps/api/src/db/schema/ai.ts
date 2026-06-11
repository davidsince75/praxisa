import {
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lessons } from "./learning.js";
import { uploadedFiles } from "./files.js";

// ── pgvector custom type ───────────────────────────────────────────────────────

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return config?.dimensions !== undefined
      ? `vector(${String(config.dimensions)})`
      : "vector";
  },
  fromDriver(value: string): number[] {
    // pgvector returns "[1.0,2.0,...]"
    return value
      .slice(1, -1)
      .split(",")
      .map((n) => parseFloat(n));
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

// ── material_embeddings ────────────────────────────────────────────────────────
// One row per text chunk. Populated at lesson ingest time by an instructor or admin.
// The embedding column uses pgvector (1024 dims = mistral-embed output).

export const materialEmbeddings = pgTable("material_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MaterialEmbedding = typeof materialEmbeddings.$inferSelect;
export type NewMaterialEmbedding = typeof materialEmbeddings.$inferInsert;

// ── document_ingests ───────────────────────────────────────────────────────────
// One row per uploaded course PDF — async processing status plus the AI-derived
// outline (ordered sections with page ranges) stored as JSONB.

export const DOCUMENT_INGEST_STATUSES = [
  "processing",
  "ready",
  "failed",
] as const;
export type DocumentIngestStatus = (typeof DOCUMENT_INGEST_STATUSES)[number];

export interface OutlineSection {
  title: string;
  pageStart: number;
  pageEnd: number;
  summary: string;
}

export const documentIngests = pgTable("document_ingests", {
  fileId: uuid("file_id")
    .primaryKey()
    .references(() => uploadedFiles.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("processing"),
  stage: text("stage"),
  error: text("error"),
  pageCount: integer("page_count"),
  chunkCount: integer("chunk_count"),
  outline: jsonb("outline").$type<OutlineSection[]>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DocumentIngest = typeof documentIngests.$inferSelect;

// ── document_embeddings ────────────────────────────────────────────────────────
// File-scoped RAG chunks with page provenance, mirroring material_embeddings.

export const documentEmbeddings = pgTable("document_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => uploadedFiles.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
