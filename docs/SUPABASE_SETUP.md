# Supabase Setup Guide

## Overview

The Multiverse uses Supabase for authentication and data persistence. If Supabase is not configured, the app will fall back to localStorage (which only works on the same browser/device).

## Quick Setup (Recommended for Production)

### Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: "The Multiverse" (or your project name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait 2-3 minutes for project to initialize

### Step 2: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

### Step 3: Add to Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Set Up Database Schema

Run this SQL in your Supabase SQL Editor (Settings → SQL Editor):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (user accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('artist', 'videographer', 'editor', 'viewer')),
  spotify_linked BOOLEAN DEFAULT false,
  instagram_linked BOOLEAN DEFAULT false,
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

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;
ALTER TABLE galaxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows re-running this script)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own universes" ON universes;
DROP POLICY IF EXISTS "Users can manage own universes" ON universes;
DROP POLICY IF EXISTS "Users can view own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can manage own galaxies" ON galaxies;
DROP POLICY IF EXISTS "Users can view own worlds" ON worlds;
DROP POLICY IF EXISTS "Users can manage own worlds" ON worlds;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to insert their own profile (must match their auth.uid())
-- This policy allows the authenticated user to create their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own universes" ON universes
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can manage own universes" ON universes
  FOR ALL USING (auth.uid() = creator_id);

CREATE POLICY "Users can view own galaxies" ON galaxies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own galaxies" ON galaxies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM universes 
      WHERE universes.id = galaxies.universe_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own worlds" ON worlds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own worlds" ON worlds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM galaxies 
      JOIN universes ON universes.id = galaxies.universe_id
      WHERE galaxies.id = worlds.galaxy_id 
      AND universes.creator_id = auth.uid()
    )
  );

-- Drop existing function if it exists (needed when changing return type)
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN);

-- Function to create profile with elevated privileges (bypasses RLS)
-- This is called from the app after user signup
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_type TEXT,
  spotify_linked BOOLEAN DEFAULT false,
  instagram_linked BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO public.profiles (
    id, email, creator_name, user_type, spotify_linked, instagram_linked
  ) VALUES (
    user_id, user_email, user_name, user_type, spotify_linked, instagram_linked
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    creator_name = EXCLUDED.creator_name,
    user_type = EXCLUDED.user_type,
    spotify_linked = EXCLUDED.spotify_linked,
    instagram_linked = EXCLUDED.instagram_linked,
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
```

### Step 5: Configure Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. (Optional) Configure other providers (Google, GitHub, etc.)

### Step 6: Restart Dev Server

```bash
npm run dev
```

## Local Development (Without Supabase)

If you don't want to set up Supabase right now, the app will use localStorage as a fallback. This means:
- ✅ Works immediately (no setup needed)
- ✅ Data persists in your browser
- ❌ Data is lost if you clear browser data
- ❌ Data doesn't sync across devices
- ❌ Not suitable for production

## Testing Authentication

1. Create an account through the onboarding form
2. Your account will be saved to Supabase (or localStorage)
3. Refresh the page - you should stay logged in
4. Close and reopen the browser - you should still be logged in

## Troubleshooting

### "Supabase credentials not configured"
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
- Restart your dev server

### "Row Level Security policy violation"
- Make sure you ran the SQL schema setup
- Check that RLS policies are created correctly

### Data not persisting
- Check browser console for errors
- Verify Supabase credentials are correct
- Check Supabase dashboard → Table Editor to see if data is being saved

