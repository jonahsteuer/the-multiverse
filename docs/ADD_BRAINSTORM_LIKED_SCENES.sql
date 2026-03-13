-- Migration: Add brainstorm_liked_scenes column to galaxies table
-- This enables the permanent liked-scenes bank (item E) so approved scenes
-- persist across brainstorm sessions for each galaxy/song.
--
-- Run this in the Supabase SQL Editor before deploying the app update.

ALTER TABLE galaxies
  ADD COLUMN IF NOT EXISTS brainstorm_liked_scenes JSONB DEFAULT '[]'::jsonb;

-- Verify
-- SELECT id, name, brainstorm_liked_scenes FROM galaxies LIMIT 5;
