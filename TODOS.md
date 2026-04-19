# TODOS

Deferred work captured during /plan-eng-review on 2026-04-15.

---

## Refund / cancellation policy

**What:** Add a `cancellation_window_hours` field to `studio_config` (e.g., 24 = free cancel up to 24h before). Wire Stripe refund API to `cancelBooking` mutation — call `stripe.refunds.create({ payment_intent: ... })` from the Edge Function when a booking is cancelled within the window.

**Why:** Studio owners will ask about this before signing. "Money is gone if you cancel" is not an acceptable policy for yoga studios, which have high last-minute cancellation rates.

**Pros:** Enables real commercial relationships. Studios manage refund policy themselves via config.

**Cons:** Requires Stripe integration to be complete first (Phase 1 Stripe Elements). Cannot refund what was never charged.

**Context:** `cancelBooking` mutation exists in `useBookings.ts:59`. It sets `status = 'cancelled'` and `cancelled_at`. No Stripe refund is called. The payment_method_last4 is stored but the PaymentIntent ID is not, so a refund schema change will also be needed (add `stripe_payment_intent_id` to bookings).

**Depends on:** Stripe Elements integration (Phase 1) must be complete. Bookings table must store `stripe_payment_intent_id`.

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

**What:** A script (e.g., `./scripts/migrate-all.sh`) that reads all provisioned studio `.env.*` files, runs `supabase db push --project-ref <ref>` against each project, and reports pass/fail per studio. Optionally: a `studio_registry.json` that tracks studio slug → Supabase project ref → last migrated schema version.

**Why:** As the schema evolves (adding `day_of_week`, `max_capacity`, `events` table, etc.), each existing studio must have migrations applied. With 3 studios this is manual. With 5+ it becomes error-prone and will eventually cause schema drift between studios.

**Pros:** Prevents "studio 1 has max_capacity, studio 3 doesn't" bugs. Makes migrations auditable.

**Cons:** Over-engineering for 3 studios. Manual per-studio migration is fine until 5th studio is onboarded.

**Context:** `new-studio.sh` provisions fresh projects from scratch and runs migrations. No "apply to existing studios" script exists. Supabase project refs are embedded in `.env.<slug>` files.

**Depends on:** Not blocking. Relevant after 3rd studio is live.

---

## YogaBrie: Seed sessions in Supabase

**What:** Run the session INSERT SQL against the live YogaBrie Supabase project (project ref: xskqpxfjhhxontirezjd). The full SQL is in CLAUDE.md under "Seeding Sessions".

**Why:** The booking flow shows no sessions until the sessions table has rows. The site is live but `Book a Session` will return an empty class list.

**How:** Open the Supabase dashboard → SQL editor → paste and run the INSERT block from CLAUDE.md. Verify by opening the booking sheet and browsing dates.

**Depends on:** Nothing. Do this before showing the site to Brinkela.

---

## Shop / Membership purchasing

**What:** The `/joinnow` page currently shows all 7 products with prices but has no purchase flow. Students can browse but must contact the studio to actually buy.

**Why:** Conversion drops when there's no buy button. For memberships and clip cards, an online purchase flow (Vipps or Stripe) removes friction.

**Pros:** Self-serve purchasing, less admin for the studio owner.

**Cons:** Requires Vipps integration (Phase 2) or Stripe checkout session from an Edge Function. Not a simple frontend change.

**Context:** Products and prices are hardcoded in `src/pages/JoinNow.tsx`. For now, the CTA is `contact@yogabrie.com`. Phase 2 will add a `products` table in Supabase and a checkout flow.

**Depends on:** Vipps integration (Phase 2) or Stripe Checkout (simpler interim option).
