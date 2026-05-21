-- Migration 0009: submissions table
--> statement-breakpoint
CREATE TYPE "submission_status" AS ENUM('submitted', 'grading', 'graded');
--> statement-breakpoint
CREATE TABLE "submissions" (
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
CREATE INDEX "idx_submissions_exercise_id"  ON "submissions"("exercise_id");
--> statement-breakpoint
CREATE INDEX "idx_submissions_enrolment_id" ON "submissions"("enrolment_id");
--> statement-breakpoint
CREATE INDEX "idx_submissions_student_id"   ON "submissions"("student_id");
--> statement-breakpoint
CREATE INDEX "idx_submissions_status"       ON "submissions"("status");
