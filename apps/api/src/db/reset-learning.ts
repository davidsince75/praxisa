/**
 * Truncates all learning data so the seed can run cleanly.
 * Does NOT touch users or auth tables.
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

await pool.query(`
  TRUNCATE
    quiz_attempts,
    quiz_questions,
    lesson_progress,
    enrolments,
    exercises,
    lessons,
    course_modules,
    courses
  RESTART IDENTITY CASCADE
`);

await pool.end();
console.log("✓ Learning data cleared. Run db:seed next.");
