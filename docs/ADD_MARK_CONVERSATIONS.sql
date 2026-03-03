-- Mark Conversations Table
-- Stores all conversations with Mark (general + brainstorm sessions)
-- for training data and future context recall.

CREATE TABLE IF NOT EXISTS public.mark_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  galaxy_id UUID,
  session_type TEXT NOT NULL DEFAULT 'general',
  -- 'general' | 'brainstorm' | 'onboarding_post'
  messages JSONB NOT NULL DEFAULT '[]',
  -- Array of { role: 'user'|'assistant', content: string, timestamp: string }
  context JSONB,
  -- Optional extra context: { songName, genre, artistProfile snapshot }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.mark_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage their own conversations
CREATE POLICY "Users can insert own mark conversations"
  ON public.mark_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own mark conversations"
  ON public.mark_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own mark conversations"
  ON public.mark_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups by user/galaxy
CREATE INDEX IF NOT EXISTS mark_conversations_user_idx ON public.mark_conversations(user_id);
CREATE INDEX IF NOT EXISTS mark_conversations_galaxy_idx ON public.mark_conversations(galaxy_id);
CREATE INDEX IF NOT EXISTS mark_conversations_type_idx ON public.mark_conversations(session_type);
