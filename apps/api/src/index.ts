import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { initAuditSdk, InMemoryAuditSink } from "@praxisa/audit-sdk";
import { loadConfig } from "./shared/config.js";
import { createLogger } from "./shared/logger.js";
import { dbPlugin } from "./db/index.js";
import { authPlugin } from "./modules/auth/index.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);

// ── Audit SDK ──────────────────────────────────────────────────────────────────
// TODO: replace InMemoryAuditSink with DrizzleAuditSink once audit_events table exists
initAuditSdk(new InMemoryAuditSink());

// ── App ────────────────────────────────────────────────────────────────────────
const app = Fastify({
  loggerInstance: logger,
  requestIdHeader: "x-request-id",
  genReqId: () => crypto.randomUUID(),
  trustProxy: true,
});

// ── Security middleware ────────────────────────────────────────────────────────
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: config.corsOrigins, credentials: true });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis: undefined,
});

// ── DB ─────────────────────────────────────────────────────────────────────────
await app.register(dbPlugin, { databaseUrl: config.databaseUrl });

// ── Domain modules ─────────────────────────────────────────────────────────────
await app.register(authPlugin, { prefix: "/v1/auth", config });

// ── Health endpoints ─────────────────────────────────────────────────────────�
