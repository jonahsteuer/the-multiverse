import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { ScheduledPost } from '@/lib/smartedit-scheduler';

/**
 * POST /api/calendar/sync-smartedit
 * Creates Google Calendar events for SmartEdit scheduled posts.
 * Each post gets two events:
 *   - Trial reel day (day before): "🧪 Trial reels: {piece.name}"
 *   - Post day: "📱 Post: {piece.name}"
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_calendar_access_token')?.value;
    const refreshToken = request.cookies.get('google_calendar_refresh_token')?.value;

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        { error: 'Not authenticated', message: 'Please connect Google Calendar first' },
        { status: 401 },
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${request.nextUrl.origin}/api/calendar/callback`,
    );

    oauth2Client.setCredentials({
      access_token: accessToken || undefined,
      refresh_token: refreshToken || undefined,
    });

    // Refresh if access token missing
    if (!accessToken && refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch {
        return NextResponse.json(
          { error: 'Token refresh failed', message: 'Please reconnect Google Calendar' },
          { status: 401 },
        );
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { posts } = (await request.json()) as { posts: ScheduledPost[] };

    const created: string[] = [];
    const errors: string[] = [];

    for (const post of posts) {
      // ── Trial reel event (day before) ──────────────────────────────────
      try {
        const trialStart = new Date(`${post.trialReelDate}T14:00:00`);
        const trialEnd = new Date(trialStart);
        trialEnd.setHours(trialEnd.getHours() + 1);

        const trialEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `🧪 Trial reels: ${post.piece.name}`,
            description: [
              `SmartEdit trial reel — day before the main post.`,
              `Song section: ${post.piece.soundbyteId ?? 'n/a'}`,
              `Aspect ratio: ${post.piece.aspectRatio ?? '9:16'}`,
              `\n${post.piece.captionSuggestion ?? ''}`,
            ].join('\n'),
            start: { dateTime: trialStart.toISOString(), timeZone: 'UTC' },
            end:   { dateTime: trialEnd.toISOString(),   timeZone: 'UTC' },
            colorId: '5', // banana yellow
          },
        });
        if (trialEvent.data.id) created.push(trialEvent.data.id);
      } catch (err) {
        errors.push(`Trial reel for "${post.piece.name}": ${err instanceof Error ? err.message : 'failed'}`);
      }

      // ── Main post event ─────────────────────────────────────────────────
      try {
        const postStart = new Date(`${post.postDate}T14:00:00`);
        const postEnd = new Date(postStart);
        postEnd.setHours(postEnd.getHours() + 1);

        const postEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `📱 Post: ${post.piece.name}`,
            description: [
              `SmartEdit scheduled post — ${post.weekLabel}`,
              `Song section: ${post.piece.soundbyteId ?? 'n/a'}`,
              `Aspect ratio: ${post.piece.aspectRatio ?? '9:16'}`,
              `\nCaption:\n${post.piece.captionSuggestion ?? ''}`,
              `\nHook:\n${post.piece.hookNotes ?? ''}`,
            ].join('\n'),
            start: { dateTime: postStart.toISOString(), timeZone: 'UTC' },
            end:   { dateTime: postEnd.toISOString(),   timeZone: 'UTC' },
            colorId: '11', // tomato red for posts
          },
        });
        if (postEvent.data.id) created.push(postEvent.data.id);
      } catch (err) {
        errors.push(`Post for "${post.piece.name}": ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[sync-smartedit]', error);
    return NextResponse.json(
      { error: 'Failed to sync to Google Calendar', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
