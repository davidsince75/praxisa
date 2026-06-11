-- Idempotency guards added 2026-06-10 (journal drift repair — see migrate.ts).
CREATE TABLE IF NOT EXISTS gmail_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  email_address    TEXT NOT NULL,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
