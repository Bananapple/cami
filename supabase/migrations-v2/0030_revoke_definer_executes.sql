-- ============================================================================
-- Phase 9: Revoke EXECUTE from anon/authenticated on SECURITY DEFINER RPCs
-- that bypass RLS but lack internal authorization checks.
--
-- Background:
--   PostgreSQL's default grants EXECUTE on functions to PUBLIC. PostgREST
--   exposes every public-schema function at /rest/v1/rpc/<name>, so any
--   browser holding a user JWT can call them. SECURITY DEFINER functions
--   run as the function owner (superuser) and bypass RLS, so RLS provides
--   no protection.
--
--   For the functions below, this means an authenticated user can directly
--   invoke server-only operations: marking unpaid payments as 'succeeded',
--   minting memberships without paying, refilling clip-card credits, and
--   cancelling other users' bookings.
--
--   These functions are called only from server-side contexts (Edge Functions
--   using the service_role key, or from inside other PL/pgSQL functions).
--   service_role retains EXECUTE via Supabase's project-level grants — only
--   anon and authenticated lose access.
--
-- Verification:
--   After applying, run from the browser console as a signed-in user:
--     fetch('https://<ref>.supabase.co/rest/v1/rpc/activate_membership', {
--       method:'POST',
--       headers:{ apikey:ANON, Authorization:'Bearer '+JWT, 'Content-Type':'application/json' },
--       body:JSON.stringify({ p_payment_id:'00000000-0000-0000-0000-000000000000' })
--     }).then(r => r.text()).then(console.log);
--   Expected: 403 with { code: '42501', message: 'permission denied for function activate_membership' }
--
-- Functions explicitly NOT revoked:
--   - book_with_credit       — has internal `WHERE id=p_membership_id AND user_id=p_user_id` check
--   - accept_waitlist_offer  — has internal `_row.user_id <> auth.uid()` check
--   - materialize_class_instances — called from frontend (staff manage views);
--       needs internal user_is_staff(_studio_id) check added in a follow-up,
--       not revoked here to avoid breaking staff scheduling tools
--   - All RLS helpers (user_studio_ids, user_has_role, user_is_staff)
--   - All triggers (handle_new_user, touch_updated_at, sync_waitlist_offered_count,
--     generate_member_referral_code, increment_discount_redeemed)
-- ============================================================================

-- Payment + membership lifecycle (called only from payment-webhook)
REVOKE EXECUTE ON FUNCTION public.activate_membership(uuid, text)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_booking(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_booking(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_membership_by_subscription(text)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_membership_by_subscription(text)     FROM PUBLIC, anon, authenticated;

-- Credit lifecycle (called only from issue-refund and create-checkout Edge Functions)
REVOKE EXECUTE ON FUNCTION public.return_credit(uuid)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_credit_booking(uuid, boolean)        FROM PUBLIC, anon, authenticated;

-- Background sweepers (called only from pg_cron)
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_bookings()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_waitlist_offers()              FROM PUBLIC, anon, authenticated;

-- Waitlist offer dispatch (called only from triggers, never from clients)
REVOKE EXECUTE ON FUNCTION public.offer_next_waitlist_spot(uuid)              FROM PUBLIC, anon, authenticated;
