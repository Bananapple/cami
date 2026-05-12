# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business Context

This is a **multi-tenant SaaS platform** for yoga studios in Scandinavia, Europe and the US. A single Supabase project serves all studios, with every tenanted table scoped by `studio_id` and RLS enforcing isolation. The owner sells websites + booking engines as a flat monthly SaaS fee. Student payments flow directly to each studio (no marketplace layer) via a **provider-agnostic adapter pattern** — Stripe Checkout in MVP, Frisbii next (Brie already uses it), Vipps later for Norwegian market fit. Adding a provider is an adapter file + one enum value; no schema changes.

**Architectural state**: YogaBrie (`xskqpxfjhhxontirezjd`, eu-north-1) has completed the v2 cutover as of 2026-04-24. The multi-tenant schema is live. The legacy `sessions` table and `session_id`/`session_date` columns on `bookings` are still present but inert — drop them once rollback confidence is established. Full migration record: `docs/MIGRATION-MULTITENANT.md`.

**Live features (as of 2026-05-02):**
- Passwordless email OTP auth
- Class schedule from `class_instances` (14-day rolling window)
- Stripe Checkout booking flow (server-side via Edge Functions)
- Webhook-confirmed bookings + booking confirmation email (Resend)
- Cancel + refund via `issue-refund` Edge Function (24h window policy)
- **Membership purchase** (Phase 1A, 2026-04-30): DB-driven products catalog; users buy subscriptions/clip cards via Stripe Checkout from `/joinnow`; webhook calls `activate_membership()` RPC on success; subscription renewal/cancellation handled via `invoice.paid` / `customer.subscription.deleted`
- **Book with membership** (Phase 1B, 2026-04-30): `create-checkout` detects active membership before creating Stripe session; calls `book_with_credit()` for subscription/clip-card holders (no Stripe redirect); `issue-refund` returns credits on cancellation within window; `BookingSheet` adapts UI to show "Included" or "X credits remaining"
- **Frisbii payment adapter** (2026-05-01, untested live): `_shared/providers/frisbii.ts` implements full `PaymentProviderAdapter`; supports one-time charges and webhook reconciliation via invoice handle = payment_id trick; subscription checkout deferred
- **Schedule & class management** (2026-05-02): Manager can create/edit `class_templates` + `schedule_rules` via `CreateRuleSheet`; `/classes` public page is DB-driven via `usePublicClasses`; `BookingSheet` accepts `templateId` prop for pre-filtered class selection; `template_id` on `ClassInstance` type
- **Instructor & location management** (2026-05-02): Manager can CRUD instructors (with specialty field) and locations from StudioView; `/coaches` public page is DB-driven via `usePublicInstructors`; `instructors.specialty` column added (`0019`)
- **Waitlist** (2026-05-02): Full state machine (`waiting→offered→accepted/expired`); `expire_stale_waitlist_offers()` pg_cron sweeper runs every minute; `notify-waitlist-offer` Edge Function deployed + wired via DB webhook (fires on `waitlists UPDATE` where status becomes 'offered'); idempotent email send via `notification_log`; manager ClassDrawer shows Attending/Waitlist/Cancelled tabs with counts and post-class no-show summary
- **Manual check-in** (2026-05-02): `bookings.checked_in_at` timestamp; manager toggles per-attendee in ClassDrawer; no-shows = confirmed past bookings without `checked_in_at`; MemberDrawer shows no-show count stat
- **Clients view** (2026-05-02): `/manage/clients` — full member list via `member_activity_summary` DB view (`0015`); segment filters (New/One-timer/Regular/Lapsing/Inactive/No plan) with counts; real-time search; MemberDrawer shows past bookings, membership status, and "sell package" copy-link flow
- **Discount codes + referral program** (2026-05-02): `discount_codes` table + staff UI; `validate-discount` Edge Function; referral links per member via `studio_members.referral_code`; `referrals` table; first-timer discount applied in `create-checkout`

**Security hardening (2026-04-30):** 28-finding audit implemented — see `docs/SECURITY-HARDENING.md`.

**Design system:** Manager UI uses three labelling primitives (`StateBadge`, `CategoryChip`, `Count`) defined in `src/manage-v2/components/Badge.tsx`. Booking state and membership health always route through mapping functions in `src/manage-v2/lib/bookingStatus.ts` and `src/manage-v2/lib/planHealth.ts` — never hardcode tone/label inline. Full reference: `docs/DESIGN-SYSTEM.md`.

**Edge Function deploy notes:**
- `payment-webhook` must be deployed with `--no-verify-jwt` (Stripe sends no JWT)
- `notify-waitlist-offer` must be deployed with `--no-verify-jwt` (DB webhook sends no JWT)
- `create-checkout` and `issue-refund` use standard JWT auth (no flag needed)
- All edge functions import CORS handling from `supabase/functions/_shared/cors.ts` — single source of truth for allowed origins / preflight.
- Per-studio URLs and sender emails are read from `studios.app_url` / `studios.from_email` (added in `0033`). Edge functions fall back to `APP_URL` / `FROM_EMAIL` env only if the row column is null. Email-sending functions also HTML-escape user-provided strings via a shared `esc()` helper.

## Commands

```bash
npm run dev          # Dev server on localhost:8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Run tests in watch mode
npm run test -- src/test/some.test.ts  # Run a single test file
```

## Provisioning a New Studio

**v2 (live)**: Adding a studio is a row INSERT into `studios` + payment provider onboarding. Schedule is built via `class_templates` + `schedule_rules`; `materialize_class_instances()` populates the 90-day rolling window. `scripts/new-studio.sh` is retired.

Provisioning helpers live in `scripts/`:
- `scripts/provision-studio.ts` — INSERTs the `studios` row (slug, name, branding, currency, timezone, `app_url`, `from_email`) from a config object; idempotent.
- `scripts/promote-owner.ts` — promotes a `studio_members` row to `role='owner'` for the initial manager.

Full step-by-step checklist (SQL → Supabase redirect URL → Vercel → Stripe → Resend → manager invite → verification): **`docs/NEW-CUSTOMER.md`**

## Architecture

### Stack
- React 18 + TypeScript + Vite (SWC), React Router v6
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- Supabase — single multi-tenant project (`xskqpxfjhhxontirezjd`), v2 schema live
- TanStack Query for server state
- react-hook-form + zod for forms
- **Provider-agnostic payment layer**: canonical `payments` table + `PaymentProviderAdapter` interface. Stripe adapter (live) + Frisbii adapter (implemented, untested) in `_shared/providers/`. Vipps planned. Secrets live in Edge Function env only. Frisbii uses invoice handle = payment_id for webhook reconciliation (no Stripe-style session ID); signature is in the JSON payload, not a header.
- `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) wraps the full React tree in `App.tsx` — catches render panics and shows a reload fallback.
- Supabase client (`src/integrations/supabase/client.ts`) passes `x-studio-slug: VITE_STUDIO_SLUG` as a global header on every request. This is required for anon RLS policies to scope reads to the correct tenant.

### Data Flow
All Supabase access goes through the client in `src/integrations/supabase/client.ts`. Custom hooks in `src/hooks/` wrap every table; components never call Supabase directly. In the v2 architecture, a `StudioContext` resolves the current studio from the URL slug/subdomain on load and supplies `studio_id` to every hook.

Key hooks (current):
- `useAuth()` — passwordless OTP (`sendOtp`, `verifyOtp`), `signOut`, current user/session
- `useClassInstances()` — fetches 14-day window of scheduled class instances with joined template/instructor/location data; `ClassInstance` type includes `template_id`
- `useBookings()` — user's bookings + `cancelBooking` mutation (booking creation is now handled server-side by the `create-checkout` Edge Function)
- `usePaymentMethods()` — saved payment methods
- `useStudioConfig()` — studio branding (legacy; v2 replaces this with `StudioContext`)
- `useProfile()`, `useMembership()` — `useMembership` returns the user's active membership for the current studio (status='active'); used in `BookingSheet` to determine booking mode
- `useProducts()` — fetches the studio's active product catalog; uses `useEffect`+`useState` (not TanStack Query) due to a TanStack Query v5 subscriber notification bug with anon queries
- `useStudioMember()` — fetches the current user's `studio_members` row (`level`, `total_sessions`, `referral_code`). Use this for per-studio user stats — these columns no longer live on `profiles`.
- `usePublicInstructors()` — fetches active instructors + class names derived from `schedule_rules`; used on `/coaches` page
- `usePublicClasses()` — fetches class templates + schedule rules, formats human-readable schedule strings; used on `/classes` page
- `useWaitlist()` — user's waitlist entries; client-side filters out past classes (`starts_at > now`)

Manager-only hooks in `src/manage/hooks/`:
- `useClientsView()` — queries `member_activity_summary` view; client-side segment filtering + search
- `useClassAttendance()` — all booking statuses for a class instance (confirmed/cancelled/pending)
- `useClassWaitlist()` — waitlist entries (waiting/offered) for a class instance; `remove` mutation
- `useClassTemplates()` / `useScheduleRules()` — class type and recurring rule CRUD
- `useManageInstructors()` / `useManageLocations()` — instructor + location CRUD (includes `specialty` field)
- `useMember()` / `useMemberBookings()` — member detail + booking history (past 20, both confirmed+cancelled)
- `useSchedule()` — manager schedule view with class instances

All user-facing hooks (`useBookings`, `useMembership`, `usePaymentMethods`, `useClassInstances`, `useStudioMember`) require `studioId` from `useStudioContext()` and scope their queries by it. All hooks expose an `error` field in their return value.

### Booking Flow (`src/components/BookingSheet.tsx`)

**Current**: `date → confirm → auth → [profile if no name] → checkout`. The `auth` step uses a two-phase email OTP form (email → 6-digit code).

**Membership-aware path (Phase 1B):** At the `checkout` step, `create-checkout` checks if the user has an active membership for this studio. If yes, it calls `book_with_credit()` and returns `{ booking_id, free: true }` — no Stripe redirect. `BookingSheet` handles this by redirecting to `/?booking_id=...&status=success`. The confirm step adapts to show "Included" (subscription) or "X credits remaining" (clip card). If no membership → existing Stripe drop-in flow unchanged.

**Drop-in path:** `checkout` step calls `create-checkout` which creates a `payments` row + `bookings` row (`status='pending'`) and returns a hosted Stripe checkout URL. Browser redirects out; webhook promotes booking to `confirmed` on success and sends confirmation email. On return, `Index.tsx` detects `?status=success` and shows a Sonner toast.

**`create-checkout` details:**
- Class booking path: checks active memberships first (fetch all, filter in app code — avoids brittle PostgREST OR chaining). If match found, calls `book_with_credit()` and returns early.
- Auto-upserts a `studio_members` row (`role='member'`) on first booking — new users can book without a staff invite.
- Capacity check counts `pending + confirmed` bookings (prevents overselling during concurrent checkouts).
- `return_url` is validated against `ALLOWED_ORIGINS` + localhost (dev) to prevent open redirects.
- Accepts `{ class_instance_id }` (book a class) OR `{ product_id }` (buy a membership/clip card).
- Currency and studio name are read from `studios.currency` / `studios.name` — nothing hardcoded.

**Legacy (decommissioned)**: was `date → confirm → auth → payment → addCard → success` with an insecure client-side `StripeCardForm` that wrote card details directly to the DB.

### Database Schema

**Legacy (in `supabase/migrations/`)**:
- `20260329021240_*` — initial schema
- `20260416000000_*` — adds `day_of_week` to sessions
- `20260416000001_*` — replaces `increment_user_sessions` RPC with DB trigger
- `20260416000002_*` — adds UNIQUE constraint on bookings `(user_id, session_id, session_date)`

| Legacy Table | Purpose |
|---|---|
| `profiles` | Extends auth.users (name, initials, level, total_sessions) |
| `sessions` | Yoga classes (name, instructor, time, duration, price, day_of_week) |
| `bookings` | User reservations (session_id, session_date, status) |
| `payment_methods` | Saved cards |
| `memberships` | Subscription plans |
| `studio_config` | Per-deployment branding (one row) |

**v2 migrations (in `supabase/migrations/`, timestamps `20260417000001–20260417000041`):**
- `000001–000007` — initial v2 schema, multi-tenant tables, RLS, functions (see `docs/MIGRATION-MULTITENANT.md`)
- `000008_security_hardening` — RLS scoping, atomic payment functions, duplicate-booking constraint
- `000009_drop_legacy_sessions` — drops legacy `sessions` table and stale columns
- `000010_products_and_membership_purchase` — `products` table + RLS + seed data; `activate_membership()`, `renew_membership_by_subscription()`, `cancel_membership_by_subscription()` RPCs
- `000011_book_with_credit` — `book_with_credit()` RPC (atomic credit booking); `return_credit()` RPC
- `000031_expire_stale_pending_bookings` — `expire_stale_pending_bookings()` sweeper; pg_cron every 5min
- `000033_atomic_credit_cancel` — `cancel_credit_booking()` RPC; atomically cancels booking + optionally returns credit
- `000034_revoke_definer_executes` — REVOKEs EXECUTE on `SECURITY DEFINER` RPCs from `anon`/`authenticated`
- `000035_internal_auth_and_rls_tightening` — internal-auth helpers + studio-scoped RLS tightening
- `000036_webhook_studio_scoping` — webhook ingestion scoped by `studio_id`; cross-studio replay rejected
- `000037_studio_visibility_and_from_email` — adds `studios.app_url` and `studios.from_email`

**Applying migrations:** All migrations are in `supabase/migrations/` and tracked in `schema_migrations`. Write new migration files there with the next timestamp; apply via the Supabase MCP `execute_sql` tool (Claude can do this directly) or `supabase db push --project-ref xskqpxfjhhxontirezjd`.

**v2 (live as of 2026-04-24)** — full design in `docs/MIGRATION-MULTITENANT.md`:

| v2 Table | Purpose |
|---|---|
| `studios` | Tenant root (slug, branding, timezone, currency) |
| `studio_members` | user↔studio with role + per-studio state (total_sessions, level, referral_code) |
| `studio_payment_providers` | Per-studio provider enrolment (Stripe/Frisbii/Vipps account IDs) |
| `profiles` | Global PII only (name, phone, marketing opt-ins) |
| `locations`, `instructors` | Rooms/branches and staff per studio |
| `class_templates` | What a class IS |
| `schedule_rules` | One row per weekday slot, with effective date range |
| `schedule_exceptions` | Per-date deviations (cancel / reschedule / sub / relocate) |
| `class_instances` | Materialized concrete occurrences — bookings point here |
| `bookings` | `class_instance_id` FK; `payment_id` FK (NULL for credit bookings); `membership_id` FK (NULL for paid bookings); exactly one of payment_id/membership_id is non-null; status lifecycle incl. `pending`/`payment_failed` |
| `payments` | Canonical payment record (`provider`, `provider_session_id`, `provider_payment_id`, status) |
| `payment_webhook_events` | Idempotent audit log for provider webhooks |
| `payment_methods` | Generalized: `provider` + `provider_external_id` |
| `memberships` | `product_id` FK → products; `credits_remaining` (NULL=unlimited subscription, integer=clip card); `valid_until` (DATE); `provider_subscription_id` for Stripe subscription renewal/cancel events |
| `products` | Studio product catalog: type (`drop_in`\|`clip_card`\|`subscription`\|`addon`\|`private`), `price_minor`, `credits`, `validity_days`, `billing_interval`; RLS: anon+authenticated read via x-studio-slug header |
| `waitlists` | Reservation-window state machine (`waiting`→`offered`→`accepted`/`expired`) |
| `notification_log` | Idempotent outbound notification record (email/SMS, one row per send attempt) |

RLS helper functions: `user_studio_ids()`, `user_has_role(studio_id, roles[])`, `user_is_staff(studio_id)`. All `SECURITY DEFINER` with locked `search_path` to prevent privilege escalation. Conflict detection for instructors and rooms uses `EXCLUDE USING GIST` on `tstzrange` — double-booking is rejected at the DB level.

**RLS policy model (post-0008):** All public read policies on `locations`, `instructors`, `class_templates`, and `class_instances` are studio-scoped:
- Anon reads: require matching `x-studio-slug` header (set automatically by the Supabase client from `VITE_STUDIO_SLUG`).
- Authenticated reads: require an active `studio_members` row for the user.
- `schedule_rules` and `schedule_exceptions` are staff-only (not queried by the frontend directly).

**`bookings`** has `UNIQUE(user_id, class_instance_id)` — double-booking rejected at DB level (23505 from PostgREST).

**Atomic payment state transitions:** Use `confirm_booking(p_payment_id)` and `refund_booking(p_payment_id)` RPCs instead of raw UPDATEs. Each RPC updates both `payments` and `bookings` inside a single implicit PostgREST transaction — partial failure is impossible.

**Email idempotency:** `sendBookingConfirmation` in `payment-webhook` INSERTs a `notification_log` row (with a unique `idempotency_key`) *before* calling Resend. A 23505 unique-violation means the email was already sent — skip silently. This prevents duplicate emails on webhook replays.

### Per-Studio Branding

**Legacy**: `studio_config` is a single row per deployment, read via `useStudioConfig()`.
**v2**: Branding lives on the `studios` row. `StudioContext` resolves the current studio by slug (from subdomain or URL prefix) on app load and provides branding + `studio_id` throughout the tree. Tailwind CSS variables (HSL) still drive colors. Fonts: DM Serif Display (headings) + Inter (body).

### Supabase Config

`supabase/config.toml` is used with `supabase config push --project-ref <ref> --yes` to push auth settings to remote projects. Email confirmations are disabled for dev/test (`enable_confirmations = false` in local config).

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_STUDIO_SLUG              # e.g. "yogabrie" — resolves the current tenant on load
```

Payment provider and notification secrets live in Supabase Edge Function env via `supabase secrets set`. Never in frontend, never in git:
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
FROM_EMAIL          # e.g. booking@yogabrie.no — defaults to onboarding@resend.dev if unset
APP_URL             # e.g. https://brie-hd7s.vercel.app — used to validate return_url in create-checkout
```

Copy `.env.example` → `.env` per studio deployment. Never commit `.env` (gitignored).

**Getting the Supabase anon key:** Always copy it fresh from the Supabase dashboard → project → Settings → API → "anon public". Keys generated by `new-studio.sh` into `.env.<slug>` can become stale if the JWT secret is ever rotated — a stale key returns 401 on all API calls.

## Deployment (YogaBrie / First Studio)

- **Live URL:** https://brie-hd7s.vercel.app
- **Platform:** Vercel (connected to GitHub repo `Bananapple/cami`, auto-deploys on push to `main`)
- **Supabase project ref:** `xskqpxfjhhxontirezjd` (eu-north-1)
- **Schedule:** Seeded — 15 class slots migrated to `class_templates` + `schedule_rules`; 90-day `class_instances` window materialized

### Vercel environment variables
Set these in Vercel → Project → Settings → Environment Variables (Production scope, no quotes):
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_STUDIO_SLUG
```
`VITE_STRIPE_PUBLISHABLE_KEY` is no longer needed — payments are fully server-side via Edge Functions.
After adding or changing env vars, trigger a fresh deploy (don't use "Redeploy from cache").

### Git config requirement
Vercel blocks deploys from commits authored with a non-GitHub email. Make sure git is configured with the email that matches your GitHub account:
```bash
git config --global user.email "your@github-email.com"
git config --global user.name "Your Name"
```

## CI

GitHub Actions runs on every push and PR to `main` (`.github/workflows/ci.yml`): `bun install → lint → build → test`. PRs should not be merged if CI is red.

## TypeScript Notes

Config is intentionally permissive (`strictNullChecks: false`, `noImplicitAny: false`). Path alias `@/` resolves to `src/`.


## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
