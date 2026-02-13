# Supabase Setup Checklist

## ✅ What You Need in Supabase

Run **ONE** SQL file in your Supabase SQL Editor:

### **`docs/COMPLETE_SETUP.sql`** (RECOMMENDED - Has Everything)

This single file includes:
- ✅ All tables (profiles, universes, galaxies, worlds)
- ✅ Onboarding columns (onboarding_complete, onboarding_profile)
- ✅ All RLS policies (with proper WITH CHECK clauses)
- ✅ create_profile_for_user function (with onboarding support)

**Just run this ONE file and you're done!**

---

## Alternative: If You Already Have Tables

If you've already run `COMPLETE_SQL_SCHEMA.sql`, you need to run these in order:

1. **`docs/ADD_ONBOARDING_COLUMNS.sql`** - Adds onboarding columns
2. **`docs/FIX_RLS_POLICIES.sql`** - Fixes RLS policies for INSERT operations

---

## Verification Queries

Run these in Supabase SQL Editor to check if everything is set up:

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'universes', 'galaxies', 'worlds');
```
**Should return:** 4 rows

### Check Onboarding Columns Exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('onboarding_complete', 'onboarding_profile');
```
**Should return:** 2 rows (onboarding_complete: boolean, onboarding_profile: jsonb)

### Check RLS Policies Exist
```sql
SELECT policyname, tablename 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'universes', 'galaxies', 'worlds')
ORDER BY tablename, policyname;
```
**Should return:** At least 12 policies:
- profiles: 3 policies (view, update, insert)
- universes: 2 policies (view, manage)
- galaxies: 4 policies (view, insert, update, delete)
- worlds: 4 policies (view, insert, update, delete)

### Check Function Exists
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_profile_for_user';
```
**Should return:** 1 row

---

## Common Errors and Fixes

### Error: "Could not find the 'onboarding_complete' column"
**Fix:** Run `docs/ADD_ONBOARDING_COLUMNS.sql`

### Error: "RLS Policy Error" or 403 Forbidden
**Fix:** Run `docs/FIX_RLS_POLICIES.sql`

### Error: "Function create_profile_for_user does not exist"
**Fix:** The function is created in `COMPLETE_SETUP.sql` or `ADD_ONBOARDING_COLUMNS.sql`

---

## Quick Fix: Run Everything

If you're not sure what you have, just run:
**`docs/COMPLETE_SETUP.sql`**

It's idempotent (safe to run multiple times) and will create/update everything.

