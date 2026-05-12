-- 0024_instructor_last_name.sql
-- Adds last_name to instructors table.
-- display_name stays as the canonical rendered name (used in class_instances,
-- schedule, public pages). last_name is stored separately so the UI can show
-- separate first/last fields while keeping all existing queries unchanged.

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS last_name TEXT DEFAULT NULL;
