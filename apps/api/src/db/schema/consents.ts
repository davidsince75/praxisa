import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

// ── policy_consents ────────────────────────────────────────────────────────────
//
// Append-only record of each user's acceptance of a versioned policy.
// Rules:
//   - Rows are never updated or deleted (immutable consent audit trail).
//   - A new row is inserted each time a user accepts any policy version.
//   - policy_type identifies which policy (e.g. "terms", "privacy", "dpa").
//   - policy_version is a free-form string set by the application
//     (e.g. "2024-01-15", "v3.1") — the app owns the versioning scheme.
//   - source_ip is stored as a /24 subnet string for pseudonymisation.

export const POLICY_TYPES = [
  "terms_of_service",
  "privacy_policy",
  "data_processing_agreement",
] as const;

export type PolicyType = (typeof POLICY_TYPES)[number];

export const policyConsents = pgTable("policy_consents", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),

  // Which policy the user accepted
  policyType: text("policy_type").notNull(),

  // The version string of the policy at the time of acceptance
  policyVersion: text("policy_version").notNull(),

  // When the acceptance was recorded (set explicitly, not DB default,
  // so it matches the request timestamp rather than the insert timestamp)
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),

  // HTTP request ID — links this record to the audit_events row
  requestId: text("request_id").notNull(),

  // Client IP scrubbed to /24 subnet (e.g. "1.2.3.0/24")
  sourceIp: text("source_ip"),
});

export type PolicyConsent = typeof policyConsents.$inferSelect;
export type NewPolicyConsent = typeof policyConsents.$inferInsert;
