-- Migration 0021: Add is_restricted flag to users for Qualiopi trial-period access control.
-- Admins can toggle this; restricted students get 1 course, first 3 modules only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE;
