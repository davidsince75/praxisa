-- Migration 0022: uploaded_files (PDF bytea storage) + courses.course_pdf_id
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).
CREATE TABLE IF NOT EXISTS uploaded_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BYTEA NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_pdf_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;
