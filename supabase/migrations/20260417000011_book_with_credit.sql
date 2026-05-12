-- ============================================================================
-- Phase 1B: Book classes using membership credits (subscription or clip card)
--
-- 1. bookings.membership_id: which membership paid for this booking (NULL = paid via payment)
-- 2. book_with_credit(): atomic booking creation + optional credit decrement
-- 3. return_credit(): atomic credit return when a credit-paid booking is cancelled
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. bookings.membership_id
-- ----------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES memberships(id);

-- ----------------------------------------------------------------------------
-- 2. book_with_credit()
--
--   Called by create-checkout when the user has an active membership covering
--   this class. Mirrors the safety pattern of confirm_booking / refund_booking:
--   - Locks the membership row FOR UPDATE to prevent double-spending credits
--     under concurrent requests (same race shape as the capacity bug we fixed)
--   - Validates membership is active, not expired, has credits (or unlimited)
--   - Checks class capacity
--   - Decrements credits_remaining (no-op for NULL = unlimited subscription)
--   - Inserts a 'confirmed' booking with membership_id set, payment_id NULL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_with_credit(
  p_user_id uuid,
  p_class_instance_id uuid,
  p_membership_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership RECORD;
  _instance   RECORD;
  _booked_count INT;
  _booking_id UUID;
BEGIN
  -- Lock membership row to serialize concurrent credit bookings
  SELECT id, credits_remaining, valid_until, status
    INTO _membership
    FROM memberships
    WHERE id = p_membership_id AND user_id = p_user_id
    FOR UPDATE;

  IF _membership IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  IF _membership.status != 'active' THEN
    RAISE EXCEPTION 'Membership is not active';
  END IF;
  IF _membership.valid_until IS NOT NULL AND _membership.valid_until < current_date THEN
    RAISE EXCEPTION 'Membership has expired';
  END IF;
  -- credits_remaining IS NULL = unlimited subscription
  IF _membership.credits_remaining IS NOT NULL AND _membership.credits_remaining < 1 THEN
    RAISE EXCEPTION 'No credits remaining';
  END IF;

  -- Capacity check (same logic as create-checkout)
  SELECT id, max_capacity, studio_id INTO _instance
    FROM class_instances
    WHERE id = p_class_instance_id AND status = 'scheduled';
  IF _instance IS NULL THEN
    RAISE EXCEPTION 'Class not found or not scheduled';
  END IF;

  SELECT COUNT(*) INTO _booked_count
    FROM bookings
    WHERE class_instance_id = p_class_instance_id
      AND status IN ('pending', 'confirmed');
  IF _instance.max_capacity > 0 AND _booked_count >= _instance.max_capacity THEN
    RAISE EXCEPTION 'Class is fully booked';
  END IF;

  -- Decrement credit (skip for unlimited subscriptions where credits_remaining IS NULL)
  IF _membership.credits_remaining IS NOT NULL THEN
    UPDATE memberships SET credits_remaining = credits_remaining - 1 WHERE id = p_membership_id;
  END IF;

  -- Insert confirmed booking (no payment_id for credit-paid bookings)
  INSERT INTO bookings (studio_id, class_instance_id, user_id, membership_id, status)
    VALUES (_instance.studio_id, p_class_instance_id, p_user_id, p_membership_id, 'confirmed')
    RETURNING id INTO _booking_id;

  RETURN _booking_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. return_credit()
--
--   Called by issue-refund when a credit-paid booking is cancelled within the
--   refund window. Atomically increments credits_remaining.
--   No-op for unlimited subscriptions (credits_remaining IS NULL).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_credit(p_membership_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE memberships
     SET credits_remaining = credits_remaining + 1
   WHERE id = p_membership_id
     AND credits_remaining IS NOT NULL;  -- skip unlimited subscriptions
END;
$$;
