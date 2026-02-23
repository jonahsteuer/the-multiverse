-- ============================================================================
-- Add onboarding_logs table to capture every onboarding conversation
-- Run this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  extracted_profile JSONB,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_user_id ON public.onboarding_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_creator_name ON public.onboarding_logs(creator_name);
CREATE INDEX IF NOT EXISTS idx_onboarding_logs_created_at ON public.onboarding_logs(created_at DESC);

-- RLS: users can only see their own logs; service role can see all
ALTER TABLE public.onboarding_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding logs" ON public.onboarding_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding logs" ON public.onboarding_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own onboarding logs" ON public.onboarding_logs
  FOR UPDATE USING (auth.uid() = user_id);
