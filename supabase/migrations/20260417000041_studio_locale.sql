-- 0037_studio_locale.sql
-- Per-studio locale for confirmation-email formatting.
--
-- Email senders previously hardcoded `nb-NO` + `Europe/Oslo` in
-- toLocaleDateString/toLocaleTimeString and `${currency} ${priceNOK}` in the
-- price line. That ships fine for Brie (Norwegian) but not for any non-Norwegian
-- studio Cami onboards next.
--
-- This adds `studios.locale` (BCP-47 string like "nb-NO", "en-US", "en-GB").
-- Edge functions read it alongside the existing `studios.timezone` and pass
-- both into Intl formatters. studios.currency stays the source of truth for
-- the actual currency code; locale just controls how it's rendered (symbol
-- placement, decimal/thousands separators).
--
-- Mirrors the 0033 pattern (from_email, app_url): nullable column with a
-- code-side fallback. Existing Norwegian studios keep working unchanged
-- because the edge functions fall back to "nb-NO" when locale is NULL.

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS locale TEXT;

COMMENT ON COLUMN studios.locale IS
  'BCP-47 locale tag for date/time/currency formatting in confirmation emails (e.g. "nb-NO", "en-US"). NULL falls back to "nb-NO" in edge functions for backward compatibility with the original Norwegian-only deployment.';
