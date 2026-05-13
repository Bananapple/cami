-- Tighten profiles_staff_read to the current studio context.
--
-- Old policy: any owner/manager could read full profiles of users who share
-- ANY studio with them. With multiple unrelated operators on the platform,
-- Studio A's staff could read phone numbers + marketing opt-ins of users who
-- happen to also be members of Studio B.
--
-- New policy: staff can only read profiles of members belonging to the studio
-- that matches the x-studio-slug request header (set automatically by the
-- Supabase client from VITE_STUDIO_SLUG). This eliminates the cross-operator
-- PII leak while preserving all current functionality — managers always
-- operate within one studio context at a time.

DROP POLICY IF EXISTS profiles_staff_read ON profiles;

CREATE POLICY profiles_staff_read ON profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM studio_members mine
    JOIN studio_members theirs ON theirs.studio_id = mine.studio_id
    JOIN studios s ON s.id = mine.studio_id
    WHERE mine.user_id = auth.uid()
      AND mine.is_active
      AND mine.role IN ('owner', 'manager')
      AND theirs.user_id = profiles.id
      AND theirs.is_active
      AND s.slug = lower(
            nullif(current_setting('request.header.x-studio-slug', true), '')
          )
  )
);
