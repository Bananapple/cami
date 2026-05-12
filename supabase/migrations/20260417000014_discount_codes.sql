-- Promotional and referral discount codes

CREATE TABLE IF NOT EXISTS discount_codes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  code                text        NOT NULL,
  description         text,
  discount_type       text        NOT NULL CHECK (discount_type IN ('percent', 'fixed_off')),
  discount_value      numeric     NOT NULL CHECK (discount_value > 0),
  currency            text,
  valid_from          timestamptz,
  valid_until         timestamptz,
  max_redemptions     int,
  times_redeemed      int         NOT NULL DEFAULT 0,
  created_by_user_id  uuid        REFERENCES auth.users(id),
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, code)
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id                 uuid        NOT NULL REFERENCES discount_codes(id),
  redeemed_by_user_id     uuid        NOT NULL REFERENCES auth.users(id),
  payment_id              uuid        REFERENCES payments(id),
  discount_applied_minor  int         NOT NULL,
  redeemed_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;

-- Staff can fully manage codes for their studio
CREATE POLICY "staff_manage_discount_codes" ON discount_codes
  FOR ALL TO authenticated
  USING (user_is_staff(studio_id))
  WITH CHECK (user_is_staff(studio_id));

-- Users can read their own redemption history
CREATE POLICY "user_reads_own_redemptions" ON discount_redemptions
  FOR SELECT TO authenticated
  USING (redeemed_by_user_id = auth.uid());

-- Staff can read all redemptions for codes in their studio
CREATE POLICY "staff_reads_studio_redemptions" ON discount_redemptions
  FOR SELECT TO authenticated
  USING (
    code_id IN (
      SELECT id FROM discount_codes WHERE user_is_staff(studio_id)
    )
  );

-- Trigger: auto-increment times_redeemed when a redemption row is inserted
CREATE OR REPLACE FUNCTION increment_discount_redeemed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE discount_codes SET times_redeemed = times_redeemed + 1 WHERE id = NEW.code_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_discount_increment_redeemed
AFTER INSERT ON discount_redemptions
FOR EACH ROW EXECUTE FUNCTION increment_discount_redeemed();
