/**
 * Database migration runner.
 * Applies pending Drizzle migrations from the ./migrations folder.
 *
 * Usage: pnpm db:migrate
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname });

await pool.end();

process.stdout.write('Migrations applied successfully.\n');
