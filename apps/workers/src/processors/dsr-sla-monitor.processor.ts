import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { and, eq, lt, inArray } from "drizzle-orm";
import type { Logger } from "pino";
import type { WorkerDb } from "../db.js";
import type { WorkerConfig } from "../config.js";
import type { DsrSlaMonitorJobData } from "../queues.js";
import { QUEUE_DSR_SLA_MONITOR } from "../queues.js";

import { gdprRequests } from "../../../api/src/db/schema/index.js";

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

// 30-day GDPR SLA; alert at 28 days to give ops a 2-day buffer
const SLA_DAYS = 30;
const ALERT_BUFFER_DAYS = 2;
const ALERT_THRESHOLD_MS = (SLA_DAYS - ALERT_BUFFER_DAYS) * 24 * 60 * 60 * 1000;

async function sendSlaAlert(
  config: WorkerConfig,
  overdueRequests: {
    id: string;
    userId: string;
    createdAt: Date;
    type: string;
  }[],
): Promise<void> {
  const rows = overdueRequests
    .map(
      (r) =>
        `<tr><td>${r.id}</td><td>${r.userId}</td><td>${r.type}</td>` +
        `<td>${r.createdAt.toISOString()}</td></tr>`,
    )
    .join("");

  const res = await fetch(BREVO_SMTP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.brevo.apiKey,
    },
    body: JSON.stringify({
      sender: {
        email: config.brevo.senderEmail,
        name: config.brevo.senderName,
      },
      to: [{ email: config.adminEmail }],
      subject: `[ACTION REQUIRED] ${String(overdueRequests.length)} DSR request(s) approaching 30-day SLA`,
      htmlContent: `
        <h2>DSR SLA Alert — Praxisa</h2>
        <p>The following ${String(overdueRequests.length)} DSR request(s) are within
        ${String(ALERT_BUFFER_DAYS)} days of the 30-day GDPR response deadline
        and are not yet completed.</p>
        <table border="1" cellpadding="4">
          <thead>
            <tr><th>Request ID</th><th>User ID</th><th>Type</th><th>Opened At</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p>Review and complete these requests immediately at your DPO dashboard.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo error ${String(res.status)}: ${body}`);
  }
}

// ── SLA check logic (exported for testing) ────────────────────────────────────

export async function runSlaMonitor(
  db: WorkerDb,
  config: WorkerConfig,
  logger: Logger,
): Promise<number> {
  const threshold = new Date(Date.now() - ALERT_THRESHOLD_MS);

  const overdue = await db
    .select({
      id: gdprRequests.id,
      userId: gdprRequests.userId,
      type: gdprRequests.type,
      createdAt: gdprRequests.createdAt,
    })
    .from(gdprRequests)
    .where(
      and(
        inArray(gdprRequests.status, ["pending", "in_progress"]),
        lt(gdprRequests.createdAt, threshold),
      ),
    );

  if (overdue.length === 0) {
    logger.info("DSR SLA monitor: no overdue requests");
    return 0;
  }

  logger.warn(
    { count: overdue.length },
    "DSR SLA monitor: overdue requests found, sending alert",
  );

  await sendSlaAlert(config, overdue);

  logger.info(
    { count: overdue.length, adminEmail: config.adminEmail },
    "DSR SLA alert sent",
  );

  return overdue.length;
}

// ── BullMQ Worker factory ──────────────────────────────────────────────────────

export function createSlaMonitorWorker(
  connection: ConnectionOptions,
  db: WorkerDb,
  config: WorkerConfig,
  logger: Logger,
): Worker<DsrSlaMonitorJobData> {
  return new Worker<DsrSlaMonitorJobData>(
    QUEUE_DSR_SLA_MONITOR,
    async (job: Job<DsrSlaMonitorJobData>) => {
      logger.debug({ jobId: job.id }, "SLA monitor job started");
      const count = await runSlaMonitor(db, config, logger);
      logger.debug(
        { jobId: job.id, overdueCount: count },
        "SLA monitor job done",
      );
    },
    { connection },
  );
}
