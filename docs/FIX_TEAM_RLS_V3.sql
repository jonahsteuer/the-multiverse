-- ============================================================================
-- FIX V3: Allow team MEMBERS to see teams they belong to
-- Problem: teams SELECT only checks created_by, so invited members can't see the team
-- Fix: Use a SECURITY DEFINER function to safely check team_members without recursion
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create a helper function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION get_user_team_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = uid;
$$;

-- 2. Drop and recreate teams SELECT policy to include members
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    created_by = auth.uid()
    OR id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- 3. Also fix team_tasks INSERT policy — team members should be able to create tasks too
-- (e.g., when brainstorm creates edit/shoot tasks)
DROP POLICY IF EXISTS "Admins can create tasks" ON public.team_tasks;
CREATE POLICY "Members can create tasks" ON public.team_tasks
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    OR team_id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- 4. Fix notifications INSERT — ensure any authenticated user can create notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Anyone can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- DONE! Now invited members can:
-- - See the team they belong to
-- - See team members
-- - Create tasks (from brainstorm results)
-- - Create notifications
-- ============================================================================

