-- Replace client-callable increment_user_sessions RPC with a DB trigger.
-- The RPC was SECURITY DEFINER with no auth.uid() check, allowing any
-- authenticated user to increment any other user's session count.
-- The trigger fires server-side on confirmed booking INSERT only.

CREATE OR REPLACE FUNCTION public.increment_sessions_on_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET total_sessions = total_sessions + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_sessions
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.increment_sessions_on_booking();
