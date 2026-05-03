## ADDED Requirements

### Requirement: PostHog script tracks page views automatically
The application SHALL include the PostHog JavaScript snippet initialised with `VITE_POSTHOG_KEY` and `studio_id` set as a super property on every event. Page views SHALL be captured automatically.

#### Scenario: Page view tracked on navigation
- **WHEN** any user (logged in or not) navigates to any page of the studio site
- **THEN** PostHog receives a `$pageview` event with `studio_id` as a property

#### Scenario: studio_id super property set before any event
- **WHEN** PostHog is initialised
- **THEN** `studio_id` is registered as a super property so all subsequent events include it without manual specification

### Requirement: Traffic panel shows visitors, conversion, and sources
The Home tab SHALL display a Traffic panel queried via the `get-analytics` Edge Function, showing: unique visitor count, booking conversion rate (booking_completed events / unique visitors), and a source breakdown (Direct, Search, Instagram, Maps) for the last 30 days. The traffic panel is NOT period-toggle-driven — it always shows last 30 days.

#### Scenario: Traffic panel renders with data
- **WHEN** PostHog has received events and the admin views the Home tab
- **THEN** the panel shows visitor count, conversion %, and source percentages

#### Scenario: No PostHog data yet
- **WHEN** PostHog has no events for this studio (e.g. first day after deploy)
- **THEN** the panel shows "No traffic data yet — check back after visitors arrive" rather than zeros or an error

#### Scenario: get-analytics validates admin role
- **WHEN** a non-admin user calls the get-analytics Edge Function directly
- **THEN** the function returns 403 and no PostHog data is returned

### Requirement: get-analytics Edge Function proxies PostHog securely
The `get-analytics` Edge Function SHALL accept an authenticated request with `{ studio_id }`, verify the caller is an admin for that studio, then query PostHog's Query API using `POSTHOG_SECRET_KEY` (server-side secret), and return aggregated stats. The secret key SHALL never be included in any client-side bundle.

#### Scenario: Successful analytics fetch
- **WHEN** an admin calls get-analytics with a valid JWT and their studio_id
- **THEN** the function returns visitor count, conversion rate, and source breakdown JSON

#### Scenario: Unauthorised call rejected
- **WHEN** a request with no JWT or a non-admin JWT calls get-analytics
- **THEN** the function returns 401 or 403 and no data
