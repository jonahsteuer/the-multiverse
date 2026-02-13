-- Check Universe RLS Policies
SELECT 
  policyname, 
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'universes'
ORDER BY policyname;

-- Try to insert a test universe as each Cam Okoro user
DO $$
DECLARE
  cam_user_id UUID;
  test_universe_id TEXT;
BEGIN
  -- Get Cam Okoro's user ID (first one)
  SELECT id INTO cam_user_id FROM profiles WHERE creator_name = 'Cam okoro' LIMIT 1;
  
  RAISE NOTICE 'Testing with user ID: %', cam_user_id;
  
  -- Try to insert a test universe
  test_universe_id := 'test-universe-' || floor(random() * 1000000)::text;
  
  BEGIN
    INSERT INTO universes (
      id,
      creator_id,
      name,
      created_at
    ) VALUES (
      test_universe_id,
      cam_user_id,
      'Test Universe',
      NOW()
    );
    RAISE NOTICE '✅ SUCCESS - Test universe inserted with ID: %', test_universe_id;
    
    -- Clean up
    DELETE FROM universes WHERE id = test_universe_id;
    RAISE NOTICE '🧹 Cleaned up test universe';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FAILED - Error: %', SQLERRM;
  END;
END $$;

