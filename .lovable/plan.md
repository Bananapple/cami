

# Booking Sheet Flow — Full Stack Implementation Plan

## Summary
Build a complete booking flow: BookingSheet component (steps 1-5), Supabase backend (auth, sessions, bookings, profiles), Stripe payments, and a user Dashboard page. Entry points added across the site.

## Prerequisites (before any code)
1. **Enable Lovable Cloud** (Supabase) — needed for auth, database tables, and RLS
2. **Enable Stripe** — needed for payment processing

These must be done first as they unlock additional tools and configuration.

## Phase 1: Database & Backend Setup

### Supabase Migrations
Create tables with RLS:
- `profiles` (extends auth.users — id, email, full_name, avatar_initials, billing_address JSONB, level, total_sessions, referrals)
- `sessions` (class_name, practitioner_name, practitioner_initials, time, duration, level, location, price)
- `bookings` (user_id, session_id, session_date, status, payment_method_last4, amount_paid)
- `payment_methods` (user_id, stripe_payment_method_id, brand, last4, expiry_month, expiry_year, is_default)
- `memberships` (user_id, plan_name, status, renewal_days, credits_remaining, valid_until, stripe_subscription_id)

RLS policies: users see only their own data; sessions are public. Profile auto-creation trigger on signup.

Seed `sessions` table with 6 demo classes (Vinyasa Flow, Breathwork, Power Yoga, Yin Yoga, Hot Yoga, Evening Flow).

## Phase 2: Hooks & Auth

### New files
| File | Purpose |
|------|---------|
| `src/hooks/useAuth.ts` | signIn, signUp, signOut, session state via `onAuthStateChange` |
| `src/hooks/useProfile.ts` | Profile CRUD with React Query |
| `src/hooks/useSessions.ts` | Fetch sessions from Supabase |
| `src/hooks/useBookings.ts` | Create/cancel bookings, list upcoming |
| `src/hooks/usePaymentMethods.ts` | List/add/remove saved cards |
| `src/hooks/useMembership.ts` | Membership status |

## Phase 3: BookingSheet Component

### `src/components/BookingSheet.tsx`
Full-screen right Sheet with multi-step state: `1 | 2 | 3 | 4a | 4b | 4c | 5`

### Sub-components in `src/components/booking/`
| Component | Step | Description |
|-----------|------|-------------|
| `DateStrip.tsx` | 1 | Horizontal scrollable date pills (today + 8 days), snap scroll |
| `SessionList.tsx` | 1-2 | Session rows: time, avatar circle with initials, class name, location, arrow |
| `OrderSummary.tsx` | 3-4 | Left panel (cream bg): plan card, session details, total price |
| `BillingForm.tsx` | 3 | Address, city, postal code, country dropdown |
| `AuthForm.tsx` | 4a | Email/password login + signup toggle, Google/Apple social buttons |
| `PaymentSelector.tsx` | 4b | Saved cards list + "Add new card" |
| `StripeCardForm.tsx` | 4c | Stripe Elements card input (PCI compliant) |
| `ConfirmationView.tsx` | 5 | Success checkmark, session summary, "View My Sessions" CTA |

### Flow logic
- Steps 1-2: single column (full width)
- Steps 3-4: split layout on desktop (cream order summary left, form right), stacked on mobile
- Step 4a shown if not authenticated; skip to 4b if logged in
- Step 5: auto-redirect to `/dashboard` after 3s or on click

## Phase 4: Dashboard Page

### `src/pages/Dashboard.tsx`
Two-column Rocycle-style layout:
- **Left sidebar** (cream bg, ~300px): avatar with initials, greeting, edit profile link, manage cards, stats (level, sessions, referrals), logout
- **Main content**: upcoming sessions list with cancel option, "Book a Session" CTA, membership card, class packs section

### Route: `/dashboard` (added to App.tsx)

## Phase 5: Integration Points

### Modified files
| File | Changes |
|------|---------|
| `src/components/Header.tsx` | Add "Book a Session" button alongside "Start Free Trial"; show user avatar + dropdown when logged in |
| `src/pages/Programs.tsx` | Add "Book a Session" button on page |
| `src/pages/Index.tsx` | Hero and CTA buttons open BookingSheet |
| `src/pages/JoinNow.tsx` | Plan cards can also trigger BookingSheet |
| `src/App.tsx` | Add `/dashboard` route, auth-aware routing |

## Phase 6: Stripe Payment Flow
- Edge function for creating payment intents ($30 drop-in)
- Stripe Elements integration in `StripeCardForm.tsx`
- Save cards to Stripe customer for future use
- Edge function for creating/attaching payment methods

## Styling
- Cream background (`bg-background`) for order summary panels
- White background for form panels
- Editorial typography: script "Your" + bold "ORDER"
- Uppercase `tracking-wider` labels throughout
- Bordered "TODAY" date pill, avatar circles with colored backgrounds
- Consistent with existing VitalPath/Thrive theme

## Implementation Order
1. Enable Lovable Cloud + Stripe (prerequisites)
2. Create database migrations + seed data
3. Build hooks (useAuth, useProfile, useSessions, useBookings)
4. Build BookingSheet + sub-components (steps 1-5)
5. Build Dashboard page
6. Wire up Stripe payment flow
7. Add entry points across the site (Header, Programs, Index, JoinNow)
8. Test end-to-end

