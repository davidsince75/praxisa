import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { initAuditSdk, InMemoryAuditSink } from "@praxisa/audit-sdk";
import { loadConfig } from "./shared/config.js";
import { createLogger } from "./shared/logger.js";
import { dbPlugin } from "./db/index.js";
import { commsPlugin } from "./modules/comms/index.js";
import { authDecoratorPlugin } from "./modules/auth/decorator.js";
import { authPlugin } from "./modules/auth/index.js";
import { learningPlugin } from "./modules/learning/index.js";
import { gdprPlugin } from "./modules/gdpr/index.js";
import { migrationPlugin } from "./modules/migration/index.js";
import { aiPlugin } from "./modules/ai/index.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);

// Audit SDK
// TODO: replace InMemoryAuditSink with DrizzleAuditSink once audit_events table exists
initAuditSdk(new InMemoryAuditSink());

// App
const app = Fastify({
  loggerInstance: logger,
  requestIdHeader: "x-request-id",
  genReqId: () => crypto.randomUUID(),
  trustProxy: true,
});

// Security middleware
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: config.corsOrigins, credentials: true });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: undefined,
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
await app.register(aiPlugin, {
  prefix: "/v1",
  ...(config.mistralApiKey !== undefined
    ? { mistralApiKey: config.mistralApiKey }
    : {}),
});

// Health endpoints
app.get("/health", (_request, reply) => {
  return reply.send({ status: "ok" });
});

app.get("/ready", (_request, reply) => {
  return reply.send({ status: "ok" });
});

// Start
await app.listen({ port: config.port, host: "0.0.0.0" });
reply) => {
  return reply.send({ status: "ok" });
});

app.get("/ready", (_request, reply) => {
  return reply.send({ status: "ok" });
});

// Start
await app.listen({ port: config.port, host: "0.0.0.0" });
