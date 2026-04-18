-- Prevent duplicate bookings at the DB level.
-- A user cannot book the same session on the same date twice.
-- The UI loading state is a soft guard; this is the hard guard.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_unique_user_session_date
  UNIQUE (user_id, session_id, session_date);
