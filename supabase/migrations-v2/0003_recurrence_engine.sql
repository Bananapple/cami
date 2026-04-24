-- ============================================================================
-- Phase 3: Recurrence Engine
-- Replaces the naive day_of_week[] pattern with templates + rules + exceptions,
-- materialized into class_instances. Adds conflict detection for instructors
-- and rooms via GIST exclusion constraints.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- locations (rooms or branches within a studio)
-- ----------------------------------------------------------------------------
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT,                 -- overrides studio default if the branch is elsewhere
  default_capacity INT NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, name)
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_public_read" ON locations FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "locations_staff_write" ON locations FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- instructors (may or may not map to an auth.users account)
-- ----------------------------------------------------------------------------
CREATE TABLE instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- optional linkage
  display_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructors_public_read" ON instructors FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "instructors_staff_write" ON instructors FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- class_templates: the "what" of a class
-- ----------------------------------------------------------------------------
CREATE TABLE class_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  level TEXT NOT NULL DEFAULT 'All levels',
  default_duration_minutes INT NOT NULL DEFAULT 60,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 250,
  default_max_capacity INT NOT NULL DEFAULT 20,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE class_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_templates_public_read" ON class_templates FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "class_templates_staff_write" ON class_templates FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- schedule_rules: one rule per weekday slot
-- ----------------------------------------------------------------------------
CREATE TABLE schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES class_templates(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,                          -- studio-local
  duration_minutes INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  max_capacity INT NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,                              -- NULL = indefinite
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_effective_range CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_schedule_rules_studio ON schedule_rules (studio_id, is_active);
CREATE INDEX idx_schedule_rules_template ON schedule_rules (template_id);

ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_rules_public_read" ON schedule_rules FOR SELECT
  TO anon, authenticated
  USING (is_active);

CREATE POLICY "schedule_rules_staff_write" ON schedule_rules FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- schedule_exceptions: deviations for specific dates
-- ----------------------------------------------------------------------------
CREATE TYPE exception_kind AS ENUM ('cancel', 'reschedule', 'sub_instructor', 'relocate');

CREATE TABLE schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES schedule_rules(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  kind exception_kind NOT NULL,
  new_start_time TIME,
  new_duration_minutes INT,
  new_instructor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  new_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, exception_date)
);

ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_exceptions_public_read" ON schedule_exceptions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "schedule_exceptions_staff_write" ON schedule_exceptions FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- class_instances: materialized concrete occurrences
-- This is what bookings and waitlists point to.
-- ----------------------------------------------------------------------------
CREATE TYPE class_instance_status AS ENUM ('scheduled', 'cancelled', 'completed');

CREATE TABLE class_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES class_templates(id) ON DELETE RESTRICT,
  rule_id UUID REFERENCES schedule_rules(id) ON DELETE SET NULL,  -- NULL = one-off
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  time_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  price NUMERIC(10,2) NOT NULL,
  max_capacity INT NOT NULL,
  status class_instance_status NOT NULL DEFAULT 'scheduled',
  booked_count INT NOT NULL DEFAULT 0,                    -- denormalized, trigger-maintained
  waitlist_offered_count INT NOT NULL DEFAULT 0,          -- denormalized, trigger-maintained
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_instance_time_order CHECK (ends_at > starts_at),
  CONSTRAINT class_instance_counts CHECK (booked_count >= 0 AND waitlist_offered_count >= 0)
);

-- Exclusion constraints for conflict detection (only for scheduled instances)
ALTER TABLE class_instances
  ADD CONSTRAINT instructor_no_overlap
  EXCLUDE USING GIST (
    instructor_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'scheduled');

ALTER TABLE class_instances
  ADD CONSTRAINT location_no_overlap
  EXCLUDE USING GIST (
    location_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'scheduled');

-- Prevent duplicate instances for the same rule at the same start time
CREATE UNIQUE INDEX idx_class_instances_rule_date
  ON class_instances (rule_id, starts_at)
  WHERE rule_id IS NOT NULL;

CREATE INDEX idx_class_instances_lookup ON class_instances (studio_id, starts_at, status);
CREATE INDEX idx_class_instances_instructor ON class_instances (instructor_id, starts_at);
CREATE INDEX idx_class_instances_location ON class_instances (location_id, starts_at);

CREATE TRIGGER trg_class_instances_touch
  BEFORE UPDATE ON class_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE class_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_instances_public_read" ON class_instances FOR SELECT
  TO anon, authenticated
  USING (status IN ('scheduled', 'completed'));

CREATE POLICY "class_instances_staff_write" ON class_instances FOR ALL
  TO authenticated
  USING (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]))
  WITH CHECK (public.user_has_role(studio_id, ARRAY['owner','manager']::studio_role[]));

-- ----------------------------------------------------------------------------
-- Rewire bookings to point at class_instances (not the legacy sessions table)
-- ----------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS class_instance_id UUID REFERENCES class_instances(id) ON DELETE RESTRICT;

-- Backfill (after materializer has populated class_instances):
--   UPDATE bookings b
--      SET class_instance_id = ci.id
--     FROM class_instances ci
--    WHERE ci.studio_id = b.studio_id
--      AND ci.starts_at::date = b.session_date
--      AND ci.rule_id IN (
--        SELECT sr.id FROM schedule_rules sr
--         WHERE sr.template_id = (SELECT ct.id FROM class_templates ct WHERE ct.name = (SELECT s.class_name FROM sessions s WHERE s.id = b.session_id))
--      );
-- Verify all bookings populated before enforcing NOT NULL.

-- Drop old session_id FK after backfill:
--   ALTER TABLE bookings DROP COLUMN session_id;
-- Then:
--   ALTER TABLE bookings ALTER COLUMN class_instance_id SET NOT NULL;
-- Replace the old UNIQUE (user_id, session_id, session_date) constraint:
--   ALTER TABLE bookings DROP CONSTRAINT bookings_user_session_date_unique;
--   ALTER TABLE bookings ADD CONSTRAINT bookings_user_instance_unique
--     UNIQUE (user_id, class_instance_id);

-- ----------------------------------------------------------------------------
-- booked_count maintenance trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_class_instance_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' THEN
      UPDATE class_instances SET booked_count = booked_count + 1 WHERE id = NEW.class_instance_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
      UPDATE class_instances SET booked_count = booked_count - 1 WHERE id = NEW.class_instance_id;
    ELSIF OLD.status <> 'confirmed' AND NEW.status = 'confirmed' THEN
      UPDATE class_instances SET booked_count = booked_count + 1 WHERE id = NEW.class_instance_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmed' THEN
      UPDATE class_instances SET booked_count = booked_count - 1 WHERE id = OLD.class_instance_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_bookings_sync_counts
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_class_instance_counts();

-- ----------------------------------------------------------------------------
-- Materializer: expand schedule_rules into class_instances for a date window
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materialize_class_instances(
  _studio_id UUID,
  _from DATE,
  _to DATE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rule RECORD;
  _exc RECORD;
  _studio RECORD;
  _date DATE;
  _start_local TIMESTAMP;
  _start_ts TIMESTAMPTZ;
  _end_ts TIMESTAMPTZ;
  _effective_instructor UUID;
  _effective_location UUID;
  _effective_duration INT;
  _effective_start_time TIME;
  _count INT := 0;
BEGIN
  SELECT timezone INTO _studio FROM studios WHERE id = _studio_id;
  IF _studio IS NULL THEN RAISE EXCEPTION 'Studio % not found', _studio_id; END IF;

  FOR _rule IN
    SELECT * FROM schedule_rules
     WHERE studio_id = _studio_id
       AND is_active
  LOOP
    _date := GREATEST(_from, _rule.effective_from);
    WHILE _date <= LEAST(_to, COALESCE(_rule.effective_until, _to)) LOOP
      IF EXTRACT(DOW FROM _date) = _rule.day_of_week THEN

        -- Look up exception if any
        SELECT * INTO _exc FROM schedule_exceptions
         WHERE rule_id = _rule.id AND exception_date = _date;

        IF FOUND AND _exc.kind = 'cancel' THEN
          _date := _date + INTERVAL '1 day';
          CONTINUE;
        END IF;

        _effective_start_time := COALESCE(_exc.new_start_time, _rule.start_time);
        _effective_duration := COALESCE(_exc.new_duration_minutes, _rule.duration_minutes);
        _effective_instructor := COALESCE(_exc.new_instructor_id, _rule.instructor_id);
        _effective_location := COALESCE(_exc.new_location_id, _rule.location_id);

        -- Compose studio-local timestamp, convert to TIMESTAMPTZ
        _start_local := (_date::TEXT || ' ' || _effective_start_time::TEXT)::TIMESTAMP;
        _start_ts := _start_local AT TIME ZONE _studio.timezone;
        _end_ts := _start_ts + (_effective_duration || ' minutes')::INTERVAL;

        INSERT INTO class_instances (
          studio_id, template_id, rule_id, location_id, instructor_id,
          starts_at, ends_at, price, max_capacity, status
        ) VALUES (
          _studio_id, _rule.template_id, _rule.id, _effective_location, _effective_instructor,
          _start_ts, _end_ts, _rule.price, _rule.max_capacity, 'scheduled'
        )
        ON CONFLICT (rule_id, starts_at) WHERE rule_id IS NOT NULL
        DO UPDATE SET
          location_id = EXCLUDED.location_id,
          instructor_id = EXCLUDED.instructor_id,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          price = EXCLUDED.price,
          max_capacity = EXCLUDED.max_capacity
        WHERE class_instances.booked_count = 0;  -- never silently change a class with bookings

        _count := _count + 1;
      END IF;
      _date := _date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
  RETURN _count;
END;
$$;

-- Daily rolling-window materialization (uncomment when pg_cron is enabled):
--   SELECT cron.schedule(
--     'materialize-instances-daily',
--     '0 2 * * *',
--     $$SELECT materialize_class_instances(s.id, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days')
--          FROM studios s WHERE s.is_active$$
--   );
