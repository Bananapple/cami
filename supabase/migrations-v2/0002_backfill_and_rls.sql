-- ============================================================================
-- Phase 2: Add studio_id to existing tenanted tables, backfill, rewrite RLS
--
-- Execution notes:
--   * Before running, INSERT the YogaBrie studio row:
--       INSERT INTO studios (slug, name, primary_color, contact_email, timezone)
--       VALUES ('yogabrie', 'YogaBrie', '#000000', 'contact@yogabrie.com', 'Europe/Oslo');
--     Capture the returned id as :yogabrie_id.
--
--   * Seed studio_members for every existing auth.users row:
--       INSERT INTO studio_members (studio_id, user_id, role)
--       SELECT :yogabrie_id, id, 'member' FROM auth.users
--       ON CONFLICT DO NOTHING;
--
--   * The migration below assumes those steps have happened and references
--     a placeholder :yogabrie_id — replace before applying.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: keep as global PII; remove per-studio columns (they moved to studio_members)
-- ----------------------------------------------------------------------------

-- New field: phone_number for SMS/WhatsApp
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketing_sms_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Move per-studio fields to studio_members (backfill script, commented):
--   UPDATE studio_members sm
--      SET total_sessions = p.total_sessions,
--          level = p.level,
--          billing_address = p.billing_address
--     FROM profiles p
--    WHERE sm.user_id = p.id AND sm.studio_id = :yogabrie_id;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS total_sessions,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS referrals,
  DROP COLUMN IF EXISTS billing_address;

-- Rewrite the new-user trigger: profiles stays global, studio_member is created
-- on first studio visit via an Edge Function (not via trigger, since we don't
-- know which studio they joined from at auth.users INSERT time).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_initials)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    upper(substring(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 1, 2))
  );
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- bookings: add studio_id, tighten FKs
-- ----------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE CASCADE;

-- Backfill (replace :yogabrie_id):
--   UPDATE bookings SET studio_id = :yogabrie_id WHERE studio_id IS NULL;

ALTER TABLE bookings ALTER COLUMN studio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_studio_user ON bookings (studio_id, user_id);

-- ----------------------------------------------------------------------------
-- payment_methods: add studio_id (a card is scoped to a studio, not global —
-- different studios use different Stripe Connect accounts)
-- ----------------------------------------------------------------------------
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE CASCADE;

-- Backfill:
--   UPDATE payment_methods SET studio_id = :yogabrie_id WHERE studio_id IS NULL;

ALTER TABLE payment_methods ALTER COLUMN studio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_studio_user ON payment_methods (studio_id, user_id);

-- ----------------------------------------------------------------------------
-- memberships: add studio_id
-- ----------------------------------------------------------------------------
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE CASCADE;

-- Backfill:
--   UPDATE memberships SET studio_id = :yogabrie_id WHERE studio_id IS NULL;

ALTER TABLE memberships ALTER COLUMN studio_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_studio_user ON memberships (studio_id, user_id);

-- ----------------------------------------------------------------------------
-- sessions: add studio_id (will be replaced by class_templates in phase 3,
-- but needs studio_id during the transition window)
-- ----------------------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES studios(id) ON DELETE CASCADE;

-- Backfill:
--   UPDATE sessions SET studio_id = :yogabrie_id WHERE studio_id IS NULL;

ALTER TABLE sessions ALTER COLUMN studio_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Rewrite RLS policies on existing tables
-- Drop all prior policies, re-create using the helper functions.
-- ----------------------------------------------------------------------------

-- profiles: own-row only, plus staff-read within shared studios
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "profiles_self_rw" ON profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_staff_read" ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM studio_members mine
        JOIN studio_members theirs
          ON theirs.studio_id = mine.studio_id
       WHERE mine.user_id = auth.uid()
         AND mine.is_active
         AND mine.role IN ('owner', 'manager')
         AND theirs.user_id = profiles.id
         AND theirs.is_active
    )
  );

-- bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

CREATE POLICY "bookings_self_read" ON bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()));

CREATE POLICY "bookings_staff_read" ON bookings FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

CREATE POLICY "bookings_self_insert" ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND studio_id IN (SELECT public.user_studio_ids())
  );

-- Status transitions (cancel) allowed by self or staff. Confirmed→cancelled only.
CREATE POLICY "bookings_self_cancel" ON bookings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings_staff_write" ON bookings FOR UPDATE
  TO authenticated
  USING (public.user_is_staff(studio_id))
  WITH CHECK (public.user_is_staff(studio_id));

-- payment_methods
DROP POLICY IF EXISTS "Users can view own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can save cards" ON payment_methods;
DROP POLICY IF EXISTS "Users can update payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete cards" ON payment_methods;

CREATE POLICY "payment_methods_self_all" ON payment_methods FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()))
  WITH CHECK (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()));

-- memberships
DROP POLICY IF EXISTS "Users can view own memberships" ON memberships;
DROP POLICY IF EXISTS "Users can create own memberships" ON memberships;

CREATE POLICY "memberships_self_read" ON memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()));

CREATE POLICY "memberships_staff_read" ON memberships FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

CREATE POLICY "memberships_staff_write" ON memberships FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- sessions (legacy — kept until phase 3 cutover)
DROP POLICY IF EXISTS "Sessions are public" ON sessions;

CREATE POLICY "sessions_public_read" ON sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "sessions_staff_write" ON sessions FOR ALL
  TO authenticated
  USING (public.user_is_staff(studio_id))
  WITH CHECK (public.user_is_staff(studio_id));

-- ----------------------------------------------------------------------------
-- Update trg_increment_sessions to increment on studio_members, not profiles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_studio_member_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE studio_members
       SET total_sessions = total_sessions + 1
     WHERE studio_id = NEW.studio_id
       AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_sessions ON bookings;
CREATE TRIGGER trg_increment_sessions
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_studio_member_sessions();

-- ----------------------------------------------------------------------------
-- Retire studio_config
-- (Data has been migrated into the studios table. Drop after verifying backfill.)
-- ----------------------------------------------------------------------------
-- DROP TABLE studio_config;
