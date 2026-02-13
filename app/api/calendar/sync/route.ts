import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { CalendarEvent } from '@/types';
import { google } from 'googleapis';
import { formatForGoogleCalendar } from '@/lib/google-calendar';

// Validation schema
const syncCalendarSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['post', 'shoot', 'edit_deadline', 'release']),
      title: z.string(),
      description: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().optional(),
      worldId: z.string().optional(),
      snapshotId: z.string().optional(),
      shootDayId: z.string().optional(),
    })
  ),
});

/**
 * POST /api/calendar/sync
 * Sync events to Google Calendar
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = syncCalendarSchema.parse(body);

    // Get access token from cookies
    const accessToken = request.cookies.get('google_calendar_access_token')?.value;
    const refreshToken = request.cookies.get('google_calendar_refresh_token')?.value;

    if (!accessToken && !refreshToken) {
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

    // Refresh token if needed (no access token or if it's expired)
    if (!accessToken && refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        
        // Update the access token cookie with the new token
        // Note: In production, you'd want to update this in the response
      } catch (refreshError) {
        return NextResponse.json(
          { error: 'Token refresh failed', message: 'Please reconnect Google Calendar' },
          { status: 401 }
        );
      }
    }

    // Try to use the token - if it fails, try refreshing
    try {
      // Test the token by making a simple API call
      const testCalendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await testCalendar.calendarList.list({ maxResults: 1 });
    } catch (tokenError: any) {
      // If token is invalid/expired and we have a refresh token, try refreshing
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

    // Create events in Google Calendar
    const syncedEvents = [];
    const errors: string[] = [];

    for (const event of data.events) {
      try {
        const calendarEvent = formatForGoogleCalendar(event as CalendarEvent);
        
        const result = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: calendarEvent,
        });

        syncedEvents.push({
          ...event,
          syncedToGoogle: true,
          googleEventId: result.data.id,
        });
      } catch (error) {
        console.error(`Error creating event ${event.id}:`, error);
        errors.push(`Failed to sync ${event.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      syncedCount: syncedEvents.length,
      events: syncedEvents,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0
        ? `Successfully synced ${syncedEvents.length} event${syncedEvents.length !== 1 ? 's' : ''} to Google Calendar!`
        : `Synced ${syncedEvents.length} of ${data.events.length} events. ${errors.length} failed.`,
    });
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to sync to Google Calendar',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calendar/status
 * Check Google Calendar connection status
 */
export async function GET(request: NextRequest) {
  // Check for access token in cookies
  const accessToken = request.cookies.get('google_calendar_access_token')?.value;
  const refreshToken = request.cookies.get('google_calendar_refresh_token')?.value;

  if (accessToken || refreshToken) {
    return NextResponse.json({
      connected: true,
      message: 'Google Calendar is connected.',
    });
  }

  return NextResponse.json({
    connected: false,
    message: 'Google Calendar not connected.',
  });
}

