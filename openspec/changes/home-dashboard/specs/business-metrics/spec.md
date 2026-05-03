## ADDED Requirements

### Requirement: Period toggle controls all metrics
The Home tab SHALL display a segmented control with three options: Week, Month, Year. Default selection is Week. Selecting a period SHALL update all metric tiles, charts, and panels to reflect the current period-to-date window.

#### Scenario: Default period on load
- **WHEN** an admin navigates to the Home tab
- **THEN** the Week period is selected and all metrics reflect the current week to date (Monday 00:00 through now)

#### Scenario: Switching period
- **WHEN** the admin clicks Month
- **THEN** all metrics update to reflect month-to-date (1st of month 00:00 through now) without page reload

### Requirement: Bookings tile shows WTD/MTD/YTD count with comparison
The Home tab SHALL display a Bookings tile showing the count of confirmed bookings in the current period-to-date, a percentage change vs the same elapsed time in the prior period, and the prior period's full total as a secondary benchmark figure.

#### Scenario: Bookings tile renders
- **WHEN** the admin views the Home tab in Week mode on a Wednesday
- **THEN** the tile shows confirmed bookings from Monday through now, percentage vs the equivalent Mon–Wed window last week, and last week's full total

#### Scenario: Period ahead of prior period
- **WHEN** current WTD bookings exceed last week's same-elapsed count
- **THEN** the comparison displays as a positive percentage in green (e.g. ↑12%)

#### Scenario: No prior period data
- **WHEN** the studio has no bookings in the prior period
- **THEN** the comparison shows "—" rather than +∞% or an error

### Requirement: Cash-in tile shows payment revenue
The Home tab SHALL display a Cash-in tile showing the sum of `payments.amount_minor` (in studio currency) for payments with `status = 'succeeded'` in the current period, with the same period-over-period comparison and prior-period benchmark.

#### Scenario: Cash-in tile renders
- **WHEN** the admin views the Home tab
- **THEN** the tile shows total cash received this period in the studio's currency (e.g. "kr 18 400")

### Requirement: MRR tile shows active subscription value
The Home tab SHALL display an MRR tile showing the sum of active subscription membership prices for the current studio, labeled "Active subscription value" to avoid implying GAAP MRR. This is a point-in-time snapshot, not period-filtered.

#### Scenario: MRR tile renders
- **WHEN** the admin views the Home tab
- **THEN** the tile shows the current sum of subscription product prices for all memberships with status='active' and type='subscription'

#### Scenario: No active subscriptions
- **WHEN** the studio has no active subscriptions
- **THEN** the tile shows "kr 0" not an error

### Requirement: Net members tile shows growth this period
The Home tab SHALL display a Net members tile showing new studio_members rows created in the current period minus memberships cancelled in the current period, displayed as "+5 / -2" and a net figure.

#### Scenario: Net members tile renders
- **WHEN** the admin views the Home tab in Month mode
- **THEN** the tile shows new member count, churned count, and net (e.g. "+5 / -2 = net +3")

### Requirement: Admin-only visibility
The Home tab and all its metrics SHALL only be visible to studio members with `role = 'admin'`. Non-admin staff SHALL be redirected to the Today tab.

#### Scenario: Instructor visits /manage
- **WHEN** a user with role != 'admin' navigates to /manage
- **THEN** they land on the Today tab, not the Home tab

#### Scenario: Admin visits /manage
- **WHEN** a user with role = 'admin' navigates to /manage
- **THEN** they land on the Home tab
