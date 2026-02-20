import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/calendar/auth
 * Initiate Google OAuth flow for Calendar access
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUri = searchParams.get('redirect_uri') || `${request.nextUrl.origin}/api/calendar/callback`;
  const returnUrl = searchParams.get('return_url'); // URL to redirect back to after OAuth

  // Google OAuth configuration
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // Using calendar scope - this allows read/write access to calendars
  const scope = 'https://www.googleapis.com/auth/calendar';

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. GOOGLE_CLIENT_ID is missing.' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection and return URL
  const state = Buffer.from(JSON.stringify({ 
    redirectUri,
    returnUrl: returnUrl || null 
  })).toString('base64');

  // Build OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline'); // Required for refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
  authUrl.searchParams.set('state', state);

  // Debug: Log the redirect URI being used
  console.log('OAuth redirect URI:', redirectUri);
  console.log('Make sure this exact URI is registered in Google Cloud Console');

  // Redirect to Google OAuth
  return NextResponse.redirect(authUrl.toString());
}

