-- ============================================
-- CLEAR ALL DATA FROM SUPABASE
-- Run this in Supabase SQL Editor
-- WARNING: This will delete ALL data!
-- ============================================

-- Delete all worlds
DELETE FROM worlds;

-- Delete all galaxies
DELETE FROM galaxies;

-- Delete all universes
DELETE FROM universes;

-- Delete all profiles
DELETE FROM profiles;

-- Delete auth users (requires admin access)
-- Replace 'your-email@example.com' with the actual email you want to delete
-- Or remove the WHERE clause to delete ALL users (be careful!)
DELETE FROM auth.users WHERE email = 'your-email@example.com';

-- Alternative: Delete all auth users (use with caution!)
-- DELETE FROM auth.users;

-- Note: If the DELETE FROM auth.users fails with permission error, you need to:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Manually delete users from there
-- OR
-- 3. Use Supabase CLI: supabase db reset (resets entire database)

