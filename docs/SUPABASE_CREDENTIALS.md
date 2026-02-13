# Supabase Credentials (Sensitive - Do Not Commit)

**⚠️ This file contains sensitive credentials. Never commit this to git!**

## Database Password

**Database Password:** `qugQwxug6KzjPGvq`

**Note:** This password is only needed when:
- Setting up the Supabase project initially
- Connecting to the database directly via SQL Editor or database tools
- Resetting database access

**The Next.js app does NOT need this password** - it only needs:
- `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon/public key)

## Where to Find Other Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Find:
   - **Project URL** → Use for `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → Use for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Security Notes

- This password is stored in `.env.local` (which is gitignored)
- Never share this password publicly
- If compromised, reset it in Supabase dashboard → Settings → Database


