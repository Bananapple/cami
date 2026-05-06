-- =============================================================
-- Demo Studio Seed — "brie-demo"
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Run Step 1 first, then Step 2, then Step 3 (manual).
-- Teardown at the bottom wipes everything cleanly.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- STEP 1: Studio skeleton
-- (studio, location, instructors, class templates, schedule rules,
--  14-day class instances, products)
-- ─────────────────────────────────────────────────────────────

INSERT INTO studios (slug, name, primary_color, timezone, currency, address, contact_email)
VALUES (
  'brie-demo',
  'Brie Studio',
  '#B5897A',
  'Europe/Oslo',
  'NOK',
  'Oslo',
  'hello@briestudio.no'
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  sid   UUID;
  loc_id UUID;
  inst1  UUID; inst2 UUID; inst3 UUID;
  tmpl1  UUID; tmpl2 UUID; tmpl3 UUID; tmpl4 UUID; tmpl5 UUID;
BEGIN
  SELECT id INTO sid FROM studios WHERE slug = 'brie-demo';

  -- Location
  INSERT INTO locations (studio_id, name, address, default_capacity)
  VALUES (sid, 'Studio', 'Brageveien 5A, Oslo', 20)
  ON CONFLICT (studio_id, name) DO NOTHING
  RETURNING id INTO loc_id;

  IF loc_id IS NULL THEN
    SELECT id INTO loc_id FROM locations WHERE studio_id = sid AND name = 'Studio';
  END IF;

  -- Instructors
  INSERT INTO instructors (studio_id, display_name, initials, specialty)
  VALUES (sid, 'Bianca Hagen', 'B', 'Ashtanga & Pilates') RETURNING id INTO inst1;
  INSERT INTO instructors (studio_id, display_name, initials, specialty)
  VALUES (sid, 'Olivia Dahl', 'O', 'Yin & Restorative') RETURNING id INTO inst2;
  INSERT INTO instructors (studio_id, display_name, initials, specialty)
  VALUES (sid, 'Marte Solberg', 'M', 'Mama & Baby') RETURNING id INTO inst3;

  -- Class templates
  INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, default_max_capacity, default_instructor_id)
  VALUES (sid, 'Pilates',              'All levels',   60, 250, 18, inst1) RETURNING id INTO tmpl1;
  INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, default_max_capacity, default_instructor_id)
  VALUES (sid, 'Ashtanga Mysore',      'Intermediate', 90, 300, 12, inst1) RETURNING id INTO tmpl2;
  INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, default_max_capacity, default_instructor_id)
  VALUES (sid, 'Yin Yoga',             'All levels',   75, 250, 20, inst2) RETURNING id INTO tmpl3;
  INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, default_max_capacity, default_instructor_id)
  VALUES (sid, 'Mama & Baby Pilates',  'Beginner',     60, 200, 10, inst3) RETURNING id INTO tmpl4;
  INSERT INTO class_templates (studio_id, name, level, default_duration_minutes, default_price, default_max_capacity, default_instructor_id)
  VALUES (sid, 'Ashtanga Full Led',    'All levels',   90, 300, 16, inst1) RETURNING id INTO tmpl5;

  -- Schedule rules (day_of_week: 0=Sun, 1=Mon, … 6=Sat)
  INSERT INTO schedule_rules
    (studio_id, template_id, location_id, instructor_id, day_of_week, start_time, duration_minutes, price, max_capacity, effective_from)
  VALUES
    -- Monday
    (sid, tmpl1, loc_id, inst1, 1, '09:00', 60, 250, 18, CURRENT_DATE),
    (sid, tmpl3, loc_id, inst2, 1, '18:00', 75, 250, 20, CURRENT_DATE),
    -- Tuesday
    (sid, tmpl2, loc_id, inst1, 2, '07:00', 90, 300, 12, CURRENT_DATE),
    (sid, tmpl1, loc_id, inst1, 2, '11:00', 60, 250, 18, CURRENT_DATE),
    -- Wednesday
    (sid, tmpl4, loc_id, inst3, 3, '10:00', 60, 200, 10, CURRENT_DATE),
    (sid, tmpl3, loc_id, inst2, 3, '18:00', 75, 250, 20, CURRENT_DATE),
    -- Thursday
    (sid, tmpl2, loc_id, inst1, 4, '07:00', 90, 300, 12, CURRENT_DATE),
    (sid, tmpl1, loc_id, inst1, 4, '09:00', 60, 250, 18, CURRENT_DATE),
    (sid, tmpl5, loc_id, inst1, 4, '16:30', 90, 300, 16, CURRENT_DATE),
    -- Saturday
    (sid, tmpl5, loc_id, inst1, 6, '11:00', 90, 300, 16, CURRENT_DATE),
    (sid, tmpl4, loc_id, inst3, 6, '14:00', 60, 200, 10, CURRENT_DATE);

  -- Materialize 14-day class instances
  PERFORM materialize_class_instances(sid, CURRENT_DATE, CURRENT_DATE + 14);

  -- Products
  INSERT INTO products (studio_id, type, name, price_minor, currency, credits, validity_days, billing_interval, display_order, tag)
  VALUES
    (sid, 'drop_in',      'Drop-in class',     25000,  'NOK', NULL, NULL, NULL,    0, NULL),
    (sid, 'clip_card',    '10× Clip Card',     200000, 'NOK', 10,   365,  NULL,    1, 'Best value'),
    (sid, 'subscription', 'Monthly Unlimited', 89900,  'NOK', NULL, NULL, 'month', 2, 'Most popular');

  RAISE NOTICE 'Step 1 done — studio_id = %', sid;
END $$;


-- ─────────────────────────────────────────────────────────────
-- STEP 2: Demo members + memberships + bookings
-- Covers all client segments: Regular, New, Lapsing, One-timer
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  sid  UUID;
  u1   UUID := gen_random_uuid();  -- Emma    regular, subscription
  u2   UUID := gen_random_uuid();  -- Astrid  regular, clip card 8 credits
  u3   UUID := gen_random_uuid();  -- Sofia   regular, clip card 3 credits (low)
  u4   UUID := gen_random_uuid();  -- Ole     regular, no plan
  u5   UUID := gen_random_uuid();  -- Ingrid  new (14d ago), no plan
  u6   UUID := gen_random_uuid();  -- Nora    new (5d ago), no plan
  u7   UUID := gen_random_uuid();  -- Lars    lapsing (last booked 55d ago)
  u8   UUID := gen_random_uuid();  -- Maja    one-timer
  mem1 UUID; mem2 UUID; mem3 UUID;
  inst_today  UUID; inst_today2 UUID;
  inst_past1  UUID; inst_past2  UUID; inst_past3 UUID;
BEGIN
  SELECT id INTO sid FROM studios WHERE slug = 'brie-demo';

  -- Auth users
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  VALUES
    (u1, 'authenticated', 'authenticated', 'emma.larsen@demo.brie',    now()-'180d'::interval, now()-'180d'::interval, now(), '{"full_name":"Emma Larsen"}'),
    (u2, 'authenticated', 'authenticated', 'astrid.lie@demo.brie',     now()-'120d'::interval, now()-'120d'::interval, now(), '{"full_name":"Astrid Lie"}'),
    (u3, 'authenticated', 'authenticated', 'sofia.andersen@demo.brie', now()-'90d'::interval,  now()-'90d'::interval,  now(), '{"full_name":"Sofia Andersen"}'),
    (u4, 'authenticated', 'authenticated', 'ole.thorsen@demo.brie',    now()-'200d'::interval, now()-'200d'::interval, now(), '{"full_name":"Ole Thorsen"}'),
    (u5, 'authenticated', 'authenticated', 'ingrid.berg@demo.brie',    now()-'14d'::interval,  now()-'14d'::interval,  now(), '{"full_name":"Ingrid Berg"}'),
    (u6, 'authenticated', 'authenticated', 'nora.dahl@demo.brie',      now()-'5d'::interval,   now()-'5d'::interval,   now(), '{"full_name":"Nora Dahl"}'),
    (u7, 'authenticated', 'authenticated', 'lars.eriksen@demo.brie',   now()-'150d'::interval, now()-'150d'::interval, now(), '{"full_name":"Lars Eriksen"}'),
    (u8, 'authenticated', 'authenticated', 'maja.nygard@demo.brie',    now()-'60d'::interval,  now()-'60d'::interval,  now(), '{"full_name":"Maja Nygård"}');

  -- Profiles
  INSERT INTO profiles (id, email, full_name)
  VALUES
    (u1, 'emma.larsen@demo.brie',    'Emma Larsen'),
    (u2, 'astrid.lie@demo.brie',     'Astrid Lie'),
    (u3, 'sofia.andersen@demo.brie', 'Sofia Andersen'),
    (u4, 'ole.thorsen@demo.brie',    'Ole Thorsen'),
    (u5, 'ingrid.berg@demo.brie',    'Ingrid Berg'),
    (u6, 'nora.dahl@demo.brie',      'Nora Dahl'),
    (u7, 'lars.eriksen@demo.brie',   'Lars Eriksen'),
    (u8, 'maja.nygard@demo.brie',    'Maja Nygård');

  -- Studio members
  INSERT INTO studio_members (studio_id, user_id, role, total_sessions, level, joined_at, status)
  VALUES
    (sid, u1, 'member', 32, 'REGULAR', now()-'180d'::interval, 'active'),
    (sid, u2, 'member', 22, 'REGULAR', now()-'120d'::interval, 'active'),
    (sid, u3, 'member',  8, 'STARTER', now()-'90d'::interval,  'active'),
    (sid, u4, 'member', 41, 'VETERAN', now()-'200d'::interval, 'active'),
    (sid, u5, 'member',  2, 'STARTER', now()-'14d'::interval,  'active'),
    (sid, u6, 'member',  1, 'STARTER', now()-'5d'::interval,   'active'),
    (sid, u7, 'member',  9, 'REGULAR', now()-'150d'::interval, 'active'),
    (sid, u8, 'member',  1, 'STARTER', now()-'60d'::interval,  'active');

  -- Memberships
  INSERT INTO memberships (studio_id, user_id, plan_name, status, credits_remaining, valid_until)
  VALUES (sid, u1, 'Monthly Unlimited', 'active', NULL, CURRENT_DATE + 18) RETURNING id INTO mem1;
  INSERT INTO memberships (studio_id, user_id, plan_name, status, credits_remaining, valid_until)
  VALUES (sid, u2, '10× Clip Card', 'active', 8, CURRENT_DATE + 200) RETURNING id INTO mem2;
  INSERT INTO memberships (studio_id, user_id, plan_name, status, credits_remaining, valid_until)
  VALUES (sid, u3, '10× Clip Card', 'active', 3, CURRENT_DATE + 120) RETURNING id INTO mem3;

  -- Pick today's class instances
  SELECT id INTO inst_today  FROM class_instances WHERE studio_id = sid AND starts_at::date = CURRENT_DATE ORDER BY starts_at LIMIT 1;
  SELECT id INTO inst_today2 FROM class_instances WHERE studio_id = sid AND starts_at::date = CURRENT_DATE ORDER BY starts_at OFFSET 1 LIMIT 1;

  -- Pick past instances for history
  SELECT id INTO inst_past1 FROM class_instances WHERE studio_id = sid AND starts_at < now() ORDER BY starts_at DESC LIMIT 1 OFFSET 0;
  SELECT id INTO inst_past2 FROM class_instances WHERE studio_id = sid AND starts_at < now() ORDER BY starts_at DESC LIMIT 1 OFFSET 1;
  SELECT id INTO inst_past3 FROM class_instances WHERE studio_id = sid AND starts_at < now() ORDER BY starts_at DESC LIMIT 1 OFFSET 2;

  -- Today's bookings (good for Today screen + check-in demo)
  INSERT INTO bookings (studio_id, user_id, class_instance_id, status, membership_id, checked_in_at)
  VALUES
    (sid, u1, inst_today,  'confirmed', mem1, now()-'30 minutes'::interval),  -- Emma, checked in
    (sid, u2, inst_today,  'confirmed', mem2, NULL),                           -- Astrid, arriving
    (sid, u4, inst_today,  'confirmed', NULL, now()-'25 minutes'::interval),   -- Ole, checked in
    (sid, u3, inst_today2, 'confirmed', mem3, NULL);                           -- Sofia, later class

  -- Past bookings (mix of statuses for member drawer history)
  INSERT INTO bookings (studio_id, user_id, class_instance_id, status, checked_in_at, cancelled_at)
  VALUES
    (sid, u1, inst_past1, 'confirmed', now()-'2d'::interval,  NULL),           -- Emma attended
    (sid, u1, inst_past2, 'cancelled', NULL, now()-'5d'::interval),            -- Emma cancelled
    (sid, u2, inst_past1, 'confirmed', now()-'2d'::interval,  NULL),           -- Astrid attended
    (sid, u4, inst_past1, 'confirmed', now()-'2d'::interval,  NULL),           -- Ole attended
    (sid, u4, inst_past3, 'confirmed', NULL,                  NULL),           -- Ole no-show (no check-in)
    (sid, u5, inst_past1, 'confirmed', now()-'10d'::interval, NULL),           -- Ingrid attended
    (sid, u5, inst_past2, 'confirmed', now()-'3d'::interval,  NULL),           -- Ingrid attended
    (sid, u6, inst_past1, 'confirmed', now()-'4d'::interval,  NULL),           -- Nora attended
    (sid, u8, inst_past1, 'confirmed', now()-'20d'::interval, NULL);           -- Maja one-timer

  RAISE NOTICE 'Step 2 done — 8 members, bookings + memberships created';
END $$;


-- ─────────────────────────────────────────────────────────────
-- STEP 3: Add yourself as manager (run after signing up on the demo site)
-- Find your UUID in Supabase → Authentication → Users
-- ─────────────────────────────────────────────────────────────

-- INSERT INTO studio_members (studio_id, user_id, role, total_sessions, level, joined_at)
-- SELECT s.id, '<YOUR_USER_UUID>', 'manager', 0, 'STARTER', now()
-- FROM studios s WHERE s.slug = 'brie-demo'
-- ON CONFLICT (studio_id, user_id) DO UPDATE SET role = 'manager';


-- ─────────────────────────────────────────────────────────────
-- TEARDOWN: wipe demo studio + all its data
-- ─────────────────────────────────────────────────────────────

-- DO $$
-- DECLARE sid UUID;
-- BEGIN
--   SELECT id INTO sid FROM studios WHERE slug = 'brie-demo';
--   DELETE FROM auth.users WHERE email LIKE '%@demo.brie';
--   DELETE FROM studios WHERE id = sid;  -- cascades to all child tables
-- END $$;
