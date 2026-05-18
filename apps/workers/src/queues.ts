import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

// ── Queue names ────────────────────────────────────────────────────────────────

export const QUEUE_DSR_SWEEP = "dsr:sweep";
export const QUEUE_DSR_SLA_MONITOR = "dsr:sla-monitor";

// ── Job data types ─────────────────────────────────────────────────────────────

/** Payload for the periodic erasure sweep — no data needed, the processor
 *  queries the DB for all pending requests on each run. */
export interface DsrSweepJobData {
  triggeredAt: string;
}

/** Payload for the SLA monitor sweep. */
export interface DsrSlaMonitorJobData {
  triggeredAt: string;
}

// ── Queue factories ────────────────────────────────────────────────────────────

export function createDsrSweepQueue(
  connection: ConnectionOptions,
): Queue<DsrSweepJobData> {
  return new Queue<DsrSweepJobData>(QUEUE_DSR_SWEEP, { connection });
}

export function createDsrSlaQueue(
  connection: ConnectionOptions,
): Queue<DsrSlaMonitorJobData> {
  return new Queue<DsrSlaMonitorJobData>(QUEUE_DSR_SLA_MONITOR, { connection });
}
