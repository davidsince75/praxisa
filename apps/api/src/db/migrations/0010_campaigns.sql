-- 0010_campaigns.sql

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_target AS ENUM ('all_students', 'course_enrolled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  subject         VARCHAR(500) NOT NULL,
  body            TEXT        NOT NULL,
  target_type     campaign_target NOT NULL DEFAULT 'all_students',
  target_course_id UUID        REFERENCES courses(id),
  status          campaign_status NOT NULL DEFAULT 'draft',
  recipient_count INTEGER,
  sent_at         TIMESTAMPTZ,
  created_by      UUID        NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx     ON campaigns(status);
CREATE INDEX IF NOT EXISTS campaigns_created_by_idx ON campaigns(created_by);
CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns(created_at DESC);
