-- member_activity_summary was accessible to any authenticated user via direct PostgREST call,
-- exposing all-studio PII (name, email, session counts) regardless of studio membership.
-- security_invoker = true makes the view run as the calling user, so existing RLS on
-- the underlying tables (studio_members, profiles, bookings, memberships) kicks in.
ALTER VIEW member_activity_summary SET (security_invoker = true);
