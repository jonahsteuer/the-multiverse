-- ============================================
-- FIX UNIVERSE RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the old "ALL" policy that's missing WITH CHECK
DROP POLICY IF EXISTS "Users can manage own universes" ON universes;

-- Create separate policies with proper WITH CHECK clauses
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

-- Verify the fix
SELECT 
  'Fixed Policies:' as status,
  policyname, 
  cmd as operation,
  CASE 
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK'
    ELSE 'No WITH CHECK'
  END as with_check_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'universes'
ORDER BY policyname;

