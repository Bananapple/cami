-- Add day_of_week to sessions for recurring schedule filtering
-- Values follow JS Date.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
-- Empty array means the session appears on all days (safe default for existing rows)
ALTER TABLE public.sessions
  ADD COLUMN day_of_week INTEGER[] DEFAULT '{}';
