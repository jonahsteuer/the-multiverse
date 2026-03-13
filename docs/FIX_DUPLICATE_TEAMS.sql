-- ============================================================
-- DIAGNOSE & FIX DUPLICATE TEAMS
-- Run section by section in Supabase SQL Editor
-- ============================================================

-- ── STEP 1: See all teams + their members ──────────────────
SELECT
  t.id          AS team_id,
  t.name        AS team_name,
  t.universe_id,
  t.galaxy_id,
  t.created_by,
  t.created_at,
  COUNT(tm.id)  AS member_count,
  STRING_AGG(tm.display_name || ' (' || tm.role || ')', ', ') AS members
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY t.id, t.name, t.universe_id, t.galaxy_id, t.created_by, t.created_at
ORDER BY t.created_at DESC;

-- ── STEP 2: Find the REAL team (has the most members / is oldest) ──
-- Look at the output of Step 1 and identify:
--   REAL_TEAM_ID  = the admin's original team (has Ruby in it, created earliest)
--   ORPHAN_TEAM_ID = the empty/duplicate team (only has Jonah Leon)
--   JONAH_USER_ID  = Jonah Leon's user ID (from team_members display_name = 'jonah leon')

-- ── STEP 3: Move Jonah Leon into the real team ─────────────
-- Replace the placeholders with the IDs from Step 1 output.

/*
-- Delete Jonah Leon's row in the orphan team
DELETE FROM team_members
WHERE team_id = 'ORPHAN_TEAM_ID'
  AND user_id = 'JONAH_LEON_USER_ID';

-- Add Jonah Leon to the real team (only if not already there)
INSERT INTO team_members (id, team_id, user_id, role, permissions, display_name, joined_at, created_at)
SELECT
  gen_random_uuid(),
  'REAL_TEAM_ID',
  'JONAH_LEON_USER_ID',
  'videographer',
  'member',
  'jonah leon',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM team_members
  WHERE team_id = 'REAL_TEAM_ID'
    AND user_id = 'JONAH_LEON_USER_ID'
);

-- Delete the orphan team itself
DELETE FROM teams WHERE id = 'ORPHAN_TEAM_ID';
*/

-- ── STEP 4: Verify the fix ─────────────────────────────────
-- Re-run Step 1 to confirm only 1 team per universe remains with all members.
