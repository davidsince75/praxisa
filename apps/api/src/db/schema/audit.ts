import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ── audit_events ───────────────────────────────────────────────────────────────
//
// Append-only immutable audit log.
// Rules:
//   - No UPDATE or DELETE is ever issued against this table.
//   - actor_user_id is intentionally NOT a FK — audit writes must never fail
//     due to a referential integrity violation (e.g. after an erasure).
//   - source_ip is stored as a /24 subnet string for pseudonymisation.
//   - metadata and policy_decision are free-form JSONB; callers own the shape.

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),

  // When the event occurred (set by emitEvent(), not DB default)
  eventAt: timestamp("event_at", { withTimezone: true }).notNull(),

  // Who triggered the action — no FK, see header comment
  actorUserId: text("actor_user_id").notNull(),

  // Structured event identifier — dot notation e.g. "auth.user.login"
  eventType: text("event_type").notNull(),

  // Domain entity affected
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),

  // PII classification of the data accessed or modified
  dataClassification: text("data_classification").notNull(),

  // HTTP request ID for trace correlation
  requestId: text("request_id").notNull(),

  // Client IP scrubbed to /24 subnet (e.g. "1.2.3.0/24")
  sourceIp: text("source_ip"),

  // SHA-256 of the raw User-Agent string — never store the raw value
  userAgentHash: text("user_agent_hash"),

  // Policy engine result — present for all policy-governed commands
  policyDecision: jsonb("policy_decision"),

  // Additional structured context specific to this event type
  metadata: jsonb("metadata"),
});

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
