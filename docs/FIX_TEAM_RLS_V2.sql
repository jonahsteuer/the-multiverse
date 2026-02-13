-- ============================================================================
-- FIX V2: Eliminate ALL cross-table recursion in RLS policies
-- The problem: teams SELECT → team_members SELECT → teams SELECT → ∞
-- The fix: teams SELECT only uses created_by (no team_members subquery)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can update their teams" ON public.teams;

DROP POLICY IF EXISTS "Users can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can add team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can remove team members" ON public.team_members;

DROP POLICY IF EXISTS "Admins can create invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Anyone can view invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Invitations can be updated" ON public.team_invitations;

DROP POLICY IF EXISTS "Members can view their tasks and events" ON public.team_tasks;
DROP POLICY IF EXISTS "Admins can create tasks" ON public.team_tasks;
DROP POLICY IF EXISTS "Task owners and admins can update tasks" ON public.team_tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.team_tasks;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;

-- ============================================================================
-- TEAMS — only check created_by (NO team_members subquery to avoid recursion)
-- ============================================================================
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update their teams" ON public.teams
  FOR UPDATE USING (created_by = auth.uid());

-- ============================================================================
-- TEAM MEMBERS — only check teams.created_by or own user_id (NO self-ref)
-- ============================================================================
CREATE POLICY "Users can view team members" ON public.team_members
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can add team members" ON public.team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can update team members" ON public.team_members
  FOR UPDATE USING (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins can remove team members" ON public.team_members
  FOR DELETE USING (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

-- ============================================================================
-- TEAM INVITATIONS
-- ============================================================================
CREATE POLICY "Admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

CREATE POLICY "Anyone can view invitations" ON public.team_invitations
  FOR SELECT USING (true);

CREATE POLICY "Invitations can be updated" ON public.team_invitations
  FOR UPDATE USING (true);

-- ============================================================================
-- TEAM TASKS
-- ============================================================================
CREATE POLICY "Members can view their tasks and events" ON public.team_tasks
  FOR SELECT USING (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Admins can create tasks" ON public.team_tasks
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

CREATE POLICY "Task owners and admins can update tasks" ON public.team_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

CREATE POLICY "Admins can delete tasks" ON public.team_tasks
  FOR DELETE USING (
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- DONE! No cross-table recursion possible.
-- Chain: team_members → teams (created_by only, no back-reference)
-- ============================================================================

