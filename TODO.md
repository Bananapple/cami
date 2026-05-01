# TODO — Brie

Last updated: 2026-05-01 (Frisbii adapter session)

---

## Immediate (next session)

- [ ] **Test Frisbii adapter end-to-end** — insert a `studio_payment_providers` row for a Frisbii test account, set `FRISBII_API_KEY` + `FRISBII_WEBHOOK_SECRET` secrets, run a test checkout and verify webhook reconciliation. Key: `order.handle = payment_id` → `invoice_settled.invoice = payment_id` → lookup works.
- [ ] **Verify Frisbii checkout response field name** — the adapter assumes `session.url` for the redirect URL. If Frisbii returns a different field name (e.g. `checkout_url`, `redirect_url`), update `frisbii.ts:createCheckoutSession`. The error message will print the raw JSON.
- [ ] **Frisbii webhook event names** — confirm exact event type strings: `invoice_settled`, `invoice_failed`, `invoice_cancelled`, `refund_settled`, `subscription_cancelled`. These were sourced from docs; validate against live webhook logs.
- [ ] **Deploy updated Edge Functions** — `frisbii.ts` + `index.ts` changes are uncommitted. After commit, redeploy all three functions: `supabase functions deploy create-checkout`, `payment-webhook --no-verify-jwt`, `issue-refund`

## Short-term

- [ ] **Frisbii subscription support** — monthly memberships via Frisbii require a different checkout session type (`/session/recurring`) and plan setup in the Frisbii dashboard. Currently logs a warning and falls back to one-time charge. Implement once a Frisbii merchant account is active.
- [ ] **Staff product management UI** — manager panel to add/edit/deactivate products without SQL Editor access
- [ ] **Referrals** — `discount_codes` table + UI; `discount_code` param already plumbed through `create-checkout`

## Medium-term

- [ ] **Waitlist UI** — schema exists (`0004_waitlists.sql`), no frontend yet: "Join waitlist" button, status on dashboard, notification dispatch
- [ ] **SMS OTP via Twilio** — `profiles.phone_number` column exists; Supabase Phone Auth needs enabling + Twilio account
- [ ] **Drop legacy `sessions` table** — `0009_drop_legacy_sessions.sql` removes it; wait until rollback confidence is established
- [ ] **Vipps payment adapter** — Norwegian market; implement after Frisbii is verified

## Completed This Session ✅

- [x] **Frisbii payment adapter** (`supabase/functions/_shared/providers/frisbii.ts`) — full `PaymentProviderAdapter` implementation: HTTP Basic auth, `createCheckoutSession` (invoice handle = payment_id for webhook reconciliation), `parseWebhookEvent` (signature in payload JSON, not header), `issueRefund` via `/refund` endpoint
- [x] Provider registry updated — `getProvider('frisbii')` now returns `FrisbiiProvider` instead of throwing
- [x] `.env.example` updated with Frisbii secret documentation

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

