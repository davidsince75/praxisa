import type { AuditSink, AuditEvent } from "@praxisa/audit-sdk";
import type { Db } from "./index.js";
import { auditEvents } from "./schema/index.js";

/**
 * Production AuditSink — persists audit events to the append-only
 * audit_events table via the application's Drizzle connection pool.
 *
 * Usage:
 *   initAuditSdk(new DrizzleAuditSink(app.db));
 *
 * Never import this in tests — use InMemoryAuditSink instead.
 */
export class DrizzleAuditSink implements AuditSink {
  constructor(private readonly db: Db) {}

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
