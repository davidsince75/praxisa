import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let _pool: Pool | null = null;

export function createDb(databaseUrl: string) {
  _pool = new Pool({ connectionString: databaseUrl, max: 5 });
  return drizzle(_pool);
}

export type WorkerDb = ReturnType<typeof createDb>;

export async function closeDb(): Promise<void> {
  if (_pool !== null) {
    await _pool.end();
    _pool = null;
  }
}
