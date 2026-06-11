-- Migration 0028: course_documents — multiple reference documents per course.
-- Links uploaded PDFs to courses for AI use (structure generation, lesson
-- drafting). The legacy single courses.course_pdf_id stays for the
-- learner-facing "PDF de cours complet"; existing values are backfilled here
-- so they appear in the document list.

CREATE TABLE IF NOT EXISTS course_documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_id    UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, file_id)
);

CREATE INDEX IF NOT EXISTS course_documents_course_id_idx
  ON course_documents (course_id);

-- Backfill: every existing course PDF becomes a listed document. Idempotent.
INSERT INTO course_documents (course_id, file_id, title)
SELECT c.id, c.course_pdf_id, f.filename
FROM courses c
JOIN uploaded_files f ON f.id = c.course_pdf_id
WHERE c.course_pdf_id IS NOT NULL
ON CONFLICT (course_id, file_id) DO NOTHING;
