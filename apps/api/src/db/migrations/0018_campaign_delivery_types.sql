-- Migration 0018: Add delivery type to campaigns (internal / external / targeted)
-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).
DO $$ BEGIN
  CREATE TYPE campaign_delivery_type AS ENUM ('internal', 'external', 'targeted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delivery_type campaign_delivery_type NOT NULL DEFAULT 'external';
--> statement-breakpoint
ALTER TABLE campaigns ALTER COLUMN subject DROP NOT NULL;
