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

await migrate(db, {
  migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
});

await pool.end();

process.stdout.write("Migration complete.\n");
