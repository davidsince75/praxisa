import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./service.js";
import type { AppConfig } from "../../shared/config.js";
import type { JwtPayload } from "./types.js";

interface AuthDecoratorOptions {
  config: AppConfig;
}

/**
 * Registers `fastify.authenticate` as a preHandler hook.
 * Must be registered (with fp scope) before any route plugin that uses it.
 */
export const authDecoratorPlugin = fp(
  (
    fastify: FastifyInstance,
    opts: AuthDecoratorOptions,
    done: (err?: Error) => void,
  ) => {
    const { config } = opts;

    fastify.decorate(
      "authenticate",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const auth = request.headers.authorization;
        if (!auth?.startsWith("Bearer ")) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        try {
          request.jwtPayload = await verifyToken(
            auth.slice(7),
            config.jwt.publicKey,
          );
        } catch {
          return reply.status(401).send({ error: "Invalid or expired token" });
        }
      },
    );

    done();
  },
  { name: "auth-decorator", dependencies: ["db"] },
);

// ── Fastify type augmentation ──────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    jwtPayload: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
