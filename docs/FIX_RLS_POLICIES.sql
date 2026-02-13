-- ============================================
-- FIX RLS POLICIES FOR 403 ERRORS
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing world policies (drop all possible policy names)
DROP POLICY IF EXISTS "Users can view own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can manage own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can insert own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can update own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can delete own worlds" ON worlds;

-- Recreate with proper WITH CHECK for INSERT operations
CREATE POLICY "Users can view own worlds" ON worlds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

-- Separate policies for INSERT/UPDATE/DELETE with WITH CHECK
CREATE POLICY "Users can insert own worlds" ON worlds
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own worlds" ON worlds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own worlds" ON worlds
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

-- Also fix galaxy policies to be safe
DROP POLICY IF EXISTS "Users can manage own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can view own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can insert own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can update own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can delete own galaxies" ON galaxies;

CREATE POLICY "Users can insert own galaxies" ON galaxies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own galaxies" ON galaxies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own galaxies" ON galaxies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

