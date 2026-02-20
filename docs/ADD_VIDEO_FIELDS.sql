-- ============================================================================
-- ADD VIDEO & POST MANAGEMENT FIELDS TO TEAM_TASKS
-- Run this in Supabase SQL Editor
-- This enables the Upload Posts feature where admins link videos to post slots
-- ============================================================================

-- Add video linking fields
ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_source TEXT CHECK (video_source IN ('google_drive', 'dropbox', 'youtube', 'direct')),
  ADD COLUMN IF NOT EXISTS video_embed_url TEXT,
  ADD COLUMN IF NOT EXISTS mark_notes TEXT,
  ADD COLUMN IF NOT EXISTS mark_analysis JSONB,
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS hashtags TEXT,
  ADD COLUMN IF NOT EXISTS post_status TEXT NOT NULL DEFAULT 'unlinked'
    CHECK (post_status IN ('unlinked', 'linked', 'analyzed', 'caption_written', 'approved', 'sent_to_editor', 'revision_requested', 'posted')),
  ADD COLUMN IF NOT EXISTS revision_notes TEXT,
  ADD COLUMN IF NOT EXISTS instagram_post_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_posted_at TIMESTAMPTZ;

-- Add Instagram connection fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
  ADD COLUMN IF NOT EXISTS instagram_user_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_username TEXT,
  ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_access_token TEXT;

-- ============================================================================
-- VERIFY
-- ============================================================================
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'team_tasks' 
  AND table_schema = 'public'
  AND column_name IN (
    'video_url', 'video_source', 'video_embed_url', 
    'mark_notes', 'mark_analysis', 'caption', 'hashtags',
    'post_status', 'revision_notes'
  )
ORDER BY column_name;

SELECT 'Video fields added successfully!' as status;

