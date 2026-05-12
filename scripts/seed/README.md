# Audience-model test seed

Two scripts that populate the `brie-demo` (or any configured test) studio with realistic-feeling member data so the Clients screen's audience-model surfaces exercise every code path.

## What you get

15 personas spanning:

- **Every lifecycle bucket**: New, Regular, One-timer, Lapsing, Inactive, On leave, No plan
- **Every frequency tier**: Devotee (8+/30d), Regular (4–7), Casual (1–3), None
- **Every plan type**: Subscription, Clip card, Drop-in (no plan)
- **Every time bucket**: Morning, Midday, Evening (including a 21:30 persona that exercises the 21:00+ extension)
- **Every source**: direct, referral, instagram, google
- **Both risk flags**: `credits_expiring_soon` (Fae — 10d out, 4 credits) and `sub_renewing_soon` (Cara — 18d out)

See `personas.ts` for the full list with rationale.

## Setup (one-shot)

Backfills user accounts, memberships, and ~120 days of synthetic booking history.

```bash
# Required env (lives in .env or shell, never committed)
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...      # NOT the anon key
export TEST_USER_PASSWORD=...              # one password used for every test user
export TEST_STUDIO_SLUG=brie-demo          # optional, defaults to brie-demo

# Dry run first to see what would happen
bun run scripts/seed/setup.ts --dry-run

# Then for real
bun run scripts/seed/setup.ts
```

Idempotent. Re-running:
- existing users are reused (matched by email)
- existing memberships are upserted
- existing bookings are silently skipped (unique constraint on `user_id + class_instance_id`)

## Daily bookings (cron)

The `seed-daily-bookings` GitHub Action runs `daily.ts` every morning at 08:00 UTC. Each persona has a booking probability (devotee ~75%, casual ~25%, lapsing 0%). Over a week or two, the audience model fills out organically.

Locally:

```bash
bun run scripts/seed/daily.ts --dry-run    # see decisions
bun run scripts/seed/daily.ts              # book for real
```

## GitHub Actions setup

Add these **secrets** to the cami repo settings:

| Secret | Value |
|---|---|
| `SEED_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `SEED_SUPABASE_ANON_KEY` | Anon/publishable key |
| `SEED_SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SEED_TEST_USER_PASSWORD` | Strong password used for all 15 test accounts |

And optionally this **variable**:

| Variable | Value |
|---|---|
| `SEED_TEST_STUDIO_SLUG` | `brie-demo` (the default; set to override) |

After secrets are set, manually trigger one run from the Actions tab → "seed-daily-bookings" → "Run workflow" to confirm wiring before letting the cron take over.

## Architecture

- **Setup uses service role** (admin client). Inserts users via `auth.admin.createUser`, backfills past `class_instances` with `status='completed'`, inserts bookings directly. Bypasses Edge Functions for historical data — necessary because Edge Functions only book future classes.
- **Daily uses anon key + per-user sign-in**. Calls `create-checkout` exactly like a real client. With active memberships, this hits the `book_with_credit()` path and returns `{free: true}` — no Stripe redirect, no email, just a confirmed booking row. This means the daily script exercises the real Edge Function code path you ship.
- **Test data stays in the test tenant.** Everything targets `TEST_STUDIO_SLUG` (default `brie-demo`). YogaBrie production data is never touched.

## Caveats / not covered

- **Stripe integration is bypassed.** The membership-credit path skips Stripe entirely. To exercise Stripe, test once manually with a real Stripe test card on a non-membership account.
- **Email confirmations don't fire.** They're sent by `payment-webhook` (Stripe), which doesn't run on credit bookings. Test the email path separately.
- **The OTP login flow isn't tested.** Personas sign in with password, not OTP. Real-user OTP UX needs manual coverage.
- **`MODE() WITHIN GROUP` ties are arbitrary.** If two templates have equal booking counts for a persona, Postgres picks one deterministically per query but unpredictably for you. The seed concentrates bookings on each persona's `preferredTemplate` to avoid ties.

## Inspecting populated data

After running setup + a few daily cycles, sign in as a manager and visit `/manage/clients` while scoped to `brie-demo` (set `VITE_STUDIO_SLUG=brie-demo` in your local `.env` or deploy a preview branch with that var). You should see:

- ~3 Devotees, ~5 Casuals, ~4 Lapsing, 1 Inactive, 2 New (one is a hot-starter), 1 On-leave, 1 One-timer
- Filter pills populated for Plan: Subscription/Clip card, Frequency: Devotee/Regular/Casual, Source: all 4 values, Time: all 3 buckets (with Gio in Evening at 21:30), Class: 5 templates
- Cara's MemberDrawer fires "Subscription renewing soon"
- Fae's MemberDrawer fires "Credits expiring soon"
