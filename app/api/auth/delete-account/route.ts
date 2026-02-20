import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This route uses the SERVICE ROLE KEY (server-side only) to fully delete
// a user from auth.users in Supabase.
export async function DELETE() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Create an admin client using the service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the user from the regular (anon) client via the Authorization header
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return NextResponse.json({ error: 'Supabase anon key not configured' }, { status: 500 });
    }

    // We need to identify who is making this request.
    // We'll use the admin client to list users — but really we pass the userId
    // from the client (it's their own ID, no security risk since we only delete
    // the currently authenticated user — we verify via the regular client).
    const regularClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // The Authorization header contains the user's JWT
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get the user
    const { data: { user }, error: userError } = await regularClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Delete all database records first (cascade)
    const userId = user.id;

    // Delete team memberships
    await adminClient.from('team_members').delete().eq('user_id', userId);

    // Delete tasks assigned to this user
    await adminClient.from('team_tasks').delete().eq('assigned_to', userId);

    // Delete teams owned by this user (and their tasks/members)
    const { data: teamsOwned } = await adminClient
      .from('teams')
      .select('id')
      .eq('created_by', userId);

    if (teamsOwned && teamsOwned.length > 0) {
      for (const t of teamsOwned) {
        await adminClient.from('team_tasks').delete().eq('team_id', t.id);
        await adminClient.from('team_members').delete().eq('team_id', t.id);
      }
      await adminClient.from('teams').delete().eq('created_by', userId);
    }

    // Delete universes + galaxies + worlds
    const { data: universesData } = await adminClient
      .from('universes')
      .select('id')
      .eq('creator_id', userId);

    if (universesData && universesData.length > 0) {
      for (const universe of universesData) {
        const { data: galaxiesData } = await adminClient
          .from('galaxies')
          .select('id')
          .eq('universe_id', universe.id);

        if (galaxiesData && galaxiesData.length > 0) {
          for (const galaxy of galaxiesData) {
            await adminClient.from('worlds').delete().eq('galaxy_id', galaxy.id);
          }
          await adminClient.from('galaxies').delete().eq('universe_id', universe.id);
        }
      }
      await adminClient.from('universes').delete().eq('creator_id', userId);
    }

    // Delete profile
    await adminClient.from('profiles').delete().eq('id', userId);

    // Finally: delete the auth user itself
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('[delete-account] Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

