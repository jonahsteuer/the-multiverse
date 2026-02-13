/**
 * Google Calendar integration utilities
 * Note: This is a basic structure. Full OAuth implementation will require:
 * - Google OAuth setup
 * - Server-side token management
 * - googleapis package
 */

import type { CalendarEvent, Snapshot, ShootDay } from '@/types';

/**
 * Create calendar events from snapshots
 */
export function createSnapshotEvents(
  snapshots: Snapshot[],
  worldName: string
): CalendarEvent[] {
  return snapshots
    .filter((s) => s.postingDate)
    .map((snapshot) => ({
      id: `event-${snapshot.id}`,
      type: 'post' as const,
      title: `Post: ${worldName} - ${snapshot.platform}`,
      description: snapshot.visualDescription + (snapshot.caption ? `\n\nCaption: "${snapshot.caption}"` : ''),
      date: snapshot.postingDate!,
      time: '14:00', // Default to 2pm, can be customized
      worldId: snapshot.worldId,
      snapshotId: snapshot.id,
      syncedToGoogle: false,
      createdAt: new Date().toISOString(),
    }));
}

/**
 * Create calendar events from shoot days
 */
export function createShootDayEvents(
  shootDays: ShootDay[],
  worldName: string
): CalendarEvent[] {
  return shootDays.map((shootDay) => ({
    id: `event-${shootDay.id}`,
    type: 'shoot' as const,
    title: `Shoot Day: ${worldName}`,
    description: `Film ${shootDay.snapshots.length} snapshot${shootDay.snapshots.length !== 1 ? 's' : ''} for ${worldName}`,
    date: shootDay.date,
    time: '10:00', // Default shoot start time
    worldId: shootDay.worldId,
    shootDayId: shootDay.id,
    syncedToGoogle: false,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Format event for Google Calendar API
 * Note: This requires googleapis package and OAuth tokens
 */
export function formatForGoogleCalendar(event: CalendarEvent): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
} {
  const date = new Date(event.date);
  const [hours, minutes] = event.time?.split(':').map(Number) || [14, 0];
  date.setHours(hours, minutes, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(endDate.getHours() + 1); // 1 hour duration

  return {
    summary: event.title,
    description: event.description || '',
    start: {
      dateTime: date.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

/**
 * Check if Google Calendar is connected
 */
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    const response = await fetch('/api/calendar/status');
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

/**
 * Sync events to Google Calendar
 * TODO: Implement actual Google Calendar API integration
 */
export async function syncToGoogleCalendar(events: CalendarEvent[]): Promise<{
  success: boolean;
  syncedCount: number;
  errors?: string[];
}> {
  // Mock implementation
  // In production, this would:
  // 1. Check OAuth token
  // 2. Create events via Google Calendar API
  // 3. Store Google event IDs
  // 4. Update events with syncedToGoogle: true

  console.log('Mock: Syncing events to Google Calendar', events);
  
  return {
    success: true,
    syncedCount: events.length,
  };
}

