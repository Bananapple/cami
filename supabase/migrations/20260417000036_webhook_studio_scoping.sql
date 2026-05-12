-- ============================================================================
-- Phase 11: Multi-tenant webhook scoping
--
-- Closes webhook-audit findings #1, #2, #3, #6, #7:
--   - Dedup table now includes studio_id; unique constraint scoped per-studio
--   - Subscription RPCs accept optional studio_id filter
--   - Existing rows backfilled by joining payment_id → payments.studio_id
--
-- Why: when the platform onboards a second studio on a separate Stripe Connect
-- account, the webhook handler will:
--   1. Read event.account from Stripe Connect events
--   2. Resolve studio_id from studio_payment_providers.provider_account_id
--   3. Insert dedup row with that studio_id
--   4. Validate the payment lookup matches the resolved studio
--
-- Without this scoping, a malicious payload from Studio B claiming to confirm
-- Studio A's pending payment would succeed if it had a valid signature on the
-- platform secret. With studio scoping, the handler refuses to cross studios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add studio_id to payment_webhook_events (nullable for backward compat)
-- ----------------------------------------------------------------------------
ALTER TABLE payment_webhook_events
  ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE CASCADE;

-- Backfill: existing rows can derive studio_id from their linked payment.
UPDATE payment_webhook_events e
   SET studio_id = p.studio_id
  FROM payments p
 WHERE e.payment_id = p.id
   AND e.studio_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Replace unique constraint to include studio_id
--
-- Use NULLS NOT DISTINCT so that legacy rows (where studio_id couldn't be
-- backfilled) still dedup correctly during the transition. PG 15+ required.
-- New rows will always have studio_id set per the webhook handler change.
-- ----------------------------------------------------------------------------
ALTER TABLE payment_webhook_events
  DROP CONSTRAINT IF EXISTS payment_webhook_events_provider_provider_event_id_key;

ALTER TABLE payment_webhook_events
  ADD CONSTRAINT payment_webhook_events_unique_per_studio
  UNIQUE NULLS NOT DISTINCT (provider, provider_event_id, studio_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_studio
  ON payment_webhook_events (studio_id, received_at);

-- ----------------------------------------------------------------------------
-- 3. Subscription RPCs: optional studio_id filter
--
-- Today: looked up memberships by provider_subscription_id alone. Risk: if two
-- studios ever have the same subscription_id (impossible under normal Stripe
-- usage but possible after data restore or a Stripe ID collision), we'd
-- update the wrong studio's membership.
--
-- Adding p_studio_id as DEFAULT NULL keeps the call site backward-compatible
-- (webhook can pass NULL during the transition), but new code should always
-- pass it. When NULL, falls back to the original behavior.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_membership_by_subscription(
  p_subscription_id text,
  p_studio_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership RECORD;
BEGIN
  SELECT id, valid_until INTO _membership
    FROM memberships
   WHERE provider_subscription_id = p_subscription_id
     AND (p_studio_id IS NULL OR studio_id = p_studio_id)
   FOR UPDATE;

  IF _membership IS NULL THEN RETURN; END IF;

  UPDATE memberships
     SET valid_until = (GREATEST(valid_until, current_date) + interval '1 month' + interval '3 days')::date,
         status = 'active'
   WHERE id = _membership.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_membership_by_subscription(
  p_subscription_id text,
  p_studio_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE memberships
     SET status = 'cancelled',
         cancelled_at = now()
   WHERE provider_subscription_id = p_subscription_id
     AND (p_studio_id IS NULL OR studio_id = p_studio_id);
END;
$$;

-- Re-revoke EXECUTE on the new signatures (REVOKE is per-signature in PG).
-- The old single-arg signature is gone; new signature needs explicit REVOKE.
REVOKE EXECUTE ON FUNCTION public.renew_membership_by_subscription(text, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_membership_by_subscription(text, uuid) FROM PUBLIC, anon, authenticated;
