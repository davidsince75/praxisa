-- Migration 0004: material_embeddings for RAG
-- Requires pgvector extension (enabled in postgres-init.sql)
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).

CREATE TABLE IF NOT EXISTS "material_embeddings" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lesson_id"   uuid NOT NULL REFERENCES "lessons"("id"),
  "chunk_index" integer NOT NULL,
  "chunk_text"  text NOT NULL,
  "embedding"   vector(1024) NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

-- IVFFlat index for approximate nearest-neighbour search (cosine distance).
-- lists=100 is appropriate for up to ~1M rows; tune at scale.
CREATE INDEX IF NOT EXISTS "material_embeddings_embedding_idx"
  ON "material_embeddings"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Fast lookup of all chunks for a given lesson (used during re-ingest).
CREATE INDEX IF NOT EXISTS "material_embeddings_lesson_id_idx"
  ON "material_embeddings" ("lesson_id");
