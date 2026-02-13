# Fixing RLS Policy Issues

## Problem
When creating a new account, you get: "new row violates row-level security policy for table 'profiles'"

## Root Cause
The RLS policy requires `auth.uid() = id`, but after `signUp()`, the session might not be immediately available, causing the policy check to fail.

## Solution Options

### Option 1: Disable Email Confirmation (Recommended for Testing)

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Find **"Enable email confirmations"**
3. **Turn it OFF** (for testing/development)
4. This allows users to be immediately authenticated after signup

### Option 2: Use a Database Trigger (More Secure)

Create a trigger that automatically creates the profile using `SECURITY DEFINER` (bypasses RLS):

```sql
-- Function that creates profile with elevated privileges
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_type TEXT,
  spotify BOOLEAN DEFAULT false,
  instagram BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, creator_name, user_type, spotify_linked, instagram_linked
  ) VALUES (
    user_id, user_email, user_name, user_type, spotify, instagram
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then call this from the app using RPC
```

### Option 3: Update RLS Policy (Less Secure)

Temporarily allow inserts without auth check (NOT recommended for production):

```sql
-- DROP the existing policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create a more permissive policy (ONLY for development!)
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT WITH CHECK (true);
```

## Recommended Approach

**For Development/Testing:**
- Use Option 1 (disable email confirmation)
- This is the simplest and works immediately

**For Production:**
- Use Option 2 (database function with SECURITY DEFINER)
- Keep email confirmation enabled
- Update the app to call the function instead of direct INSERT

## Current Status

The app code now:
1. Waits 500ms after signup for session to establish
2. Checks for session before creating profile
3. Provides better error messages

If you still get RLS errors, **disable email confirmation** in Supabase settings.


