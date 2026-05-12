-- 0024_member_activity_view_v2.sql
-- Adds raw evidence columns to member_activity_summary so the Clients screen
-- and downstream consumers (promo targeting, insight engine) can derive richer
-- audience tags. View stays SECURITY INVOKER (per 0020) and is granted to
-- authenticated only.
--
-- The view returns RAW EVIDENCE (counts, mode-of, dates, ids). Labeled tiers
-- (frequency_tier, lifecycle bucket) are computed in TS using per-studio config
-- in studios.segment_config (added in 0025). This keeps threshold tuning
-- instant and avoids view recomputation.

DROP VIEW IF EXISTS member_activity_summary;

CREATE VIEW member_activity_summary AS
WITH member_bookings_30d AS (
  SELECT
    b.user_id,
    b.studio_id,
    COUNT(*)::INT AS bookings_last_30d
  FROM bookings b
  WHERE b.status = 'confirmed'
    AND b.booked_at >= now() - interval '30 days'
  GROUP BY b.user_id, b.studio_id
),
member_bookings_90d AS (
  SELECT
    b.user_id,
    b.studio_id,
    COUNT(*)::INT AS bookings_last_90d
  FROM bookings b
  WHERE b.status = 'confirmed'
    AND b.booked_at >= now() - interval '90 days'
  GROUP BY b.user_id, b.studio_id
),
member_top_template AS (
  -- Most-booked class template across last 90d of confirmed bookings.
  -- MODE() picks the most frequent template_id; ties broken arbitrarily by Postgres.
  SELECT
    b.user_id,
    b.studio_id,
    MODE() WITHIN GROUP (ORDER BY ci.template_id) AS top_template_id
  FROM bookings b
  JOIN class_instances ci ON ci.id = b.class_instance_id
  WHERE b.status = 'confirmed'
    AND b.booked_at >= now() - interval '90 days'
    AND ci.template_id IS NOT NULL
  GROUP BY b.user_id, b.studio_id
),
member_top_time AS (
  -- Most-booked time-of-day bucket, computed in studio-local time.
  -- Boundaries: morning 05–11, midday 11–15, evening 15–21. Outside these
  -- ranges (e.g. midnight class) → NULL bucket and excluded from the mode.
  SELECT
    b.user_id,
    b.studio_id,
    MODE() WITHIN GROUP (ORDER BY bucket) AS top_time_bucket
  FROM (
    SELECT
      b.user_id,
      b.studio_id,
      CASE
        WHEN EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) >= 5
         AND EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) < 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) >= 11
         AND EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) < 15 THEN 'midday'
        WHEN EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) >= 15
         AND EXTRACT(HOUR FROM (ci.starts_at AT TIME ZONE s.timezone)) < 21 THEN 'evening'
        ELSE NULL
      END AS bucket
    FROM bookings b
    JOIN class_instances ci ON ci.id = b.class_instance_id
    JOIN studios s ON s.id = b.studio_id
    WHERE b.status = 'confirmed'
      AND b.booked_at >= now() - interval '90 days'
  ) b
  WHERE bucket IS NOT NULL
  GROUP BY b.user_id, b.studio_id
)
SELECT
  sm.id              AS studio_member_id,
  sm.studio_id,
  sm.user_id,
  sm.role,
  sm.is_active,
  sm.status,
  sm.total_sessions,
  sm.level,
  sm.joined_at,
  sm.source,
  p.full_name,
  p.email,
  p.phone_number,
  m.id               AS membership_id,
  m.status           AS membership_status,
  m.credits_remaining,
  m.valid_until,
  prod.name          AS plan_name,
  prod.type          AS plan_type,
  (
    SELECT MAX(b.booked_at)
    FROM bookings b
    WHERE b.user_id = sm.user_id
      AND b.studio_id = sm.studio_id
      AND b.status = 'confirmed'
  ) AS last_booking_at,
  COALESCE(b30.bookings_last_30d, 0) AS bookings_last_30d,
  COALESCE(b90.bookings_last_90d, 0) AS bookings_last_90d,
  tt.top_template_id,
  ct.name            AS top_template_name,
  tm.top_time_bucket,
  -- Risk flags. Clip cards: credits + expiry. Subscriptions: renewal date.
  CASE
    WHEN m.id IS NOT NULL
     AND m.credits_remaining IS NOT NULL
     AND m.credits_remaining > 0
     AND m.valid_until IS NOT NULL
     AND m.valid_until <= (now() + interval '14 days')::date
    THEN true
    ELSE false
  END AS credits_expiring_soon,
  CASE
    WHEN m.id IS NOT NULL
     AND prod.type = 'subscription'
     AND m.valid_until IS NOT NULL
     AND m.valid_until <= (now() + interval '30 days')::date
    THEN true
    ELSE false
  END AS sub_renewing_soon
FROM studio_members sm
JOIN profiles p ON p.id = sm.user_id
LEFT JOIN memberships m
  ON m.user_id = sm.user_id
  AND m.studio_id = sm.studio_id
  AND m.status = 'active'
LEFT JOIN products prod ON prod.id = m.product_id
LEFT JOIN member_bookings_30d b30
  ON b30.user_id = sm.user_id AND b30.studio_id = sm.studio_id
LEFT JOIN member_bookings_90d b90
  ON b90.user_id = sm.user_id AND b90.studio_id = sm.studio_id
LEFT JOIN member_top_template tt
  ON tt.user_id = sm.user_id AND tt.studio_id = sm.studio_id
LEFT JOIN class_templates ct ON ct.id = tt.top_template_id
LEFT JOIN member_top_time tm
  ON tm.user_id = sm.user_id AND tm.studio_id = sm.studio_id
WHERE sm.role = 'member'
  AND sm.is_active = true;

ALTER VIEW member_activity_summary SET (security_invoker = true);

GRANT SELECT ON member_activity_summary TO authenticated;
