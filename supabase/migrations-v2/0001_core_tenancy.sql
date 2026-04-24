-- ============================================================================
-- Phase 1: Core Tenancy
-- Introduces the studio as a tenant and studio_members as the user↔studio link.
-- No changes to existing tables in this migration — purely additive.
-- ============================================================================

-- Extensions required later (btree_gist for exclusion constraints on ranges)
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- studios: the tenant root
-- ----------------------------------------------------------------------------
CREATE TABLE studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#000000',
  logo_url TEXT,
  contact_email TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  currency CHAR(3) NOT NULL DEFAULT 'NOK',
  address TEXT,                              -- primary physical address (migrated from studio_config.location)
  cancellation_window_hours INT NOT NULL DEFAULT 24,
  waitlist_offer_window_minutes INT NOT NULL DEFAULT 20,
  -- Payment provider linkage lives in studio_payment_providers (see 0005)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_studios_slug_active ON studios (slug) WHERE is_active;

-- ----------------------------------------------------------------------------
-- studio_members: the user↔studio link with role + per-studio state
-- ----------------------------------------------------------------------------
CREATE TYPE studio_role AS ENUM ('owner', 'manager', 'instructor', 'member');

CREATE TABLE studio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role studio_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Per-studio state (moved off of profiles)
  total_sessions INT NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'STARTER',
  referral_code TEXT,
  referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_address JSONB,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,

  UNIQUE (studio_id, user_id),
  UNIQUE (studio_id, referral_code)
);

CREATE INDEX idx_studio_members_user ON studio_members (user_id) WHERE is_active;
CREATE INDEX idx_studio_members_studio ON studio_members (studio_id, role) WHERE is_active;

-- ----------------------------------------------------------------------------
-- Helper functions for RLS
-- All SECURITY DEFINER + locked search_path to prevent privilege escalation.
-- ----------------------------------------------------------------------------

-- Returns the set of studio_ids the current user belongs to (any active role)
CREATE OR REPLACE FUNCTION public.user_studio_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT studio_id
    FROM studio_members
   WHERE user_id = auth.uid()
     AND is_active = true;
$$;

-- Checks whether the current user has any of the given roles in a specific studio
CREATE OR REPLACE FUNCTION public.user_has_role(_studio_id UUID, _roles studio_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM studio_members
     WHERE user_id = auth.uid()
       AND studio_id = _studio_id
       AND role = ANY(_roles)
       AND is_active = true
  );
$$;

-- Convenience: staff = owner | manager | instructor
CREATE OR REPLACE FUNCTION public.user_is_staff(_studio_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role(_studio_id, ARRAY['owner','manager','instructor']::studio_role[]);
$$;

-- ----------------------------------------------------------------------------
-- RLS on the new tables
-- ----------------------------------------------------------------------------
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_members ENABLE ROW LEVEL SECURITY;

-- Studios: public read of branding for active studios; updates only by owner
CREATE POLICY "studios_public_read" ON studios FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "studios_owner_update" ON studios FOR UPDATE
  TO authenticated
  USING (public.user_has_role(id, ARRAY['owner']::studio_role[]))
  WITH CHECK (public.user_has_role(id, ARRAY['owner']::studio_role[]));

-- studio_members: users see their own memberships; staff see all memberships of their studio
CREATE POLICY "studio_members_self_read" ON studio_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "studio_members_staff_read" ON studio_members FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

-- Members can be created by the system (trigger on first studio visit) or by staff
CREATE POLICY "studio_members_staff_write" ON studio_members FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

CREATE POLICY "studio_members_staff_update" ON studio_members FOR UPDATE
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- Touch trigger to keep updated_at fresh
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_studios_touch
  BEFORE UPDATE ON studios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
