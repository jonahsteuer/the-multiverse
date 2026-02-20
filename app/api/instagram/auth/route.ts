import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// GET /api/instagram/auth
// Redirects user to Facebook OAuth to connect their Instagram Business account
// Uses Facebook Graph API (required for Instagram Business/Creator insights)
// ============================================================================

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/instagram/callback`;

  if (!appId) {
    return NextResponse.json(
      { error: 'INSTAGRAM_APP_ID not configured' },
      { status: 500 }
    );
  }

  // Scopes needed for Instagram Business analytics:
  // - pages_show_list: list Facebook pages the user manages
  // - instagram_basic: access basic Instagram account info
  // - instagram_manage_insights: access post performance metrics
  // - pages_read_engagement: needed to get page-level data
  const scopes = [
    'pages_show_list',
    'instagram_basic',
    'instagram_manage_insights',
    'pages_read_engagement',
  ].join(',');

  const state = Buffer.from(JSON.stringify({ 
    timestamp: Date.now(),
    redirect: '/api/instagram/callback'
  })).toString('base64');

  const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  oauthUrl.searchParams.set('client_id', appId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('state', state);

  return NextResponse.redirect(oauthUrl.toString());
}

