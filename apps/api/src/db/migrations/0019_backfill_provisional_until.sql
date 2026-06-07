-- Migration 0019: Backfill provisional_until for self-enrolled students
-- who enrolled without the column existing yet.
-- enrolled_by IS NULL means self-enrolled (not admin-enrolled).
-- Only backfill active enrolments where provisional_until is still NULL.
UPDATE enrolments
SET provisional_until = enrolled_at + INTERVAL '14 days'
WHERE enrolled_by IS NULL
  AND deleted_at IS NULL
  AND status = 'active'
  AND provisional_until IS NULL
  AND enrolled_at > now() - INTERVAL '14 days';
