/**
 * Database migration runner.
 * Enables required PostgreSQL extensions, then applies pending Drizzle migrations.
 *
 * Usage: pnpm db:migrate
 */
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const db = drizzle(pool);

// Enable required extensions before running migrations.
// These are idempotent — safe to run on every deploy.
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext`);
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

// Repair: journal entry 0000 originally carried a 2026 timestamp while every
// later entry uses a 2025-based series. Drizzle only applies migrations whose
// journal "when" exceeds the highest created_at already recorded, so any
// database initialised with the bad value silently skipped every migration
// added afterwards (root cause of the missing user_profiles, content_body and
// uploaded_files objects that previous repair scripts patched around).
// Rewrite the poisoned bookkeeping row to the corrected journal value
// (1747440000000) so pending migrations finally apply. Idempotent — no-op on
// healthy and freshly created databases.
await db.execute(sql`
  DO $repair$
  BEGIN
    IF to_regclass('drizzle.__drizzle_migrations') IS NOT NULL THEN
      UPDATE drizzle.__drizzle_migrations
      SET created_at = 1747440000000
      WHERE created_at = 1779051335163;
    END IF;
  END
  $repair$;
`);

await migrate(db, {
  migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
});

await pool.end();

process.stdout.write("Migration complete.\n");
