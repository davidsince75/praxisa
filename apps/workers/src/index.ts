import { pino } from "pino";
import { Redis } from "ioredis";
import { initAuditSdk, InMemoryAuditSink } from "@praxisa/audit-sdk";
import { loadConfig } from "./config.js";
import { createDb, closeDb } from "./db.js";
import {
  createDsrSweepQueue,
  createDsrSlaQueue,
  QUEUE_DSR_SWEEP,
  QUEUE_DSR_SLA_MONITOR,
} from "./queues.js";
import { createErasureWorker } from "./processors/dsr-erasure.processor.js";
import { createSlaMonitorWorker } from "./processors/dsr-sla-monitor.processor.js";

// ── Bootstrap ──────────────────────────────────────────────────────────────────

const config = loadConfig();

const logger = pino({
  level: config.logLevel,
  ...(config.nodeEnv === "development"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});

// Audit SDK — same in-memory sink as API until DrizzleAuditSink is wired up
initAuditSdk(new InMemoryAuditSink());

// Redis connection (shared by BullMQ queues and workers)
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

// Database
const db = createDb(config.databaseUrl);

// Queues (needed to schedule repeatable jobs)
const sweepQueue = createDsrSweepQueue(connection);
const slaQueue = createDsrSlaQueue(connection);

// Workers
const erasureWorker = createErasureWorker(connection, db, config, logger);
const slaWorker = createSlaMonitorWorker(connection, db, config, logger);

// ── Schedule repeatable jobs ───────────────────────────────────────────────────

// Erasure sweep: every 60 seconds
await sweepQueue.upsertJobScheduler(
  "erasure-sweep-scheduler",
  { every: 60_000 },
  {
    name: "erasure-sweep",
    data: { triggeredAt: new Date().toISOString() },
  },
);

// SLA monitor: daily at 06:00 UTC
await slaQueue.upsertJobScheduler(
  "sla-monitor-scheduler",
  { pattern: "0 6 * * *" },
  {
    name: "sla-monitor",
    data: { triggeredAt: new Date().toISOString() },
  },
);

logger.info(
  {
    queues: [QUEUE_DSR_SWEEP, QUEUE_DSR_SLA_MONITOR],
  },
  "Workers started",
);

// ── Graceful shutdown ──────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");

  await erasureWorker.close();
  await slaWorker.close();
  await sweepQueue.close();
  await slaQueue.close();
  await closeDb();
  connection.disconnect();

  logger.info("Workers shut down cleanly");
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
