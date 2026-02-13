-- ============================================
-- COMPLETE SUPABASE SETUP - RUN THIS ONCE
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- This includes: tables, columns, RLS policies, and functions
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: CREATE TABLES
-- ============================================

-- Profiles table (user accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('artist', 'videographer', 'editor', 'viewer')),
  spotify_linked BOOLEAN DEFAULT false,
  instagram_linked BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  onboarding_profile JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Universes table
CREATE TABLE IF NOT EXISTS universes (
  id TEXT PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Galaxies table
CREATE TABLE IF NOT EXISTS galaxies (
  id TEXT PRIMARY KEY,
  universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  release_date DATE,
  visual_landscape JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worlds table
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  galaxy_id TEXT NOT NULL REFERENCES galaxies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  release_date DATE NOT NULL,
  color TEXT NOT NULL,
  visual_landscape JSONB NOT NULL,
  snapshot_strategy JSONB,
  is_public BOOLEAN DEFAULT false,
  is_released BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: ADD ONBOARDING COLUMNS (if not already added)
-- ============================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_profile JSONB DEFAULT NULL;

-- ============================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE galaxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: DROP OLD POLICIES (if they exist)
-- ============================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Universe policies
DROP POLICY IF EXISTS "Users can view own universes" ON universes;
DROP POLICY IF EXISTS "Users can manage own universes" ON universes;

-- Galaxy policies
DROP POLICY IF EXISTS "Users can view own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can manage own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can insert own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can update own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can delete own galaxies" ON galaxies;

-- World policies
DROP POLICY IF EXISTS "Users can view own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can manage own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can insert own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can update own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can delete own worlds" ON worlds;

-- ============================================
-- STEP 5: CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Universe policies
CREATE POLICY "Users can view own universes" ON universes
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can manage own universes" ON universes
  FOR ALL USING (auth.uid() = creator_id);

-- Galaxy policies
CREATE POLICY "Users can view own galaxies" ON galaxies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

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

-- World policies
CREATE POLICY "Users can view own worlds" ON worlds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

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

-- ============================================
-- STEP 6: CREATE PROFILE FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_type TEXT,
  spotify_linked BOOLEAN DEFAULT false,
  instagram_linked BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  onboarding_profile JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO public.profiles (
    id, email, creator_name, user_type, spotify_linked, instagram_linked, onboarding_complete, onboarding_profile
  ) VALUES (
    user_id, user_email, user_name, user_type, spotify_linked, instagram_linked, onboarding_complete, onboarding_profile
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    creator_name = EXCLUDED.creator_name,
    user_type = EXCLUDED.user_type,
    spotify_linked = EXCLUDED.spotify_linked,
    instagram_linked = EXCLUDED.instagram_linked,
    onboarding_complete = EXCLUDED.onboarding_complete,
    onboarding_profile = EXCLUDED.onboarding_profile,
    updated_at = NOW();
  
  -- Return the created/updated profile as JSON
  SELECT to_jsonb(p.*) INTO result
  FROM public.profiles p
  WHERE p.id = user_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;

-- ============================================
-- VERIFICATION QUERIES (optional - run to check)
-- ============================================

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'universes', 'galaxies', 'worlds');

-- Check if columns exist on profiles
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('onboarding_complete', 'onboarding_profile');

-- Check if policies exist
-- SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'universes', 'galaxies', 'worlds');

