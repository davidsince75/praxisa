import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";

interface RedisPluginOptions {
  redisUrl: string;
}

/**
 * Registers an ioredis client as fastify.redis.
 * fp-scoped so all route plugins can access it.
 * Used by: @fastify/rate-limit (shared counters), /ready health check.
 */
export const redisPlugin = fp(
  (
    fastify: FastifyInstance,
    opts: RedisPluginOptions,
    done: (err?: Error) => void,
  ) => {
    const redis = new Redis(opts.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redis.on("error", (err: Error) => {
      fastify.log.error({ err }, "Redis connection error");
    });

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    done();
  },
  { name: "redis" },
);

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}
