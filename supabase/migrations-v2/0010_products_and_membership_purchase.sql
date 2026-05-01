-- ============================================================================
-- Phase 1A: Products catalog + membership purchase flow
--
-- 1. products table: catalog of buyable items per studio (replaces hardcoded list in JoinNow.tsx)
-- 2. payments.product_id: link a payment to the product purchased (NULL for class bookings)
-- 3. payments.discount_code: plumb-through for future referral codes (no UI yet)
-- 4. memberships.product_id: link a membership to the product that created it
-- 5. activate_membership() RPC: atomic membership creation on payment success
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. products catalog
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('drop_in', 'clip_card', 'subscription', 'addon', 'private')),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  tag TEXT,                          -- "Best value", "Most popular", etc.

  price_minor INTEGER NOT NULL,      -- in smallest currency unit (øre for NOK)
  currency TEXT NOT NULL DEFAULT 'NOK',

  credits INTEGER,                   -- 10 for clip card; NULL = unlimited or N/A
  validity_days INTEGER,             -- 365 for clip card; NULL = no expiry / handled by billing
  billing_interval TEXT,             -- 'month' for subscriptions; NULL for one-time
  commitment_months INTEGER,         -- 12 for 1-year membership; NULL otherwise

  provider_price_id TEXT,            -- Stripe Price ID for hosted checkout

  requires_contact BOOLEAN NOT NULL DEFAULT false,  -- private sessions = true
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_studio_active_idx ON products(studio_id, is_active, display_order);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public read (anon + authenticated): scoped via x-studio-slug header.
-- Product pricing is public info — any visitor to the studio page can read it.
CREATE POLICY "products_public_read" ON products FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

-- Staff write
CREATE POLICY "products_staff_write" ON products FOR ALL
  TO authenticated
  USING (public.user_is_staff(studio_id))
  WITH CHECK (public.user_is_staff(studio_id));

-- ----------------------------------------------------------------------------
-- 2. payments: link to product (NULL for class bookings)
-- ----------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_code TEXT;

-- ----------------------------------------------------------------------------
-- 3. memberships: link to product (the catalog row that created this membership)
-- ----------------------------------------------------------------------------
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- ----------------------------------------------------------------------------
-- 4. activate_membership(p_payment_id, p_provider_subscription_id): atomic membership creation
--
--   Called from payment-webhook on payment.succeeded when payment.product_id IS NOT NULL.
--   For subscription products, p_provider_subscription_id is the Stripe subscription ID
--   so we can later match invoice.paid / customer.subscription.deleted webhooks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_membership(
  p_payment_id uuid,
  p_provider_subscription_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment RECORD;
  _product RECORD;
  _membership_id UUID;
  _valid_until DATE;
  _renewal_days INT;
BEGIN
  -- Lock the payment row to serialize against concurrent webhook handlers
  SELECT * INTO _payment FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF _payment IS NULL THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;
  IF _payment.product_id IS NULL THEN
    RAISE EXCEPTION 'Payment % has no product_id', p_payment_id;
  END IF;

  SELECT * INTO _product FROM products WHERE id = _payment.product_id;
  IF _product IS NULL THEN
    RAISE EXCEPTION 'Product % not found', _payment.product_id;
  END IF;

  -- Validity window: explicit validity_days for clip cards; +1 month for subscriptions
  IF _product.validity_days IS NOT NULL THEN
    _valid_until := (now() + (_product.validity_days || ' days')::interval)::date;
  ELSIF _product.billing_interval = 'month' THEN
    _valid_until := (now() + interval '1 month' + interval '3 days')::date;  -- 3-day grace
  ELSE
    _valid_until := NULL;
  END IF;

  IF _product.billing_interval = 'month' THEN
    _renewal_days := 30;
  ELSE
    _renewal_days := NULL;
  END IF;

  INSERT INTO memberships (
    studio_id, user_id, product_id, plan_name,
    status, credits_remaining, valid_until,
    provider, provider_subscription_id, renewal_days
  ) VALUES (
    _payment.studio_id, _payment.user_id, _payment.product_id, _product.name,
    'active', _product.credits, _valid_until,
    _payment.provider, p_provider_subscription_id, _renewal_days
  )
  RETURNING id INTO _membership_id;

  UPDATE payments SET status = 'succeeded' WHERE id = p_payment_id;

  RETURN _membership_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. renew_membership_by_subscription: extend valid_until on recurring billing
--
--   Called on invoice.paid (after the initial subscription_create invoice).
--   Idempotent: if no membership exists for this subscription, no-op.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_membership_by_subscription(p_subscription_id text)
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
   FOR UPDATE;

  IF _membership IS NULL THEN RETURN; END IF;

  -- Extend by 1 month from the later of (current valid_until) or (now). 3-day grace.
  UPDATE memberships
     SET valid_until = (GREATEST(valid_until, current_date) + interval '1 month' + interval '3 days')::date,
         status = 'active'
   WHERE id = _membership.id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. cancel_membership_by_subscription: mark cancelled on subscription deletion
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_membership_by_subscription(p_subscription_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE memberships
     SET status = 'cancelled'
   WHERE provider_subscription_id = p_subscription_id
     AND status = 'active';
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Seed Brie's catalog
-- ----------------------------------------------------------------------------
DO $$
DECLARE _studio_id UUID;
BEGIN
  SELECT id INTO _studio_id FROM studios WHERE slug = 'yogabrie';
  IF _studio_id IS NULL THEN
    RAISE NOTICE 'Studio yogabrie not found — skipping product seed';
    RETURN;
  END IF;

  -- Idempotent: only insert if no products exist for this studio yet
  IF EXISTS (SELECT 1 FROM products WHERE studio_id = _studio_id) THEN
    RAISE NOTICE 'Products already seeded for yogabrie — skipping';
    RETURN;
  END IF;

  INSERT INTO products (
    studio_id, type, name, description, image_url, tag,
    price_minor, currency, credits, validity_days, billing_interval, commitment_months,
    requires_contact, display_order
  ) VALUES
    (_studio_id, 'drop_in', 'Drop-in',
     'Single class. No commitment, no card needed. Show up and practice.',
     '/images/shop/dropin.jpeg', 'Flexible',
     25000, 'NOK', 1, NULL, NULL, NULL,
     false, 1),

    (_studio_id, 'clip_card', '10× Clip Card',
     'Ten classes at a reduced rate. Use across any class type at any time.',
     '/images/shop/clipcard10.jpeg', 'Best value',
     230000, 'NOK', 10, 365, NULL, NULL,
     false, 2),

    (_studio_id, 'subscription', 'All-Inclusive',
     'Unlimited access to all classes for one month. Roll month-to-month, cancel anytime.',
     '/images/shop/allincl.jpeg', 'Most popular',
     160000, 'NOK', NULL, NULL, 'month', NULL,
     false, 3),

    (_studio_id, 'subscription', '1-Year Membership',
     'Unlimited access with a 12-month commitment. Best monthly rate we offer.',
     '/images/shop/membership1.jpeg', 'Committed',
     125000, 'NOK', NULL, NULL, 'month', 12,
     false, 4),

    (_studio_id, 'addon', 'Mat Hotel',
     'We store your mat at the studio so you never have to carry it. Monthly add-on.',
     '/images/shop/mathotel.jpeg', 'Add-on',
     5000, 'NOK', NULL, NULL, 'month', NULL,
     false, 5),

    (_studio_id, 'private', 'Private Session — 60 min',
     'One-on-one instruction tailored entirely to your needs and current practice.',
     '/images/shop/private60mn.jpeg', 'Private',
     150000, 'NOK', 1, NULL, NULL, NULL,
     true, 6),

    (_studio_id, 'private', 'Private Session — 90 min',
     'Extended private session. Ideal for deeper work, injury recovery, or focused technique.',
     '/images/shop/private90mn.jpeg', 'Private',
     190000, 'NOK', 1, NULL, NULL, NULL,
     true, 7);
END $$;
