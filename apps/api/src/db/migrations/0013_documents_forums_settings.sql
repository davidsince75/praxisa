-- Phase 15-18: Student Documents, Discussion Forums, Assignment Deadlines, User Settings
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).

-- 1. Assignment deadlines — add due_at to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- 2. Student documents
DO $$ BEGIN
  CREATE TYPE student_document_status AS ENUM ('draft', 'published', 'evaluated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS student_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES courses(id) ON DELETE SET NULL,
  module_id   UUID REFERENCES course_modules(id) ON DELETE SET NULL,
  lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  status      student_document_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  feedback    TEXT,
  score       INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_course ON student_documents(course_id);

-- 3. Discussion forums
CREATE TABLE IF NOT EXISTS forum_threads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id  UUID REFERENCES lessons(id) ON DELETE SET NULL,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  is_locked  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_course ON forum_threads(course_id);

CREATE TABLE IF NOT EXISTS forum_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id);

-- 4. User preferences (settings)
CREATE TABLE IF NOT EXISTS user_preferences (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme     TEXT NOT NULL DEFAULT 'system',
  locale    TEXT NOT NULL DEFAULT 'fr',
  email_notifications JSONB NOT NULL DEFAULT '{"messages":true,"grading":true,"campaigns":true,"forums":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
