-- 0025_instructor_platform_role.sql
-- Adds platform_role to instructors so the Studio drawer can express whether
-- an instructor should have Manager (full) or Associate (limited) access
-- when they log in. Defaults to 'associate' for existing rows.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'associate'
    CHECK (platform_role IN ('manager', 'associate'));
