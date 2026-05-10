-- 0036_align_valid_until_on_cancel.sql
-- Snap memberships.valid_until to Stripe's actual period end at cancel time.
--
-- Background: activate_membership/renew_membership_by_subscription set
-- valid_until = next-billing-date + 3-day grace. The grace exists to absorb
-- webhook delivery lag during normal renewals (Stripe charges → webhook fires
-- → we extend valid_until). Without it, a delayed webhook would briefly
-- revoke a paying user's access. Sound design for the renewal scenario.
--
-- The grace serves no purpose on cancellation, however — Stripe will not bill
-- again, so there's no webhook lag to absorb. But valid_until still carries
-- the 3-day buffer from the most recent activation/renewal, which means our
-- UI says "Access until <date+3>" while Stripe shows "Cancels on <date>".
-- Confusing.
--
-- Fix: extend request_membership_cancellation to accept the actual Stripe
-- current_period_end (passed through from the cancel-membership Edge
-- Function). When provided, valid_until snaps to that date — no buffer.
-- Renewal grace is untouched.
--
-- The previous 1-arg signature is dropped — only the Edge Function calls this
-- RPC, and it'll pass the new arg as of this release.

DROP FUNCTION IF EXISTS public.request_membership_cancellation(uuid);

CREATE OR REPLACE FUNCTION public.request_membership_cancellation(
  p_membership_id uuid,
  p_valid_until   date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership RECORD;
BEGIN
  SELECT id, status, cancel_scheduled_at
    INTO _membership
    FROM memberships
   WHERE id = p_membership_id
   FOR UPDATE;

  IF _membership IS NULL THEN
    RAISE EXCEPTION 'Membership not found: %', p_membership_id;
  END IF;

  IF _membership.status <> 'active' THEN
    RAISE EXCEPTION 'Membership is not active (status: %)', _membership.status;
  END IF;

  -- Idempotent: already scheduled means nothing to do
  IF _membership.cancel_scheduled_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE memberships
     SET cancel_scheduled_at = now(),
         valid_until = COALESCE(p_valid_until, valid_until)
   WHERE id = p_membership_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_membership_cancellation(uuid, date) FROM PUBLIC, anon, authenticated;
