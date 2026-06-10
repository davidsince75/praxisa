import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, passwordInvalidationKey } from "./service.js";
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
          return reply.status(401).send({ error: "Non autorisé" });
        }

        let payload: JwtPayload;
        try {
          payload = await verifyToken(auth.slice(7), config.jwt.publicKey);
        } catch {
          return reply.status(401).send({ error: "Jeton invalide ou expiré" });
        }

        // Reject session tokens issued before the user's last password reset.
        // Fail-open on Redis errors: this is a secondary control and must not
        // take the whole API down with it.
        if (payload.iat !== undefined) {
          try {
            const invalidatedAt = await fastify.redis.get(
              passwordInvalidationKey(payload.sub),
            );
            if (invalidatedAt !== null && payload.iat < Number(invalidatedAt)) {
              return reply
                .status(401)
                .send({ error: "Session expirée — veuillez vous reconnecter" });
            }
          } catch (err: unknown) {
            request.log.error(
              { err },
              "Password-invalidation check failed — allowing request",
            );
          }
        }

        request.jwtPayload = payload;
      },
    );

    done();
  },
  { name: "auth-decorator", dependencies: ["db", "redis"] },
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
