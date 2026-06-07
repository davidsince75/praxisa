-- Migration 0017: Add provisional_until column for Qualiopi 14-day trial period.
-- A non-null value in the future means the enrolment has restricted module access.
-- No enum change needed — status stays "active" during the trial.
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS provisional_until TIMESTAMPTZ;
