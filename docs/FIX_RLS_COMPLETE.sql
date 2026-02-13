-- ============================================
-- COMPLETE RLS FIX - Nuclear Option
-- This drops EVERYTHING and recreates properly
-- ============================================

-- Disable RLS temporarily
ALTER TABLE universes DISABLE ROW LEVEL SECURITY;
ALTER TABLE galaxies DISABLE ROW LEVEL SECURITY;
ALTER TABLE worlds DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can manage own universes" ON universes;
DROP POLICY IF EXISTS "Users can view own universes" ON universes;
DROP POLICY IF EXISTS "Users can insert own universes" ON universes;
DROP POLICY IF EXISTS "Users can update own universes" ON universes;
DROP POLICY IF EXISTS "Users can delete own universes" ON universes;

DROP POLICY IF EXISTS "Users can manage own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can view own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can insert own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can update own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can delete own galaxies" ON galaxies;

DROP POLICY IF EXISTS "Users can manage own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can view own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can insert own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can update own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can delete own worlds" ON worlds;

-- Re-enable RLS
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE galaxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UNIVERSES POLICIES
-- ============================================

CREATE POLICY "Users can view own universes" ON universes
  FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert own universes" ON universes
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own universes" ON universes
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can delete own universes" ON universes
  FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================
-- GALAXIES POLICIES
-- ============================================

CREATE POLICY "Users can view own galaxies" ON galaxies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own galaxies" ON galaxies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own galaxies" ON galaxies
  FOR UPDATE
  USING (
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
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

-- ============================================
-- WORLDS POLICIES
-- ============================================

CREATE POLICY "Users can view own worlds" ON worlds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own worlds" ON worlds
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own worlds" ON worlds
  FOR UPDATE
  USING (
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
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

-- Verify
SELECT 'VERIFICATION - Universe Policies:' as check_type, policyname, cmd
FROM pg_policies 
WHERE tablename = 'universes'
ORDER BY policyname;

SELECT 'VERIFICATION - Galaxy Policies:' as check_type, policyname, cmd
FROM pg_policies 
WHERE tablename = 'galaxies'
ORDER BY policyname;

SELECT 'VERIFICATION - World Policies:' as check_type, policyname, cmd
FROM pg_policies 
WHERE tablename = 'worlds'
ORDER BY policyname;

