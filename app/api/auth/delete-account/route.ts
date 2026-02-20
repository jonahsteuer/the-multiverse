import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// This route uses the SERVICE ROLE KEY (server-side only) to fully delete
// a user from auth.users in Supabase. All related DB rows cascade-delete
// automatically via ON DELETE CASCADE foreign keys.
export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error('[delete-account] Missing env vars', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
        hasAnonKey: !!anonKey,
      });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Read the Authorization header (contains the user's JWT from the client)
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[delete-account] Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token using the regular anon client
    const regularClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await regularClient.auth.getUser();
    if (userError || !user) {
      console.error('[delete-account] Token verification failed:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[delete-account] Deleting user:', userId);

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Delete the auth user — all DB rows cascade-delete automatically
    // because all tables reference auth.users(id) ON DELETE CASCADE
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[delete-account] Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('[delete-account] Successfully deleted user:', userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
