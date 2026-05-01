# Feature Roadmap

Architecture assessment conducted 2026-04-23. v2 cutover completed 2026-04-24 — all migrations live on `xskqpxfjhhxontirezjd`. Schema in `supabase/migrations-v2/`, full design in `docs/MIGRATION-MULTITENANT.md`.

---

## Resolved Decisions

### ✅ Multi-tenant vs. Per-Project Architecture — RESOLVED (2026-04-23)
**Decision**: Move to a single multi-tenant Supabase project with `studio_id` on every tenanted table and RLS helper functions (`user_studio_ids()`, `user_has_role()`, `user_is_staff()`) enforcing isolation.
**Artifacts**: `supabase/migrations-v2/0001_core_tenancy.sql`, `0002_backfill_and_rls.sql`. Tenant root is the new `studios` table; user↔studio link lives in `studio_members` with per-studio state (total_sessions, level, referral_code).
**Implication**: `scripts/new-studio.sh` is retired. Adding a studio is a row insert + Stripe Connect onboarding, not a new Supabase project.

### ✅ Real Stripe Integration — RESOLVED (2026-04-23) — provider-agnostic
**Decision**: MVP uses **Stripe Checkout** (hosted page, PCI-compliant, no Elements build). The database is provider-agnostic from day one: a canonical `payments` table holds payment records with a `provider` enum (`stripe | frisbii | vipps`). Adding a provider is an adapter file + one enum value — no schema changes.
**Artifacts**: `supabase/migrations-v2/0005_payments_provider_agnostic.sql`, Edge Function pattern in `docs/MIGRATION-MULTITENANT.md` §4.
**Implication**: The insecure `StripeCardForm` is decommissioned. The booking flow is `create-checkout` → redirect to hosted URL → webhook confirms → booking promoted from `pending` to `confirmed`.

### ✅ Edge Functions — RESOLVED (2026-04-23) — deployed to production
**Decision**: Three Deno Edge Functions + shared provider adapter layer. Stripe adapter implemented.
**Artifacts**: `supabase/functions/create-checkout/`, `supabase/functions/payment-webhook/`, `supabase/functions/issue-refund/`, `supabase/functions/_shared/providers/` (types, index, stripe adapter).
**Implication**: All payment logic runs server-side. Frontend calls `supabase.functions.invoke('create-checkout')` and redirects. Webhook at `/payment-webhook/stripe` handles confirmation and sends booking confirmation email via Resend. All three functions deployed to production; secrets set. `payment-webhook` must be deployed with `--no-verify-jwt`.

### ✅ Membership Purchase + Credit Booking — RESOLVED (2026-04-30)
**Decision**: DB-driven `products` catalog replaces hardcoded `/joinnow` array. Stripe Checkout for purchases. `activate_membership()` RPC on webhook success. `create-checkout` detects active membership before creating Stripe session — calls `book_with_credit()` for holders, returns `{ booking_id, free: true }` with no Stripe redirect. Credits atomically decremented/returned via `FOR UPDATE` locked RPCs.
**Artifacts**: `migrations-v2/0010_products_and_membership_purchase.sql`, `0011_book_with_credit.sql`, `src/components/ProductPurchaseSheet.tsx`, `src/hooks/useProducts.ts`, `src/components/BookingSheet.tsx`, `src/components/booking/OrderSummary.tsx`.
**Implication**: `useProducts` uses `useEffect`+`useState` (not TanStack Query) — TanStack Query v5 had a subscriber notification bug with anon queries that prevented re-renders. `bookings.membership_id` is set for credit-paid bookings; `payment_id` is NULL. `issue-refund` returns credits on cancellation outside the window.

### ✅ Refund / Cancellation — RESOLVED (2026-04-24)
**Decision**: `issue-refund` Edge Function handles combined cancel+refund. Owner or staff can cancel any booking. Refund issued automatically if payment succeeded and cancellation is outside the 24h window (`studios.cancellation_window_hours`). If Stripe refund fails, booking is still cancelled and error is logged.
**Artifacts**: `supabase/functions/issue-refund/index.ts`, `src/hooks/useBookings.ts` (`cancelBooking` mutation), `src/pages/Dashboard.tsx` (context-aware toast).

### ✅ Booking Confirmation Email — RESOLVED (2026-04-24)
**Decision**: Resend is the email provider. Confirmation email is sent from `payment-webhook` after a booking is confirmed. Idempotency via `notification_log` table.
**Artifacts**: `supabase/functions/payment-webhook/index.ts` (`sendBookingConfirmation`), `supabase/migrations-v2/0006_notification_log.sql`.
**Implication**: Secrets needed: `RESEND_API_KEY`, `FROM_EMAIL` (defaults to `onboarding@resend.dev` for sandbox). Domain must be verified in Resend for production sends.

### ✅ Passwordless Auth (Email OTP) — RESOLVED (2026-04-24)
**Decision**: Replace email + password with a two-phase OTP flow. Single email field → 6-digit code sent to inbox → verified in-sheet via `supabase.auth.verifyOtp`. `shouldCreateUser: true` handles both new and returning users with one call.
**Artifacts**: `src/hooks/useAuth.ts` (`sendOtp`, `verifyOtp`), `src/components/booking/AuthForm.tsx` (two-phase form with 30s resend cooldown).
**Implication**: No password storage, no password reset flow. `handle_new_user` trigger updated to also auto-enroll new users in all active studios via `studio_members`. SMS OTP via Twilio deferred to Phase 2 (see TODOS.md).

---

## Planned Features

*All references below target the v2 schema. `class_instance_id` replaces the old `(session_id, session_date)` composite; `studio_members` replaces per-studio fields on `profiles`.*

### Waitlists — designed in `0004_waitlists.sql`
- `waitlists` table with `status ∈ {waiting, offered, accepted, expired, cancelled}`
- 20-minute reservation window configurable via `studios.waitlist_offer_window_minutes`
- Atomic `offer_next_waitlist_spot()` with `FOR UPDATE SKIP LOCKED` for concurrent-safe promotion
- `expire_stale_waitlist_offers()` swept by pg_cron every minute
- Trigger on `bookings` cancel auto-offers the freed spot
- UI work remaining: "Join waitlist" button when `booked_count + waitlist_offered_count ≥ max_capacity`; waitlist status on dashboard; notification dispatch wiring

### Multi-Location — designed in `0003_recurrence_engine.sql`
- `locations` table `(studio_id, name, address, timezone, default_capacity)`
- `class_instances.location_id` FK (replaces the old `sessions.location TEXT`)
- Conflict detection: `EXCLUDE USING GIST (location_id WITH =, time_range WITH &&)` — DB refuses room double-booking
- UI work remaining: location selector in manager dashboard; filter schedule by location

### Recurrence Engine — designed in `0003_recurrence_engine.sql`
- `class_templates` (what the class IS) + `schedule_rules` (one row per weekday slot) + `schedule_exceptions` (cancel/reschedule/sub) → materialized into `class_instances`
- Daily pg_cron job materializes a rolling 90-day window
- Instructor conflict detection via same exclusion-constraint pattern as locations
- UI work remaining: schedule builder for owners/managers; exception handler ("cancel this Tuesday")

### Cross-sell upsell in BookingSheet (next small win)
When `bookingMode === "dropin"`, show a subtle hint below the price line:
> *"Save kr 50/class with a 10-class card →"* (link to /joinnow)
One line, visually subordinate to the main CTA — drives membership conversion at the highest-intent moment. Small change in `BookingSheet.tsx` confirm step.

### Push to production + subscription cancel test
- `git push` → Vercel auto-deploys Phase 1A + 1B
- Real-world test: complete subscription checkout → cancel from Stripe Dashboard → verify `memberships.status = 'cancelled'`

### Confirmation email for membership purchases
Currently only class bookings get a Resend email. Add a membership receipt from `payment-webhook` when `activate_membership()` succeeds.

### Staff product management UI
Add/edit/deactivate products from manager panel without touching the DB directly.

### Referral System
- `studio_members.referral_code` (unique per studio) and `studio_members.referred_by_user_id` already in `0001`
- Still need: `referral_rewards` table `(studio_id, referrer_id, referred_id, reward_type, redeemed_at)` and the trigger/Edge Function that issues rewards on first booking or plan activation

### Guest Passes
- New table: `guest_passes (studio_id, owner_user_id, guest_email, class_instance_id, used_at)`
- Booking flow branch: guest checkout path that consumes a pass instead of creating a payment
- Owner purchases/gifts passes from their dashboard (uses the same `create-checkout` Edge Function with a different product type)

### CRM & Automated Sequences
- Email provider: Resend (live). `notification_log` table exists (`0006`). Booking confirmation email is live.
- Remaining sequences: class reminder (~2h before), post-class follow-up with review link, re-engagement (14-day inactivity)
- Timed sends require pg_cron or Supabase Scheduled Functions (not yet enabled)

### SMS / WhatsApp Notifications
- `profiles.phone_number` already added in `0002_backfill_and_rls.sql`, plus opt-in flags
- Twilio adapter in a new Edge Function; writes to the same `notification_log` with `channel='sms'|'whatsapp'`
- Pattern mirrors the payment-provider adapter interface — one `NotificationProviderAdapter` per channel

### Google Review Tracking
- New table: `review_requests (studio_id, user_id, booking_id, link_token UUID, sent_at, clicked_at)`
- Public Edge Function endpoint `/r/:token` logs the click and 302s to the Google review URL
- Analytics on send volume, click rate, conversion — feeds the CRM dashboard

### Digital Waivers
- New tables: `waiver_configs (studio_id, version, text, required_on_booking)` + `waivers (user_id, waiver_config_id, signed_at, ip_address)`
- Booking flow step: insert between auth and checkout, only if user lacks a current-version signature
- Re-prompt when `waiver_configs.version` changes

### Smart Member Segmentation
- Data already captured (`bookings`, `memberships`, `studio_members.total_sessions`)
- Build view `member_activity_summary`: last visit, visit frequency, plan type, total spend
- CRM filter UI for audience targeting ("inactive 14+ days", "clip card < 2 credits remaining")

---

## Schema Additions Summary (remaining work)

| Table / Column | Feature |
|---|---|
| `referral_rewards` (new table) | Referrals |
| `guest_passes` (new table) | Guest passes |
| `notification_log` (new table) | CRM / SMS / WhatsApp |
| `review_requests` (new table) | Google review tracking |
| `waiver_configs` (new table) | Digital waivers |
| `waivers` (new table) | Digital waivers |
| `member_activity_summary` (view) | Segmentation |

*Tables already live: `studios`, `studio_members`, `studio_payment_providers`, `locations`, `instructors`, `class_templates`, `schedule_rules`, `schedule_exceptions`, `class_instances`, `waitlists`, `payments`, `payment_webhook_events`, `notification_log`, `bookings` (with `membership_id`), `memberships` (with `product_id`, `credits_remaining`), `products`.*
