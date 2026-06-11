-- Migration 0006: policy_consents — immutable consent audit trail
--
-- Design notes:
--   - Append-only: no UPDATE or DELETE is ever issued against this table.
--   - policy_type and policy_version are plain text (no enum) so new policy
--     types can be introduced without a DDL migration.
--   - source_ip stores a /24 subnet string for pseudonymisation.
--   - request_id links each row to the corresponding audit_events row.
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).

CREATE TABLE IF NOT EXISTS "policy_consents" (
  "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid        NOT NULL REFERENCES "users"("id"),
  "policy_type"    text        NOT NULL,
  "policy_version" text        NOT NULL,
  "accepted_at"    timestamptz NOT NULL,
  "request_id"     text        NOT NULL,
  "source_ip"      text
);

-- Look up all consents for a given user (subject access requests, export)
CREATE INDEX IF NOT EXISTS "policy_consents_user_id_idx"
  ON "policy_consents" ("user_id");

-- Look up which users accepted a specific version (compliance audits)
CREATE INDEX IF NOT EXISTS "policy_consents_policy_idx"
  ON "policy_consents" ("policy_type", "policy_version");
