# Security Hardening — 2026-04-30

Third-party audit (Gemini + DeepSeek), 28 findings. All implemented in a single pass. Migration: `supabase/migrations-v2/0008_security_hardening.sql`.

---

## Findings summary

| # | Area | Severity | Fix |
|---|---|---|---|
| 1 | Double charge — no idempotency on webhook | Critical | INSERT `notification_log` before Resend call; unique `idempotency_key` is the lock |
| 2 | Open redirect in `create-checkout` `return_url` | Critical | Validate against `ALLOWED_ORIGINS` derived from `APP_URL` env var |
| 3 | Capacity race — `booked_count` stale under concurrent load | Critical | Count `pending + confirmed` bookings live instead of reading `booked_count` |
| 4 | Refund webhook leaves `bookings.status = 'confirmed'` | Critical | `refund_booking()` RPC now updates both `payments` and `bookings` atomically |
| 5 | Payment state split across two sequential UPDATEs — partial failure window | Critical | Replaced with `confirm_booking()` / `refund_booking()` DB functions; PostgREST wraps each RPC in an implicit transaction |
| 6 | TOCTOU race in `BookingSheet` auth check | Critical | Removed stale `isAuthenticated` state check; single `getUser()` call is the authority |
| 7 | `useIsStaff` had no `user_id` or `studio_id` filter — any logged-in user could pass the staff gate | Critical | Added `.eq("user_id", user.id)` and `.eq("studio_id", studioId)` |
| 8 | Anon RLS policies allowed reads across all studios | High | All public read policies on `locations`, `instructors`, `class_templates`, `class_instances` now require `x-studio-slug` header to match `studios.slug` |
| 9 | Authenticated read policies had no studio scoping | High | Member read policies require active `studio_members` row for the user |
| 10 | `schedule_rules` and `schedule_exceptions` readable by anyone | High | Replaced public read policy with staff-only read policy |
| 11 | Double-booking possible at DB level | High | `UNIQUE(user_id, class_instance_id)` added to `bookings` (cleaned 5 duplicates from live DB first) |
| 12 | `useBookings` had no studio scope | High | Added `.eq("studio_id", studioId)` + `enabled: !!studioId` |
| 13 | `useMembership` had no studio scope | High | Added `.eq("studio_id", studioId)` |
| 14 | `usePaymentMethods` had no studio scope + used wrong column name | High | Added `.eq("studio_id", studioId)`; insert now uses `provider_external_id` not `stripe_payment_method_id` |
| 15 | Currency hardcoded as `"NOK"` in `create-checkout` | Medium | Read from `studios.currency` |
| 16 | Studio name hardcoded in booking confirmation email | Medium | Read from `studios.name` |
| 17 | `studio_members_self_insert` policy missing — new users couldn't book without staff invite | Medium | Added policy; `create-checkout` also auto-upserts on first booking |
| 18 | `materialize_class_instances` ignored `locations.timezone` | Medium | Replaced with fixed version: `COALESCE(l.timezone, _studio.timezone)` |
| 19 | `materialize_class_instances` referenced non-existent `scheduled_date` column | Medium | Fixed to `starts_at::date = _date` |
| 20 | `materialize_class_instances` left cancelled instances with no bookings in place | Medium | Now DELETEs `scheduled` instances with no confirmed bookings when a `cancel` exception is applied |
| 21 | `useClassInstances` time window anchored in UTC not studio timezone | Medium | Anchor date computed with `toLocaleString("sv-SE", { timeZone: studioTimezone })` |
| 22 | `useClassInstances` queryKey was static — stale data across studios | Medium | queryKey now includes `[studioId, fromISO, toISO]` |
| 23 | Render panics had no recovery path | Medium | `ErrorBoundary` wraps full React tree in `App.tsx` |
| 24 | Anon Supabase client sent no `x-studio-slug` header | Medium | Client now passes `global.headers: { 'x-studio-slug': VITE_STUDIO_SLUG }` |
| 25 | `NotFound.tsx` used `<a href="/">` — full page reload | Low | Changed to `<Link to="/">` |
| 26 | `StaffGate.tsx` used `<a href="/dashboard">` | Low | Changed to `<Link to="/dashboard">` |
| 27 | `tailwind.config.ts` listed 3 non-existent content paths | Low | Removed; only `./src/**/*.{ts,tsx}` remains |
| 28 | `scripts/new-studio.sh` still executable but targets v1 schema | Low | Added `echo ERROR: deprecated && exit 1` guard at top |

Three findings from the original audit were deferred as genuinely out of scope for this pass:
- Stripe key rotation (operational, not a code fix)
- Waitlist capacity guards (waitlist feature not yet live)
- NavRail `aria-current` (accessibility — tracked separately)

---

## Follow-up findings (post-audit)

| # | Area | Severity | Discovered | Fix |
|---|---|---|---|---|
| 29 | Cross-tenant attribution via `create-checkout` — service role bypasses RLS, so a stale tab or hand-crafted request could submit a `product_id` belonging to a different studio than the frontend was scoped to; `studio_id` was derived from `product.studio_id` without cross-checking the request | High | 2026-05-11 (in prod — yogabrie member purchased "Monthly Unlimited" but membership row landed on brie-demo) | Added `validateStudioMatch(req, adminClient, studioId)` helper in `supabase/functions/create-checkout/index.ts`. Compares `x-studio-slug` request header against the resolved `studio_id`; returns 400 if header absent/empty, 403 on mismatch. Called immediately after `studioId` is resolved in both the class-booking and product-purchase branches so the credit-booking early-return path is also protected. PR #9, 2026-05-12. |

**Open defense-in-depth track** (deferred to next sprint, not yet implemented):
- RLS audit — every tenanted table, every policy, every service-role edge function call (`issue-refund`, `validate-discount`, `cancel-membership`, `get-analytics`)
- Extract `validateStudioMatch` pattern as a shared helper applied across all edge functions that accept user-controlled tenant IDs
- Integration tests that explicitly attempt cross-tenant operations and verify they fail
- PG-level belt: set `app.current_studio_id` as a Postgres session variable per request, consumed by RLS policies — stricter than the current per-policy header reads

---

## Key architectural decisions

### RLS: anon reads via header, not hardcoded IDs

Anon RLS policies use `current_setting('request.headers', true)::json->>'x-studio-slug'` to resolve the tenant, not a hardcoded studio ID. This means the same policy works for every studio without per-studio SQL changes. The Supabase client sets this header automatically from `VITE_STUDIO_SLUG`.

### Payment atomicity: DB functions not sequential UPDATEs

`confirm_booking(p_payment_id)` and `refund_booking(p_payment_id)` are `plpgsql` functions called via PostgREST RPC. PostgREST auto-wraps each RPC call in an implicit transaction — the `payments` update and the `bookings` update either both succeed or both roll back. No partial-failure window.

### Email idempotency: INSERT before send

`sendBookingConfirmation` in `payment-webhook` does:
1. Fetch user email + studio name (needed for `recipient` NOT NULL)
2. INSERT `notification_log` row with unique `idempotency_key = booking_id + ':booking_confirmation'`
3. If INSERT throws 23505 → already sent, skip
4. Call Resend

This means webhook replays (Stripe retries on timeout, etc.) are silently deduplicated at step 2.

### studio_members auto-upsert on first booking

`create-checkout` calls `adminClient.from("studio_members").upsert({...}, {onConflict: "studio_id,user_id", ignoreDuplicates: true})` before creating the checkout session. New users who sign up and immediately book get a `member` row automatically — no staff invite required.

### Duplicate bookings in live DB

Adding `UNIQUE(user_id, class_instance_id)` required cleaning 5 duplicate pairs from the live DB first. The cleanup kept the booking with the highest `id` (assumed most recent / correct) and deleted the others. All duplicates were for the same user in a sandbox/test environment — no real money involved.

---

## Follow-up hardening (2026-05-09)

A second pass closed remaining gaps surfaced after the original 28-finding audit. Migrations + edge function refactors land on branch `security-fixes`.

| Migration | Change |
|---|---|
| `0030_revoke_definer_executes.sql` | REVOKE default EXECUTE on `SECURITY DEFINER` RPCs from `anon`/`authenticated`; only callers that need the function are GRANTed |
| `0031_internal_auth_and_rls_tightening.sql` | Internal-auth helpers + studio-scoped RLS across membership / booking / payment tables |
| `0032_webhook_studio_scoping.sql` | Webhook ingestion + `payment_webhook_events` scoped by `studio_id` so cross-studio replay is rejected |
| `0033_studio_visibility_and_from_email.sql` | Adds `studios.app_url` + `studios.from_email`; edge functions read per-studio values instead of global env vars |

Edge function plumbing alongside these migrations:
- Shared CORS module at `supabase/functions/_shared/cors.ts` — every function imports the same allow-list / preflight handler.
- Per-studio URL/email plumbing across 11 functions; global `APP_URL` / `FROM_EMAIL` env vars are now fallbacks, not the source of truth.
- HTML-escape (`esc()`) helper adopted in 6 email-sending functions to prevent injection via user-controlled studio/member strings.
- `get-analytics` UUID-validates `studio_id` before any query.
