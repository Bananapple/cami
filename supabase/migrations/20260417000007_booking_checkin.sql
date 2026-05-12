-- 0007_booking_checkin.sql
-- Adds `checked_in_at` to bookings for front-desk attendance tracking.
-- Staff in the same studio can toggle the column.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ NULL;

DROP POLICY IF EXISTS "staff_update_bookings_in_studio" ON bookings;
CREATE POLICY "staff_update_bookings_in_studio" ON bookings
  FOR UPDATE
  USING (user_is_staff(studio_id))
  WITH CHECK (user_is_staff(studio_id));
