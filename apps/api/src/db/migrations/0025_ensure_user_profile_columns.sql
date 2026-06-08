-- Migration 0025: ensure user profile columns exist on the users table.
-- Idempotent — ADD COLUMN IF NOT EXISTS is safe even if 0024 already ran.
-- Fixes: login fails when 0024 was blocked or not applied on Railway.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'France';
