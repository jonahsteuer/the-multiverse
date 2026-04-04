/**
 * GET /api/auth/instagram/callback?code=xxx&state=xxx
 *
 * Exchanges the authorization code for an access token,
 * stores the token in Supabase profiles.onboarding_profile.instagramOAuth,
 * then redirects the user back to the app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // Handle OAuth denial
  if (errorParam) {
    console.error('[instagram-callback] OAuth error:', errorParam);
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=${errorParam}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=missing_params`);
  }

  // Pre-parse returnTo before the main try/catch so error redirects can also use it
  let earlyReturnTo = '/';
  try {
    const sd = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    if (sd.returnTo && sd.returnTo.startsWith('/')) earlyReturnTo = sd.returnTo;
  } catch { /* ignore */ }

  // Decode userId (and optional returnTo) from state
  let userId: string;
  let returnTo = '/';
  try {
    const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    userId = stateData.userId;
    if (!userId) throw new Error('No userId in state');
    // Validate returnTo is a relative path (no external redirects)
    if (stateData.returnTo && stateData.returnTo.startsWith('/')) {
      returnTo = stateData.returnTo;
    }
  } catch {
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=invalid_state`);
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    console.error('[instagram-callback] Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET');
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=server_config`);
  }

  try {
    // Exchange code for short-lived access token
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[instagram-callback] Token exchange failed:', tokenData);
      return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=token_exchange`);
    }

    const { access_token: shortLivedToken, user_id: igUserId } = tokenData;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${appSecret}` +
      `&access_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedRes.json();
    const accessToken = longLivedData.access_token || shortLivedToken;

    // Store token in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[instagram-callback] Missing Supabase env vars');
      return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=server_config`);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();

    const updatedProfile = {
      ...(prof?.onboarding_profile || {}),
      instagramOAuth: {
        accessToken,
        tokenIssuedAt: new Date().toISOString(),
        igUserId: String(igUserId),
      },
    };

    await supabase
      .from('profiles')
      .update({ onboarding_profile: updatedProfile })
      .eq('id', userId);

    console.log(`[instagram-callback] OAuth token stored for user ${userId} (IG user ${igUserId})`);
    return NextResponse.redirect(`${baseUrl}${returnTo}${returnTo.includes('?') ? '&' : '?'}instagram_oauth=success`);

  } catch (err: any) {
    console.error('[instagram-callback] Error:', err.message);
    return NextResponse.redirect(`${baseUrl}${earlyReturnTo}${earlyReturnTo.includes('?') ? '&' : '?'}instagram_oauth=error&reason=server_error`);
  }
}
