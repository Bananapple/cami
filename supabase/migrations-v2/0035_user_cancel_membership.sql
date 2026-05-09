-- 0035_user_cancel_membership.sql
-- User-initiated membership cancellation.
--
-- Pattern: user clicks "Cancel" in dashboard → cancel-membership Edge Function
-- calls Stripe subscriptions.update(cancel_at_period_end=true) → calls this
-- RPC to stamp memberships.cancel_scheduled_at so the UI can render
-- "Cancellation scheduled". Stripe's customer.subscription.deleted webhook
-- fires at the end of the current period and invokes
-- cancel_membership_by_subscription() (0028/0032), which flips
-- status='cancelled' + stamps cancelled_at.
--
-- Authorization is enforced by the Edge Function (verifies user owns the
-- membership before calling). This RPC is server-only — REVOKEd from
-- anon/authenticated, only service_role can invoke (mirrors 0030 pattern,
-- e.g. cancel_credit_booking).

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS cancel_scheduled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.request_membership_cancellation(p_membership_id uuid)
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
     SET cancel_scheduled_at = now()
   WHERE id = p_membership_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_membership_cancellation(uuid) FROM PUBLIC, anon, authenticated;
