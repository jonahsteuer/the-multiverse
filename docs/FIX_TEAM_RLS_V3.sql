-- ============================================================================
-- FIX V3: Allow team MEMBERS to access teams, universes, galaxies, and worlds
-- Problems:
--   1. teams SELECT only checks created_by → invited members can't see the team
--   2. universes SELECT only checks creator_id → team members can't load the universe
--   3. galaxies SELECT only checks ownership → team members can't see galaxies
--   4. worlds SELECT only checks ownership → team members can't see worlds (no orbiting planets!)
--   5. notifications INSERT may block new members
-- Fix: Use SECURITY DEFINER functions + update SELECT policies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create a helper function that bypasses RLS to check team membership
CREATE OR REPLACE FUNCTION get_user_team_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = uid;
$$;

-- 2. Helper: get universe IDs that a user has access to (via teams)
CREATE OR REPLACE FUNCTION get_user_universe_ids(uid uuid)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT t.universe_id FROM public.teams t
  INNER JOIN public.team_members tm ON tm.team_id = t.id
  WHERE tm.user_id = uid;
$$;

-- ============================================================================
-- FIX TEAMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    created_by = auth.uid()
    OR id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- ============================================================================
-- FIX UNIVERSES TABLE — allow team members to read the universe
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own universes" ON public.universes;
DROP POLICY IF EXISTS "Users can manage own universes" ON public.universes;
DROP POLICY IF EXISTS "Users can select own universes" ON public.universes;
DROP POLICY IF EXISTS "Users can read own or team universes" ON public.universes;

-- Create a single SELECT policy that allows owners AND team members
CREATE POLICY "Users can read own or team universes" ON public.universes
  FOR SELECT USING (
    creator_id = auth.uid()
    OR id IN (SELECT get_user_universe_ids(auth.uid()))
  );

-- ============================================================================
-- FIX GALAXIES TABLE — allow team members to read galaxies
-- ============================================================================
DROP POLICY IF EXISTS "Users can read own galaxies" ON public.galaxies;
DROP POLICY IF EXISTS "Users can manage own galaxies" ON public.galaxies;
DROP POLICY IF EXISTS "Users can select own galaxies" ON public.galaxies;
DROP POLICY IF EXISTS "Users can read own or team galaxies" ON public.galaxies;

-- Get galaxy access through universe access
CREATE POLICY "Users can read own or team galaxies" ON public.galaxies
  FOR SELECT USING (
    universe_id IN (
      SELECT id FROM public.universes WHERE creator_id = auth.uid()
    )
    OR universe_id IN (SELECT get_user_universe_ids(auth.uid()))
  );

-- ============================================================================
-- FIX WORLDS TABLE — allow team members to read worlds (fixes missing orbiting planets!)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own worlds" ON public.worlds;
DROP POLICY IF EXISTS "Users can read own worlds" ON public.worlds;
DROP POLICY IF EXISTS "Users can read own or team worlds" ON public.worlds;

CREATE POLICY "Users can read own or team worlds" ON public.worlds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.galaxies g
      JOIN public.universes u ON u.id = g.universe_id
      WHERE g.id = worlds.galaxy_id
      AND u.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.galaxies g
      WHERE g.id = worlds.galaxy_id
      AND g.universe_id IN (SELECT get_user_universe_ids(auth.uid()))
    )
  );

-- ============================================================================
-- FIX TEAM TASKS — allow members to create tasks (e.g. from brainstorm)
-- ============================================================================
DROP POLICY IF EXISTS "Admins can create tasks" ON public.team_tasks;
DROP POLICY IF EXISTS "Members can create tasks" ON public.team_tasks;
CREATE POLICY "Members can create tasks" ON public.team_tasks
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    OR team_id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- ============================================================================
-- FIX NOTIFICATIONS — allow any authenticated user to create notifications
-- ============================================================================
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;
CREATE POLICY "Anyone can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- FIX PROFILES TABLE — allow team members to read admin's profile
-- (needed so team members can load the admin's artist profile for calendar)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read team member profiles" ON public.profiles;
CREATE POLICY "Users can read team member profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT tm.user_id FROM public.team_members tm
      WHERE tm.team_id IN (SELECT get_user_team_ids(auth.uid()))
    )
  );

-- ============================================================================
-- VERIFY
-- ============================================================================
SELECT 'Policies updated successfully!' as status;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('teams', 'universes', 'galaxies', 'worlds', 'team_tasks', 'notifications', 'profiles')
ORDER BY tablename, policyname;

-- ============================================================================
-- DONE! Now invited members can:
-- - See the team they belong to (teams SELECT)
-- - Load the team's universe (universes SELECT)
-- - Load galaxies in the universe (galaxies SELECT)
-- - See worlds orbiting in the galaxy (worlds SELECT) ← NEW
-- - Read admin's artist profile for calendar sync (profiles SELECT) ← NEW
-- - Create tasks from brainstorm results (team_tasks INSERT)
-- - Create notifications (notifications INSERT)
-- ============================================================================
