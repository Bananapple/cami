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

### ~~Architectural — heycami.studio split~~ — ✅ DONE (Option B, hostname-gated routes)

**What:** Today the codebase is a single React app where every Vercel deployment renders the same routes — customer booking flow at `/`, manage UI at `/manage`. When deployed to `heycami.studio` (the platform marketing site), this means hitting `heycami.studio/manage/schedule` renders the yoga manage UI showing brie-demo data. Confusing and architecturally wrong: heycami is the platform, not a yoga studio.

**Implemented Option B:** `isMarketingHost()` in `src/marketing/isMarketingHost.ts` checks `window.location.hostname` against `{"heycami.studio", "www.heycami.studio"}`. `App.tsx` renders `MarketingApp` (no StudioProvider, no studio routes, catch-all → `/`) when on the marketing host, and `StudioApp` otherwise.

**Staff login model (decided):** Staff log in directly on their studio's URL. This is intentional — keeps branding to the studio, no generic Cami picker needed. Not building centralized heycami.studio login.

### Audit #16 — `profiles_staff_read` cross-studio leak (DEFERRED — approach failed)

**What:** Staff can read profiles of users who share ANY studio with them. With multiple unrelated operators, Studio A's staff could read phone numbers + marketing opt-ins of Studio B's members.

**Attempted fix (2026-05-13, migration 0042 + 0043 revert):** Added a `current_setting('request.header.x-studio-slug', true)` condition to scope the policy to the current studio. This caused `member_activity_summary` (which uses `INNER JOIN profiles`) to return zero rows — the header is null/empty in authenticated PostgREST context, so `s.slug = NULL` was FALSE for all rows and the inner join collapsed.

**Why deferred:** The slug-header approach doesn't work through views that INNER JOIN `profiles`. A correct fix requires either rewriting the policy at the view/function layer (avoiding RLS on raw `profiles`) or introducing an explicit "operator" concept in the schema. Not exploitable on single-tenant Brie deployment.

**When to land:** Before onboarding a second unrelated operator.

### Webhook audit #1 — per-studio webhook secrets (alternative architecture, OPTIONAL)

**What:** Today the platform has one `STRIPE_WEBHOOK_SECRET`. The audit's recommendation was per-studio secrets stored in `studio_payment_providers.config['webhook_secret']`. Each customer registers their own webhook in Stripe.

**Why deferred:** With Stripe Connect (now fully wired in `payment-webhook` per migration 0032), one platform-level webhook handles ALL connected accounts via `event.account` scoping. This is Stripe's recommended pattern for marketplaces. Per-studio secrets is a redundant alternative.

**When to land:** Don't, unless you decide to switch away from Connect.

### Webhook audit #6 — studio_id in URL path (defense-in-depth, OPTIONAL)

**What:** Webhook URL pattern is `/payment-webhook/<provider>`. Audit suggested `/payment-webhook/<studio_id>/<provider>`.

**Why deferred:** Now that the handler resolves studio from `event.account` and validates payment lookups by studio (migration 0032), URL-level scoping is redundant defense-in-depth.

**When to land:** Don't, unless an incident reveals a need.

### Frontend bugs found in passing (separate work, not security)

- ~~**AuthCallback hardcoded background defaults to Cami styling**~~ — ✅ Non-issue. No per-studio CSS variable injection exists anywhere in the app (`StudioProvider` never calls `setProperty`). All pages use the same default shadcn theme. AuthCallback uses `bg-background` CSS variable like everything else — nothing to change until per-studio theming is built.
- ~~**StaffGate cross-studio "Back to dashboard" UX**~~ — ✅ Already implemented. `hasRelationship = studioMember != null` drives the branch: customer → "Back to dashboard" link; no relationship → "Sign out" button.
- ~~**`/manage/schedule` save doesn't dispatch network request**~~ — ✅ Fixed (2026-05-10, PR #8). Root cause: time chip's inline Save button used a `+` icon (same as Add), causing users to click the wrong save. Split into `CircleSave` (checkmark) and `CircleAdd` (plus) in `EditSequenceDrawer`. The underlying `updateRule.mutate` path was never broken.
- **Owner-promotion path required manual SQL** — ✅ Resolved (`scripts/promote-owner.ts`).

### ~~Remove "smart audiences" / lifecycle segments from Clients view~~ — ✅ DONE (2026-05-13, branch fix/ui-cleanup-and-schedule-badge)

Stripped lifecycle filter pills, plan health badges, frequency/time KV rows, and audience chips from the Clients and Member views. `useClientsView` now returns a simple member list + text filter. `planHealth.ts` deleted. Schedule "Confirmed" badge renamed "Scheduled". Command palette Segments section removed. 3 test files deleted (tested removed logic).

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

## ~~Shop / Membership purchasing~~ — ✅ DONE (Phase 1A 2026-04-30 + success toast 2026-05-13)

`/joinnow` reads products from DB via `useProducts`; `ProductPurchaseSheet` handles auth + checkout via `useBuyProduct` → `create-checkout` Edge Function with `{ product_id }`. Webhook activates membership on payment success. Dashboard now shows "Membership activated!" toast on `?status=success` return.

---

## Auth — SMS OTP via Twilio (Phase 2)

**What:** Replace (or supplement) email OTP with phone number OTP. User enters their phone number, receives a 6-digit SMS code, verifies it in-sheet. Uses `supabase.auth.signInWithOtp({ phone })` + `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.

**Why:** Phone OTP has higher delivery reliability than email (no spam filters, no inbox searching), and is familiar from banking/e-commerce flows. Better conversion for mobile-first yoga studio students.

**Cons:** Requires a Twilio account, Supabase Phone Auth enabled, and per-SMS cost (~$0.0075/SMS). Not worth setting up until the student base grows beyond 100 active users.

**Context:** Email OTP is live as of 2026-04-23 (`useAuth.sendOtp` / `useAuth.verifyOtp`). The `profiles` table already has a `phone_number TEXT` column (added in `migrations-v2/0002`). Adding SMS OTP is a UI-only change — add a phone input phase to `AuthForm.tsx`, call `signInWithOtp({ phone })`, verify with `type: 'sms'`. No schema changes needed.

**Depends on:** Twilio account + Supabase Phone Auth config. Do not implement until external accounts are provisioned.
