import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/calendar/fetch
 * Fetch events from Google Calendar
 */
export async function GET(request: NextRequest) {
  console.log('[API /calendar/fetch] 📅 Request received');
  try {
    // Get access token from cookies
    const accessToken = request.cookies.get('google_calendar_access_token')?.value;
    const refreshToken = request.cookies.get('google_calendar_refresh_token')?.value;

    console.log('[API /calendar/fetch] Has accessToken:', !!accessToken);
    console.log('[API /calendar/fetch] Has refreshToken:', !!refreshToken);

    if (!accessToken && !refreshToken) {
      console.log('[API /calendar/fetch] ❌ Not authenticated');
      return NextResponse.json(
        { error: 'Not authenticated', message: 'Please connect Google Calendar first' },
        { status: 401 }
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/callback`
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken || undefined,
      refresh_token: refreshToken || undefined,
    });

    // Refresh token if needed
    if (!accessToken && refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (refreshError) {
        return NextResponse.json(
          { error: 'Token refresh failed', message: 'Please reconnect Google Calendar' },
          { status: 401 }
        );
      }
    }

    // Test the token
    try {
      const testCalendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await testCalendar.calendarList.list({ maxResults: 1 });
    } catch (tokenError: any) {
      if (refreshToken && (tokenError.code === 401 || tokenError.code === 403)) {
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);
        } catch (refreshError) {
          return NextResponse.json(
            { error: 'Token expired and refresh failed', message: 'Please reconnect Google Calendar' },
            { status: 401 }
          );
        }
      } else {
        throw tokenError;
      }
    }

    // Initialize Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get date range from query params (default to next 3 months)
    const timeMin = request.nextUrl.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = request.nextUrl.searchParams.get('timeMax') || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch events from Google Calendar
    console.log('[API /calendar/fetch] Fetching events from', timeMin, 'to', timeMax);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    console.log('[API /calendar/fetch] Raw response items:', response.data.items?.length || 0);

    const events = (response.data.items || []).map((event) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      
      return {
        id: event.id || '',
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        start: start || '',
        end: end || '',
        location: event.location || '',
        htmlLink: event.htmlLink || '',
        colorId: event.colorId,
        // Try to extract world info from description or title
        isMultiverseEvent: event.description?.includes('Multiverse') || event.summary?.includes('Post:') || event.summary?.includes('Shoot:'),
      };
    });

    console.log('[API /calendar/fetch] ✅ Returning', events.length, 'events');

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('Error fetching from Google Calendar:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch from Google Calendar',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


