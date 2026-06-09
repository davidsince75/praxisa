CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  postal_code TEXT,
  country     TEXT NOT NULL DEFAULT 'France',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
