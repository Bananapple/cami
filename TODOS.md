# TODOS

Deferred work captured during /plan-eng-review on 2026-04-15.

---

## Deferred 2026-05-12 (defense-in-depth + key rotation)

The cross-tenant-guard incident on 2026-05-12 (PR #9, merged as `e3e53dd`) revealed a class of bug: edge functions using service role to bypass RLS without cross-checking the `x-studio-slug` header. PR #9 fixed `create-checkout` only. The wider track is open. While documenting follow-ups, a separate concern surfaced: the legacy service_role key was pasted into an AI chat conversation during the audience-model seed work on 2026-05-12. Bounded exposure (chat + local laptop + GH secret), but the key has bypass-RLS access to the entire project — yogabrie production data AND brie-demo. Rotation is the right move, deferred to do properly.

### Migrate legacy API keys → modern Supabase keys + rotate the leaked service_role

**What:** Move all consumers off the legacy `eyJ…` JWT-based anon + service_role keys (Supabase project Settings → API → "Legacy anon, service_role API keys" tab) and onto the modern `sb_publishable_*` + `sb_secret_*` keys (same page, default tab). Then click "Disable legacy API keys" — at that moment the leaked service_role is permanently revoked.

**Why:** The legacy `eyJ…` service_role pasted into AI chat on 2026-05-12 grants project-wide RLS bypass. Bounded exposure today (only in chat history + author's laptop + the GH secret, not in any commit/log/share), but it's a master key to all customer data across all studios. Rotation closes the residual risk.

**Scope (4 phases, ~45-60 min):**
1. **Update non-production consumers first** (zero blast radius):
   - GH secret `SEED_SUPABASE_SERVICE_ROLE_KEY` → `sb_secret_*` value
   - GH secret `SEED_SUPABASE_ANON_KEY` → `sb_publishable_*` value
   - `~/Desktop/Studio/cami/.env.local` → `sb_secret_*`
   - `~/Desktop/Studio/cami/.env` → `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_*`
   - Smoke test via curl + a `seed-setup` dry-run workflow
2. **Update production frontend** (visible blast radius):
   - Vercel `brie` project → `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_*` → redeploy
   - Vercel `cami` project → same → redeploy
   - Verify sign-in works on both deployments
3. **Verify edge function behavior with legacy still on** (baseline). Trigger one real flow (e.g. a brie-demo checkout). Confirm `payment-webhook`, `create-checkout`, `issue-refund` all still work.
4. **Disable legacy.** Click "Disable legacy API keys" in Supabase dashboard. **Immediately retest the same edge function flow.** If broken: re-enable legacy, then update each edge function to read from a custom secret (`supabase secrets set SB_SECRET_KEY=sb_secret_*` + update function code) rather than the auto-injected `SUPABASE_SERVICE_ROLE_KEY`. Re-disable.

**Open uncertainty:** Whether `SUPABASE_SERVICE_ROLE_KEY` (auto-injected env var in edge functions) auto-aliases to the new `sb_secret_*` value when legacy is disabled. Supabase docs imply yes; I'd test before trusting it. If no, all edge functions (`create-checkout`, `issue-refund`, `validate-discount`, `cancel-membership`, `get-analytics`, `payment-webhook`, `notify-waitlist-offer`, `send-member-message`, `invite-member`) need a custom-secret refactor.

**When to land:** Bundle with the defense-in-depth track below. Or sooner if any sign of broader exposure.

### Defense-in-depth follow-ups from PR #9 (cross-tenant guard)

PR #9 added `validateStudioMatch` inline in `create-checkout` only. The same class of bug exists across other edge functions that derive `studio_id` from a user-supplied resource without cross-checking the `x-studio-slug` header:

- `issue-refund` — derives from `booking.studio_id`. No guard.
- `cancel-membership` — derives from `membership.studio_id`. No guard.
- `validate-discount` — derives from `class_instance.studio_id`. No guard.
- `get-analytics` — accepts `studio_id` directly from request body (UUID-validated only). **Highest exposure** — any authenticated user could request analytics for any studio.

**Work:**
1. Extract `validateStudioMatch` from `create-checkout/index.ts` into `_shared/`. One canonical implementation.
2. Apply it to each of the 4 vulnerable edge functions.
3. Integration tests that explicitly attempt cross-tenant operations (forge a `x-studio-slug` header from studio A while operating on studio B's resource) and assert they fail with 403.
4. Optional belt: set `app.current_studio_id` as a Postgres session variable on each request and have RLS policies read it (stricter than per-policy header reads).

**Why:** PR #9 closed one door. Four more are open.

**When to land:** Soon. The `get-analytics` exposure in particular means any logged-in user (including test accounts on brie-demo) could enumerate yogabrie's analytics by passing the yogabrie studio_id.

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

### Audit #16 — `profiles_staff_read` cross-studio leak

**What:** RLS policy `profiles_staff_read` lets staff of any studio read full profile rows (name, email, phone, marketing opt-ins) of any user who shares ANY studio with them. If user X belongs to Studio A AND Studio B, both A's and B's staff can see X's PII.

**Why deferred:** With Brie + Cami both same-operator (you), this is intentional. With unrelated tenants, it's a real PII leak.

**Fix when landing:** Either column-restrict the staff-read policy, or expose a staff-facing view that excludes phone/marketing opt-ins.

**When to land:** Before tenant 2 (any non-related customer).

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

### Findings raised during /ship pre-landing review of security-fixes (2026-05-09)

- **CORS fallback to `*` when `APP_URL` unset** — `supabase/functions/_shared/cors.ts:45`. The header comment calls this "safe degraded mode" for dev. Bearer JWT auth (not cookies) limits damage, but a misconfigured prod deploy would advertise CORS to all origins. Fix is ~10 lines: throw at module load when `APP_URL` is unset and `DENO_DEPLOYMENT_ID` is set (i.e. running on Supabase, not local). **Land in `fix/post-audit-cleanup` branch.**
- **`invite-member` listUsers caps at perPage: 1000** — `supabase/functions/invite-member/index.ts:102`. Past 1000 auth users, an existing-user lookup-by-email returns null, so the studio_members upsert is skipped — invite still mails OK but role grant silently fails. Fine at current scale (1 studio, <100 users). Fix is the pagination loop pattern from `scripts/promote-owner.ts:58-71`. **Land before crossing 1000 auth users platform-wide, or as part of post-audit cleanup if convenient.**

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
