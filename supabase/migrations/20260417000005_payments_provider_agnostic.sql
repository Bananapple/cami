-- ============================================================================
-- Phase 5: Provider-Agnostic Payment Layer
--
-- Design principle: the database knows nothing about any specific payment
-- provider. It records a canonical "payment" with a provider name and the
-- provider's opaque external IDs. All provider-specific logic lives in
-- Edge Function adapters (see supabase/functions/_shared/providers/).
--
-- MVP provider: Stripe (via Checkout). Next: Frisbii. Future: Vipps.
-- Adding a provider = implement the adapter interface + insert a row in
-- the payment_providers enum; no schema changes needed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Provider enum — the set of integrations the platform supports.
-- Adding a new provider: ALTER TYPE payment_provider ADD VALUE '...';
-- ----------------------------------------------------------------------------
CREATE TYPE payment_provider AS ENUM (
  'stripe',
  'frisbii',
  'vipps'
);

-- ----------------------------------------------------------------------------
-- studio_payment_providers: which provider(s) each studio has configured,
-- and their merchant/Connect account IDs. Replaces stripe-specific fields
-- on the studios table.
--
-- A studio may have multiple providers configured (e.g., Stripe as primary
-- for cards, Vipps as a Norwegian fallback). is_primary indicates default.
-- ----------------------------------------------------------------------------
CREATE TABLE studio_payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  provider_account_id TEXT,              -- Stripe Connect acct_xxx / Frisbii merchant id / Vipps MSN (NULL = platform account, no Connect)
  is_primary BOOLEAN NOT NULL DEFAULT false,
  onboarded_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,   -- provider-specific settings (fee %, webhook URL, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, provider)
);

-- Exactly one primary provider per studio (when any are configured)
CREATE UNIQUE INDEX idx_studio_payment_primary
  ON studio_payment_providers (studio_id)
  WHERE is_primary = true;

CREATE INDEX idx_studio_payment_providers_active
  ON studio_payment_providers (studio_id)
  WHERE is_active = true;

CREATE TRIGGER trg_studio_payment_providers_touch
  BEFORE UPDATE ON studio_payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE studio_payment_providers ENABLE ROW LEVEL SECURITY;

-- Staff can read their studio's provider config; only owners can write
CREATE POLICY "spp_staff_read" ON studio_payment_providers FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

CREATE POLICY "spp_owner_write" ON studio_payment_providers FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner']::studio_role[]));

-- ----------------------------------------------------------------------------
-- payments: canonical payment record. One row per charge attempt.
--
-- This is our internal "PaymentIntent" — neutral across providers. A Stripe
-- Checkout Session writes its session id into provider_session_id and its
-- eventual PaymentIntent id into provider_payment_id. Frisbii writes its
-- own session/payment ids into the same columns. The application never
-- branches on provider — Edge Function adapters handle that.
-- ----------------------------------------------------------------------------
CREATE TYPE payment_status AS ENUM (
  'requires_action',   -- hosted checkout URL active, user redirected out
  'processing',        -- user returned, webhook pending
  'succeeded',         -- payment captured
  'failed',            -- declined or error
  'cancelled',         -- user abandoned or explicitly cancelled
  'refunded',          -- fully refunded
  'partially_refunded' -- some amount refunded
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  provider payment_provider NOT NULL,
  provider_session_id TEXT,          -- hosted checkout session ID (cs_xxx for Stripe)
  provider_payment_id TEXT,          -- final payment ID, set when succeeded (pi_xxx for Stripe)
  provider_customer_id TEXT,         -- optional customer reference (cus_xxx for Stripe)

  status payment_status NOT NULL DEFAULT 'requires_action',
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL,         -- ISO 4217, e.g. 'NOK'

  checkout_url TEXT,                 -- hosted payment page (for Checkout-style providers)
  return_url TEXT,                   -- where the provider redirects after completion
  description TEXT,

  -- Refund fields
  refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  provider_refund_id TEXT,
  refund_reason TEXT,

  -- Failure detail
  failure_code TEXT,
  failure_message TEXT,

  -- Audit
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_webhook_event_id TEXT,        -- idempotency: avoid processing same event twice
  last_webhook_received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payments_refund_within_amount CHECK (refunded_amount <= amount)
);

-- The provider's session ID is how webhooks find our payment row.
CREATE UNIQUE INDEX idx_payments_provider_session
  ON payments (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX idx_payments_studio_user ON payments (studio_id, user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status, created_at) WHERE status IN ('requires_action', 'processing');

CREATE TRIGGER trg_payments_touch
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users see their own payment history. Never INSERT/UPDATE — Edge Functions do that.
CREATE POLICY "payments_self_read" ON payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()));

CREATE POLICY "payments_staff_read" ON payments FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Service role (Edge Functions) bypasses RLS.

-- ----------------------------------------------------------------------------
-- Idempotent webhook event log — prevents double-processing
-- ----------------------------------------------------------------------------
CREATE TABLE payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider payment_provider NOT NULL,
  provider_event_id TEXT NOT NULL,   -- the provider's own event id (evt_xxx for Stripe)
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_webhook_events_unprocessed
  ON payment_webhook_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service role only; no policies for authenticated users (intentional silent deny)

-- ----------------------------------------------------------------------------
-- payment_methods: generalize across providers
--
-- Existing table from the initial schema has `stripe_payment_method_id`.
-- We rename that to `provider_external_id` and add a `provider` column.
-- ----------------------------------------------------------------------------

-- Drop any raw card columns if they slipped in during the insecure-form era
ALTER TABLE payment_methods DROP COLUMN IF EXISTS card_number;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS cvc;
ALTER TABLE payment_methods DROP COLUMN IF EXISTS cardholder_name;

-- Add provider column (default 'stripe' for existing rows — YogaBrie's only provider)
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS provider payment_provider;
UPDATE payment_methods SET provider = 'stripe' WHERE provider IS NULL;
ALTER TABLE payment_methods ALTER COLUMN provider SET NOT NULL;

-- Rename the old stripe-specific column (if it exists) to the neutral name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'payment_methods' AND column_name = 'stripe_payment_method_id'
  ) THEN
    ALTER TABLE payment_methods RENAME COLUMN stripe_payment_method_id TO provider_external_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'payment_methods' AND column_name = 'provider_external_id'
  ) THEN
    ALTER TABLE payment_methods ADD COLUMN provider_external_id TEXT;
  END IF;
END $$;

DELETE FROM payment_methods WHERE provider_external_id IS NULL;

ALTER TABLE payment_methods
  ALTER COLUMN provider_external_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_provider_external_unique'
  ) THEN
    ALTER TABLE payment_methods
      ADD CONSTRAINT payment_methods_provider_external_unique
      UNIQUE (provider, provider_external_id);
  END IF;
END $$;

-- Note: brand/last4/expiry_month/expiry_year may be NULL for providers that
-- don't expose card details (e.g., Vipps returns a masked phone, not card metadata).
ALTER TABLE payment_methods ALTER COLUMN brand DROP NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN last4 DROP NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN expiry_month DROP NOT NULL;
ALTER TABLE payment_methods ALTER COLUMN expiry_year DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- bookings: link to payments instead of provider-specific IDs
-- ----------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_payment ON bookings (payment_id) WHERE payment_id IS NOT NULL;

-- Remove the Stripe-specific columns that an earlier migration draft introduced
-- (if they exist). The payments table is now the authoritative source.
ALTER TABLE bookings DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS refund_status;
ALTER TABLE bookings DROP COLUMN IF EXISTS refunded_amount;

-- ----------------------------------------------------------------------------
-- memberships: same generalization
-- ----------------------------------------------------------------------------
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS provider payment_provider;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

-- Backfill existing rows (all on Stripe in current world)
UPDATE memberships SET provider = 'stripe'
 WHERE provider IS NULL AND stripe_subscription_id IS NOT NULL;

-- Copy stripe_subscription_id into the neutral column, then drop the old one
UPDATE memberships SET provider_subscription_id = stripe_subscription_id
 WHERE provider_subscription_id IS NULL AND stripe_subscription_id IS NOT NULL;

ALTER TABLE memberships DROP COLUMN IF EXISTS stripe_subscription_id;

CREATE INDEX IF NOT EXISTS idx_memberships_provider_sub
  ON memberships (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Booking status lifecycle tightening (same as before — provider-neutral)
-- A booking is 'pending' when the Edge Function creates the payments row.
-- The webhook promotes it to 'confirmed' on payment.succeeded.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check_v2'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_status_check_v2
      CHECK (status IN ('pending','confirmed','cancelled','completed','no_show','payment_failed'));
  END IF;
END $$;

DROP POLICY IF EXISTS "bookings_self_insert" ON bookings;
CREATE POLICY "bookings_self_insert" ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND studio_id IN (SELECT public.user_studio_ids())
    AND status = 'pending'
  );

-- ----------------------------------------------------------------------------
-- Utility: can this studio accept online payment? (any active provider)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.studio_accepts_online_payment(_studio_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM studio_payment_providers
     WHERE studio_id = _studio_id
       AND is_active = true
       AND onboarded_at IS NOT NULL
  );
$$;

-- Convenience: return the primary provider for a studio (or NULL)
CREATE OR REPLACE FUNCTION public.studio_primary_provider(_studio_id UUID)
RETURNS payment_provider
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT provider FROM studio_payment_providers
   WHERE studio_id = _studio_id
     AND is_active = true
     AND is_primary = true
     AND onboarded_at IS NOT NULL
   LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- Edge Function surface — neutral contracts
-- (Implementations in supabase/functions/, provider adapters in
--  supabase/functions/_shared/providers/{stripe,frisbii,vipps}.ts)
--
--   POST /functions/v1/create-checkout
--     Auth: Supabase JWT
--     Body: { class_instance_id: UUID, return_url?: string }
--     Returns: { checkout_url: string, payment_id: UUID, booking_id: UUID }
--     Flow:
--       1. Look up class_instance → price server-side (never trust client)
--       2. Resolve studio's primary provider via studio_primary_provider()
--       3. Insert payments row (status='requires_action', provider set)
--       4. Call provider adapter's createCheckoutSession()
--       5. Update payments row with provider_session_id + checkout_url
--       6. Insert booking (status='pending', payment_id set)
--       7. Return checkout_url — frontend redirects
--
--   POST /functions/v1/payment-webhook/:provider
--     No auth header; signature-verified by the adapter
--     Flow:
--       1. Adapter parses + verifies the webhook → canonical event
--       2. Dedupe against payment_webhook_events (provider, provider_event_id)
--       3. Update payments row status + provider_payment_id
--       4. On succeeded → UPDATE bookings SET status='confirmed' WHERE payment_id = ?
--       5. On failed/cancelled → UPDATE bookings SET status='payment_failed'
--
--   POST /functions/v1/issue-refund
--     Auth: Supabase JWT (staff only)
--     Body: { payment_id: UUID, amount?: number, reason?: string }
--     Flow: lookup payments → adapter.issueRefund() → update payments.refunded_amount
-- ----------------------------------------------------------------------------
