# Checking Your Supabase Key

## Important: Key Format

The key you provided starts with `sb_publishable_` which is unusual. Supabase typically uses "anon public" keys that look different.

## How to Get the Correct Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Look for **"Project API keys"** section
5. Find the key labeled **"anon"** or **"anon public"** (NOT "publishable")
6. Copy that key - it should be much longer and look different

## Typical Key Formats

- **Anon key**: Usually starts with `eyJ...` (JWT format) or is a long string
- **Publishable key**: Starts with `sb_publishable_` (this is for specific Supabase features)

For the Next.js app, you need the **"anon public"** key, not the publishable key.

## Update .env.local

Once you have the correct anon key, update:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

Then restart your dev server.


