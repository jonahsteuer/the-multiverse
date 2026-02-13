import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/calendar/status
 * Check if Google Calendar is connected
 */
export async function GET(request: NextRequest) {
  try {
    // Check for access token in cookies
    const accessToken = request.cookies.get('google_calendar_access_token')?.value;
    const refreshToken = request.cookies.get('google_calendar_refresh_token')?.value;

    const connected = !!(accessToken || refreshToken);

    return NextResponse.json({
      connected,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    return NextResponse.json({
      connected: false,
      error: 'Failed to check status',
    });
  }
}

