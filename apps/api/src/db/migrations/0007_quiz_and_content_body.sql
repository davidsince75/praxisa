-- Migration 0007: quiz questions + attempts + lesson content_body
-- Adds structured quiz storage and rich-text lesson body.

-- Add content_body to lessons (stores HTML/markdown for text lessons)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_body text;

-- Quiz questions (belongs to an exercise of type 'quiz')
CREATE TABLE IF NOT EXISTS quiz_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position          integer NOT NULL DEFAULT 0,
  question_text     text NOT NULL,
  options           text NOT NULL DEFAULT '[]',   -- JSON: [{id, text}, ...]
  correct_option_id text NOT NULL,
  explanation       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_exercise
  ON quiz_questions(exercise_id);

-- Quiz attempts (one per student per exercise)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES users(id),
  enrolment_id  uuid NOT NULL REFERENCES enrolments(id),
  answers       text NOT NULL DEFAULT '{}',  -- JSON: {[questionId]: selectedOptionId}
  score         integer NOT NULL DEFAULT 0,
  max_score     integer NOT NULL DEFAULT 0,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_exercise_student
  ON quiz_attempts(exercise_id, student_id);
