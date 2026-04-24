-- ============================================================================
-- Phase 4: Waitlists with Reservation Window
--
-- Flow:
--   1. Class full → user inserts waitlist row (status='waiting')
--   2. Booking cancelled → trigger calls offer_next_waitlist_spot
--   3. First waiter (ORDER BY joined_at, FOR UPDATE SKIP LOCKED) → status='offered'
--      offer_expires_at = now() + studio.waitlist_offer_window_minutes
--   4. Edge Function sends notification
--   5. User either accepts (converts to booking) or lets it expire
--   6. pg_cron sweeps every minute, expires stale offers, passes to next in line
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM (
    'waiting',    -- in queue, no offer yet
    'offered',    -- spot offered, awaiting acceptance
    'accepted',   -- accepted → booking created
    'expired',    -- window passed without acceptance
    'cancelled'   -- user left waitlist voluntarily
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS waitlists CASCADE;

CREATE TABLE waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_via TEXT,
  CONSTRAINT waitlist_offer_fields CHECK (
    (status = 'offered' AND offered_at IS NOT NULL AND offer_expires_at IS NOT NULL)
    OR (status <> 'offered')
  ),
  -- One active entry per (class, user); expired/cancelled rows remain as history
  EXCLUDE USING btree (class_instance_id WITH =, user_id WITH =)
    WHERE (status IN ('waiting', 'offered', 'accepted'))
);

CREATE INDEX idx_waitlist_queue
  ON waitlists (class_instance_id, joined_at)
  WHERE status = 'waiting';

CREATE INDEX idx_waitlist_offer_expiry
  ON waitlists (offer_expires_at)
  WHERE status = 'offered';

CREATE INDEX idx_waitlist_user
  ON waitlists (user_id, studio_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlists_self_read" ON waitlists FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND studio_id IN (SELECT public.user_studio_ids()));

CREATE POLICY "waitlists_staff_read" ON waitlists FOR SELECT
  TO authenticated
  USING (public.user_is_staff(studio_id));

CREATE POLICY "waitlists_self_insert" ON waitlists FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND studio_id IN (SELECT public.user_studio_ids())
    AND status = 'waiting'  -- users can only create in 'waiting' state
  );

CREATE POLICY "waitlists_self_cancel" ON waitlists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status IN ('waiting', 'offered'))
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

CREATE POLICY "waitlists_staff_write" ON waitlists FOR ALL
  TO authenticated
  USING (public.user_is_staff(studio_id))
  WITH CHECK (public.user_is_staff(studio_id));

-- ----------------------------------------------------------------------------
-- Maintain waitlist_offered_count on class_instances
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_waitlist_offered_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'offered' AND NEW.status = 'offered' THEN
      UPDATE class_instances SET waitlist_offered_count = waitlist_offered_count + 1
       WHERE id = NEW.class_instance_id;
    ELSIF OLD.status = 'offered' AND NEW.status <> 'offered' THEN
      UPDATE class_instances SET waitlist_offered_count = waitlist_offered_count - 1
       WHERE id = NEW.class_instance_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_waitlists_sync_offered
  AFTER UPDATE ON waitlists
  FOR EACH ROW EXECUTE FUNCTION public.sync_waitlist_offered_count();

-- ----------------------------------------------------------------------------
-- offer_next_waitlist_spot: atomically pick the next waiter and make them an offer.
-- Returns the waitlist_id (so callers can dispatch notifications), or NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_next_waitlist_spot(_class_instance_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _studio_id UUID;
  _offer_window_min INT;
  _capacity_ok BOOLEAN;
  _next_id UUID;
BEGIN
  -- Check there's capacity to offer (confirmed + outstanding offers < max)
  SELECT
    ci.studio_id,
    s.waitlist_offer_window_minutes,
    (ci.booked_count + ci.waitlist_offered_count) < ci.max_capacity
  INTO _studio_id, _offer_window_min, _capacity_ok
  FROM class_instances ci
  JOIN studios s ON s.id = ci.studio_id
  WHERE ci.id = _class_instance_id
    AND ci.status = 'scheduled'
  FOR UPDATE;

  IF NOT FOUND OR NOT _capacity_ok THEN
    RETURN NULL;
  END IF;

  -- Lock and offer to first waiter
  UPDATE waitlists
     SET status = 'offered',
         offered_at = now(),
         offer_expires_at = now() + (_offer_window_min || ' minutes')::INTERVAL
   WHERE id = (
     SELECT id FROM waitlists
      WHERE class_instance_id = _class_instance_id
        AND status = 'waiting'
      ORDER BY joined_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id INTO _next_id;

  RETURN _next_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Trigger: on booking cancel, try to offer the newly-free spot
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_booking_cancel_offers_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    PERFORM public.offer_next_waitlist_spot(NEW.class_instance_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_offer_waitlist ON bookings;
CREATE TRIGGER trg_bookings_offer_waitlist
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_booking_cancel_offers_waitlist();

-- ----------------------------------------------------------------------------
-- Sweeper: expire stale offers, promote next in line
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_waitlist_offers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expired_instance UUID;
  _count INT := 0;
BEGIN
  FOR _expired_instance IN
    UPDATE waitlists
       SET status = 'expired',
           resolved_at = now(),
           resolved_via = 'offer_window_expired'
     WHERE status = 'offered'
       AND offer_expires_at < now()
     RETURNING class_instance_id
  LOOP
    PERFORM public.offer_next_waitlist_spot(_expired_instance);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

-- Schedule the sweeper every minute (uncomment when pg_cron enabled):
--   SELECT cron.schedule(
--     'waitlist-expire-offers',
--     '* * * * *',
--     $$SELECT public.expire_stale_waitlist_offers()$$
--   );

-- ----------------------------------------------------------------------------
-- accept_waitlist_offer: called by the Edge Function after payment.
-- This is the ONLY path that transitions 'offered' → 'accepted' by a user.
-- Creating the matching booking row is the caller's responsibility.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_waitlist_offer(_waitlist_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row waitlists%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM waitlists WHERE id = _waitlist_id FOR UPDATE;
  IF NOT FOUND OR _row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _row.status <> 'offered' THEN
    RAISE EXCEPTION 'Offer not active';
  END IF;
  IF _row.offer_expires_at < now() THEN
    RAISE EXCEPTION 'Offer expired';
  END IF;

  UPDATE waitlists
     SET status = 'accepted',
         resolved_at = now(),
         resolved_via = 'user_accepted'
   WHERE id = _waitlist_id;
  RETURN TRUE;
END;
$$;
