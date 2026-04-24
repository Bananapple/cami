-- ============================================================================
-- YogaBrie Backfill Script
--
-- Run AFTER applying all supabase/migrations-v2/ files in order.
-- Execute in the Supabase SQL editor or via psql against xskqpxfjhhxontirezjd.
--
-- Run each section separately and verify before proceeding to the next.
-- ============================================================================

-- SECTION 1: Insert the YogaBrie studio row from the existing studio_config
-- ----------------------------------------------------------------------------
-- First run this SELECT to preview what will be inserted:
--
--   SELECT studio_name, location, primary_color, contact_email
--   FROM studio_config LIMIT 1;

INSERT INTO studios (slug, name, address, primary_color, contact_email, timezone, currency, cancellation_window_hours)
SELECT
  'yogabrie',
  studio_name,
  location,               -- studio_config.location → studios.address
  COALESCE(primary_color, '#000000'),
  contact_email,
  'Europe/Oslo',
  'NOK',
  24
FROM studio_config
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Verify:
-- SELECT id, slug, name, address FROM studios WHERE slug = 'yogabrie';
-- Copy the returned id — replace every occurrence of :yogabrie_id below.


-- SECTION 2: Seed studio_members from auth.users (everyone = member initially)
-- ----------------------------------------------------------------------------
-- Review first: SELECT id, email FROM auth.users;

INSERT INTO studio_members (studio_id, user_id, role, is_active, joined_at)
SELECT
  (SELECT id FROM studios WHERE slug = 'yogabrie'),
  id,
  'member',
  true,
  created_at
FROM auth.users
ON CONFLICT (studio_id, user_id) DO NOTHING;

-- Promote yourself (the studio owner) — replace <your-user-id>:
-- UPDATE studio_members
--    SET role = 'owner'
--  WHERE studio_id = (SELECT id FROM studios WHERE slug = 'yogabrie')
--    AND user_id = '<your-user-id>';

-- Verify:
-- SELECT role, COUNT(*) FROM studio_members GROUP BY role;


-- SECTION 3: Insert the primary location
-- ----------------------------------------------------------------------------
INSERT INTO locations (studio_id, name, address, default_capacity, is_active)
VALUES (
  (SELECT id FROM studios WHERE slug = 'yogabrie'),
  'Studio',                        -- matches sessions.location value "Studio"
  (SELECT address FROM studios WHERE slug = 'yogabrie'),
  20,
  true
)
ON CONFLICT DO NOTHING;

-- Verify:
-- SELECT * FROM locations;


-- SECTION 4: Insert instructors from unique practitioner_name values in sessions
-- ----------------------------------------------------------------------------
INSERT INTO instructors (studio_id, display_name, initials, is_active)
SELECT DISTINCT
  (SELECT id FROM studios WHERE slug = 'yogabrie'),
  practitioner_name,
  practitioner_initials,
  true
FROM sessions
ON CONFLICT DO NOTHING;

-- Verify:
-- SELECT display_name, initials FROM instructors;


-- SECTION 5: Migrate sessions → class_templates (one per unique class_name)
-- ----------------------------------------------------------------------------
INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, is_active)
SELECT DISTINCT ON (class_name)
  (SELECT id FROM studios WHERE slug = 'yogabrie'),
  class_name,
  level,
  duration,
  price,
  true
FROM sessions
ORDER BY class_name, created_at
ON CONFLICT DO NOTHING;

-- Verify:
-- SELECT name, level, default_duration_minutes, default_price FROM class_templates ORDER BY name;


-- SECTION 6: Migrate sessions → schedule_rules (one per session row per weekday)
-- ----------------------------------------------------------------------------
-- Unnests the day_of_week integer array into individual rows.
INSERT INTO schedule_rules (
  studio_id, template_id, location_id, instructor_id,
  day_of_week, start_time, duration_minutes, price, max_capacity,
  effective_from, is_active
)
SELECT
  (SELECT id FROM studios WHERE slug = 'yogabrie')                         AS studio_id,
  ct.id                                                                     AS template_id,
  (SELECT id FROM locations
    WHERE studio_id = (SELECT id FROM studios WHERE slug = 'yogabrie')
      AND name = 'Studio'
    LIMIT 1)                                                               AS location_id,
  i.id                                                                      AS instructor_id,
  unnest(s.day_of_week)                                                     AS day_of_week,
  s.time::TIME                                                              AS start_time,
  s.duration                                                                AS duration_minutes,
  s.price                                                                   AS price,
  20                                                                        AS max_capacity,
  '2026-01-01'::DATE                                                        AS effective_from,
  true                                                                      AS is_active
FROM sessions s
JOIN class_templates ct
  ON ct.studio_id = (SELECT id FROM studios WHERE slug = 'yogabrie')
  AND ct.name = s.class_name
JOIN instructors i
  ON i.studio_id = (SELECT id FROM studios WHERE slug = 'yogabrie')
  AND i.display_name = s.practitioner_name
WHERE array_length(s.day_of_week, 1) > 0  -- skip sessions with empty day_of_week
ON CONFLICT DO NOTHING;

-- Verify count (should be >= number of sessions since days are unnested):
-- SELECT COUNT(*) FROM schedule_rules;


-- SECTION 7: Materialize class_instances for the next 90 days
-- ----------------------------------------------------------------------------
SELECT materialize_class_instances(
  (SELECT id FROM studios WHERE slug = 'yogabrie'),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '90 days'
);

-- Verify:
-- SELECT COUNT(*), MIN(starts_at), MAX(starts_at) FROM class_instances;


-- SECTION 8: Backfill bookings.class_instance_id from legacy (session_id, session_date)
-- ----------------------------------------------------------------------------
-- This matches each historical booking to the correct class_instance by:
--   - same studio
--   - same date (starts_at::date = session_date)
--   - class_template name matches the session's class_name

UPDATE bookings b
SET class_instance_id = ci.id
FROM class_instances ci
JOIN schedule_rules sr ON sr.id = ci.rule_id
JOIN class_templates ct ON ct.id = sr.template_id
JOIN sessions s ON s.id = b.session_id AND s.class_name = ct.name
WHERE ci.studio_id = (SELECT id FROM studios WHERE slug = 'yogabrie')
  AND ci.starts_at::date = b.session_date
  AND b.class_instance_id IS NULL;

-- Verify — this must return 0 before proceeding:
-- SELECT COUNT(*) FROM bookings WHERE class_instance_id IS NULL AND session_id IS NOT NULL;


-- SECTION 9: Pre-cutover verification checklist
-- ----------------------------------------------------------------------------
-- Run all of these and confirm expected values before redeploying the frontend.

SELECT 'studios'       AS tbl, COUNT(*) FROM studios;
SELECT 'studio_members' AS tbl, COUNT(*) FROM studio_members;
SELECT 'locations'     AS tbl, COUNT(*) FROM locations;
SELECT 'instructors'   AS tbl, COUNT(*) FROM instructors;
SELECT 'class_templates' AS tbl, COUNT(*) FROM class_templates;
SELECT 'schedule_rules'  AS tbl, COUNT(*) FROM schedule_rules;
SELECT 'class_instances' AS tbl, COUNT(*) FROM class_instances;

-- Must be 0:
SELECT COUNT(*) AS unmatched_bookings FROM bookings WHERE class_instance_id IS NULL AND session_id IS NOT NULL;

-- All bookings accounted for:
SELECT status, COUNT(*) FROM bookings GROUP BY status;
