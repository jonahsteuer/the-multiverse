import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar by clearing stored tokens
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Google Calendar disconnected successfully',
  });

  // Clear the tokens from cookies
  response.cookies.delete('google_calendar_access_token');
  response.cookies.delete('google_calendar_refresh_token');

  return response;
}


