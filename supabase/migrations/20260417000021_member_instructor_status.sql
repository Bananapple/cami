-- 0020_member_instructor_status.sql
--
-- Adds an explicit `status` text column to studio_members and instructors
-- to support the redesigned UI's "On leave" badge.
--
-- Scope: UI / reporting marker only. The existing `is_active` boolean is
-- preserved and remains the source of truth for active-vs-deactivated checks
-- throughout the codebase. The new `status` column adds a third state
-- ('on_leave') that the UI can render distinctly.
--
-- Future plumbing (post-cutover, see follow-up task):
--   * suppress on_leave members from lapsed-reporting queries
--   * exclude on_leave instructors from substitute-picker dropdown
--   * optionally pause Stripe subscription when status flips to on_leave

ALTER TABLE studio_members
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'inactive'));

ALTER TABLE instructors
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'inactive'));

-- Backfill: existing inactive rows (is_active = false) get status='inactive'
-- so the two columns are coherent from day one.
UPDATE studio_members SET status = 'inactive' WHERE is_active = false;
UPDATE instructors    SET status = 'inactive' WHERE is_active = false;

COMMENT ON COLUMN studio_members.status IS
  'UI status marker. active|on_leave|inactive. is_active remains source of truth for permissions.';
COMMENT ON COLUMN instructors.status IS
  'UI status marker. active|on_leave|inactive. is_active remains source of truth for filtering.';
