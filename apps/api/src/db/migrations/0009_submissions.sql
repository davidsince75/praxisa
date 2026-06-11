-- Migration 0009: submissions table
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "submission_status" AS ENUM('submitted', 'grading', 'graded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
  "id"           UUID              NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "exercise_id"  UUID              NOT NULL REFERENCES "exercises"("id"),
  "enrolment_id" UUID              NOT NULL REFERENCES "enrolments"("id"),
  "student_id"   UUID              NOT NULL REFERENCES "users"("id"),
  "body"         TEXT              NOT NULL,
  "file_url"     TEXT,
  "status"       "submission_status" NOT NULL DEFAULT 'submitted',
  "score"        INTEGER,
  "feedback"     TEXT,
  "graded_by"    UUID              REFERENCES "users"("id"),
  "graded_at"    TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_exercise_id"  ON "submissions"("exercise_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_enrolment_id" ON "submissions"("enrolment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_student_id"   ON "submissions"("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_status"       ON "submissions"("status");
