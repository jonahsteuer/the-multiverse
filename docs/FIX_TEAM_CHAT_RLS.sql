-- ============================================================================
-- FIX: team_channels + team_messages RLS for non-admin members
--
-- Root cause:
--   1. team_channels SELECT policy: USING (auth.uid()::text = ANY(member_ids))
--      → Late-joining members (e.g. invited videographers) can never see the
--        group channel because they weren't in member_ids when it was created.
--      → The "add late joiner" logic in the app never runs because the SELECT
--        returns nothing.
--
--   2. team_messages SELECT + INSERT policies also check member_ids through the
--      same team_channels lookup → invited members can't read or send messages.
--
-- Fix:
--   - Group channels are visible to ALL team members (via team_members table)
--   - DM channels remain restricted to their specific member_ids
--   - Messages follow the same channel visibility logic
--
-- Requires get_user_team_ids_text() helper (created below).
-- ============================================================================

-- Helper: returns team IDs (as TEXT) for the current user — avoids RLS recursion
CREATE OR REPLACE FUNCTION get_user_team_ids_text(uid uuid)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id::text FROM public.team_members WHERE user_id = uid;
$$;

-- ── team_channels ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read their channels"   ON public.team_channels;
DROP POLICY IF EXISTS "Authenticated can create channels"  ON public.team_channels;
DROP POLICY IF EXISTS "Members can update their channels"  ON public.team_channels;

-- SELECT: member_ids for DMs; team membership for group channels
CREATE POLICY "Members can read their channels"
ON public.team_channels FOR SELECT TO authenticated
USING (
  auth.uid()::text = ANY(member_ids)
  OR (
    channel_type = 'group'
    AND team_id IN (SELECT get_user_team_ids_text(auth.uid()))
  )
);

-- INSERT: must be a team member to create a channel
CREATE POLICY "Authenticated can create channels"
ON public.team_channels FOR INSERT TO authenticated
WITH CHECK (
  auth.uid()::text = ANY(member_ids)
  OR (
    channel_type = 'group'
    AND team_id IN (SELECT get_user_team_ids_text(auth.uid()))
  )
);

-- UPDATE: allow updating group channels if you're a team member
-- (needed so late-joining members can add themselves to member_ids)
CREATE POLICY "Members can update their channels"
ON public.team_channels FOR UPDATE TO authenticated
USING (
  auth.uid()::text = ANY(member_ids)
  OR (
    channel_type = 'group'
    AND team_id IN (SELECT get_user_team_ids_text(auth.uid()))
  )
);

-- ── team_messages ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can read messages" ON public.team_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.team_messages;

-- SELECT: can read messages if you can see the channel
CREATE POLICY "Members can read messages"
ON public.team_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_channels tc
    WHERE tc.id = team_messages.channel_id
    AND (
      auth.uid()::text = ANY(tc.member_ids)
      OR (tc.channel_type = 'group' AND tc.team_id IN (SELECT get_user_team_ids_text(auth.uid())))
    )
  )
);

-- INSERT: can send messages if you can see the channel
CREATE POLICY "Members can send messages"
ON public.team_messages FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid()::text = sender_id OR sender_id = 'mark')
  AND EXISTS (
    SELECT 1 FROM public.team_channels tc
    WHERE tc.id = team_messages.channel_id
    AND (
      auth.uid()::text = ANY(tc.member_ids)
      OR (tc.channel_type = 'group' AND tc.team_id IN (SELECT get_user_team_ids_text(auth.uid())))
    )
  )
);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('team_channels', 'team_messages')
ORDER BY tablename, policyname;
