import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

interface DbPluginOptions {
  databaseUrl: string;
}

export const dbPlugin = fp(
  (fastify: FastifyInstance, opts: DbPluginOptions, done: (err?: Error) => void) => {
    const pool = new Pool({ connectionString: opts.databaseUrl, max: 20 });
    const db = drizzle(pool, { schema });

    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await pool.end();
    });

    done();
  },
  { name: "db" },
);

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
