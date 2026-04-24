# Multi-Tenant Migration Plan

**Status**: Partially implemented (2026-04-23/24). Edge Functions built; v2 migrations staged but not yet applied to production.
**Scope**: Pivot from one-Supabase-project-per-studio to a single multi-tenant project. Addresses tenancy, recurrence engine, waitlist reservation windows, and Stripe security.

---

## 0. Orientation

### Why we're doing this
The per-project model blocks every feature that needs cross-studio context: CRM rollups, platform-wide referrals, multi-location ownership, consolidated billing. It also means schema drift as the list of studios grows. One project, `studio_id` everywhere, strict RLS.

### What's at stake
- **Data isolation**: a bug in RLS lets one studio see another studio's members. This must be treated as a P0 security boundary. We defend in depth: RLS + explicit WHERE clauses + route-scoped studio context.
- **Branding/routing**: the app must know "which studio am I?" before it does anything. Subdomain (`yogabrie.brie.app`) or path prefix (`brie.app/s/yogabrie`). The app resolves slug → studio_id on load.
- **Existing YogaBrie project**: the first studio is already live. Migration must preserve their data and not cause downtime.

### Migration philosophy
- Phased, not big-bang. Each phase ships independently and is reversible until the next phase depends on it.
- New tables live alongside old ones during transition; cutover happens per feature.
- The schema in `migrations-v2/` is the *target*. Porting YogaBrie data is a separate backfill script.

### Phase order
| Phase | What | Status |
|---|---|---|
| 0 | Kill the insecure card form; replace with hosted Stripe Checkout redirect | ✅ Done |
| 1 | Create `studios`, `studio_members`, helper functions | Staged in `0001_core_tenancy.sql` |
| 2 | Add `studio_id` to existing tenanted tables; backfill; rewrite RLS | Staged in `0002_backfill_and_rls.sql` |
| 3 | Recurrence engine tables; migrate `sessions` → `class_templates` + `schedule_rules` | Staged in `0003_recurrence_engine.sql` |
| 4 | Waitlist with reservation window + pg_cron expiry job | Staged in `0004_waitlists.sql` |
| 5 | Provider-agnostic payment layer + Edge Functions | Staged + Edge Functions ✅ built |
| 6+ | Feature work (CRM, referrals, waivers, etc.) on the new foundation | Pending migration cutover |

---

## 1. Multi-Tenancy

### Tenant model

```
studios (root tenant)
  └── studio_members (user ↔ studio, with role)
        ├── role: owner | manager | instructor | member
        ├── per-studio state: total_sessions, level, referral_code
        └── is_active (soft-leave without losing history)

profiles (global PII, one per auth.users)
  ├── email, full_name, phone_number
  └── global preferences (marketing opt-ins)
```

**Key decision**: `profiles` is global (one row per `auth.users`). Per-studio state (session count, level, referral code, billing address) moves to `studio_members`. A single user can belong to multiple studios without leaking data between them.

### Roles
- `owner` — full control over a studio (billing, staff, config)
- `manager` — can manage schedule, members, bookings; cannot change billing
- `instructor` — can view their own classes + mark attendance; cannot see other instructors' rosters
- `member` — normal student

### RLS strategy

Three helper functions power every policy:

```sql
-- Returns studios the current user belongs to (any role, active)
CREATE FUNCTION user_studio_ids() RETURNS SETOF UUID ...

-- Checks role in a specific studio
CREATE FUNCTION user_has_role(_studio_id UUID, _roles studio_role[]) RETURNS BOOLEAN ...

-- Convenience: am I staff (owner/manager/instructor) in this studio?
CREATE FUNCTION user_is_staff(_studio_id UUID) RETURNS BOOLEAN ...
```

All three are `SECURITY DEFINER STABLE` with `search_path = public` locked to prevent search-path privilege escalation (same guarantee the existing `trg_increment_sessions` trigger uses).

**Policy pattern** for every tenanted table:

```sql
-- Members see their own rows within their studios
CREATE POLICY "self_read" ON bookings FOR SELECT
  USING (user_id = auth.uid() AND studio_id IN (SELECT user_studio_ids()));

-- Staff see all rows for their studio
CREATE POLICY "staff_read" ON bookings FOR SELECT
  USING (user_is_staff(studio_id));

-- Members can only create bookings for themselves, in studios they belong to
CREATE POLICY "self_insert" ON bookings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND studio_id IN (SELECT user_studio_ids())
  );
```

**Public read** (for unauthenticated browsing of `studios` branding and `class_instances`):
```sql
CREATE POLICY "public_studios_read" ON studios FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "public_schedule_read" ON class_instances FOR SELECT TO anon, authenticated
  USING (status = 'scheduled');
```
Class instances are not sensitive (they're the public class schedule). Bookings, waitlists, payment_methods, memberships — strictly gated.

### Defense in depth
- **RLS** is the primary boundary. Never trust the client to filter by `studio_id`.
- **Explicit WHERE clauses** in every query still include `studio_id` (belt-and-suspenders; protects against policy bugs).
- **Current-studio context** in the React app (`StudioContext`) provides the UUID for query filters, resolved from the URL on load.
- **Integration tests** with two seeded studios that verify User A in Studio 1 cannot see any row owned by Studio 2.

---

## 2. Recurrence Engine

### The problem with `day_of_week INTEGER[]`
Current schema ties a yoga class to a set of weekdays. It cannot express:
- "Cancel Tuesday 9am on Dec 30 only" (a specific occurrence)
- "Sub instructor on May 5" (partial exception)
- "This series runs Jan–June only" (bounded recurrence)
- "No classes on Dec 25" (holiday)
- Past vs future schedule differences (bookings for old schedule shouldn't disappear when you change times)

### Three-layer model

```
class_templates   — what the class IS (name, duration, level, description)
schedule_rules    — recurring pattern (one rule = one weekday slot with a run window)
schedule_exceptions — deviations for specific dates (cancel / reschedule / sub)
class_instances   — materialized, concrete occurrences (starts_at, ends_at, instructor, location)
```

**Why materialize `class_instances`?**
- Bookings need a stable FK that survives rule edits (if you change Tuesday 9am to 9:30 next month, last month's bookings still point to the 9am instance).
- Capacity checks, conflict detection, and the booking UI all query one concrete table.
- Postgres exclusion constraints can enforce "no double-booked instructor/room" at the DB level.

A scheduled job (pg_cron, daily) materializes instances for a rolling 90-day window from `schedule_rules` minus `schedule_exceptions`. Manual edits to a specific instance update that instance directly.

### Recurrence rules

Each `schedule_rules` row = one weekday slot. A class that runs Mon/Wed/Fri is three rows. This is less compact than the current `INTEGER[]` but lets each weekday have its own instructor, room, start time, and effective dates.

| Column | Type | Notes |
|---|---|---|
| `template_id` | UUID | FK to `class_templates` |
| `location_id` | UUID | FK to `locations` (was `location TEXT`) |
| `instructor_id` | UUID | FK to `instructors` |
| `day_of_week` | INT (0–6) | One rule per day |
| `start_time` | TIME | Stored in studio-local time |
| `duration_minutes` | INT | Override template default |
| `price` | NUMERIC(10,2) | Override template default |
| `max_capacity` | INT | Override location/template default |
| `effective_from` | DATE | When this rule starts applying |
| `effective_until` | DATE NULL | NULL = indefinite |

### Exceptions

Four kinds:
- `cancel` — that date, no class
- `reschedule` — same class, different time
- `sub_instructor` — different instructor
- `relocate` — different room/branch

Exceptions resolve against a specific `(rule_id, exception_date)`. The materializer applies them when generating `class_instances`.

### Conflict detection

Instructor and room double-booking is enforced at the database level using Postgres `tstzrange` exclusion constraints:

```sql
ALTER TABLE class_instances ADD CONSTRAINT instructor_no_overlap
  EXCLUDE USING GIST (instructor_id WITH =, time_range WITH &&)
  WHERE (status = 'scheduled');

ALTER TABLE class_instances ADD CONSTRAINT location_no_overlap
  EXCLUDE USING GIST (location_id WITH =, time_range WITH &&)
  WHERE (status = 'scheduled');
```

Requires the `btree_gist` extension. Attempting to INSERT an instance that overlaps an existing scheduled instance for the same instructor or location fails with `exclusion_violation`. The UI surfaces the conflict to the manager.

### Materializer function

A SQL function `materialize_class_instances(_studio_id UUID, _from DATE, _to DATE)` that:
1. Iterates every active `schedule_rules` row for the studio
2. For each date in `[_from, _to]` where `day_of_week` matches and date falls in `[effective_from, effective_until]`
3. Looks up any `schedule_exceptions` for `(rule_id, date)`
4. If not cancelled, UPSERTs a `class_instances` row

Runs daily via pg_cron. Also triggered when a rule is created/updated.

---

## 3. Waitlist with Reservation Window

### Flow

```
User tries to book full class
  ↓
Insert waitlists row (status='waiting', joined_at=now())
  ↓
Someone cancels
  ↓
Expiry/offer job picks first user ORDER BY joined_at
  ↓
status='offered', offer_expires_at = now() + waitlist_offer_window_minutes
  ↓
Send notification (email/SMS via Edge Function)
  ↓
┌── User accepts within window → status='accepted' → creates booking → refunds to capacity
│
└── Window expires → status='expired' → job moves to next user in line
```

### Schema

```sql
CREATE TYPE waitlist_status AS ENUM (
  'waiting',   -- in queue, no offer yet
  'offered',   -- spot offered, awaiting acceptance
  'accepted',  -- user accepted, booking created
  'expired',   -- offer window passed without acceptance
  'cancelled'  -- user left waitlist voluntarily
);

CREATE TABLE waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  -- Only one active (waiting/offered/accepted) entry per (class, user)
  CONSTRAINT waitlist_unique_active
    EXCLUDE (class_instance_id WITH =, user_id WITH =)
    WHERE (status IN ('waiting', 'offered', 'accepted'))
);

CREATE INDEX idx_waitlist_queue
  ON waitlists (class_instance_id, status, joined_at)
  WHERE status = 'waiting';

CREATE INDEX idx_waitlist_offer_expiry
  ON waitlists (offer_expires_at)
  WHERE status = 'offered';
```

### The "hold" — how we lock capacity

A class instance has three competing numbers:
- `max_capacity` (seat count)
- confirmed `bookings` count
- `offered` waitlist entries (outstanding offers — each one is effectively holding a seat)

The effective available count is:
```
available = max_capacity
          - (count of bookings WHERE status='confirmed')
          - (count of waitlists WHERE status='offered' AND offer_expires_at > now())
```

When `available = 0`, no new booking inserts. When a cancellation fires the offer, that outstanding offer *is* the lock — the frontend sees `available=0` because the offered seat is still held.

For performance, `class_instances` carries denormalized `booked_count` and `waitlist_offered_count`, maintained by triggers:
- Trigger on `bookings` INSERT/UPDATE/DELETE → bump/decrement `booked_count`
- Trigger on `waitlists` UPDATE → bump/decrement `waitlist_offered_count` when status transitions

### Offer picker function

```sql
CREATE FUNCTION offer_next_waitlist_spot(_class_instance_id UUID)
RETURNS UUID AS $$
DECLARE
  _studio_id UUID;
  _offer_window_min INT;
  _next_id UUID;
BEGIN
  SELECT ci.studio_id, s.waitlist_offer_window_minutes
    INTO _studio_id, _offer_window_min
    FROM class_instances ci
    JOIN studios s ON s.id = ci.studio_id
   WHERE ci.id = _class_instance_id;

  -- Lock the first waiting user atomically
  UPDATE waitlists
     SET status = 'offered',
         offered_at = now(),
         offer_expires_at = now() + (_offer_window_min || ' minutes')::INTERVAL
   WHERE id = (
     SELECT id FROM waitlists
      WHERE class_instance_id = _class_instance_id
        AND status = 'waiting'
      ORDER BY joined_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id INTO _next_id;

  RETURN _next_id; -- Edge Function uses this to send the notification
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

`FOR UPDATE SKIP LOCKED` prevents two concurrent expiry/cancel events from offering the same spot twice.

### Expiry sweeper

Runs every minute via pg_cron:

```sql
CREATE FUNCTION expire_stale_offers() RETURNS INT AS $$
DECLARE
  _expired RECORD;
  _count INT := 0;
BEGIN
  FOR _expired IN
    UPDATE waitlists
       SET status = 'expired', resolved_at = now()
     WHERE status = 'offered'
       AND offer_expires_at < now()
     RETURNING class_instance_id
  LOOP
    -- Immediately offer to next in line
    PERFORM offer_next_waitlist_spot(_expired.class_instance_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END; $$ LANGUAGE plpgsql;

SELECT cron.schedule('waitlist-expire', '* * * * *', $$SELECT expire_stale_offers()$$);
```

### Kickoff on cancellation

A trigger on `bookings` status change to `cancelled`:
```sql
CREATE FUNCTION trg_booking_cancelled_offer_waitlist() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    PERFORM offer_next_waitlist_spot(NEW.class_instance_id);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

### Notification dispatch
The `offer_next_waitlist_spot` function writes the row. A separate Edge Function (triggered by a realtime subscription on `waitlists` UPDATE, or by the caller directly) sends the email/SMS using the existing notification infra.

### User acceptance flow
Frontend hits `POST /functions/v1/accept-waitlist-offer`:
1. Edge Function verifies the offer is still valid (status='offered' AND offer_expires_at > now())
2. Creates booking row (handles payment)
3. Updates waitlist row to status='accepted', resolved_at=now()
4. Returns booking confirmation

All in a single transaction. If payment fails, nothing changes and the offer remains live.

---

## 4. Provider-Agnostic Payment Layer

### Design principle
The database knows nothing about Stripe, Frisbii, or Vipps specifically. It stores a canonical `payments` record with a `provider` enum and opaque `provider_session_id` / `provider_payment_id` columns. All provider-specific behaviour lives in Edge Function adapters behind a single `PaymentProviderAdapter` interface.

**MVP provider**: Stripe Checkout (hosted page — PCI-compliant, no Elements work needed).
**Next**: Frisbii (Brie already uses it for their existing business).
**Future**: Vipps (Norwegian market fit).

Adding a provider: implement the adapter interface + add a value to the `payment_provider` enum. No schema changes.

### Why not just use Stripe directly
Every `stripe_*` column in the schema is a line of code that has to be rewritten when Frisbii comes online. The cost of the abstraction is one extra table (`payments`) and one enum column (`provider`). The cost of *not* abstracting is painful in three months.

### Schema shape

```
┌──────────────────────────┐
│ studio_payment_providers │  ← which providers each studio has enrolled
├──────────────────────────┤
│ studio_id                │
│ provider                 │  (stripe | frisbii | vipps)
│ provider_account_id      │  (acct_xxx | merchant id | MSN)
│ is_primary               │  exactly one primary per studio
│ onboarded_at, config     │
└──────────────────────────┘

┌─────────────┐      ┌──────────────────────┐
│  bookings   │─────▶│      payments        │  ← canonical payment record
├─────────────┤      ├──────────────────────┤
│ payment_id  │      │ provider             │
│ status      │      │ provider_session_id  │  (cs_xxx / Frisbii session)
└─────────────┘      │ provider_payment_id  │  (pi_xxx / Frisbii payment)
                     │ status               │  (requires_action|processing|
                     │ amount, currency     │    succeeded|failed|refunded|…)
                     │ checkout_url         │
                     │ refunded_amount      │
                     └──────────────────────┘
                                │
                                │  indexed by (provider, provider_session_id)
                                ▼
                     ┌──────────────────────────┐
                     │ payment_webhook_events   │  ← idempotent event log
                     ├──────────────────────────┤
                     │ provider                 │
                     │ provider_event_id        │  UNIQUE — dedupe
                     │ event_type, payload      │
                     │ processed_at, error      │
                     └──────────────────────────┘
```

### Booking flow (Stripe Checkout — MVP)

```
┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────┐
│ Browser  │   │ Edge Func    │   │ Provider   │   │ Postgres │
│          │   │ create-      │   │ (Stripe)   │   │          │
│          │   │ checkout     │   │            │   │          │
├──────────┤   ├──────────────┤   ├────────────┤   ├──────────┤
│click book├──▶│validate,     │                   │          │
│          │   │resolve       ├──────────────────▶│INSERT    │
│          │   │provider      │                   │payments  │
│          │   │              │                   │(req_act) │
│          │   │get adapter   │                   │          │
│          │   │(stripe)      ├──▶create         │          │
│          │   │              │   Checkout       │          │
│          │   │              │◀──session+url    │          │
│          │   │              ├──────────────────▶│UPDATE    │
│          │   │              │                   │payments  │
│          │   │              │                   │+session  │
│          │   │              │                   │+booking  │
│          │◀──│checkout_url  │                   │(pending) │
│redirect  │                                                   │
│to Stripe │                                                   │
│...pays...│                                                   │
│          │           ┌──────────────┐                       │
│          │           │ stripe sends │                       │
│          │           │ webhook      │                       │
│          │           ├──────────────┤                       │
│          │           │payment-      │                       │
│          │           │webhook/:prov │                       │
│          │           │              │                       │
│          │           │adapter.parse │                       │
│          │           │+verify sig   │                       │
│          │           │              │──────────────────────▶│dedupe via
│          │           │              │                       │webhook_events
│          │           │              │──────────────────────▶│UPDATE
│          │           │              │                       │payments →
│          │           │              │                       │succeeded
│          │           │              │──────────────────────▶│UPDATE
│          │           │              │                       │booking →
│          │           │              │                       │confirmed
│return to │                                                   │
│our site  │                                                   │
└──────────┘                                                   │
```

### Three Edge Functions (all provider-neutral contracts)

**`create-checkout`** — initiate a payment
- Auth: Supabase JWT
- Input: `{ class_instance_id, return_url? }`
- Looks up class price server-side (never trusts client)
- Resolves studio's primary provider via `studio_primary_provider()`
- Creates `payments` row (`status='requires_action'`, `provider` set)
- Calls adapter's `createCheckoutSession()` with the studio's merchant id
- Updates `payments` row with `provider_session_id` + `checkout_url`
- Inserts `booking` with `status='pending'` + `payment_id`
- Returns `{ checkout_url, payment_id, booking_id }`

**`payment-webhook/:provider`** — async confirmation
- No auth header; adapter verifies signature
- Parses provider's webhook into `CanonicalWebhookEvent` (shared shape)
- Dedupes against `payment_webhook_events (provider, provider_event_id)`
- On `payment.succeeded`: `payments.status='succeeded'`, booking → `confirmed`
- On `payment.failed` / `payment.cancelled`: booking → `payment_failed`
- On `payment.refunded` / `payment.partially_refunded`: updates `refunded_amount`

**`issue-refund`** — staff-only refund
- Auth: Supabase JWT, staff role enforced
- Input: `{ payment_id, amount?, reason? }`
- Looks up `payments.provider`, calls adapter's `issueRefund()`
- Updates `payments.refunded_amount` and `provider_refund_id`

### The adapter interface

```typescript
// supabase/functions/_shared/providers/types.ts
interface PaymentProviderAdapter {
  readonly name: 'stripe' | 'frisbii' | 'vipps';

  createCheckoutSession(p: CreateCheckoutParams): Promise<{
    provider_session_id: string;
    checkout_url: string;
  }>;

  parseWebhookEvent(payload: string, signature: string): Promise<CanonicalWebhookEvent>;

  issueRefund(p: { provider_payment_id: string; amount?: number }): Promise<{
    provider_refund_id: string;
    refunded_amount: number;
  }>;
}
```

File layout:
```
supabase/functions/
  _shared/
    providers/
      types.ts              ← the adapter interface (also exported from src/types/database.ts)
      index.ts              ← getProvider(name) → adapter
      stripe.ts             ← MVP
      frisbii.ts            ← Phase 5.5
      vipps.ts              ← Phase 6+
  create-checkout/index.ts  ← uses getProvider(studio.primary_provider)
  payment-webhook/index.ts  ← route param `:provider`, uses getProvider(provider)
  issue-refund/index.ts
```

### Secrets management
Each provider has its own set of secrets in Supabase Edge Function env:
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
FRISBII_API_KEY
FRISBII_WEBHOOK_SECRET
VIPPS_CLIENT_ID
VIPPS_CLIENT_SECRET
VIPPS_SUBSCRIPTION_KEY
```
Never in frontend. Never in database. Never in git. Managed via `supabase secrets set`.

### Data that is NOT in the database
- Raw card numbers, CVCs, expiry dates typed by users
- Provider API keys or webhook secrets
- Anything returned by a provider that isn't one of: tokenized IDs, non-sensitive metadata (brand/last4), status values

### Row-level safety
- `payments` — authenticated users see their own rows; staff see studio-wide; only service role (Edge Functions) writes
- `payment_webhook_events` — no authenticated-user policies; service role only
- `bookings.status='confirmed'` — user INSERTs can only create `status='pending'`; promotion happens via webhook

### Why Stripe Checkout (not Elements) for MVP
- Fully hosted; PCI-compliant with zero frontend card handling
- ~1 day to integrate vs ~1 week for Elements + SetupIntent + PaymentIntent
- Same adapter interface means swapping to Elements later is purely an adapter change — schema stays identical
- Frisbii integration on day one is much easier with a checkout-style flow (it matches Frisbii's hosted model too)

---

## 5. Migration Execution Order

### YogaBrie (the one live studio) cutover

The existing YogaBrie project at `xskqpxfjhhxontirezjd.supabase.co` becomes the multi-tenant platform project. Alternative: provision a fresh project and migrate data. Either works; keeping the existing project is simpler.

1. Pause writes (brief maintenance window) — under 15 minutes if data is small
2. Apply `0001_core_tenancy.sql`
3. Run backfill: insert the YogaBrie studio row, create `studio_members` from existing `profiles`
4. Apply `0002_backfill_and_rls.sql` (adds `studio_id` to all tables, backfills to YogaBrie's ID, enables NOT NULL)
5. Apply `0003_recurrence_engine.sql`
6. Run recurrence backfill: convert `sessions` rows to `class_templates` + `schedule_rules` (one rule per day in the old `day_of_week` array); materialize 90 days of `class_instances`; rewrite `bookings.session_id` → `bookings.class_instance_id`
7. Apply `0004_waitlists.sql`
8. Apply `0005_payments_provider_agnostic.sql`
9. Deploy Edge Functions (`create-checkout`, `payment-webhook`, `issue-refund`) + set Supabase secrets
10. Unpause writes
11. Retire `scripts/new-studio.sh` (no more per-studio project creation — studios are rows now)
12. Update `CLAUDE.md` to reflect the new architecture

### Adding new studios post-migration
```
POST /functions/v1/create-studio
  → inserts studios row
  → creates initial owner via studio_members
  → initiates Stripe Connect onboarding
  → returns subdomain/slug for the new studio
```
No more Supabase project provisioning. No more per-studio env files.

### Backwards compatibility
The old `sessions` table stays for one migration window, then is dropped in a follow-up migration (`0006_drop_legacy_sessions.sql`). The old `studio_config` table is kept read-only during transition, eventually dropped.

---

## 6. Testing & Verification

### Required test coverage before cutover
- **Tenant isolation tests** (Vitest + Supabase test project): seed two studios, confirm user in Studio A cannot SELECT/INSERT/UPDATE/DELETE any row in Studio B. Test for all ten tenanted tables.
- **Recurrence tests**: assert that a rule with weekday=2, effective_from=2026-05-01, effective_until=2026-06-30 materializes the correct Tuesdays. Assert exceptions suppress/modify correctly.
- **Conflict tests**: attempt to double-book an instructor — expect `exclusion_violation`. Same for a room.
- **Waitlist tests**: simulate concurrent cancellations with `pg_notify` / parallel transactions; assert only one user is offered a spot. Assert expiry sweeper promotes next-in-line correctly.
- **Stripe tests**: use Stripe test mode; verify webhook signature validation rejects unsigned payloads; verify a failed PaymentIntent does not leave a confirmed booking.

### Rollback plan per phase
- Phase 1 is purely additive (new tables, no changes to existing ones) — rollback = drop new tables.
- Phase 2 keeps old RLS policies until new ones are verified. Rollback = re-enable old policies, drop `studio_id` column.
- Phase 3 keeps `sessions` table intact during transition. Rollback = revert booking FKs, keep both tables.
- Phase 4–5 are fully additive.

---

## 7. What This Doesn't Solve

Deliberate scope exclusions — these remain open:

- **Timezone handling** still carried in `TODOS.md`. Addressed partially (studios have timezone), but full DST-correct scheduling is a separate workstream.
- **CRM / notification engine** (email/SMS dispatch, automated sequences) — schema references it but Edge Function build is Phase 6+.
- **Referral reward mechanics** — schema for `referral_code` is in place via `studio_members`, but reward issuance logic is future work.
- **Legacy migration for studios that don't yet exist** — the current `scripts/new-studio.sh` pattern is retired. If more studios were provisioned on the old model before cutover, each needs a data migration on the same timeline. Budget for that explicitly.

---

## 8. Files in this proposal

```
supabase/migrations-v2/
  0001_core_tenancy.sql                  — studios, studio_members, helper fns
  0002_backfill_and_rls.sql              — add studio_id, rewrite RLS on existing tables
  0003_recurrence_engine.sql             — templates, rules, exceptions, instances
  0004_waitlists.sql                     — reservation window + pg_cron sweeper
  0005_payments_provider_agnostic.sql    — studio_payment_providers, payments, webhook log

src/types/database.ts             — TypeScript handshake for new schema

docs/MIGRATION-MULTITENANT.md     — this document
```

These are design artifacts, not applied migrations. Copy to `supabase/migrations/` only when ready to execute and after verifying backfill scripts are prepared.
