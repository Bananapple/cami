-- ----------------------------------------------------------------------------
-- Notification log — idempotency record for all outbound notifications
-- ----------------------------------------------------------------------------

CREATE TABLE notification_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID        REFERENCES studios(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id       UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  channel          TEXT        NOT NULL DEFAULT 'email',
  template         TEXT        NOT NULL,
  recipient        TEXT        NOT NULL,
  idempotency_key  TEXT        NOT NULL UNIQUE,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  error            TEXT
);

CREATE INDEX idx_notification_log_booking ON notification_log (booking_id);
CREATE INDEX idx_notification_log_user    ON notification_log (user_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- Service role only — no RLS policies for end users (intentional)
