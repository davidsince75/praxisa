-- Migration 0018: Add delivery type to campaigns (internal / external / targeted)
CREATE TYPE campaign_delivery_type AS ENUM ('internal', 'external', 'targeted');
--> statement-breakpoint
ALTER TABLE campaigns ADD COLUMN delivery_type campaign_delivery_type NOT NULL DEFAULT 'external';
--> statement-breakpoint
ALTER TABLE campaigns ALTER COLUMN subject DROP NOT NULL;
