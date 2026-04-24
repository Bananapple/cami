# TODOS

Deferred work captured during /plan-eng-review on 2026-04-15.

---

## Refund / cancellation policy

**What:** `studios.cancellation_window_hours` is defined in v2 (default 24). Wire `cancelBooking` to call the provider-agnostic `issue-refund` Edge Function when a booking is cancelled inside the window — that function looks up `bookings.payment_id → payments.provider`, dispatches to the correct adapter's `issueRefund()`, and updates `payments.refunded_amount` + `provider_refund_id`.

**Why:** Studio owners will ask about this before signing. "Money is gone if you cancel" is not an acceptable policy for yoga studios, which have high last-minute cancellation rates.

**Pros:** Enables real commercial relationships. Studios manage refund policy themselves via `cancellation_window_hours`. Refund logic is provider-neutral — works for Stripe today and Frisbii/Vipps when added.

**Cons:** Cannot refund what was never charged. Requires the `create-checkout` flow to be live so that `bookings.payment_id` is populated.

**Context:** `cancelBooking` mutation in `useBookings.ts:59` currently sets `status='cancelled'` and `cancelled_at`. In v2 it should also call `/functions/v1/issue-refund` when cancelling within the window, and update `bookings.status='cancelled'` only after the refund is initiated (or queued). Schema already ready: `bookings.payment_id` → `payments.provider_payment_id` exists in `0005_payments_provider_agnostic.sql`. Refund contract in `src/types/database.ts` under `EdgeFunctions.IssueRefundRequest`.

**Depends on:** v2 payment layer applied; `issue-refund` Edge Function built.

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

**Depends on:** `create-checkout` Edge Function built + provider-agnostic payment schema applied (`supabase/migrations-v2/0005_payments_provider_agnostic.sql`). No more Stripe-specific code required — adding Frisbii or Vipps later is a pure adapter swap.

---

## Auth — SMS OTP via Twilio (Phase 2)

**What:** Replace (or supplement) email OTP with phone number OTP. User enters their phone number, receives a 6-digit SMS code, verifies it in-sheet. Uses `supabase.auth.signInWithOtp({ phone })` + `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.

**Why:** Phone OTP has higher delivery reliability than email (no spam filters, no inbox searching), and is familiar from banking/e-commerce flows. Better conversion for mobile-first yoga studio students.

**Cons:** Requires a Twilio account, Supabase Phone Auth enabled, and per-SMS cost (~$0.0075/SMS). Not worth setting up until the student base grows beyond 100 active users.

**Context:** Email OTP is live as of 2026-04-23 (`useAuth.sendOtp` / `useAuth.verifyOtp`). The `profiles` table already has a `phone_number TEXT` column (added in `migrations-v2/0002`). Adding SMS OTP is a UI-only change — add a phone input phase to `AuthForm.tsx`, call `signInWithOtp({ phone })`, verify with `type: 'sms'`. No schema changes needed.

**Depends on:** Twilio account + Supabase Phone Auth config. Do not implement until external accounts are provisioned.
