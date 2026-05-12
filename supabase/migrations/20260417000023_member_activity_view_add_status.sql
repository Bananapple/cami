-- 0022_member_activity_view_add_status.sql
-- Adds sm.status to member_activity_summary so the Clients screen can show
-- "On leave" badges and exclude on_leave members from lapsing/inactive segments.
-- Must DROP + recreate because CREATE OR REPLACE cannot insert a column mid-list.

DROP VIEW IF EXISTS member_activity_summary;

CREATE VIEW member_activity_summary AS
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
  ) AS last_booking_at
FROM studio_members sm
JOIN profiles p ON p.id = sm.user_id
LEFT JOIN memberships m
  ON m.user_id = sm.user_id
  AND m.studio_id = sm.studio_id
  AND m.status = 'active'
LEFT JOIN products prod ON prod.id = m.product_id
WHERE sm.role = 'member'
  AND sm.is_active = true;

GRANT SELECT ON member_activity_summary TO authenticated;
