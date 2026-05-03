## ADDED Requirements

### Requirement: Booking trend sparkline shows trailing 12 periods
The Home tab SHALL display a sparkline chart of confirmed booking counts for the trailing 12 complete periods (weeks if Week is selected, months if Month, years if Year). The current incomplete period SHALL NOT be included in the sparkline.

#### Scenario: Week mode sparkline
- **WHEN** the admin views the Home tab in Week mode
- **THEN** the sparkline shows 12 bars or data points representing the last 12 complete calendar weeks

#### Scenario: Sparse data at studio launch
- **WHEN** the studio has fewer than 12 complete periods of data
- **THEN** the sparkline renders with however many complete periods exist, padded to zero for earlier periods

### Requirement: Fill rate shown for current period
The Home tab SHALL display the average class fill rate (booked / capacity) across all class instances that started within the current period-to-date, as a percentage and a visual bar.

#### Scenario: Fill rate renders
- **WHEN** the admin views the Home tab
- **THEN** a percentage (e.g. "78%") and a proportional bar are shown

#### Scenario: No classes in period
- **WHEN** no class instances have started in the current period
- **THEN** the fill rate shows "—" rather than 0% or an error
