# TODO — Brie

Last updated: 2026-05-02 (discount codes + referral program session)

---

## Immediate (next session)

- [ ] **Commit current diff** — everything since `7459b84` is uncommitted: discount codes, referral program, BookingSheet promo UI, Dashboard referral link, StudioView manager UI, validate-discount function
- [ ] **Rename migration collision** — two files named `0012_*` in `migrations-v2/`; rename `0012_partial_booking_unique.sql` to `0014_partial_booking_unique.sql`
- [ ] **Deploy new Edge Functions** — `validate-discount` and `notify-waitlist-offer` need first deploy: `supabase functions deploy validate-discount` + `supabase functions deploy notify-waitlist-offer --no-verify-jwt`
- [ ] **Redeploy create-checkout** — discount/referral logic added since last deploy

## Short-term

- [ ] **Clients view** (`/manage/clients`) — member list, membership status, booking history, search — currently Placeholder
- [ ] **Schedule management view** (`/manage/schedule`) — create/edit class instances without SQL Editor — currently Placeholder
- [ ] **Referrer reward** — `referrals` table tracks relationships but referrer never gets credited (e.g. +1 class credit when referred user completes first booking)
- [ ] **Frisbii adapter end-to-end test** — insert `studio_payment_providers` row, set secrets, run test checkout, verify webhook reconciliation (`order.handle = payment_id`)
- [ ] **Frisbii subscription support** — needs `/session/recurring` session type; currently falls back to one-time charge

## Medium-term

- [ ] **Waitlist UI** — schema exists (`0004_waitlists.sql`), no frontend yet: "Join waitlist" button, status on dashboard, notification dispatch
- [ ] **Home view** (`/manage/home`) — overview stats: bookings today, revenue, active members — currently Placeholder
- [ ] **SMS OTP via Twilio** — `profiles.phone_number` column exists; Supabase Phone Auth needs enabling + Twilio account
- [ ] **Drop legacy `sessions` table** — `0009_drop_legacy_sessions.sql` removes it; wait until rollback confidence is established
- [ ] **Vipps payment adapter** — Norwegian market; implement after Frisbii is verified

## Medium-term

- [ ] **Waitlist UI** — schema exists (`0004_waitlists.sql`), no frontend yet: "Join waitlist" button, status on dashboard, notification dispatch
- [ ] **SMS OTP via Twilio** — `profiles.phone_number` column exists; Supabase Phone Auth needs enabling + Twilio account
- [ ] **Drop legacy `sessions` table** — `0009_drop_legacy_sessions.sql` removes it; wait until rollback confidence is established
- [ ] **Vipps payment adapter** — Norwegian market; implement after Frisbii is verified

## Completed This Session ✅ (2026-05-02)

- [x] **Discount codes** — `discount_codes` + `discount_redemptions` tables (`0012`), staff create/toggle UI in StudioView, promo input in BookingSheet with live price preview via `validate-discount` Edge Function, discount applied in `create-checkout`
- [x] **Referral program** — `referral_enabled`/`referral_discount_percent` on studios, `referrals` table, auto-generated `referral_code` per studio_member (BEFORE INSERT trigger + backfill), first-timer validation in `create-checkout`, referral link on Dashboard (gated on `referral_enabled`), `?ref=CODE` URL capture → sessionStorage → auto-fill at checkout (`RefCapture` in App.tsx)
- [x] **DB cleanup** — deleted 7 fake test accounts and their bookings; discovered `supabase db query --linked` for direct SQL execution

## Completed Previously ✅

- [x] **Frisbii payment adapter** (`supabase/functions/_shared/providers/frisbii.ts`) — full `PaymentProviderAdapter` implementation
- [x] **Phase 1A** — products catalog, membership purchase via Stripe, `activate_membership()` RPC, membership confirmation email
- [x] **Phase 1B** — book with credits, `book_with_credit()` + `return_credit()` RPCs, credit-aware cancel/refund, BookingSheet adapts UI

## Completed Previously ✅

- [x] **Phase 1A** — products catalog, membership purchase via Stripe, `activate_membership()` RPC, membership confirmation email
- [x] **Phase 1B** — book with credits, `book_with_credit()` + `return_credit()` RPCs, credit-aware cancel/refund, BookingSheet adapts UI
- [x] Partial unique index (`0012`) — allows rebook after cancellation
- [x] Cancel confirmation dialog with policy-aware copy (inside/outside 24h window)
- [x] Past sessions greyed out in booking sheet
- [x] Live credit count after cancellation (invalidate membership + bookings queries)
- [x] Friendly duplicate booking error (intercept 23505 in `create-checkout`)
- [x] Booking sort by date ascending
- [x] Timezone-correct time display in OrderSummary
- [x] Subscription cancellation webhook verified end-to-end

## Known Risks / Gotchas

- **Frisbii adapter untested** — written from docs only; no live test account yet. Checkout response field names and webhook event type strings need validation.
- **Frisbii subscriptions not implemented** — one-time charges only. Monthly memberships via Frisbii need the `/session/recurring` session type.
- `useProducts` uses `useEffect`+`useState` (not TanStack Query) — TanStack Query v5 subscriber notification bug with anon queries
- `useMembership` uses TanStack Query — watch for stale data if user buys a membership mid-session
- Migrations in `supabase/migrations-v2/` must be applied manually via SQL Editor (Supabase CLI only sees `supabase/migrations/`)
- Resend production emails require domain verification — currently goes to spam without it

