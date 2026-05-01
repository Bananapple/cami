# TODO — Brie

Last updated: 2026-04-30 (end of Phase 1B session)

---

## Immediate (next session)

- [ ] **Push to production** — `git push` → Vercel auto-deploys 1A + 1B (2 commits ahead of origin/main)
- [ ] **Test subscription cancel via Stripe Dashboard** — only way to test `customer.subscription.deleted` → `memberships.status = 'cancelled'`. Do: test-mode checkout → cancel from Stripe Dashboard → Customers → subscription → cancel
- [ ] **Cross-sell upsell line in BookingSheet confirm step** — when `bookingMode === 'dropin'`, show a subtle hint: *"Save kr 50/class with a 10-class card →"* linking to `/joinnow`. Edit `BookingSheet.tsx` confirm step price block.

## Short-term

- [ ] **Membership confirmation email** — add Resend email in `payment-webhook` when `activate_membership()` succeeds (mirrors `sendBookingConfirmation` pattern, uses `notification_log` idempotency)
- [ ] **Staff product management UI** — manager panel to add/edit/deactivate products without SQL Editor access
- [ ] **Test credit return on cancellation** — book a class with clip card, cancel it outside the 24h window, verify `memberships.credits_remaining` increments back

## Medium-term

- [ ] **Referrals** — `discount_codes` table + UI; `discount_code` param already plumbed through `create-checkout`
- [ ] **Frisbii payment adapter** — Brie's existing students use Frisbii; needed before full go-live
- [ ] **Waitlist UI** — schema exists (`0004_waitlists.sql`), no frontend yet: "Join waitlist" button, status on dashboard, notification dispatch
- [ ] **Drop legacy `sessions` table** — `0009_drop_legacy_sessions.sql` removes it; wait until rollback confidence is established

## Known Risks / Gotchas

- `customer.subscription.deleted` webhook handler is correct in code but untested end-to-end (CLI cannot trigger it; requires real Stripe Dashboard cancellation)
- `useProducts` uses `useEffect`+`useState` (not TanStack Query) — TanStack Query v5 had a subscriber notification bug with anon queries
- `useMembership` still uses TanStack Query — watch for stale data if user buys a membership mid-session
- Migrations in `supabase/migrations-v2/` must be applied manually via SQL Editor (Supabase CLI only sees `supabase/migrations/`)
- `return_url` localhost allowance in `create-checkout` is correct for dev but confirm `APP_URL` env var is set correctly in production to avoid the same CORS issue

