import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import { initAuditSdk } from "@praxisa/audit-sdk";
import { DrizzleAuditSink } from "./db/audit-sink.js";
import { loadConfig } from "./shared/config.js";
import { createLogger } from "./shared/logger.js";
import { redisPlugin } from "./shared/redis.js";
import { dbPlugin } from "./db/index.js";
import { commsPlugin } from "./modules/comms/index.js";
import { authDecoratorPlugin } from "./modules/auth/decorator.js";
import { authPlugin } from "./modules/auth/index.js";
import { learningPlugin } from "./modules/learning/index.js";
import { gdprPlugin } from "./modules/gdpr/index.js";
import { migrationPlugin } from "./modules/migration/index.js";
import { aiPlugin } from "./modules/ai/index.js";
import { auditPlugin } from "./modules/audit/index.js";
import { usersPlugin } from "./modules/users/index.js";
import { analyticsPlugin } from "./modules/analytics/index.js";
import { certificatesPlugin } from "./modules/certificates/index.js";
import { messagingPlugin } from "./modules/messaging/index.js";
import { submissionsPlugin } from "./modules/submissions/index.js";
import { campaignsPlugin } from "./modules/campaigns/index.js";
import { notificationsPlugin } from "./modules/notifications/index.js";
import { ratingsPlugin } from "./modules/ratings/index.js";
import { importPlugin } from "./modules/import/index.js";
import { documentsPlugin } from "./modules/documents/index.js";
import { forumsPlugin } from "./modules/forums/index.js";
import { settingsPlugin } from "./modules/settings/index.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);

// App
const app = Fastify({
  loggerInstance: logger,
  requestIdHeader: "x-request-id",
  genReqId: () => crypto.randomUUID(),
  trustProxy: true,
});

// Redis (fp-scoped — must precede rate-limit so app.redis is decorated first)
await app.register(redisPlugin, { redisUrl: config.redisUrl });

// Security middleware
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: config.corsOrigins, credentials: true });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: app.redis,
});

// DB
await app.register(dbPlugin, { databaseUrl: config.databaseUrl });

// Comms
await app.register(commsPlugin, {
  brevoApiKey: config.comms.brevoApiKey,
  senderEmail: config.comms.senderEmail,
  senderName: config.comms.senderName,
  appBaseUrl: config.appBaseUrl,
});

// Auth decorator (fp-scoped — must precede all route plugins that use authenticate)
await app.register(authDecoratorPlugin, { config });

// Domain modules
await app.register(authPlugin, { prefix: "/v1/auth", config });
await app.register(learningPlugin, { prefix: "/v1" });
await app.register(gdprPlugin, { prefix: "/v1" });
await app.register(migrationPlugin, { prefix: "/v1" });
await app.register(auditPlugin, { prefix: "/v1" });
await app.register(usersPlugin, { prefix: "/v1" });
await app.register(analyticsPlugin, { prefix: "/v1" });
await app.register(certificatesPlugin, { prefix: "/v1" });
await app.register(messagingPlugin, { prefix: "/v1" });
await app.register(submissionsPlugin, { prefix: "/v1" });
await app.register(campaignsPlugin, { prefix: "/v1" });
await app.register(notificationsPlugin, { prefix: "/v1" });
await app.register(ratingsPlugin, { prefix: "/v1" });
await app.register(importPlugin, { prefix: "/v1" });
await app.register(documentsPlugin, { prefix: "/v1" });
await app.register(forumsPlugin, { prefix: "/v1" });
await app.register(settingsPlugin, { prefix: "/v1" });
await app.register(aiPlugin, {
  prefix: "/v1",
  ...(config.mistralApiKey !== undefined
    ? { mistralApiKey: config.mistralApiKey }
    : {}),
});

// Audit SDK — wired after DB plugin so app.db is available
initAuditSdk(new DrizzleAuditSink(app.db));

// Health endpoints
app.get("/health", (_request, reply) => {
  return reply.send({ status: "ok" });
});

app.get("/ready", async (_request, reply) => {
  try {
    await app.db.execute(sql`SELECT 1`);
    await app.redis.ping();
    return reply.send({ status: "ok" });
  } catch (err: unknown) {
    app.log.error({ err }, "Readiness check failed");
    return reply.status(503).send({ status: "error" });
  }
});

// Start
await app.listen({ port: config.port, host: "0.0.0.0" });
