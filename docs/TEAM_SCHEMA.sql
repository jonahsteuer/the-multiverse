-- ============================================================================
-- TEAM COLLABORATION SCHEMA
-- Run this in Supabase SQL Editor to create all team-related tables
-- ============================================================================

-- 1. TEAMS TABLE
-- One team per universe. Created automatically when artist finishes onboarding.
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  universe_id text NOT NULL,
  name text NOT NULL, -- e.g., "Kiss Bang's Team"
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. TEAM MEMBERS TABLE
-- Tracks who is on each team and their role/permissions.
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'videographer', 'editor', 'artist', 'other')),
  permissions text NOT NULL DEFAULT 'member' CHECK (permissions IN ('full', 'member')),
  display_name text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id) -- A user can only be on a team once
);

-- 3. TEAM INVITATIONS TABLE
-- Tracks invite links and their status.
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE, -- The token in the invite URL
  role text NOT NULL CHECK (role IN ('manager', 'videographer', 'editor', 'artist', 'other')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_name text, -- Optional: name of person being invited
  invited_email text, -- Optional: email of person being invited
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. TEAM TASKS TABLE
-- All tasks and events for the team. Tasks are assigned to individuals, events are shared.
CREATE TABLE IF NOT EXISTS public.team_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  galaxy_id text, -- Optional: which galaxy/release this task is for
  title text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL CHECK (type IN (
    'invite_team', 'brainstorm', 'prep', 'film', 'edit', 
    'review', 'post', 'release', 'shoot', 'custom'
  )),
  task_category text NOT NULL DEFAULT 'task' CHECK (task_category IN ('task', 'event')),
  -- 'task' = personal, assigned to individuals (shows only on their calendar)
  -- 'event' = shared, visible to entire team (release dates, post dates, shoot days)
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for shared events
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. NOTIFICATIONS TABLE
-- In-app notifications for team activity.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'task_assigned', 'task_completed', 'task_rescheduled', 
    'invite_accepted', 'member_joined', 'brainstorm_completed', 'general'
  )),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}', -- Additional context (task_id, member_name, etc.)
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_teams_universe_id ON public.teams(universe_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);

CREATE INDEX IF NOT EXISTS idx_team_tasks_team_id ON public.team_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_assigned_to ON public.team_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_team_tasks_date ON public.team_tasks(date);
CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON public.team_tasks(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- TEAMS: Users can see teams they created or are a member of
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    created_by = auth.uid()
    OR id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update their teams" ON public.teams
  FOR UPDATE USING (
    id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND permissions = 'full'
    )
  );

-- TEAM MEMBERS: Users can see members of teams they created or belong to
CREATE POLICY "Users can view team members" ON public.team_members
  FOR SELECT USING (
    -- You can see members of teams you created
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    -- Or you can see your own membership row (prevents recursion)
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can add team members" ON public.team_members
  FOR INSERT WITH CHECK (
    -- Team creator can add the first member (themselves)
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
    -- Existing admins can add members
    OR team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND permissions = 'full'
    )
    OR user_id = auth.uid() -- Allow users to add themselves (via invite acceptance)
  );

CREATE POLICY "Admins can update team members" ON public.team_members
  FOR UPDATE USING (
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can remove team members" ON public.team_members
  FOR DELETE USING (
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
  );

-- TEAM INVITATIONS: Admins can manage invitations, anyone can read by token
CREATE POLICY "Admins can create invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Anyone can view invitations" ON public.team_invitations
  FOR SELECT USING (true); -- Invite pages need to read without auth

CREATE POLICY "Invitations can be updated" ON public.team_invitations
  FOR UPDATE USING (true); -- Accept/decline needs to update

-- TEAM TASKS: Members see their tasks + shared events
CREATE POLICY "Members can view their tasks and events" ON public.team_tasks
  FOR SELECT USING (
    -- Team creator can see all tasks
    team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
    -- Or tasks assigned to this user
    OR assigned_to = auth.uid()
    -- Or shared events (visible to everyone on the team)
    OR (task_category = 'event' AND team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    ))
  );

CREATE POLICY "Admins can create tasks" ON public.team_tasks
  FOR INSERT WITH CHECK (
    -- Team creator can create tasks
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
    OR team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND permissions = 'full'
    )
  );

CREATE POLICY "Task owners and admins can update tasks" ON public.team_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid() -- Task assignee can update (reschedule)
    OR team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can delete tasks" ON public.team_tasks
  FOR DELETE USING (
    team_id IN (
      SELECT id FROM public.teams WHERE created_by = auth.uid()
    )
  );

-- NOTIFICATIONS: Users can only see their own notifications
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true); -- Any authenticated user can create notifications

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()); -- Mark as read

CREATE POLICY "Users can delete their notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- ENABLE REALTIME for notifications and tasks
-- ============================================================================

-- Enable realtime on notifications table for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tasks;

-- ============================================================================
-- DONE! 
-- Tables created: teams, team_members, team_invitations, team_tasks, notifications
-- RLS policies: configured for role-based access
-- Realtime: enabled for notifications and tasks
-- ============================================================================

