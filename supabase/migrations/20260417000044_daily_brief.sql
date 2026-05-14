-- ─────────────────────────────────────────────────────────────────────────────
-- 0044: Daily brief infrastructure
--
-- 1. daily_brief_enabled flag on studios
-- 2. brief_signals table — freshness tracker for nudge-type signals so the
--    same person isn't surfaced every morning until something changes
-- 3. Four SQL helper functions for the complex signal queries (window functions
--    and cross-table joins that PostgREST can't express cleanly)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Studio flag ────────────────────────────────────────────────────────────

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS daily_brief_enabled BOOLEAN NOT NULL DEFAULT true;

-- ── 2. brief_signals ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brief_signals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    UUID        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type  TEXT        NOT NULL,  -- 'clip_inactive' | 'expiring_membership' | 'first_timer_return'
  surfaced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_brief_signals_lookup
  ON brief_signals (studio_id, signal_type, surfaced_at DESC);

ALTER TABLE brief_signals ENABLE ROW LEVEL SECURITY;
-- Service role only — no end-user RLS policies

-- ── 3. SQL helper functions ───────────────────────────────────────────────────

-- First-timers (total_sessions=1) with a class today
CREATE OR REPLACE FUNCTION brief_first_timers_today(p_studio_id uuid, p_tz text)
RETURNS TABLE(user_id uuid, full_name text, class_name text, time_str text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (sm.user_id)
    sm.user_id,
    p.full_name,
    ct.name  AS class_name,
    to_char(ci.starts_at AT TIME ZONE p_tz, 'HH12:MI AM') AS time_str
  FROM bookings b
  JOIN class_instances ci  ON ci.id  = b.class_instance_id
  JOIN class_templates ct  ON ct.id  = ci.template_id
  JOIN studio_members  sm  ON sm.user_id   = b.user_id AND sm.studio_id = p_studio_id
  JOIN profiles        p   ON p.id         = b.user_id
  WHERE b.studio_id   = p_studio_id
    AND b.status      = 'confirmed'
    AND sm.total_sessions = 1
    AND (ci.starts_at AT TIME ZONE p_tz)::date = (now() AT TIME ZONE p_tz)::date
  ORDER BY sm.user_id, ci.starts_at;
$$;

-- Members hitting a session milestone (5, 10, 25, 50, 100) with a class today
CREATE OR REPLACE FUNCTION brief_milestones_today(p_studio_id uuid, p_tz text)
RETURNS TABLE(user_id uuid, full_name text, total_sessions int, class_name text, time_str text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (sm.user_id)
    sm.user_id,
    p.full_name,
    sm.total_sessions,
    ct.name  AS class_name,
    to_char(ci.starts_at AT TIME ZONE p_tz, 'HH12:MI AM') AS time_str
  FROM bookings b
  JOIN class_instances ci  ON ci.id  = b.class_instance_id
  JOIN class_templates ct  ON ct.id  = ci.template_id
  JOIN studio_members  sm  ON sm.user_id   = b.user_id AND sm.studio_id = p_studio_id
  JOIN profiles        p   ON p.id         = b.user_id
  WHERE b.studio_id   = p_studio_id
    AND b.status      = 'confirmed'
    AND sm.total_sessions = ANY(ARRAY[5, 10, 25, 50, 100])
    AND (ci.starts_at AT TIME ZONE p_tz)::date = (now() AT TIME ZONE p_tz)::date
  ORDER BY sm.user_id, ci.starts_at;
$$;

-- Members who have a class today after a 30+ day gap
CREATE OR REPLACE FUNCTION brief_returns_today(
  p_studio_id uuid,
  p_tz        text,
  p_gap_days  int DEFAULT 30
)
RETURNS TABLE(user_id uuid, full_name text, days_away int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT
      b.user_id,
      ci.starts_at,
      ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY ci.starts_at DESC) AS rn
    FROM bookings b
    JOIN class_instances ci ON ci.id = b.class_instance_id
    WHERE b.studio_id = p_studio_id
      AND b.status    = 'confirmed'
  ),
  top_two AS (
    SELECT user_id,
      MAX(starts_at) FILTER (WHERE rn = 1) AS latest,
      MAX(starts_at) FILTER (WHERE rn = 2) AS previous
    FROM ranked
    WHERE rn <= 2
    GROUP BY user_id
  )
  SELECT
    t.user_id,
    p.full_name,
    EXTRACT(DAY FROM (t.latest - t.previous))::int AS days_away
  FROM top_two t
  JOIN profiles p ON p.id = t.user_id
  WHERE (t.latest   AT TIME ZONE p_tz)::date = (now() AT TIME ZONE p_tz)::date
    AND t.previous  IS NOT NULL
    AND t.latest - t.previous >= (p_gap_days || ' days')::interval
  ORDER BY days_away DESC;
$$;

-- First-timers (total_sessions=1) whose only class was 7-14 days ago
CREATE OR REPLACE FUNCTION brief_first_timer_returns(p_studio_id uuid)
RETURNS TABLE(user_id uuid, full_name text, days_ago int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    sm.user_id,
    p.full_name,
    EXTRACT(DAY FROM now() - ci.starts_at)::int AS days_ago
  FROM bookings b
  JOIN class_instances ci ON ci.id = b.class_instance_id
  JOIN studio_members  sm ON sm.user_id = b.user_id AND sm.studio_id = p_studio_id
  JOIN profiles        p  ON p.id       = b.user_id
  WHERE b.studio_id       = p_studio_id
    AND b.status          = 'confirmed'
    AND sm.total_sessions = 1
    AND ci.starts_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'
    AND (p.email IS NOT NULL OR p.phone_number IS NOT NULL)
  ORDER BY ci.starts_at DESC;
$$;

-- Revoke direct calls from non-service roles (called only from Edge Functions)
REVOKE EXECUTE ON FUNCTION brief_first_timers_today  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION brief_milestones_today    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION brief_returns_today       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION brief_first_timer_returns FROM anon, authenticated;
