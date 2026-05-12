-- Atomic credit-booking cancellation.
--
-- Replaces the two-step pattern in issue-refund (UPDATE bookings, then RPC
-- return_credit) with a single transaction so a crash between those ops
-- can't leave the booking cancelled but the credit permanently lost.
--
-- p_return_credit: true  → decrement credits_remaining (outside cancel window)
--                  false → cancel only, no credit returned (inside window)
--
-- Modelled on book_with_credit() (0011): FOR UPDATE lock on booking, then
-- atomic UPDATE of both rows in one transaction.

CREATE OR REPLACE FUNCTION public.cancel_credit_booking(
  p_booking_id    uuid,
  p_return_credit boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _booking RECORD;
BEGIN
  -- Lock the booking row to guard against concurrent double-cancel
  SELECT id, status, membership_id
    INTO _booking
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

  IF _booking IS NULL THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  -- Idempotent: already cancelled means nothing left to do
  IF _booking.status = 'cancelled' THEN
    RETURN;
  END IF;

  IF _booking.status != 'confirmed' THEN
    RAISE EXCEPTION 'Booking is not confirmed (status: %)', _booking.status;
  END IF;

  -- Cancel the booking
  UPDATE bookings
     SET status       = 'cancelled',
         cancelled_at = now()
   WHERE id = p_booking_id;

  -- Return credit atomically in the same transaction (clip cards only;
  -- NULL credits_remaining = unlimited subscription — no-op via WHERE clause)
  IF p_return_credit AND _booking.membership_id IS NOT NULL THEN
    UPDATE memberships
       SET credits_remaining = credits_remaining + 1
     WHERE id = _booking.membership_id
       AND credits_remaining IS NOT NULL;
  END IF;
END;
$$;
