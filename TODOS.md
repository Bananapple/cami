# TODOS

Deferred work captured during /plan-eng-review on 2026-04-15.

---

## ~~Deferred 2026-05-12 (defense-in-depth + key rotation)~~ — ✅ DONE (2026-05-13)

### ~~Migrate legacy API keys → modern Supabase keys + rotate the leaked service_role~~ — ✅ DONE

Rotated via `scripts/rotate-keys.sh` on 2026-05-13. All 6 targets updated (local .env, .env.local, GitHub Actions secrets ×2, Vercel production + preview on brie and cami). Legacy keys disabled in Supabase dashboard after smoke test confirmed booking flow intact. The leaked `eyJ…` service_role is permanently revoked. `SUPABASE_SERVICE_ROLE_KEY` auto-injected env var in edge functions continued to work after legacy disable — no custom-secret refactor needed.

### ~~Defense-in-depth follow-ups from PR #9 (cross-tenant guard)~~ — ✅ DONE (PR #11)

`validateStudioMatch` extracted to `_shared/guard.ts` and applied to all 8 edge functions: `create-checkout`, `issue-refund`, `cancel-membership`, `validate-discount`, `get-analytics`, `invite-member`, `send-member-message`, `cancel-class-notify`. Adversarial review addressed 4 findings (guard ordering, slug case-sensitivity). Smoke-tested on production.

---

## Deferred 2026-05-09 (security audit + multi-tenant readiness session)

A pre-launch CSO-mode audit + customer-readiness pass shipped 14 audit findings + 4 webhook-audit items + 2 customer-readiness items. The items below were intentionally deferred — they are real but not exploitable on the current single-tenant Brie deployment, OR require operational context (a real second customer, design/UX decisions) to land cleanly.

### Architectural — heycami.studio split (DEFERRED, requires UX decision)

**What:** Today the codebase is a single React app where every Vercel deployment renders the same routes — customer booking flow at `/`, manage UI at `/manage`. When deployed to `heycami.studio` (the platform marketing site), this means hitting `heycami.studio/manage/schedule` renders the yoga manage UI showing brie-demo data. Confusing and architecturally wrong: heycami is the platform, not a yoga studio.

**Two options:**
- **A. Two codebases:** split the platform marketing site (heycami.studio) into its own repo/codebase. Studio app stays one deployable. Cleanest, biggest effort.
- **B. One codebase, hostname-gated routes:** in `App.tsx`, gate the studio routes by `window.location.hostname`. If host is `heycami.studio`, render only marketing pages and refuse to mount StudioProvider/booking/manage. Smaller change, slightly less clean.

**Sub-question (separate decision):** the "Log in" button on heycami.studio — should staff log in centrally there (and get routed to their studio's `/manage`), or should they log in directly on their studio's site? Current code assumes the latter (each Vercel deployment is its own login surface; `/manage` gates on `studio_members` membership for whatever studio that deployment is configured for). Centralized auth is better UX for multi-studio operators (one login → studio picker → land in the right `/manage`), harder to build (~couple hours of routing + studio-picker UI).

**Why deferred:** Both options require design + product decisions before code. Doesn't block real-customer onboarding because the staff workflow is "go directly to your studio's URL."

**When to land:** Before public Cami marketing launch (you don't want demo prospects discovering broken yoga routes by URL-guessing).

### ~~Audit #16 — `profiles_staff_read` cross-studio leak~~ — ✅ DONE (2026-05-13, migration 0042)

Policy now joins through `studios` and requires `s.slug` to match the `x-studio-slug` request header. Staff can only read profiles of members in the studio they're currently operating in — cross-operator PII leak closed.

### Webhook audit #1 — per-studio webhook secrets (alternative architecture, OPTIONAL)

**What:** Today the platform has one `STRIPE_WEBHOOK_SECRET`. The audit's recommendation was per-studio secrets stored in `studio_payment_providers.config['webhook_secret']`. Each customer registers their own webhook in Stripe.

**Why deferred:** With Stripe Connect (now fully wired in `payment-webhook` per migration 0032), one platform-level webhook handles ALL connected accounts via `event.account` scoping. This is Stripe's recommended pattern for marketplaces. Per-studio secrets is a redundant alternative.

**When to land:** Don't, unless you decide to switch away from Connect.

### Webhook audit #6 — studio_id in URL path (defense-in-depth, OPTIONAL)

**What:** Webhook URL pattern is `/payment-webhook/<provider>`. Audit suggested `/payment-webhook/<studio_id>/<provider>`.

**Why deferred:** Now that the handler resolves studio from `event.account` and validates payment lookups by studio (migration 0032), URL-level scoping is redundant defense-in-depth.

**When to land:** Don't, unless an incident reveals a need.

### Frontend bugs found in passing (separate work, not security)

- **AuthCallback hardcoded background defaults to Cami styling** — `src/pages/AuthCallback.tsx`. Should pull from StudioContext like everything else.
- **StaffGate cross-studio "Back to dashboard" UX** — `src/manage/components/StaffGate.tsx`. The denial page sends users to `/dashboard` regardless of whether they have ANY relationship to the current studio. Should branch: customer of this studio → `/dashboard`; no relationship → "Sign out" button.
- **`/manage/schedule` save doesn't dispatch network request** — verified in DevTools Network tab during smoke test 4 on 2026-05-09. Click Save fires no PATCH request; only the page-load GET appears. Time edits silently don't persist. Pre-existing.
- **Owner-promotion path required manual SQL** — ✅ Resolved (`scripts/promote-owner.ts`).

### Tech debt found in passing

- **137 ESLint warnings in `src/`** — all pre-existing, none added during the 2026-05-09 session. Breakdown: ~80% `react-refresh/only-export-components` (HMR optimization, non-functional), ~15% `react-hooks/exhaustive-deps` (real bugs hiding here), ~5% scattered. Run `npm run lint -- --fix` for auto-fixable ones first, then walk the exhaustive-deps cases manually. Worth a focused session.
- **Test coverage thin** — 4 test files for a multi-thousand-line codebase. Untested critical paths: BookingSheet (membership detection, promo code, waitlist), all Edge Functions, all manage hooks. Worth scoping before public launch.

### ~~Findings raised during /ship pre-landing review of security-fixes (2026-05-09)~~ — ✅ DONE

- ~~**CORS fallback to `*` when `APP_URL` unset**~~ — ✅ Already implemented in `_shared/cors.ts` (throws at module load on Supabase Edge if `ALLOWED_ORIGINS` is empty).
- ~~**`invite-member` listUsers caps at perPage: 1000**~~ — ✅ Pagination loop already implemented in `invite-member/index.ts` (caps at 100 pages / 100k users).

---

## ~~Refund / cancellation policy~~ — ✅ DONE (2026-04-24)

**Implemented:** `issue-refund` Edge Function repurposed as a combined cancel+refund endpoint. Takes `{ booking_id }`. Accessible by the booking owner OR studio staff. Always cancels the booking first, then conditionally refunds based on:
- `payment_id` must exist and payment must have `status='succeeded'`
- Class must be more than `cancellation_window_hours` (default 24) away

If the Stripe refund fails, the booking is still cancelled and the error is logged for manual follow-up. `cancelBooking` in `useBookings.ts` calls this function. Dashboard shows context-aware toast (refunded / inside window / refund failed / generic).

---

## Timezone-aware session scheduling

**What:** Add a `timezone TEXT DEFAULT 'Europe/Oslo'` column to `studio_config` (or `sessions`). Store and display all session times in the studio's timezone. Handle `session_date` booking date arithmetic in the studio's timezone.

**Why:** A student traveling from London will have their browser in UTC+1 (or UTC+0 in winter). `session_date` is a plain `DATE` — if the date boundary falls between midnight Oslo and midnight London, a student can book the wrong day.

**Pros:** Correct behavior for international students. Future-proofs for any non-Norwegian studio.

**Cons:** Adds complexity to date formatting throughout the UI. For a single-timezone Norwegian market, this is a very edge case.

**Context:** `sessions.time` is `TEXT` (e.g., "09:00"). `session_date` in bookings is `DATE`. No timezone info is stored. Norwegian studios are all in Europe/Oslo (UTC+1/+2). Accept as known limitation for the first studio.

**Depends on:** Nothing blocking. Acceptable as known limitation until 2+ studios are live.

---

## Multi-studio migration management

## ~~Multi-studio migration management~~ — OBSOLETE

Retired with the v2 multi-tenant cutover. All studios now share one Supabase project (`xskqpxfjhhxontirezjd`). Schema migrations run once against the shared project, not per-studio.

---

## Shop / Membership purchasing

**What:** The `/joinnow` page currently shows all 7 products with prices but has no purchase flow. Students can browse but must contact the studio to actually buy. Wire the `create-checkout` Edge Function redirect flow to each product's CTA — same pattern as class bookings, different line items.

**Why:** Conversion drops when there's no buy button. The provider-agnostic `create-checkout` flow (decided 2026-04-23) handles single-class bookings *and* memberships/clip cards through the same Edge Function — the hosted checkout page (Stripe Checkout for MVP, Frisbii/Vipps via the same adapter interface) accepts a line items payload and redirects back on success.

**Flow:**
1. User clicks "Buy 10-class card" on `/joinnow`
2. Frontend calls `POST /functions/v1/create-checkout` with `{ product_id }` (or `class_instance_id` for single classes)
3. Edge Function resolves the studio's primary provider via `studio_primary_provider()`, creates `payments` row, calls the adapter's `createCheckoutSession()`
4. Returns `checkout_url` — browser redirects
5. Webhook promotes the associated `memberships` row (or `bookings` row) from `pending` to `active`/`confirmed`

**Pros:** Self-serve purchasing. Same Edge Function handles class bookings, memberships, guest passes — no duplicate code per flow.

**Cons:** Needs a `products` (or `membership_plans`) table in Supabase; needs the membership-activation webhook handler to be distinct from the booking-confirmation handler. Frontend `/joinnow` needs to read from the DB instead of hardcoded values.

**Context:** Products and prices are hardcoded in `src/pages/JoinNow.tsx`. For now, the CTA is `contact@yogabrie.com`. The Edge Function contract is defined in `docs/MIGRATION-MULTITENANT.md` §4 and typed in `src/types/database.ts` under `EdgeFunctions.CreateCheckoutRequest`.

**Depends on:** ~~`create-checkout` Edge Function built~~ ✅; ~~`0005_payments_provider_agnostic.sql` applied~~ ✅. Ready to implement. Note: `/joinnow` prices are still hardcoded — move to DB before wiring checkout.

---

## Auth — SMS OTP via Twilio (Phase 2)

**What:** Replace (or supplement) email OTP with phone number OTP. User enters their phone number, receives a 6-digit SMS code, verifies it in-sheet. Uses `supabase.auth.signInWithOtp({ phone })` + `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.

**Why:** Phone OTP has higher delivery reliability than email (no spam filters, no inbox searching), and is familiar from banking/e-commerce flows. Better conversion for mobile-first yoga studio students.

**Cons:** Requires a Twilio account, Supabase Phone Auth enabled, and per-SMS cost (~$0.0075/SMS). Not worth setting up until the student base grows beyond 100 active users.

**Context:** Email OTP is live as of 2026-04-23 (`useAuth.sendOtp` / `useAuth.verifyOtp`). The `profiles` table already has a `phone_number TEXT` column (added in `migrations-v2/0002`). Adding SMS OTP is a UI-only change — add a phone input phase to `AuthForm.tsx`, call `signInWithOtp({ phone })`, verify with `type: 'sms'`. No schema changes needed.

**Depends on:** Twilio account + Supabase Phone Auth config. Do not implement until external accounts are provisioned.
