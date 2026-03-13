-- ============================================================================
-- FIX DB CONSTRAINTS
-- Run this in Supabase SQL Editor
-- Fixes:
--   1. task_category CHECK: add 'footage'
--   2. type CHECK: add 'audience-builder', 'teaser', 'promo', 'footage', 'finalize'
--   3. post_edits FK: make post_task_id nullable (tasks may live client-side)
--   4. post_edits INSERT policy: also allow team creators
--   5. notifications type: add 'review_notes_sent', 'brainstorm_revision'
-- ============================================================================

-- ── 1. task_category constraint ──────────────────────────────────────────────
ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_task_category_check;

ALTER TABLE public.team_tasks
  ADD CONSTRAINT team_tasks_task_category_check
  CHECK (task_category IN ('task', 'event', 'footage'));

-- ── 2. type constraint ───────────────────────────────────────────────────────
ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_type_check;

ALTER TABLE public.team_tasks
  ADD CONSTRAINT team_tasks_type_check
  CHECK (type IN (
    'invite_team', 'brainstorm', 'prep', 'film', 'edit',
    'review', 'post', 'release', 'shoot', 'custom',
    'audience-builder', 'teaser', 'promo', 'footage', 'finalize'
  ));

-- ── 3. post_edits: make post_task_id nullable (no FK enforcement) ────────────
-- Drop the old FK constraint if it exists
ALTER TABLE public.post_edits
  DROP CONSTRAINT IF EXISTS post_edits_post_task_id_fkey;

-- Keep the column but without FK (tasks may be client-generated and not yet in DB)
ALTER TABLE public.post_edits
  ALTER COLUMN post_task_id DROP NOT NULL;

-- ── 4. post_edits INSERT policy: also allow team creators ────────────────────
DROP POLICY IF EXISTS "team_members_insert_post_edits" ON public.post_edits;

CREATE POLICY "team_members_insert_post_edits" ON public.post_edits
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

-- Also fix SELECT policy to include team creators
DROP POLICY IF EXISTS "team_members_view_post_edits" ON public.post_edits;

CREATE POLICY "team_members_view_post_edits" ON public.post_edits
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

-- Also fix UPDATE policy
DROP POLICY IF EXISTS "team_members_update_post_edits" ON public.post_edits;

CREATE POLICY "team_members_update_post_edits" ON public.post_edits
  FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
  );

-- ── 5. notifications type constraint ─────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_assigned', 'task_completed', 'task_rescheduled',
    'invite_accepted', 'member_joined', 'brainstorm_completed',
    'brainstorm_revision', 'general', 'review_notes_sent'
  ));

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT 'Constraints fixed successfully!' AS status;

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN (
    'team_tasks_task_category_check',
    'team_tasks_type_check',
    'notifications_type_check'
  );
