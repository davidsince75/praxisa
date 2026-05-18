import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lessons } from "./learning.js";

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
