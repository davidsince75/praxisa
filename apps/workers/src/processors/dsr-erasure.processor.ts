import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import type { Logger } from "pino";
import { emitEvent } from "@praxisa/audit-sdk";
import type { WorkerDb } from "../db.js";
import type { WorkerConfig } from "../config.js";
import type { DsrSweepJobData } from "../queues.js";
import { QUEUE_DSR_SWEEP } from "../queues.js";

// ── Schema imports ─────────────────────────────────────────────────────────────
// Workers import schema directly from the API package source.
// This is intentional: workers share the same DB schema without duplicating it.
// In a future extraction the schema would move to a shared package.
import {
  users,
  gdprRequests,
  enrolments,
  lessonProgress,
  policyConsents,
} from "../../../api/src/db/schema/index.js";

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

// ── Brevo helper ───────────────────────────────────────────────────────────────

async function sendErasureConfirmation(
  config: WorkerConfig,
  userEmail: string,
  userFirstName: string,
): Promise<void> {
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
      to: [{ email: userEmail }],
      subject: "Your erasure request has been completed | Praxisa",
      htmlContent: `
        <p>Bonjour ${userFirstName},</p>
        <p>Your data erasure request has been completed. All personal data associated
        with your Praxisa account has been permanently removed from our systems.</p>
        <p>If you have any questions, please contact privacy@praxisa.fr.</p>
        <p>— L'équipe Praxisa</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo error ${String(res.status)}: ${body}`);
  }
}

// ── Erasure logic (exported for testing) ──────────────────────────────────────

/**
 * Anonymise all PII fields for a user.
 * - email → erased_<id>@praxisa.invalid  (retains DB uniqueness constraint)
 * - firstName / lastName → "[Erased]"
 * - passwordHash → fixed non-valid string (prevents login)
 */
export async function eraseUserPii(
  db: WorkerDb,
  userId: string,
): Promise<void> {
  const erasedEmail = `erased_${userId}@praxisa.invalid`;

  await db
    .update(users)
    .set({
      email: erasedEmail,
      firstName: "[Erased]",
      lastName: "[Erased]",
      passwordHash: "ERASED",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Null out source_ip on consent records — belt-and-suspenders pseudonymisation.
  // The records themselves are retained: they are the company's evidence of lawful
  // basis under Art. 6 GDPR and are exempt from erasure under Art. 17(3)(b).
  await db
    .update(policyConsents)
    .set({ sourceIp: null })
    .where(eq(policyConsents.userId, userId));
}

/**
 * Process all pending erasure requests in a single sweep.
 * Each request is transitioned to in_progress before processing
 * to prevent duplicate processing across multiple worker instances.
 */
export async function runErasureSweep(
  db: WorkerDb,
  config: WorkerConfig,
  logger: Logger,
): Promise<number> {
  // Claim all pending erasure requests atomically
  const claimed = await db
    .update(gdprRequests)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(
      and(eq(gdprRequests.type, "erasure"), eq(gdprRequests.status, "pending")),
    )
    .returning({
      id: gdprRequests.id,
      userId: gdprRequests.userId,
    });

  if (claimed.length === 0) {
    return 0;
  }

  logger.info({ count: claimed.length }, "DSR erasure sweep: claimed requests");

  let processed = 0;

  for (const req of claimed) {
    try {
      // Fetch user PII before zeroing (needed for confirmation email)
      const userRows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, req.userId))
        .limit(1);

      const user = userRows[0];
      if (user === undefined) {
        logger.warn(
          { requestId: req.id, userId: req.userId },
          "DSR erasure: user not found, marking completed",
        );
        await db
          .update(gdprRequests)
          .set({
            status: "completed",
            completedAt: new Date(),
            notes: "User record not found — possibly already erased",
            updatedAt: new Date(),
          })
          .where(eq(gdprRequests.id, req.id));
        continue;
      }

      const originalEmail = user.email;
      const originalFirstName = user.firstName;

      // Send confirmation email BEFORE zeroing (so we still have the address)
      await sendErasureConfirmation(config, originalEmail, originalFirstName);

      // Zero all PII (also nulls consent source_ip)
      await eraseUserPii(db, req.userId);

      // Hard-delete lesson progress (no PII, but reduces re-identification risk)
      const userEnrolments = await db
        .select({ id: enrolments.id })
        .from(enrolments)
        .where(eq(enrolments.studentId, req.userId));

      let deletedProgressCount = 0;
      if (userEnrolments.length > 0) {
        const enrolmentIds = userEnrolments.map((e: { id: string }) => e.id);
        const deleted = await db
          .delete(lessonProgress)
          .where(inArray(lessonProgress.enrolmentId, enrolmentIds))
          .returning({ id: lessonProgress.id });
        deletedProgressCount = deleted.length;
      }

      // Count consent records retained for the completion notes
      const retainedConsents = await db
        .select({ id: policyConsents.id })
        .from(policyConsents)
        .where(eq(policyConsents.userId, req.userId));

      // Mark request completed with a structured retention summary
      const retentionSummary = [
        `Erased: users PII (email, name, password)`,
        `Hard-deleted: lesson_progress (${String(deletedProgressCount)} rows)`,
        `Retained (Art. 17(3)(b)): policy_consents (${String(retainedConsents.length)} rows, source_ip nulled)`,
        `Retained (Art. 17(3)(b)): audit_events (immutable compliance log)`,
      ].join("; ");

      await db
        .update(gdprRequests)
        .set({
          status: "completed",
          completedAt: new Date(),
          completedBy: null,
          notes: `Auto-completed by erasure worker. ${retentionSummary}`,
          updatedAt: new Date(),
        })
        .where(eq(gdprRequests.id, req.id));

      await emitEvent({
        actorUserId: req.userId,
        eventType: "gdpr.erasure.completed",
        entityType: "user",
        entityId: req.userId,
        dataClassification: "pii:direct",
        requestId: req.id,
        sourceIp: "worker",
        metadata: {
          deletedProgressRows: deletedProgressCount,
          retainedConsentRows: retainedConsents.length,
        },
      });

      logger.info(
        { requestId: req.id, userId: req.userId, deletedProgressCount },
        "DSR erasure completed",
      );
      processed++;
    } catch (err: unknown) {
      logger.error(
        { err, requestId: req.id, userId: req.userId },
        "DSR erasure failed — request left in_progress for retry",
      );
      // Leave in_progress: next sweep run will skip it (only claims 'pending').
      // An operator or SLA monitor will catch stalled in_progress requests.
    }
  }

  return processed;
}

// ── BullMQ Worker factory ──────────────────────────────────────────────────────

export function createErasureWorker(
  connection: ConnectionOptions,
  db: WorkerDb,
  config: WorkerConfig,
  logger: Logger,
): Worker<DsrSweepJobData> {
  return new Worker<DsrSweepJobData>(
    QUEUE_DSR_SWEEP,
    async (job: Job<DsrSweepJobData>) => {
      logger.debug({ jobId: job.id }, "DSR sweep job started");
      const count = await runErasureSweep(db, config, logger);
      logger.debug({ jobId: job.id, processed: count }, "DSR sweep job done");
    },
    {
      connection,
      concurrency: 1, // Serial sweeps prevent race conditions
    },
  );
}
