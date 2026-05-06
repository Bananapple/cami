-- 0025_studio_segment_config.sql
-- Adds per-studio configuration for the audience segmentation thresholds.
-- Lifecycle thresholds (newDays, lapsingFromDays, etc.) and frequency tier
-- cutoffs are studio-tunable via the SegmentConfigDrawer on the Clients page.
-- Time-of-day bucket boundaries (morning/midday/evening) intentionally remain
-- hardcoded — they don't vary meaningfully studio-to-studio and would bloat
-- the config UI.
--
-- Defaults match what useClientsView used as hardcoded constants prior to this
-- change, so behavior is preserved for existing studios with no further action.

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS segment_config JSONB
  NOT NULL DEFAULT '{
    "lifecycle": {
      "newDays": 30,
      "regularDays": 30,
      "lapsingFromDays": 90,
      "lapsingToDays": 45,
      "lapsingMinSessions": 3,
      "inactiveDays": 90,
      "inactiveMinSessions": 2,
      "oneTimerCooldownDays": 14
    },
    "frequency": {
      "casualMin": 1,
      "regularMin": 4,
      "devoteeMin": 8
    }
  }'::jsonb;

COMMENT ON COLUMN studios.segment_config IS
  'Per-studio thresholds for lifecycle classification + frequency tier cutoffs. Edited via the SegmentConfigDrawer; consumed by useClientsView in TS to label members.';
