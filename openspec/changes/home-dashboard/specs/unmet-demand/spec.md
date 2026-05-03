## ADDED Requirements

### Requirement: Unmet demand panel shows waitlist pressure
The Home tab SHALL display an Unmet demand panel showing the number of students who joined a waitlist but did not get a spot in the current period, and the class template with the most unserved waitlist entries.

#### Scenario: Unmet demand panel renders
- **WHEN** the admin views the Home tab
- **THEN** the panel shows total expired/unclaimed waitlist offers in the period and the top bottleneck class template name

#### Scenario: No waitlist pressure
- **WHEN** there are no expired or unclaimed waitlist entries in the period
- **THEN** the panel shows "No unmet demand this period" rather than zeros or an error

#### Scenario: Bottleneck class identified
- **WHEN** one class template has more expired waitlist entries than others in the period
- **THEN** the panel names that template (e.g. "Bootylicious — 8 unserved this week") and implies a capacity opportunity

### Requirement: Unmet demand counts only expired and unclaimed offers
Unmet demand SHALL be computed from waitlist entries where `status = 'expired'` (offer sent but not accepted in time) or where `status = 'waiting'` and the associated class instance has already passed (demand that never got an offer). Accepted waitlist entries (converted to bookings) SHALL NOT count as unmet demand.

#### Scenario: Accepted entries excluded
- **WHEN** a student joined a waitlist and successfully got a spot
- **THEN** that entry is not counted in unmet demand
