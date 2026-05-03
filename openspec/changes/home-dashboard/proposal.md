## Why

Studio owners and managers have no single place to see how the business is performing — revenue, bookings, membership trends, class demand, and website traffic all live in separate systems or not at all. The Home tab is currently empty; this change turns it into the owner's daily business health view.

## What Changes

- **New Home tab** in the manager suite (`/manage`) showing business health metrics for the current studio
- **Period toggle** (Week / Month / Year, default: Week) using a segmented control; all metrics show period-to-date values with a comparison to the same elapsed time last period (WTD vs WTD, MTD vs MTD, YTD vs YTD), plus the full prior period total as a benchmark target
- **Stat tiles**: Bookings (count), Cash in (sum of succeeded payments), MRR (active subscription value), Net members (new minus churned)
- **Unmet demand panel**: waitlist pressure summary — how many students couldn't get into a class this period, and which class template is the bottleneck
- **Booking trend chart**: sparkline of bookings over the last 12 periods (weeks/months)
- **Class fill rate**: average fill % across all class instances in the period
- **Traffic panel**: visitor count, booking conversion rate, and source breakdown (Direct / Search / Instagram / Maps) via PostHog
- **PostHog integration**: `posthog-js` added to the frontend for page view and booking event tracking; `get-analytics` Edge Function queries PostHog's API server-side so the secret key never reaches the browser
- **Admin-only gating**: Home tab visible only to users with `role = 'admin'` in `studio_members`; regular instructors see the Today tab as their default

## Capabilities

### New Capabilities

- `business-metrics`: KPI tiles (bookings, cash-in, MRR, net members) with period-to-date + prior-period-total display
- `unmet-demand`: Waitlist pressure analysis — unserved students count + bottleneck class identification
- `booking-trend`: Sparkline chart of booking volume over trailing 12 periods
- `traffic-analytics`: PostHog-backed visitor + conversion + source breakdown panel; Edge Function proxy for secure API access

### Modified Capabilities

- `booking-flow`: `booking_completed` PostHog event must be fired on successful booking (both paid and credit paths)

## Impact

- `src/manage/views/HomeView.tsx` — new view (currently empty or placeholder)
- `src/manage/` routing — Home tab shown only when `studio_members.role = 'admin'`
- `supabase/functions/get-analytics/` — new Edge Function, PostHog Query API proxy
- `index.html` — PostHog JS snippet added
- `src/integrations/posthog.ts` — PostHog init + helper for `studio_id` super property
- `BookingSheet.tsx` / payment success handler — fire `booking_completed` event
- Supabase secrets: `POSTHOG_SECRET_KEY`
- New env var: `VITE_POSTHOG_KEY` (public project API key, safe to expose)
- No DB schema changes required — all metrics computed from existing tables (`bookings`, `payments`, `memberships`, `studio_members`, `waitlists`, `class_instances`)
