## 1. PostHog Setup

- [x] 1.1 Create a PostHog project (free tier) at posthog.com and copy the project API key
- [x] 1.2 Add `VITE_POSTHOG_KEY` to Vercel environment variables (Production scope)
- [x] 1.3 Add `POSTHOG_SECRET_KEY` to Supabase secrets via `supabase secrets set POSTHOG_SECRET_KEY=...`
- [x] 1.4 Install posthog-js: `npm install posthog-js`
- [x] 1.5 Create `src/integrations/posthog.ts` — init PostHog with `VITE_POSTHOG_KEY`, register `studio_id` as a super property, export `posthog` instance and `identifyUser(userId)` helper
- [x] 1.6 Call PostHog init in `main.tsx` (or `App.tsx`) before rendering the React tree; set `studio_id` super property once `StudioContext` resolves

## 2. Booking Event Tracking

- [x] 2.1 In `Index.tsx` (the `?status=success` handler), fire `posthog.capture('booking_completed', { booking_id, class_name, price })` after a successful paid booking redirect
- [x] 2.2 In `BookingSheet.tsx`, fire `posthog.capture('booking_completed', { booking_id, class_name, price: 0 })` immediately after `book_with_credit()` returns successfully (the credit booking path that skips Stripe)

## 3. get-analytics Edge Function

- [x] 3.1 Create `supabase/functions/get-analytics/index.ts` — validate JWT + admin role for the requested `studio_id`; call PostHog's Query API for last-30-day visitors, `booking_completed` event count, and referrer breakdown; return JSON `{ visitors, conversions, conversionRate, sources }`
- [x] 3.2 Deploy `get-analytics` with standard JWT auth (no `--no-verify-jwt` flag needed)
- [ ] 3.3 Smoke-test the function via curl with a valid admin JWT; verify it returns data and rejects non-admin JWTs with 403

## 4. useHomeDashboard Hook

- [x] 4.1 Create `src/manage/hooks/useHomeDashboard.ts` — accepts `period: 'week' | 'month' | 'year'`; computes `periodStart`, `periodEnd` (now), `priorPeriodStart`, `priorPeriodEnd` (same elapsed days last period), and `priorPeriodFullEnd` (end of last full period)
- [x] 4.2 Add query: confirmed bookings count for current period + same-elapsed prior period + prior period full total
- [x] 4.3 Add query: sum of `payments.amount_minor` (status=succeeded) for current period + same-elapsed prior + prior full
- [x] 4.4 Add query: MRR — sum of subscription product prices for active memberships (point-in-time, not period-filtered)
- [x] 4.5 Add query: new `studio_members` rows in period + cancelled memberships in period → net members
- [x] 4.6 Add query: trailing 12 complete periods booking counts for sparkline
- [x] 4.7 Add query: average fill rate (confirmed bookings / max_capacity) for class instances that started in the current period
- [x] 4.8 Add query: unmet demand — expired waitlist offers + waiting entries for past classes in period, grouped by `class_template_id` → return total + bottleneck template name
- [x] 4.9 Add analytics fetch: call `get-analytics` Edge Function and return traffic data (last 30 days, not period-filtered)
- [x] 4.10 Return all values with `isLoading` and `error` fields

## 5. HomeView Component

- [x] 5.1 Create `src/manage/views/HomeView.tsx` — period toggle (segmented control: Week / Month / Year, default Week) using the same pill style as ClassDrawer tabs
- [x] 5.2 Add period label below toggle showing the window start date (e.g. "Week of May 6")
- [x] 5.3 Add KPI tile grid (2×2): Bookings, Cash in, MRR, Net members — each tile shows current period-to-date value, ↑/↓ percentage vs same-elapsed prior period, and prior period full total as secondary figure
- [x] 5.4 Add Unmet demand panel: total unserved count + bottleneck class name + "consider adding a slot" nudge; show "No unmet demand" state when empty
- [x] 5.5 Add booking trend sparkline: inline SVG path from trailing 12 periods data; x-axis labels for first and last period
- [x] 5.6 Add fill rate bar: percentage label + CSS progress bar
- [x] 5.7 Add Traffic panel: visitors count, conversion rate, source breakdown pills (Direct / Search / Instagram / Maps); show "No traffic data yet" state when PostHog has no events
- [x] 5.8 Handle loading state: skeleton tiles while `isLoading` is true
- [x] 5.9 Handle error state: surface errors gracefully, don't crash the whole tab

## 6. Routing & Admin Gating

- [x] 6.1 In the manage layout / router, check `studio_members.role` from `useStudioMember`; if role is `'admin'`, set Home as the default tab; otherwise default to Today
- [x] 6.2 Hide the Home tab link in the nav for non-admin users
- [x] 6.3 Add `/manage` or `/manage/home` route pointing to `HomeView`

## 7. QA & Deploy

- [ ] 7.1 Verify stat tiles load correctly as admin; verify non-admin user does not see Home tab
- [ ] 7.2 Verify period toggle switches all tiles; verify WTD/MTD/YTD comparison values look correct
- [ ] 7.3 Verify `booking_completed` event appears in PostHog after a test booking (paid and credit paths)
- [ ] 7.4 Verify Traffic panel shows "No data yet" on first deploy, then populates after a few page views
- [x] 7.5 Commit all changes and push to deploy to Vercel
