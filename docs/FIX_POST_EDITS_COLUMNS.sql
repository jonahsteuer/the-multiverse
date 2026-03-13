-- ============================================================================
-- Make post_edits columns nullable so inserts don't fail on client-side IDs
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Make galaxy_id nullable (client-side galaxy IDs are not real UUIDs)
ALTER TABLE public.post_edits
  ALTER COLUMN galaxy_id DROP NOT NULL;

-- Make post_task_id nullable (already done in FIX_CONSTRAINTS.sql, but idempotent)
ALTER TABLE public.post_edits
  ALTER COLUMN post_task_id DROP NOT NULL;

SELECT 'post_edits columns made nullable successfully!' AS status;
