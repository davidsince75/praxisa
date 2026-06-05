-- Migration 0017: Add provisional enrolment status for Qualiopi 14-day withdrawal period
ALTER TYPE enrolment_status ADD VALUE 'provisional';
--> statement-breakpoint
ALTER TABLE enrolments ADD COLUMN provisional_until TIMESTAMPTZ;
