-- ============================================================================
-- Phase 8: Security Hardening
--
-- 1. RLS: scope all public/member read policies to studio_id
--    - locations, instructors, class_templates: anon reads via x-studio-slug header;
--      authenticated reads via studio_members membership
--    - schedule_rules, schedule_exceptions: restrict to staff only (not used by frontend)
--    - class_instances: same dual-policy pattern as above
--
-- 2. bookings: add UNIQUE(user_id, class_instance_id) to prevent double-booking
--
-- 3. studio_members: allow authenticated users to self-insert as 'member'
--    so new users can book without waiting for staff invite
--
-- 4. Atomic payment DB functions: confirm_booking, refund_booking
--    Wraps the two-UPDATE sequence in a single plpgsql call so PostgREST
--    auto-wraps it in a transaction — no partial-update failure window.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. Fix RLS on locations
-- ----------------------------------------------------------------------------
DROP POLICY "locations_public_read" ON locations;

-- Anon visitors: only see locations for the studio identified by x-studio-slug header.
-- The frontend Supabase client sets this header from VITE_STUDIO_SLUG env var.
CREATE POLICY "locations_anon_read" ON locations FOR SELECT
  TO anon
  USING (
    is_active
    AND studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

-- Authenticated members: only see locations for studios they belong to.
CREATE POLICY "locations_member_read" ON locations FOR SELECT
  TO authenticated
  USING (
    is_active
    AND studio_id = ANY(
      SELECT studio_id FROM studio_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 1b. Fix RLS on instructors
-- ----------------------------------------------------------------------------
DROP POLICY "instructors_public_read" ON instructors;

CREATE POLICY "instructors_anon_read" ON instructors FOR SELECT
  TO anon
  USING (
    is_active
    AND studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

CREATE POLICY "instructors_member_read" ON instructors FOR SELECT
  TO authenticated
  USING (
    is_active
    AND studio_id = ANY(
      SELECT studio_id FROM studio_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 1c. Fix RLS on class_templates
-- ----------------------------------------------------------------------------
DROP POLICY "class_templates_public_read" ON class_templates;

CREATE POLICY "class_templates_anon_read" ON class_templates FOR SELECT
  TO anon
  USING (
    is_active
    AND studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

CREATE POLICY "class_templates_member_read" ON class_templates FOR SELECT
  TO authenticated
  USING (
    is_active
    AND studio_id = ANY(
      SELECT studio_id FROM studio_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 1d. Fix RLS on schedule_rules (staff only — not queried directly by frontend)
-- ----------------------------------------------------------------------------
DROP POLICY "schedule_rules_public_read" ON schedule_rules;

-- Retain: schedule_rules_staff_write already exists and covers staff reads/writes.
-- Add an explicit staff-only read policy.
CREATE POLICY "schedule_rules_staff_read" ON schedule_rules FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

-- ----------------------------------------------------------------------------
-- 1e. Fix RLS on schedule_exceptions (staff only)
-- ----------------------------------------------------------------------------
DROP POLICY "schedule_exceptions_public_read" ON schedule_exceptions;

CREATE POLICY "schedule_exceptions_staff_read" ON schedule_exceptions FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

-- ----------------------------------------------------------------------------
-- 1f. Fix RLS on class_instances
-- ----------------------------------------------------------------------------
DROP POLICY "class_instances_public_read" ON class_instances;

CREATE POLICY "class_instances_anon_read" ON class_instances FOR SELECT
  TO anon
  USING (
    status IN ('scheduled', 'completed')
    AND studio_id = (
      SELECT id FROM studios
      WHERE slug = nullif(current_setting('request.headers', true)::json->>'x-studio-slug', '')
    )
  );

CREATE POLICY "class_instances_member_read" ON class_instances FOR SELECT
  TO authenticated
  USING (
    status IN ('scheduled', 'completed')
    AND studio_id = ANY(
      SELECT studio_id FROM studio_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Bookings: UNIQUE(user_id, class_instance_id) prevents double-booking
-- ----------------------------------------------------------------------------
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_session_date_unique;
ALTER TABLE bookings ADD CONSTRAINT bookings_user_instance_unique
  UNIQUE (user_id, class_instance_id);

-- ----------------------------------------------------------------------------
-- 3. studio_members: allow authenticated users to self-insert as 'member'
--    The create-checkout Edge Function upserts this row on first booking,
--    but this policy also allows the frontend to do it directly if needed.
-- ----------------------------------------------------------------------------
CREATE POLICY "studio_members_self_insert" ON studio_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member');

-- ----------------------------------------------------------------------------
-- 4. Atomic payment state transition functions
--    PostgREST wraps each RPC call in an implicit transaction, making both
--    UPDATEs atomic. Partial failure (payment updated, booking not) is impossible.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_booking(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments SET status = 'succeeded' WHERE id = p_payment_id;
  UPDATE bookings SET status = 'confirmed' WHERE payment_id = p_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_booking(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments SET status = 'refunded' WHERE id = p_payment_id;
  UPDATE bookings SET status = 'cancelled' WHERE payment_id = p_payment_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Fix materializer: respect location timezone + clean up cancelled instances
--
-- Replaces materialize_class_instances() with corrected version that:
-- a) Uses location.timezone when set (fallback to studio.timezone)
-- b) Deletes pre-existing scheduled instances when a cancel exception is applied
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
  _tz TEXT;
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
          -- Delete any pre-existing scheduled instance for this slot that has no
          -- confirmed bookings. Instances with confirmed bookings are left in place
          -- so staff can handle them manually.
          DELETE FROM class_instances
           WHERE studio_id = _studio_id
             AND rule_id = _rule.id
             AND starts_at::date = _date
             AND status = 'scheduled'
             AND NOT EXISTS (
               SELECT 1 FROM bookings
                WHERE class_instance_id = class_instances.id
                  AND status = 'confirmed'
             );
          _date := _date + INTERVAL '1 day';
          CONTINUE;
        END IF;

        _effective_start_time := COALESCE(_exc.new_start_time, _rule.start_time);
        _effective_duration := COALESCE(_exc.new_duration_minutes, _rule.duration_minutes);
        _effective_instructor := COALESCE(_exc.new_instructor_id, _rule.instructor_id);
        _effective_location := COALESCE(_exc.new_location_id, _rule.location_id);

        -- Use location timezone if set; fall back to studio timezone.
        SELECT COALESCE(l.timezone, _studio.timezone) INTO _tz
          FROM locations l WHERE l.id = _effective_location;
        IF _tz IS NULL THEN _tz := _studio.timezone; END IF;

        -- Compose studio-local timestamp, convert to TIMESTAMPTZ in the correct zone.
        _start_local := (_date::TEXT || ' ' || _effective_start_time::TEXT)::TIMESTAMP;
        _start_ts := _start_local AT TIME ZONE _tz;
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
