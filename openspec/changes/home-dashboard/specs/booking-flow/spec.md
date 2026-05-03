## MODIFIED Requirements

### Requirement: Booking confirmation fires PostHog event
On successful booking (both paid via Stripe and credit via membership), the application SHALL fire a `booking_completed` PostHog event with properties: `class_name`, `price` (0 for credit bookings), `booking_id`, `studio_id`.

#### Scenario: Paid booking completed
- **WHEN** a user returns to the site after a successful Stripe checkout with `?status=success&booking_id=...`
- **THEN** a `booking_completed` event is sent to PostHog with the class name, price paid, and booking ID

#### Scenario: Credit booking completed
- **WHEN** a user completes a booking using a membership credit (no Stripe redirect)
- **THEN** a `booking_completed` event is sent to PostHog with price=0 and the booking ID

#### Scenario: Failed or cancelled booking
- **WHEN** a booking fails or the user cancels the Stripe checkout
- **THEN** no `booking_completed` event is fired
