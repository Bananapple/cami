# Test studio (brie-demo) simulation reference

The `brie-demo` studio is a separate tenant under the same Supabase project as production (`xskqpxfjhhxontirezjd`). It's the target for synthetic data that exercises the audience model, member lifecycle math, and dashboard surfaces without touching real customer data.

## At a glance

| What | Where |
|---|---|
| Studio slug | `brie-demo` |
| Studio id | `bd54dc3c-7cd9-4833-830f-266926ae4105` |
| Schedule basis | `scripts/seed-demo-studio.sql` (5 class templates, 3 instructors, recurring rules, 14-day forward instances) |
| Product catalog | Drop-in (NOK 250), 10× Clip Card (NOK 2,000), Monthly Unlimited (NOK 899/mo) |
| Audience seed | `scripts/seed/setup.ts` — 15 personas + ~120 days backfilled history |
| Daily activity | `scripts/seed/daily.ts` via `.github/workflows/seed-daily-bookings.yml` cron at 08:00 UTC |
| Realistic demo accounts | 7 pre-existing `*@demo.brie` accounts from the original SQL seed (Astrid Lie, Emma Larsen, Ingrid Berg, Lars Eriksen, Maja Nygård, Nora Dahl, Ole Thorsen, Sofia Andersen) |
| To inspect | Set `VITE_STUDIO_SLUG=brie-demo` in `.env`, run `npm run dev`, sign in, visit `/manage/clients` |

## The 15 audience-model personas

Each persona is engineered to populate a specific cell in the audience-model matrix. See `scripts/seed/personas.ts` for the source.

| # | Name | Email | Lifecycle target | Plan | Time | Class | Daily book % |
|---|---|---|---|---|---|---|---|
| 1 | Ada Devotee | ada@cami.test | Regular / Devotee | Subscription | Morning | Ashtanga Mysore | 75% |
| 2 | Beatrice Hagen | beatrice@cami.test | Regular / Devotee | Subscription | Morning | Pilates | 65% |
| 3 | Cara Renew | cara@cami.test | Regular | Subscription (valid 18d) — fires `sub_renewing_soon` | Evening | Ashtanga Full Led | 50% |
| 4 | Dia Midday | dia@cami.test | Regular / Casual | Clip card | Midday | Yin Yoga | 30% |
| 5 | Eli Dropin | eli@cami.test | Regular / Casual | None (drop-in) | Evening | Pilates | 25% |
| 6 | Fae Expiring | fae@cami.test | Regular | Clip card (4 left, valid 10d) — fires `credits_expiring_soon` | Morning | Ashtanga Mysore | 40% |
| 7 | Gio LateEvening | gio@cami.test | Regular | Subscription | Evening (21:30 — exercises the 21:00+ bucket extension) | Yin Yoga | 40% |
| 8 | Hana Faded | hana@cami.test | Lapsing | Subscription cancelled | Morning | Ashtanga Mysore | 0% |
| 9 | Iris Quiet | iris@cami.test | Lapsing | None | Midday | Pilates | 0% |
| 10 | Jun BurntOut | jun@cami.test | Lapsing | Clip card depleted | Evening | Ashtanga Full Led | 0% |
| 11 | Kit LongGone | kit@cami.test | Inactive | None | Morning | Pilates | 0% |
| 12 | Lila OneShot | lila@cami.test | One-timer | None | Midday | Yin Yoga | 0% |
| 13 | Maya FreshFace | maya@cami.test | New (no bookings yet) | None | Morning | Pilates | 15% |
| 14 | Nia HotStart | nia@cami.test | New + Devotee | Subscription | Evening | Ashtanga Mysore | 70% |
| 15 | Ozzy Paused | ozzy@cami.test | On leave | Subscription | Morning | Pilates | 0% |

## What this exercises

**Lifecycle filter pills** — every bucket has at least one occupant:
- New: Maya, Nia
- Regular: Ada, Beatrice, Cara, Dia, Eli, Fae, Gio, Nia
- One-timer: Lila
- Lapsing: Hana, Iris, Jun (all ≥3 sessions, last booking 45–90 days ago)
- Inactive: Kit (≥2 sessions, last booking >90 days ago)
- On leave: Ozzy
- No plan: Eli, Hana, Iris, Kit, Lila, Maya (membership_id IS NULL)

**Tag filter pills:**
- Plan: subscription (6), clip_card (3), drop-in/none (6)
- Frequency tier: devotee (Ada, Nia), regular, casual, none — driven by `bookings_last_30d`
- Source: direct, referral, instagram, google — at least one persona each
- Time affinity: morning, midday, evening — covers all three (Gio specifically at 21:30 to test the extension shipped in migration 0026)
- Class: Ashtanga Mysore (4 personas), Pilates (4), Yin Yoga (3), Ashtanga Full Led (2), Mama & Baby (0 — not preferred by any persona)

**Risk-flag alerts in MemberDrawer:**
- `credits_expiring_soon`: Fae (4 credits remaining, valid 10 days)
- `sub_renewing_soon`: Cara (subscription valid 18 days, under 30-day threshold)

**Home dashboard KPIs:**
- Bookings — populates from ~130 backfilled + daily increment
- Active subscription value — ~5,400 NOK from 6 seed subs (+/- pre-existing test data)
- Net members — Hana/Jun's cancelled memberships occasionally surface as "churned" in the week they expired
- Booking trend — 30-week bars, density growing toward present
- Cash in — **always 0** for seed bookings (membership-credit path, no Stripe)

## What this does NOT exercise

These paths are intentionally bypassed and need separate testing:

| Path | Why bypassed | How to test separately |
|---|---|---|
| Stripe payment flow | Seed bookings use membership-credit (`book_with_credit()`), no Stripe redirect | Manual booking with Stripe test card on a non-membership account |
| Email confirmations | Sent by `payment-webhook`, which doesn't fire for credit bookings | Test card booking → check Resend dashboard |
| OTP login UX | Seed users sign in via `signInWithPassword` | Manual OTP flow with a real email |
| Frontend BookingSheet UI | Seed calls `create-checkout` directly | Manual click-through on `/` |
| Traffic dashboard | PostHog-driven, requires real public visitors with the JS snippet loaded | Deploy a brie-demo Vercel preview, visit from a few browsers; OR future: simulate via PostHog ingest API |
| Waitlist flow | Not seeded | Manual: book a class to capacity, then attempt one more booking |
| Refund flow | Not seeded | Manual: cancel a recent booking within window |
| Discount codes / referrals | Not seeded | Manual at checkout |

## Known quirks

- **Synthetic class_instances pollute the Schedule tab.** Backfilled bookings reference new one-off `class_instances` with `rule_id=NULL`, scattered at 07:00 / 12:00 / 19:00 across the past 120 days. They're tagged with `notes='[seed] backfilled for audience-model test data'` for identification. Future improvement: have the seed pick the closest matching real `class_instance` instead of inventing standalone ones. See `scripts/seed/lib.ts:insertPastClassInstance`.
- **`Cash in` KPI always 0 on brie-demo.** Seed bookings have `payment_id=null` (no Stripe involvement). Real revenue testing needs the manual Stripe-test-card path.
- **Time bucket assumes Europe/Oslo standard offset.** DST drift of ±1 hour stays within bucket boundaries (5/11/15/24), but a North American test studio would need the offset table in `scripts/seed/lib.ts:stdOffsetMinutes` extended.
- **Pre-existing accounts on brie-demo.** Beyond the 15 seed personas, there are 7 `*@demo.brie` demo accounts (Astrid, Emma, etc. from `seed-demo-studio.sql`) and 4 personal test accounts the author accumulated (`ndevibe@zohomail.com`, `nicholas@kaizengrp.co`, etc.). Total visible on `/manage/clients` for brie-demo: ~26 members.

## Operating

### Wipe and re-seed (if persona definitions change)

```bash
# From the Actions tab → "seed-setup" workflow → Run workflow
# Inputs: dry_run=false, force=true
```

`--force` deletes each persona's existing seed-tagged bookings + class_instances and rebuilds from current persona spec. Idempotent.

### Manual local run

```bash
cd ~/Desktop/Studio/cami
export SUPABASE_URL=...  # or source .env + .env.local
export SUPABASE_SERVICE_ROLE_KEY=...
export SUPABASE_ANON_KEY=...
export TEST_USER_PASSWORD=...
bun run scripts/seed/setup.ts --dry-run
bun run scripts/seed/setup.ts        # or --force to rebuild
bun run scripts/seed/daily.ts        # one cron tick
```

### Inspect populated state via the manage UI

```bash
# Edit .env, set VITE_STUDIO_SLUG=brie-demo (instead of yogabrie)
npm run dev
# Visit http://localhost:8080, sign in as your usual account
# (may need scripts/promote-owner.ts --slug=brie-demo --email=YOUR_EMAIL the first time)
# /manage/clients → see all 26 members, filter pills populated, MemberDrawer for any persona
# /manage/home → KPI tiles, booking trend, unmet demand
# Remember to set VITE_STUDIO_SLUG back when done
```

## See also

- `scripts/seed/README.md` — operator-facing setup guide
- `scripts/seed/personas.ts` — source of truth for the 15 personas
- `scripts/seed-demo-studio.sql` — original studio scaffolding (location, instructors, templates, products, schedule rules)
- `TODOS.md` — deferred work including the eventual rotation off legacy API keys
