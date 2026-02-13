-- ============================================
-- CLEAN SLATE FOR CAM OKORO TESTING
-- This removes ALL Cam Okoro data to start fresh
-- ============================================

-- Delete Cam's worlds first (foreign key constraints)
DELETE FROM worlds 
WHERE galaxy_id IN (
  SELECT g.id FROM galaxies g
  JOIN universes u ON u.id = g.universe_id
  JOIN profiles p ON p.id = u.creator_id
  WHERE LOWER(p.creator_name) LIKE '%cam%okoro%'
);

-- Delete Cam's galaxies
DELETE FROM galaxies
WHERE universe_id IN (
  SELECT u.id FROM universes u
  JOIN profiles p ON p.id = u.creator_id
  WHERE LOWER(p.creator_name) LIKE '%cam%okoro%'
);

-- Delete Cam's universes
DELETE FROM universes
WHERE creator_id IN (
  SELECT id FROM profiles
  WHERE LOWER(creator_name) LIKE '%cam%okoro%'
);

-- Delete Cam's profiles
DELETE FROM profiles
WHERE LOWER(creator_name) LIKE '%cam%okoro%';

-- Verify deletion
SELECT 'Remaining Cam Data:' as check_type, COUNT(*) as count
FROM profiles
WHERE LOWER(creator_name) LIKE '%cam%okoro%';

