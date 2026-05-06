# Design System — Badges, Chips & Counts

Quick reference for the three labelling primitives used throughout the manager UI.
All live in `src/manage-v2/components/Badge.tsx`; styles in `src/manage-v2/tokens/tokens.css`.

---

## StateBadge

**What it is:** Colored capsule with a leading colored dot. Used exclusively for *state* — something that can change over time (booking status, membership health, payment result).

**Rule:** Never pass raw backend strings to `<StateBadge>`. Always go through a mapping function first (see [Mapping Functions](#mapping-functions) below).

```tsx
import { StateBadge } from "@/manage-v2/components/Badge";

<StateBadge tone="good">Active</StateBadge>
<StateBadge tone="warn">Expiring</StateBadge>
```

### Tones

| Tone | Color | Dot color | When to use |
|------|-------|-----------|-------------|
| `good` | Green text on green-tinted background | Green | Positive, confirmed, active, attended |
| `warn` | Amber text on amber-tinted background | Amber | Needs attention but not broken — low credits, expiring soon, no-show |
| `bad` | Red text on red-tinted background | Red | Broken or failed — payment failed, lapsed, out of credits, refund failed |
| `info` | Blue text on blue-tinted background | Blue | Neutral informational — refunded, expiring (informational notice) |
| `neutral` | Muted text on surface background | Faint | No strong signal — pending, cancelled, no plan, no payment |

---

## CategoryChip

**What it is:** Soft-fill capsule, no border, no dot. Used for *classification* — labelling what something *is*, not what state it's in. Typically used on class rows (type of class, schedule frequency, time of day, level).

```tsx
import { CategoryChip } from "@/manage-v2/components/Badge";

<CategoryChip variant="plan">Monthly</CategoryChip>
<CategoryChip variant="frequency">3× week</CategoryChip>
<CategoryChip variant="time">Morning</CategoryChip>
<CategoryChip variant="level">Beginner</CategoryChip>
<CategoryChip>General</CategoryChip>
```

### Variants

| Variant | Color | Use for |
|---------|-------|---------|
| `default` | Neutral/muted | Uncategorized labels, general tags |
| `plan` | Blue (info palette) | Membership / product type (Monthly, Clip card, Drop-in) |
| `frequency` | Green (good palette) | How often — class schedule frequency |
| `time` | Amber (warn palette) | Time of day (Morning, Evening, Weekend) |
| `level` | Neutral/muted | Skill level (Beginner, All levels, Advanced) |

---

## Count

**What it is:** Bare tabular numeral with an optional label. NOT a pill — no background, no border. Used for stats and numeric summaries (attendance counts, session totals, no-show numbers).

```tsx
import { Count } from "@/manage-v2/components/Badge";

<Count value={12} label="sessions" />
<Count value={2} label="no-shows" tone="warn" />
<Count value={0} label="credits" tone="danger" />
```

### Tones

| Tone | Color | When to use |
|------|-------|-------------|
| `default` | Normal ink | Ordinary counts |
| `warn` | Amber | Count represents a soft warning (low attendance, approaching threshold) |
| `danger` | Red | Count represents a critical state (zero credits, high no-shows) |

---

## Mapping Functions

These are the single source of truth for converting backend data → badge config. Call them; don't hardcode `tone`/`label` inline.

### Booking status → `StateBadge`

**File:** `src/manage-v2/lib/bookingStatus.ts`

```tsx
import { bookingBadge } from "@/manage-v2/lib/bookingStatus";

const { tone, label } = bookingBadge(bookingRow);
<StateBadge tone={tone}>{label}</StateBadge>
```

`bookingBadge()` takes a full booking row and returns the right badge in one call. Internally it runs `deriveBookingStatus()` to convert raw DB status + context into a richer derived state.

#### Derived status table (all 15 states)

| Derived state | Tone | Label | When |
|--------------|------|-------|------|
| `booked` | `good` | Booked | Confirmed, future, not checked in |
| `attended` | `good` | Attended | Confirmed + `checked_in_at` set |
| `no_show_derived` | `warn` | No-show | Confirmed, past, no check-in |
| `pending` | `neutral` | Pending | Payment not yet confirmed |
| `payment_failed` | `warn` | Payment failed | Stripe/provider failure |
| `credit_returned` | `neutral` | Credit returned | Cancelled within window, credit booking |
| `credit_no_return` | `neutral` | No credit | Cancelled outside window, credit booking |
| `no_payment` | `neutral` | No payment | Cancelled, no payment record |
| `refunded` | `info` | Refunded | Cancelled, payment fully refunded |
| `partial_refund` | `warn` | Partial refund | Cancelled, partial refund only |
| `refund_failed` | `bad` | Refund failed | Cancelled within window, refund failed |
| `no_refund_after_window` | `neutral` | No refund | Cancelled outside 24-hour window |
| `completed` | `good` | Attended | Raw DB `completed` status (legacy) |
| `cancelled` | `neutral` | Cancelled | Raw DB `cancelled` (fallback) |
| `no_show` | `bad` | No-show | Raw DB `no_show` (fallback) |

### Membership health → `StateBadge`

**File:** `src/manage-v2/lib/planHealth.ts`

```tsx
import { getPlanHealth } from "@/manage-v2/lib/planHealth";

const { tone, label } = getPlanHealth(memberSummaryRow);
<StateBadge tone={tone}>{label}</StateBadge>
```

#### Plan health table

| Condition | Tone | Label |
|-----------|------|-------|
| No membership | `neutral` | No plan |
| Active subscription or clip card | `good` | Active |
| Clip card, 1–3 credits left | `warn` | Low credits |
| Clip card, 0 credits | `bad` | Out of credits |
| Membership expiring within 14 days | `info` | Expiring |
| Membership expired | `bad` | Lapsed |
| Member on leave | `neutral` | On leave |

---

## Quick decision guide

> **Is this a state** (something that changes, passes/fails, is active/inactive)?
> → Use `StateBadge` + a mapping function.

> **Is this a classification** (what type/category something belongs to)?
> → Use `CategoryChip` with the right variant.

> **Is this a number** being called out in a stats row?
> → Use `Count`, not a badge.

> **Am I passing a raw backend string directly to a badge?**
> → Stop. Route through `bookingBadge()` or `getPlanHealth()` first.
