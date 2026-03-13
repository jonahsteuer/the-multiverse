-- ============================================================================
-- FIX: team_members SELECT RLS — allow members to see ALL teammates
--
-- Root cause: the existing policy uses  OR user_id = auth.uid()
-- which means non-admin members can only see THEIR OWN row, never teammates.
--
-- Fix: Use the SECURITY DEFINER function get_user_team_ids() (created in
-- FIX_TEAM_RLS_V3.sql) to check if the current user belongs to the same team.
--
-- Run this in Supabase SQL Editor AFTER FIX_TEAM_RLS_V3.sql has been applied.
-- ============================================================================

-- Ensure the SECURITY DEFINER helper exists (re-create idempotently)
CREATE OR REPLACE FUNCTION get_user_team_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = uid;
$$;

-- Drop all existing SELECT policies on team_members
DROP POLICY IF EXISTS "Users can view team members"    ON public.team_members;
DROP POLICY IF EXISTS "Team members can view members"  ON public.team_members;
DROP POLICY IF EXISTS "Members can view team members"  ON public.team_members;

-- New policy: any team member can see ALL members of teams they belong to
-- (uses SECURITY DEFINER to avoid infinite recursion)
CREATE POLICY "Team members can view all members of their teams"
  ON public.team_members
  FOR SELECT
  USING (
    -- Team creator/admin can see all members
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    -- Any member of the team can see all other members
    OR team_id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- Verify
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'team_members'
ORDER BY policyname;
