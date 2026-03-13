-- ============================================================
-- Stafford Approach Schema Additions
-- Run this in Supabase SQL editor
-- ============================================================

-- 1. Per-song fields on worlds table (C, D, D+)
ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS song_emotion TEXT,          -- "1-2 words what this song feels like" (C)
  ADD COLUMN IF NOT EXISTS song_stage TEXT,            -- writing/recorded/mixed/mastered/ready (D)
  ADD COLUMN IF NOT EXISTS listening_context TEXT;     -- "where someone would listen to this" (D+)

-- 2. Post-level fields on team_tasks (M, K, L)
ALTER TABLE team_tasks
  ADD COLUMN IF NOT EXISTS soundbyte TEXT,             -- which song section: intro/verse/chorus/bridge/outro
  ADD COLUMN IF NOT EXISTS rollout_zone TEXT,          -- pre-release / release-week / post-release
  ADD COLUMN IF NOT EXISTS shoot_look TEXT,            -- e.g. "Look 2 — close-up, side angle, seated"
  ADD COLUMN IF NOT EXISTS expected_footage_ref TEXT;  -- reference to footage item used for this edit

-- 3. Target listener interests on profiles (B)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS target_listener_interests TEXT;  -- "what else they're into besides music"
