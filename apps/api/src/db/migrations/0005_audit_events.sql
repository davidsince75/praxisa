-- Migration 0005: append-only audit_events table
--
-- Design notes:
--   - No FK on actor_user_id: audit writes must never fail due to referential
--     integrity violations (e.g. after a GDPR erasure zeroes the users row).
--   - No updated_at: rows are never modified after insert.
--   - source_ip stores a /24 subnet string for pseudonymisation.

CREATE TABLE "audit_events" (
  "id"                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_at"            timestamptz NOT NULL,
  "actor_user_id"       text        NOT NULL,
  "event_type"          text        NOT NULL,
  "entity_type"         text        NOT NULL,
  "entity_id"           text,
  "data_classification" text        NOT NULL,
  "request_id"          text        NOT NULL,
  "source_ip"           text,
  "user_agent_hash"     text,
  "policy_decision"     jsonb,
  "metadata"            jsonb
);

-- Time-range queries (most common access pattern for compliance reports)
CREATE INDEX "audit_events_event_at_idx"
  ON "audit_events" ("event_at" DESC);

-- Per-actor queries (DSR subject access requests)
CREATE INDEX "audit_events_actor_user_id_idx"
  ON "audit_events" ("actor_user_id");

-- Per-entity queries (e.g. "all events for this batch")
CREATE INDEX "audit_events_entity_idx"
  ON "audit_events" ("entity_type", "entity_id");
