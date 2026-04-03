/**
 * GET /api/auth/instagram?userId=xxx
 *
 * Redirects the user to Instagram OAuth consent screen.
 * Requires INSTAGRAM_APP_ID env var (from Meta App Dashboard).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: 'INSTAGRAM_APP_ID not configured' }, { status: 500 });
  }

  // Build callback URL using NEXT_PUBLIC_APP_URL or request origin
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  // Encode userId in state param so callback can associate token with the user
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

  const authUrl = new URL('https://api.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
