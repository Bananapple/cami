-- 0028_membership_cancelled_at.sql
-- Add cancelled_at timestamp to memberships so churn can be period-scoped.
-- Backfill existing cancelled rows using updated_at as the best available proxy.

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- No backfill: created_at is membership start, not cancellation date.
-- Existing cancelled rows stay NULL; cancelled_at is stamped going forward only.

CREATE INDEX IF NOT EXISTS idx_memberships_cancelled_at
  ON memberships (studio_id, cancelled_at)
  WHERE cancelled_at IS NOT NULL;

-- Replace cancel_membership_by_subscription to stamp cancelled_at
CREATE OR REPLACE FUNCTION public.cancel_membership_by_subscription(p_subscription_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE memberships
     SET status = 'cancelled',
         cancelled_at = now()
   WHERE provider_subscription_id = p_subscription_id
     AND status = 'active';
END;
$$;
