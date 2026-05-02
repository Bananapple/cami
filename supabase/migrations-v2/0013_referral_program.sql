-- Referral program: studio-level config + relationship tracking

-- Referral program settings on studios
ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS referral_enabled          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_discount_percent int     NOT NULL DEFAULT 20;

-- Referrals: tracks who referred whom and status of that relationship
CREATE TABLE IF NOT EXISTS referrals (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id               uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  referrer_user_id        uuid        NOT NULL REFERENCES auth.users(id),
  referred_user_id        uuid        NOT NULL REFERENCES auth.users(id),
  referral_code           text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed')),
  discount_applied_percent int,
  created_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz,
  -- A user can only be referred once per studio
  UNIQUE (studio_id, referred_user_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrer_reads_own" ON referrals;
CREATE POLICY "referrer_reads_own" ON referrals
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS "referred_reads_own" ON referrals;
CREATE POLICY "referred_reads_own" ON referrals
  FOR SELECT TO authenticated
  USING (referred_user_id = auth.uid());

DROP POLICY IF EXISTS "staff_reads_studio_referrals" ON referrals;
CREATE POLICY "staff_reads_studio_referrals" ON referrals
  FOR SELECT TO authenticated
  USING (user_is_staff(studio_id));

-- Auto-generate a unique referral code when a studio_members row is inserted
CREATE OR REPLACE FUNCTION generate_member_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    -- 7 uppercase hex chars: e.g. "A3F9B12"
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = NEW.studio_id AND referral_code = code
    );
    attempts := attempts + 1;
    IF attempts > 10 THEN
      code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT;
    END IF;
  END LOOP;
  NEW.referral_code := code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_studio_members_gen_referral_code ON studio_members;
CREATE TRIGGER trg_studio_members_gen_referral_code
BEFORE INSERT ON studio_members
FOR EACH ROW EXECUTE FUNCTION generate_member_referral_code();

-- Backfill existing studio_members rows that have no referral_code
DO $$
DECLARE
  r   RECORD;
  code TEXT;
  attempts INT;
BEGIN
  FOR r IN SELECT id, studio_id FROM studio_members WHERE referral_code IS NULL LOOP
    attempts := 0;
    LOOP
      code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM studio_members
        WHERE studio_id = r.studio_id AND referral_code = code
      );
      attempts := attempts + 1;
      IF attempts > 10 THEN
        code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
        EXIT;
      END IF;
    END LOOP;
    UPDATE studio_members SET referral_code = code WHERE id = r.id;
  END LOOP;
END;
$$;
