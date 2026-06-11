-- Migration 0027: document ingest pipeline for uploaded course PDFs.
-- document_ingests: one row per uploaded file — processing status + the
--   AI-derived outline (sections with page ranges) stored as JSONB.
-- document_embeddings: file-scoped RAG chunks with page provenance, mirroring
--   material_embeddings (1024 dims = mistral-embed output).

CREATE TABLE IF NOT EXISTS document_ingests (
  file_id      UUID PRIMARY KEY REFERENCES uploaded_files(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'processing',
  stage        TEXT,
  error        TEXT,
  page_count   INTEGER,
  chunk_count  INTEGER,
  outline      JSONB,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_start  INTEGER NOT NULL,
  page_end    INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  embedding   vector(1024) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_embeddings_file_id_idx
  ON document_embeddings (file_id);

CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx
  ON document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
