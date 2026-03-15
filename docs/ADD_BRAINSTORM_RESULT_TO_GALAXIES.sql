-- ADD_BRAINSTORM_RESULT_TO_GALAXIES.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds brainstorm_result JSONB column to galaxies table.
-- This column stores the full BrainstormResult object after a brainstorm
-- completes, enabling ShootDayModal and other components to access scene data
-- (confirmedScenes, looks, location, crew, etc.) without re-running the
-- brainstorm.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE galaxies
  ADD COLUMN IF NOT EXISTS brainstorm_result JSONB DEFAULT NULL;

-- Optional: index for faster queries if you ever need to filter by completion
CREATE INDEX IF NOT EXISTS idx_galaxies_brainstorm_result
  ON galaxies USING gin (brainstorm_result)
  WHERE brainstorm_result IS NOT NULL;
