-- Migration 0020: Guarantee provisional_until column exists.
-- Migration 0017 was recorded as applied but the column was never created
-- (ALTER TYPE ADD VALUE inside a transaction can silently fail on some PG versions).
-- This migration is idempotent and will fix the column in all environments.
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS provisional_until TIMESTAMPTZ;
