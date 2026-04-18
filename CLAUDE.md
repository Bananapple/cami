# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Business Context

This is a **multi-studio SaaS platform** — not a single yoga studio site. Each yoga studio client gets their own isolated Supabase project and branded deployment. The owner sells websites + booking engines to Norwegian yoga studios as a flat monthly SaaS fee. Student payments go directly to each studio (no marketplace layer). Vipps support is important for Norwegian users.

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

```bash
./scripts/new-studio.sh
```

Automates: Supabase project creation (eu-north-1), migration push, `studio_config` seed, and generates `.env.<studio-slug>`. Requires `supabase` CLI and `jq` installed, and `supabase login` already run.

### Seeding Sessions

After provisioning, insert sessions via the Supabase dashboard or SQL. The `day_of_week` column controls which days a class appears in the booking UI. Values follow JS `Date.getDay()`: 0=Sunday, 1=Monday, ..., 6=Saturday.

```sql
-- Vinyasa Flow: Mon/Wed/Fri at 07:00
INSERT INTO sessions (class_name, practitioner_name, practitioner_initials, time, duration, level, location, price, day_of_week)
VALUES ('Vinyasa Flow', 'Anne Bakke', 'AB', '07:00', 60, 'All levels', 'Studio 1', 250, '{1,3,5}');

-- Yin Yoga: Tue/Thu at 18:00
INSERT INTO sessions (class_name, practitioner_name, practitioner_initials, time, duration, level, location, price, day_of_week)
VALUES ('Yin Yoga', 'Erik Lie', 'EL', '18:00', 75, 'Beginner', 'Studio 2', 250, '{2,4}');
```

Sessions with an empty `day_of_week` (`'{}'`) appear on every day — use this only as a temporary placeholder. Always set real days before going live.

## Architecture

### Stack
- React 18 + TypeScript + Vite (SWC), React Router v6
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- Supabase (auth + Postgres) — **one project per studio deployment**
- TanStack Query for server state
- react-hook-form + zod for forms
- Stripe for payments (frontend key only; secret key lives in Supabase Edge Functions)

### Data Flow
All Supabase access goes through the client in `src/integrations/supabase/client.ts`, which reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Custom hooks in `src/hooks/` wrap every table. Components never call Supabase directly.

Key hooks:
- `useAuth()` — sign up/in/out, current user
- `useSessions()` — available yoga classes
- `useBookings()` — user's bookings, `createBooking` mutation
- `usePaymentMethods()` — saved cards
- `useStudioConfig()` — studio name/location/branding from DB (cached permanently, one read on load)
- `useProfile()`, `useMembership()`

### Booking Flow (`src/components/BookingSheet.tsx`)

The core feature. A slide-in Sheet with a 6-step wizard:

```
date → confirm → auth → payment → addCard → success
```

State machine lives entirely in `BookingSheet.tsx`. Each step renders a sub-component from `src/components/booking/`. Steps `auth`, `payment`, and `addCard` use a split layout (order summary left, form right).

`handlePaymentComplete(last4)` is the convergence point — called by both `PaymentSelector` (existing card) and `StripeCardForm` (new card). It calls `createBooking.mutateAsync()` and advances to `success` only on success. On failure it sets `bookingError` state and stays on the payment step.

### Database Schema

Migrations in `supabase/migrations/`:
- `20260329021240_*` — initial schema
- `20260416000000_*` — adds `day_of_week` to sessions
- `20260416000001_*` — replaces `increment_user_sessions` RPC with DB trigger
- `20260416000002_*` — adds UNIQUE constraint on bookings `(user_id, session_id, session_date)`

| Table | Purpose | RLS |
|---|---|---|
| `profiles` | Extends auth.users (name, initials, level, total_sessions) | Own row only |
| `sessions` | Yoga classes (name, instructor, time, duration, level, price, day_of_week) | Public read |
| `bookings` | User reservations (session_id, session_date, status, amount_paid) | Own rows only |
| `payment_methods` | Saved Stripe cards (brand, last4, expiry) | Own rows only |
| `memberships` | Subscription plans | Own rows only |
| `studio_config` | Per-deployment branding (studio_name, location, logo_url, primary_color) | Public read |

Auto-trigger `handle_new_user()` creates a `profiles` row on signup. DB trigger `trg_increment_sessions` bumps `profiles.total_sessions` after a confirmed booking INSERT (replaced the old `increment_user_sessions` RPC which had a privilege escalation vulnerability).

### Per-Studio Branding

`studio_config` has one row per deployment. `useStudioConfig()` reads it and exposes `studioName` and `location`. Colors come from Tailwind CSS variables (HSL). Fonts are DM Serif Display (headings) + Inter (body).

### Supabase Config

`supabase/config.toml` is used with `supabase config push --project-ref <ref> --yes` to push auth settings to remote projects. Email confirmations are disabled for dev/test (`enable_confirmations = false` in local config).

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_STRIPE_PUBLISHABLE_KEY   # frontend only; secret key goes in Edge Function env
```

Copy `.env.example` → `.env` per studio deployment. Never commit `.env` (gitignored).

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
