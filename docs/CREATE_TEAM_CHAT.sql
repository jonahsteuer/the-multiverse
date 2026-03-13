-- TC1: Team chat schema
-- Run in Supabase SQL editor

-- Channels: one group channel per team + any 1-on-1 DMs
CREATE TABLE IF NOT EXISTS team_channels (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_id TEXT NOT NULL,
  name TEXT,                        -- null for DMs
  channel_type TEXT NOT NULL DEFAULT 'group', -- 'group' | 'dm'
  member_ids TEXT[] NOT NULL DEFAULT '{}',    -- participant user IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  channel_id TEXT NOT NULL REFERENCES team_channels(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'footage-share' | 'mark-response' | 'task-card' | 'post-slots-confirm'
  metadata JSONB DEFAULT '{}',               -- footage links, task IDs, slot details, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_messages_channel ON team_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_channels_team ON team_channels(team_id);

-- RLS
ALTER TABLE team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Team members can read channels they belong to
CREATE POLICY "Members can read their channels"
ON team_channels FOR SELECT TO authenticated
USING (auth.uid()::text = ANY(member_ids));

-- Authenticated users can create channels
CREATE POLICY "Authenticated can create channels"
ON team_channels FOR INSERT TO authenticated
WITH CHECK (auth.uid()::text = ANY(member_ids));

-- Anyone authenticated can update channel (for updated_at)
CREATE POLICY "Members can update their channels"
ON team_channels FOR UPDATE TO authenticated
USING (auth.uid()::text = ANY(member_ids));

-- Members can read messages in their channels
CREATE POLICY "Members can read messages"
ON team_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_channels
    WHERE id = team_messages.channel_id
    AND auth.uid()::text = ANY(member_ids)
  )
);

-- Members can insert messages into their channels
-- sender_id can be auth.uid() (user) OR 'mark' (server-side AI messages)
CREATE POLICY "Members can send messages"
ON team_messages FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid()::text = sender_id OR sender_id = 'mark')
  AND EXISTS (
    SELECT 1 FROM team_channels
    WHERE id = team_messages.channel_id
    AND auth.uid()::text = ANY(member_ids)
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE team_channels;
