import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ============================================================================
// GET /api/instagram/callback
// Handles Facebook OAuth callback, exchanges code for access token,
// finds connected Instagram Business account, stores token in Supabase
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  // Use the actual request origin so this works on localhost, Vercel, and custom domains
  const appUrl = request.nextUrl.origin;

  if (error) {
    console.error('[Instagram OAuth] Error from Facebook:', error, searchParams.get('error_description'));
    return NextResponse.redirect(`${appUrl}?instagram_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?instagram_error=no_code`);
  }

  const appId = process.env.INSTAGRAM_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  const redirectUri = `${appUrl}/api/instagram/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${appUrl}?instagram_error=not_configured`);
  }

  try {
    // Step 1: Exchange code for short-lived access token
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('[Instagram OAuth] Token exchange failed:', tokenData);
      return NextResponse.redirect(`${appUrl}?instagram_error=token_exchange_failed`);
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token (60 days)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortLivedToken;
    const expiresIn = longTokenData.expires_in || 5183944; // ~60 days

    // Step 3: Get Facebook Pages the user manages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      console.error('[Instagram OAuth] No Facebook pages found');
      return NextResponse.redirect(`${appUrl}?instagram_error=no_pages`);
    }

    // Step 4: Find Instagram Business Account connected to the first page
    let instagramUserId = '';
    let instagramUsername = '';
    let pageId = '';
    let pageAccessToken = '';

    for (const page of pagesData.data) {
      const igRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();

      if (igData.instagram_business_account?.id) {
        instagramUserId = igData.instagram_business_account.id;
        pageId = page.id;
        pageAccessToken = page.access_token;

        // Get username
        const profileRes = await fetch(
          `https://graph.facebook.com/v21.0/${instagramUserId}?fields=username&access_token=${page.access_token}`
        );
        const profileData = await profileRes.json();
        instagramUsername = profileData.username || '';
        break;
      }
    }

    if (!instagramUserId) {
      console.error('[Instagram OAuth] No Instagram Business account connected to any page');
      return NextResponse.redirect(`${appUrl}?instagram_error=no_instagram_business_account`);
    }

    // Step 5: Get current Supabase user and save tokens
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          instagram_access_token: accessToken,
          instagram_user_id: instagramUserId,
          instagram_username: instagramUsername,
          instagram_token_expires_at: expiresAt,
          facebook_page_id: pageId,
          facebook_access_token: pageAccessToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[Instagram OAuth] Error saving tokens:', updateError);
      } else {
        console.log('[Instagram OAuth] ✅ Saved tokens for user:', user.id, '| IG:', instagramUsername);
      }
    } else {
      // Store in session/cookie for client to pick up
      console.warn('[Instagram OAuth] No Supabase session during callback — tokens saved to URL');
    }

    // Redirect back to app with success
    return NextResponse.redirect(
      `${appUrl}?instagram_connected=true&instagram_username=${encodeURIComponent(instagramUsername)}`
    );

  } catch (err: any) {
    console.error('[Instagram OAuth] Unexpected error:', err);
    return NextResponse.redirect(`${appUrl}?instagram_error=${encodeURIComponent(err.message)}`);
  }
}

