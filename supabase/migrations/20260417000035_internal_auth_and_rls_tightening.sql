-- ============================================================================
-- Phase 10: Internal auth checks + RLS tightening
--
-- 1. materialize_class_instances: add internal user_is_staff(_studio_id) check
--    so the function defends itself even though it stays EXECUTE-able by
--    authenticated (the frontend manage views call it directly).
--
-- 2. bookings_self_cancel: tighten RLS so a user can only UPDATE their own
--    booking when the new status is 'cancelled'. Previously the policy
--    accepted any UPDATE, including status='confirmed' — letting a user flip
--    a pending booking to confirmed from the client without paying.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. materialize_class_instances: defense-in-depth staff check
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
  -- Defense-in-depth: only staff for this studio can materialize.
  -- The function is callable directly by authenticated users via PostgREST,
  -- so it cannot rely on the caller being inside a trusted Edge Function.
  -- service_role calls (e.g. from pg_cron or Edge Functions) bypass this
  -- because auth.uid() is NULL and user_is_staff returns false — so we also
  -- allow service_role explicitly.
  IF auth.role() <> 'service_role' AND NOT public.user_is_staff(_studio_id) THEN
    RAISE EXCEPTION 'Forbidden: not staff for studio %', _studio_id
      USING ERRCODE = '42501';
  END IF;

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

        SELECT * INTO _exc FROM schedule_exceptions
         WHERE rule_id = _rule.id AND exception_date = _date;

        IF FOUND AND _exc.kind = 'cancel' THEN
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

        SELECT COALESCE(l.timezone, _studio.timezone) INTO _tz
          FROM locations l WHERE l.id = _effective_location;
        IF _tz IS NULL THEN _tz := _studio.timezone; END IF;

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
        WHERE class_instances.booked_count = 0;

        _count := _count + 1;
      END IF;
      _date := _date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
  RETURN _count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. bookings_self_cancel: restrict to status='cancelled' transitions only
--
-- Old policy let users UPDATE any column on their own booking, including
-- flipping status from 'pending' to 'confirmed' from the client without
-- paying. This is the table-level companion to the SECURITY DEFINER REVOKE
-- in 0030 — a defense-in-depth pair so neither path lets users self-confirm.
--
-- The new policy:
--   - Caller must own the booking (user_id = auth.uid())
--   - The new status (after UPDATE) must be 'cancelled'
--   - The old status (before UPDATE) must be 'pending' or 'confirmed'
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "bookings_self_cancel" ON bookings;

CREATE POLICY "bookings_self_cancel" ON bookings FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND studio_id IN (SELECT public.user_studio_ids())
    AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );
