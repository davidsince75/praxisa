/**
 * One-off repair: create user_profiles table if missing.
 * Run: DATABASE_URL=<railway-url> tsx apps/api/src/db/repair-user-profiles.ts
 * Idempotent -- safe to run multiple times.
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });

await pool.query(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone       TEXT,
    address     TEXT,
    city        TEXT,
    postal_code TEXT,
    country     TEXT NOT NULL DEFAULT 'France',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
console.log("OK user_profiles table ready");

const res = await pool.query(
  "DELETE FROM __drizzle_migrations WHERE tag LIKE '%0026%' RETURNING tag",
);
if ((res.rowCount ?? 0) > 0) {
  console.log("Cleared stale migration entry:", res.rows[0].tag);
} else {
  console.log("No stale tracking entry found");
}

await pool.end();
console.log("Done.");
