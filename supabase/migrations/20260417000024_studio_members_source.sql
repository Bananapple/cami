-- Adds source attribution to studio_members.
-- Populated when a member first books (via create-checkout Edge Function).
-- Staff can also edit it manually. NULL = unknown.
ALTER TABLE studio_members
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

COMMENT ON COLUMN studio_members.source IS
  'Acquisition channel: direct, referral, instagram, google, etc. Set on first booking.';
