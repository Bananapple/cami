-- Sweep zombie pending bookings + payments so abandoned Stripe checkouts
-- don't permanently hold class capacity.
--
-- Background:
--   create-checkout creates bookings(status='pending') + payments(status='pending')
--   before redirecting to Stripe. The capacity check counts pending+confirmed.
--   If the user abandons (closes tab, network drop, expired card), the rows
--   never resolve — capacity is held forever.
--
-- Companion fix:
--   Stripe Checkout sessions are now created with expires_at = now + 30min
--   (see _shared/providers/stripe.ts). After 30 min the session can't be paid
--   on, so it's safe for this sweeper to cancel the corresponding rows.
--
-- Note: only touches drop-in bookings (with payment_id). Credit bookings
-- (membership_id) skip Stripe and confirm immediately, so they never sit
-- in pending state.

CREATE OR REPLACE FUNCTION public.expire_stale_pending_bookings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT := 0;
BEGIN
  -- Cancel pending bookings older than 30 min where the linked payment
  -- is also still pending. If the payment somehow succeeded but the
  -- booking didn't get confirmed, leave it alone — that's a different bug
  -- worth investigating, not silently cancelling.
  WITH cancelled AS (
    UPDATE bookings b
       SET status = 'cancelled'
      FROM payments p
     WHERE b.payment_id = p.id
       AND b.status = 'pending'
       AND b.booked_at < now() - INTERVAL '30 minutes'
       AND p.status = 'pending'
    RETURNING b.id
  )
  SELECT COUNT(*) INTO _count FROM cancelled;

  -- Mark the matched payments as cancelled too. We use the same time window
  -- so we don't accidentally cancel a payment for a product purchase that's
  -- still inside its grace period.
  UPDATE payments p
     SET status = 'cancelled'
   WHERE p.status = 'pending'
     AND p.created_at < now() - INTERVAL '30 minutes';

  RETURN _count;
END;
$$;

-- Schedule the sweeper every 5 minutes. Doesn't need tight timing —
-- the goal is freeing capacity within ~5 min of session expiry, not instant.
--
-- Apply via Supabase SQL Editor:
--   SELECT cron.schedule(
--     'expire-stale-pending-bookings',
--     '*/5 * * * *',
--     $$SELECT public.expire_stale_pending_bookings()$$
--   );
