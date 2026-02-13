-- ============================================
-- SIMPLIFIED SUPABASE DIAGNOSTIC
-- Run this in Supabase SQL Editor
-- ============================================

-- Check if tables exist
SELECT 'Tables Check' as diagnostic, table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'universes', 'galaxies', 'worlds')
ORDER BY table_name;

-- Check all profiles
SELECT 'All Profiles' as diagnostic, id, creator_name, email, onboarding_complete
FROM profiles
LIMIT 5;

-- Check all universes
SELECT 'All Universes' as diagnostic, id, name, creator_id, created_at
FROM universes
LIMIT 5;

-- Check all galaxies
SELECT 'All Galaxies' as diagnostic, id, name, universe_id, created_at
FROM galaxies
LIMIT 5;

-- Check if Cam Okoro profile exists
SELECT 'Cam Okoro Profile' as diagnostic, *
FROM profiles
WHERE LOWER(creator_name) LIKE '%cam%okoro%'
OR LOWER(creator_name) LIKE '%camokoro%';

-- Check Cam Okoro's universe
SELECT 'Cam Okoro Universe' as diagnostic, u.*
FROM universes u
JOIN profiles p ON p.id = u.creator_id
WHERE LOWER(p.creator_name) LIKE '%cam%okoro%'
OR LOWER(p.creator_name) LIKE '%camokoro%';

-- Check for orphaned galaxies (galaxies without a valid universe)
SELECT 'Orphaned Galaxies Check' as diagnostic, 
  g.id as galaxy_id, 
  g.name as galaxy_name,
  g.universe_id,
  CASE 
    WHEN u.id IS NULL THEN 'Universe does not exist!'
    ELSE 'OK'
  END as status
FROM galaxies g
LEFT JOIN universes u ON u.id = g.universe_id
WHERE u.id IS NULL;

