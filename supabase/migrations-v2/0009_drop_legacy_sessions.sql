-- Drop legacy sessions schema
--
-- The v2 backfill (backfill-yogabrie.sql) migrated all sessions → class_templates/schedule_rules
-- and all bookings.session_id → bookings.class_instance_id. Applied 2026-04-30.

ALTER TABLE bookings DROP COLUMN IF EXISTS session_id;
ALTER TABLE bookings DROP COLUMN IF EXISTS session_date;

-- class_instance_id now has UNIQUE(user_id, class_instance_id) and all rows are populated
ALTER TABLE bookings ALTER COLUMN class_instance_id SET NOT NULL;

-- sessions table is fully superseded by class_templates + schedule_rules + class_instances
DROP TABLE IF EXISTS public.sessions CASCADE;
