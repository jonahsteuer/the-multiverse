import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ============================================================================
// GET /api/instagram/status
// Returns the current Instagram connection status for the logged-in user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false, reason: 'not_authenticated' });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('instagram_user_id, instagram_username, instagram_token_expires_at')
      .eq('id', user.id)
      .single();

    if (error || !profile?.instagram_user_id) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    if (profile.instagram_token_expires_at) {
      const expiresAt = new Date(profile.instagram_token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({ 
          connected: false, 
          reason: 'token_expired',
          username: profile.instagram_username 
        });
      }
    }

    return NextResponse.json({
      connected: true,
      username: profile.instagram_username,
      userId: profile.instagram_user_id,
    });

  } catch (err: any) {
    console.error('[Instagram Status] Error:', err);
    return NextResponse.json({ connected: false, error: err.message });
  }
}

// ============================================================================
// DELETE /api/instagram/status  
// Disconnects Instagram account
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await supabase
      .from('profiles')
      .update({
        instagram_access_token: null,
        instagram_user_id: null,
        instagram_username: null,
        instagram_token_expires_at: null,
        facebook_page_id: null,
        facebook_access_token: null,
      })
      .eq('id', user.id);

    return NextResponse.json({ disconnected: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

