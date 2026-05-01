-- ============================================================================
-- Fix: allow rebooking a class after cancellation
--
-- The original UNIQUE(user_id, class_instance_id) constraint is a full unique
-- index — it blocks rebooking a class you previously cancelled (status='cancelled').
-- Replace it with a partial unique index scoped to active bookings only.
-- ============================================================================

-- Drop the full unique constraint (name from 0008_security_hardening.sql)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_instance_unique;

-- Partial unique index: only one active booking per user per class instance
CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_instance_active_unique
  ON bookings (user_id, class_instance_id)
  WHERE status IN ('pending', 'confirmed');
