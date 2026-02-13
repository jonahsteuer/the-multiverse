-- ============================================
-- ADD ONBOARDING COLUMNS TO PROFILES TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add onboarding_complete column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Add onboarding_profile column (stores the full onboarding profile data as JSONB)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_profile JSONB DEFAULT NULL;

-- Update the create_profile_for_user function to include new columns
DROP FUNCTION IF EXISTS public.create_profile_for_user(UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN);

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

