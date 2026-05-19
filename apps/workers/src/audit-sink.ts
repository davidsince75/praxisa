import type { AuditSink, AuditEvent } from "@praxisa/audit-sdk";
import type { WorkerDb } from "./db.js";
import { auditEvents } from "../../api/src/db/schema/index.js";

/**
 * Production AuditSink for the workers process.
 * Mirrors apps/api/src/db/audit-sink.ts — kept separate to avoid a
 * cross-app dist dependency between the workers and api packages.
 */
export class DrizzleAuditSink implements AuditSink {
  constructor(private readonly db: WorkerDb) {}

  async write(event: AuditEvent): Promise<void> {
    await this.db.insert(auditEvents).values({
      id: event.id,
      eventAt: event.eventAt,
      actorUserId: event.actorUserId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      dataClassification: event.dataClassification,
      requestId: event.requestId,
      sourceIp: event.sourceIp ?? null,
      userAgentHash: event.userAgentHash ?? null,
      policyDecision: event.policyDecision ?? null,
      metadata: event.metadata ?? null,
    });
  }
}
