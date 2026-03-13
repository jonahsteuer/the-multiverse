-- ============================================================
-- ADD GALAXY-LEVEL SHARING TO TEAMS
-- Run this in Supabase SQL Editor
-- ============================================================
--
-- Sharing is now at the GALAXY level, not the universe level.
-- Each team invitation is tied to a specific galaxy.
--
-- This script:
--   1. Adds galaxy_id column to teams table
--   2. Auto-populates galaxy_id for existing teams (finds the
--      most recently created galaxy in the team's universe)
--   3. Adds a foreign key constraint
-- ============================================================

-- 1. Add the column (text to match galaxies.id type — nullable for backward compat)
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS galaxy_id TEXT REFERENCES galaxies(id) ON DELETE SET NULL;

-- 2. Back-fill existing teams: find the latest galaxy in their universe
UPDATE teams t
SET galaxy_id = (
  SELECT g.id
  FROM galaxies g
  WHERE g.universe_id = t.universe_id
  ORDER BY g.created_at DESC
  LIMIT 1
)
WHERE galaxy_id IS NULL
  AND universe_id IS NOT NULL;

-- 3. Verify the result
SELECT
  t.id        AS team_id,
  t.name      AS team_name,
  t.universe_id,
  t.galaxy_id,
  g.name      AS galaxy_name
FROM teams t
LEFT JOIN galaxies g ON g.id = t.galaxy_id
ORDER BY t.created_at DESC
LIMIT 20;
