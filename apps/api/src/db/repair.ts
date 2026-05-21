import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

await pool.query(
  `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_body text`,
);
console.log("✓ content_body column added");

await pool.query(`
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    question_text text NOT NULL,
    options text NOT NULL DEFAULT '[]',
    correct_option_id text NOT NULL,
    explanation text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`);
console.log("✓ quiz_questions table ready");

await pool.query(`
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES users(id),
    enrolment_id uuid NOT NULL REFERENCES enrolments(id),
    answers text NOT NULL DEFAULT '{}',
    score integer NOT NULL DEFAULT 0,
    max_score integer NOT NULL DEFAULT 0,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);
console.log("✓ quiz_attempts table ready");

await pool.end();
console.log("\nDone. Run db:seed next.");
