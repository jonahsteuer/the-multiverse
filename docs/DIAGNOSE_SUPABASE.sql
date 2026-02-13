-- ============================================
-- SUPABASE DIAGNOSTIC QUERIES
-- Run these in Supabase SQL Editor to diagnose issues
-- ============================================

-- STEP 1: Check if you're authenticated
SELECT 
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'Authenticated as: ' || auth.uid()
    ELSE 'NOT AUTHENTICATED - You need to be logged in!'
  END as auth_status;

-- STEP 2: Check if all tables exist
SELECT 
  't1: Tables' as step,
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'universes', 'galaxies', 'worlds')
ORDER BY table_name;

-- STEP 3: Check your profile
SELECT 
  't2: Your Profile' as step,
  id, creator_name, email, onboarding_complete
FROM profiles 
WHERE id = auth.uid();

-- STEP 4: Check your universes
SELECT 
  't3: Your Universes' as step,
  id, name, creator_id, created_at
FROM universes 
WHERE creator_id = auth.uid();

-- STEP 5: Check RLS policies on universes
SELECT 
  't4: Universe Policies' as step,
  policyname, 
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_check,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'universes'
ORDER BY policyname;

-- STEP 6: Check RLS policies on galaxies
SELECT 
  't5: Galaxy Policies' as step,
  policyname, 
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_check,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'galaxies'
ORDER BY policyname;

-- STEP 7: Try to manually insert a test galaxy
-- This will show the exact error if RLS is blocking
DO $$
DECLARE
  test_universe_id TEXT;
BEGIN
  -- Get the first universe
  SELECT id INTO test_universe_id FROM universes WHERE creator_id = auth.uid() LIMIT 1;
  
  IF test_universe_id IS NULL THEN
    RAISE NOTICE 'NO UNIVERSE FOUND - You need to create a universe first';
  ELSE
    RAISE NOTICE 'Found universe: %', test_universe_id;
    
    -- Try to insert a test galaxy
    BEGIN
      INSERT INTO galaxies (
        id, universe_id, name, release_date, visual_landscape, created_at
      ) VALUES (
        'test-galaxy-' || floor(random() * 1000000)::text,
        test_universe_id,
        'Test Galaxy',
        NULL,
        '{"theme": "test"}',
        NOW()
      );
      RAISE NOTICE 'SUCCESS - Test galaxy inserted!';
      
      -- Clean up test data
      DELETE FROM galaxies WHERE name = 'Test Galaxy';
      RAISE NOTICE 'Test galaxy cleaned up';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAILED - Error inserting test galaxy: %', SQLERRM;
    END;
  END IF;
END $$;

