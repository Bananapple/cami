## Context

The manager suite currently has a Home tab that renders nothing useful. The studio owner has no in-app way to see business health — they'd need to cross-reference Supabase, Stripe, and PostHog separately. All the raw data exists in the DB (bookings, payments, memberships, waitlists, studio_members, class_instances); what's missing is the aggregation layer and the traffic signal.

The platform is multi-tenant (one Supabase project, all studios share it). The Home tab must be strictly scoped to the current `studio_id` from `StudioContext`. Admin-only gating is enforced via `studio_members.role`.

## Goals / Non-Goals

**Goals:**
- Owner sees KPI tiles (bookings, cash-in, MRR, net members) with period-to-date + prior-period benchmark
- Period toggle: Week / Month / Year — all metrics recompute on switch
- Unmet demand panel surfacing waitlist pressure by class template
- Booking trend sparkline (12 trailing periods)
- Class fill rate for the selected period
- Traffic panel: visitors, conversion rate, source breakdown via PostHog
- PostHog tracking added to booking confirmation flow
- Dashboard visible only to admin-role studio members

**Non-Goals:**
- Revenue accruals / GAAP accounting (v1 uses cash-in only)
- Per-studio PostHog projects (shared project, segmented by studio_id property)
- Google Search Console / Business Profile integration (future)
- Instagram Insights API (future)
- Custom date range picker (period toggle only)

## Decisions

### D1: Metrics computed client-side vs DB views vs Edge Function

**Decision:** Lightweight Supabase queries from a dedicated `useHomeDashboard` hook, not a new Edge Function or DB view.

**Rationale:** All needed data is already RLS-scoped. The aggregations are simple (SUM, COUNT, GROUP BY date). An Edge Function adds a cold-start latency budget with no benefit here — the Supabase client already handles auth. A DB view would be harder to parameterise by period. A hook with 4-5 targeted queries keeps the pattern consistent with the rest of the codebase (`useSchedule`, `useClientsView`).

**Alternative considered:** Postgres RPC that takes `(studio_id, period_start, period_end)` and returns all metrics in one round-trip. Cleaner network-wise but harder to evolve — any new metric requires a migration. Deferred to v2 if performance is an issue.

### D2: PostHog querying — frontend vs Edge Function proxy

**Decision:** Edge Function `get-analytics` as a proxy to PostHog's Query API.

**Rationale:** PostHog's secret API key (needed for querying) must not reach the browser. The public project API key (`VITE_POSTHOG_KEY`) is safe to expose — it's write-only for event ingestion. The Edge Function accepts `{ studio_id, period }` from the authenticated client, validates the caller is an admin for that studio, then calls PostHog with `POSTHOG_SECRET_KEY`. This is future-proof: if studios ever get their own PostHog projects, only the Edge Function changes.

**Alternative considered:** Query PostHog directly from the browser using the project API key (which has limited read scope). Technically possible but wrong — the secret key has full read access and would need to be in env vars visible to the client bundle.

### D3: Period comparison baseline

**Decision:** Period-to-date vs same elapsed days in the prior period. Prior period's *full* total shown as a secondary "benchmark" figure.

**Rationale:** WTD/MTD/YTD comparisons against the same elapsed time are the honest read of "am I ahead or behind right now." The full prior period total gives context: "I'm at 87 bookings, 12% ahead of last week's pace, and last week finished at 147." Early in a period (e.g., Monday morning) the numbers look small — that's correct, not a bug.

**Alternative considered:** Compare against last full period only. Cleaner but misleading mid-period ("I'm at 20 bookings vs last week's 147" looks like -86% when you're only 6 hours in).

### D4: Admin gating mechanism

**Decision:** Check `studio_members.role === 'admin'` via `useStudioMember` hook in the Home tab component. Show a "not authorised" state (or redirect to Today) if role is not admin.

**Rationale:** `useStudioMember` is already fetched in the manage layout. No new RLS policy needed — the underlying tables are already scoped. This is a UI gate, not a security gate (the individual queries are already RLS-protected). The Edge Function validates admin role server-side before calling PostHog.

### D5: Chart library

**Decision:** No new charting library. Render sparklines as inline SVG paths computed from the data. Render the fill rate as a CSS progress bar.

**Rationale:** The designs call for simple sparklines and a single bar — introducing Recharts or Chart.js for this is a heavyweight dependency. Inline SVG is ~20 lines, zero bundle cost, and fits the existing Tailwind/shadcn aesthetic.

## Risks / Trade-offs

- **PostHog cold data**: PostHog has no events until the snippet is deployed. Traffic panel will show zeros for the first week. → Mitigation: show "No data yet" state with a setup hint, not an error.
- **PostHog free tier limit**: 1M events/month per project, 1 domain. A single yoga studio is nowhere near this. → Acceptable for MVP; revisit at >5 studios.
- **WTD confusion on Monday morning**: All current-period metrics show very small numbers early in the week. → Show the period start date in the toggle so the owner understands the window ("Week of May 6").
- **MRR accuracy**: MRR is computed as SUM of subscription membership prices for active memberships. Does not account for prorated months or mid-period cancellations. → Acceptable for v1; honest label "Active subscription value" avoids implying GAAP MRR.
- **Query count**: `useHomeDashboard` makes 5-6 parallel Supabase queries. Each is simple and indexed. → No concern at current scale; if latency becomes an issue, consolidate into an RPC.

## Migration Plan

1. Add `VITE_POSTHOG_KEY` to Vercel env vars (PostHog project API key)
2. Add `POSTHOG_SECRET_KEY` to Supabase secrets
3. Deploy `get-analytics` Edge Function (`--no-verify-jwt` is NOT needed — it uses standard JWT auth)
4. Deploy frontend with PostHog snippet + HomeView
5. Verify: open Home tab as admin, confirm stat tiles load, confirm PostHog receives a `$pageview` event
6. Rollback: remove Home tab route if critical issue — no DB changes to revert
