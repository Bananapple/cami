# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business Context

This is a **multi-tenant SaaS platform** for Norwegian yoga studios. A single Supabase project serves all studios, with every tenanted table scoped by `studio_id` and RLS enforcing isolation. The owner sells websites + booking engines as a flat monthly SaaS fee. Student payments flow directly to each studio (no marketplace layer) via a **provider-agnostic adapter pattern** — Stripe Checkout in MVP, Frisbii next (Brie already uses it), Vipps later for Norwegian market fit. Adding a provider is an adapter file + one enum value; no schema changes.

**Architectural state**: YogaBrie (`xskqpxfjhhxontirezjd`, eu-north-1) has completed the v2 cutover as of 2026-04-24. The multi-tenant schema is live. The legacy `sessions` table and `session_id`/`session_date` columns on `bookings` are still present but inert — drop them once rollback confidence is established. The migration SQL is in `supabase/migrations-v2/` and the execution record is in `docs/MIGRATION-MULTITENANT.md`.

**Live features (as of 2026-04-24):**
- Passwordless email OTP auth
- Class schedule from `class_instances` (14-day rolling window)
- Stripe Checkout booking flow (server-side via Edge Functions)
- Webhook-confirmed bookings + booking confirmation email (Resend)
- Cancel + refund via `issue-refund` Edge Function (24h window policy)

**Edge Function deploy notes:**
- `payment-webhook` must be deployed with `--no-verify-jwt` (Stripe sends no JWT)
- `create-checkout` and `issue-refund` use standard JWT auth (no flag needed)

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

## Architecture

### Stack
- React 18 + TypeScript + Vite (SWC), React Router v6
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- Supabase — single multi-tenant project (`xskqpxfjhhxontirezjd`), v2 schema live
- TanStack Query for server state
- react-hook-form + zod for forms
- **Provider-agnostic payment layer**: canonical `payments` table + `PaymentProviderAdapter` interface. MVP adapter = Stripe Checkout; adapters planned for Frisbii and Vipps. Secrets (API keys, webhook secrets) live in Supabase Edge Function env, never in frontend or DB.

### Data Flow
All Supabase access goes through the client in `src/integrations/supabase/client.ts`. Custom hooks in `src/hooks/` wrap every table; components never call Supabase directly. In the v2 architecture, a `StudioContext` resolves the current studio from the URL slug/subdomain on load and supplies `studio_id` to every hook.

Key hooks (current):
- `useAuth()` — passwordless OTP (`sendOtp`, `verifyOtp`), `signOut`, current user/session
- `useClassInstances()` — fetches 14-day window of scheduled class instances with joined template/instructor/location data
- `useBookings()` — user's bookings + `cancelBooking` mutation (booking creation is now handled server-side by the `create-checkout` Edge Function)
- `usePaymentMethods()` — saved payment methods
- `useStudioConfig()` — studio branding (legacy; v2 replaces this with `StudioContext`)
- `useProfile()`, `useMembership()`

### Booking Flow (`src/components/BookingSheet.tsx`)

**Current**: `date → confirm → auth → checkout`. The `auth` step uses a two-phase email OTP form (email → 6-digit code). The `checkout` step calls the `create-checkout` Edge Function, which creates a `payments` row + `bookings` row (`status='pending'`) and returns a hosted provider checkout URL. The browser redirects out; the provider's webhook promotes the booking to `confirmed` on success and sends a booking confirmation email via Resend. On return, `Index.tsx` detects `?status=success` in the URL and shows a Sonner toast.

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
| `bookings` | `class_instance_id` FK; `payment_id` FK; status lifecycle incl. `pending`/`payment_failed` |
| `payments` | Canonical payment record (`provider`, `provider_session_id`, `provider_payment_id`, status) |
| `payment_webhook_events` | Idempotent audit log for provider webhooks |
| `payment_methods` | Generalized: `provider` + `provider_external_id` |
| `memberships` | `provider` + `provider_subscription_id` |
| `waitlists` | Reservation-window state machine (`waiting`→`offered`→`accepted`/`expired`) |
| `notification_log` | Idempotent outbound notification record (email/SMS, one row per send attempt) |

RLS helper functions: `user_studio_ids()`, `user_has_role(studio_id, roles[])`, `user_is_staff(studio_id)`. All `SECURITY DEFINER` with locked `search_path` to prevent privilege escalation. Conflict detection for instructors and rooms uses `EXCLUDE USING GIST` on `tstzrange` — double-booking is rejected at the DB level.

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
```

Copy `.env.example` → `.env` per studio deployment. Never commit `.env` (gitignored).

**Getting the Supabase anon key:** Always copy it fresh from the Supabase dashboard → project → Settings → API → "anon public". Keys generated by `new-studio.sh` into `.env.<slug>` can become stale if the JWT secret is ever rotated — a stale key returns 401 on all API calls.

## Deployment (YogaBrie / First Studio)

- **Live URL:** https://brie-alpha.vercel.app
- **Platform:** Vercel (connected to GitHub repo `Bananapple/brie`, auto-deploys on push to `main`)
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
