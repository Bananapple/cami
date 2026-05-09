-- ============================================================================
-- Phase 12: Studio visibility scoping + per-studio FROM_EMAIL
--
-- 1. studios_public_read: scope by x-studio-slug header so anon visitors can
--    only read the studio whose slug matches their site, not the entire
--    customer list. Mirrors the pattern in 0008 for locations/instructors/
--    class_templates.
--
-- 2. studios.from_email: per-studio sender address for transactional emails.
--    Falls back to env-var FROM_EMAIL when null. Each customer's emails should
--    come from their verified Resend domain (e.g. booking@yogabrie.no), not
--    the platform's onboarding@resend.dev.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Scope studios_public_read to the slug from the request header.
--
-- Authenticated users with an active membership in any studio still need to
-- read their studios for the dashboard — keep that path open via a separate
-- policy.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "studios_public_read" ON studios;

CREATE POLICY "studios_anon_read" ON studios FOR SELECT
  TO anon
  USING (
    is_active = true
    AND slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
  );

CREATE POLICY "studios_member_read" ON studios FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND id = ANY(SELECT public.user_studio_ids())
  );

-- Also keep slug-based read for authenticated users so they can load any
-- studio they're visiting (e.g. logged-in user lands on a different studio's
-- site for the first time and we need to render the studio header before they
-- become a member).
CREATE POLICY "studios_authenticated_slug_read" ON studios FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
  );

-- ----------------------------------------------------------------------------
-- 2. studios.from_email: per-studio transactional sender
-- ----------------------------------------------------------------------------
ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS from_email TEXT;

COMMENT ON COLUMN studios.from_email IS
  'Per-studio FROM address for transactional emails (booking confirmation, '
  'invite, cancellation, waitlist offer). Must be a verified Resend domain. '
  'Falls back to FROM_EMAIL env var when null.';
