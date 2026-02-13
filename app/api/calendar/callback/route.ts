import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/calendar/callback
 * Handle Google OAuth callback and exchange code for tokens
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Try to decode return URL from state if available
  let returnUrl: string | null = null;
  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      returnUrl = decodedState.returnUrl || null;
    } catch {
      // State might not have returnUrl, that's okay
    }
  }

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code not provided' },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  try {
    // Exchange authorization code for tokens
    console.log('Exchanging authorization code for tokens...');
    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', clientId ? `${clientId.substring(0, 20)}...` : 'missing');
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      console.error('Status:', tokenResponse.status);
      console.error('Status text:', tokenResponse.statusText);
      
      // Try to parse error as JSON for better error message
      let errorMessage = 'Failed to exchange authorization code';
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error_description || errorJson.error || errorMessage;
      } catch {
        // If not JSON, use the text as is
        errorMessage = errorData || errorMessage;
      }
      
      // Redirect back to original page with error, or to root if no return URL
      const redirectUrl = returnUrl
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}calendar_error=${encodeURIComponent(errorMessage)}`
        : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?calendar_error=${encodeURIComponent(errorMessage)}`;
      
      return NextResponse.redirect(redirectUrl);
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful!');
    console.log('Has access token:', !!tokens.access_token);
    console.log('Has refresh token:', !!tokens.refresh_token);

    // TODO: Store tokens securely (database, encrypted session, etc.)
    // For now, we'll store in a cookie (not ideal for production)
    // Redirect back to the original page if available, otherwise to root
    const redirectUrl = returnUrl 
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}calendar_connected=true`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?calendar_connected=true`;
    
    const response = NextResponse.redirect(redirectUrl);

    // Store tokens in httpOnly cookie (in production, use secure storage)
    response.cookies.set('google_calendar_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    });

    if (tokens.refresh_token) {
      response.cookies.set('google_calendar_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Try to get return URL from state
    let returnUrl: string | null = null;
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        returnUrl = decodedState.returnUrl || null;
      } catch {
        // Ignore
      }
    }
    
    // Redirect back to original page with error, or to root if no return URL
    const redirectUrl = returnUrl
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}calendar_error=${encodeURIComponent(errorMessage)}`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?calendar_error=${encodeURIComponent(errorMessage)}`;
    
    return NextResponse.redirect(redirectUrl);
  }
}

