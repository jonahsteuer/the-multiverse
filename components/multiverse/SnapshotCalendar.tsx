'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Snapshot, World, Galaxy, ShootDay, CalendarEvent as CalendarEventType } from '@/types';
import { formatPostingDate, getDaysUntilPosting } from '@/lib/snapshot-schedule';
import { formatShootDay, getDaysUntilShoot } from '@/lib/shoot-day-calculator';
import { createSnapshotEvents, createShootDayEvents, syncToGoogleCalendar } from '@/lib/google-calendar';
import { connectGoogleCalendar, checkCalendarConnection } from '@/lib/google-oauth';
import { calculateShootDays } from '@/lib/shoot-day-calculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarEvent {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  type: 'post' | 'shoot' | 'edit' | 'shot_list' | 'release';
  title: string;
  description?: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  snapshotId?: string;
  shootDayId?: string;
  snapshot?: Snapshot;
  shootDay?: ShootDay;
}

interface SnapshotCalendarProps {
  worlds: World[];
  galaxy?: Galaxy;
  snapshots?: Snapshot[]; // Optional: if provided, use these instead of extracting from worlds
  onEventClick?: (event: CalendarEvent) => void;
}

export function SnapshotCalendar({ worlds, galaxy, snapshots, onEventClick }: SnapshotCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Check calendar connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await checkCalendarConnection();
      setIsConnected(connected);
    };
    checkConnection();
  }, []);

  // Get first day of month and number of days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate shoot days for all worlds
  const allShootDays = useMemo(() => {
    const shootDays: ShootDay[] = [];
    worlds.forEach((world) => {
      if (world.snapshotStrategy) {
        const worldShootDays = calculateShootDays(world.snapshotStrategy.snapshots, world.id);
        shootDays.push(...worldShootDays);
      }
    });
    return shootDays;
  }, [worlds]);

  // Build calendar events from worlds
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    worlds.forEach((world) => {
      // Add release date
      events.push({
        id: `release-${world.id}`,
        date: world.releaseDate,
        type: 'release',
        title: `${world.name} Release`,
        description: `Release date for ${world.name}`,
        worldId: world.id,
        worldName: world.name,
        worldColor: world.color,
      });

      // Add snapshots (posting dates) - use snapshotStrategy snapshots directly
      // The snapshots prop is optional and mainly for filtering, but we prioritize snapshotStrategy
      let snapshotsToProcess: Snapshot[] = [];
      
      // Always use snapshotStrategy snapshots if available (they're already associated with this world)
      if (world.snapshotStrategy && world.snapshotStrategy.snapshots) {
        snapshotsToProcess = world.snapshotStrategy.snapshots;
        console.log(`[Calendar] World "${world.name}": Found ${snapshotsToProcess.length} snapshots in snapshotStrategy`);
      } else if (snapshots && snapshots.length > 0) {
        // Fallback: use provided snapshots if snapshotStrategy doesn't exist
        // Filter by worldId if provided, otherwise use all (assuming they're for this world)
        snapshotsToProcess = snapshots.filter((s) => !s.worldId || s.worldId === world.id);
        console.log(`[Calendar] World "${world.name}": Using ${snapshotsToProcess.length} provided snapshots`);
      } else {
        console.log(`[Calendar] World "${world.name}": No snapshots found`);
      }
      
      // Process each snapshot
      snapshotsToProcess.forEach((snapshot) => {
        // Only add if snapshot has a posting date
        if (snapshot.postingDate) {
          console.log(`[Calendar] Adding post event for snapshot ${snapshot.id} on ${snapshot.postingDate}`);
            events.push({
              id: `post-${snapshot.id}`,
              date: snapshot.postingDate,
              type: 'post',
              title: snapshot.visualDescription.substring(0, 50) + (snapshot.visualDescription.length > 50 ? '...' : ''),
              description: snapshot.visualDescription,
              worldId: world.id,
              worldName: world.name,
              worldColor: world.color,
              snapshotId: snapshot.id,
              snapshot,
            });

            // Add shot list deadline (3 days before filming date)
            if (snapshot.suggestedFilmingDate) {
              const filmingDate = new Date(snapshot.suggestedFilmingDate);
              const shotListDate = new Date(filmingDate);
              shotListDate.setDate(shotListDate.getDate() - 3); // 3 days before filming

              events.push({
                id: `shot-list-${snapshot.id}`,
                date: shotListDate.toISOString().split('T')[0],
                type: 'shot_list',
                title: `Final Shot List: ${world.name}`,
                description: `Shot list due for ${snapshot.visualDescription.substring(0, 30)}...`,
                worldId: world.id,
                worldName: world.name,
                worldColor: world.color,
                snapshotId: snapshot.id,
                snapshot,
              });

              // Add filming date (shoot day)
              events.push({
                id: `shoot-${snapshot.id}`,
                date: snapshot.suggestedFilmingDate,
                type: 'shoot',
                title: `Shoot: ${world.name}`,
                description: `Film snapshot: ${snapshot.visualDescription.substring(0, 50)}...`,
                worldId: world.id,
                worldName: world.name,
                worldColor: world.color,
                snapshotId: snapshot.id,
                snapshot,
              });
            }
          }
        });
    });

    console.log(`[Calendar] Total events generated: ${events.length}`);
    console.log(`[Calendar] Event types:`, {
      posts: events.filter(e => e.type === 'post').length,
      shoots: events.filter(e => e.type === 'shoot').length,
      shotLists: events.filter(e => e.type === 'shot_list').length,
      releases: events.filter(e => e.type === 'release').length,
    });
    return events;
  }, [worlds, snapshots]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      if (!grouped[event.date]) {
        grouped[event.date] = [];
      }
      grouped[event.date].push(event);
    });
    return grouped;
  }, [calendarEvents]);

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Get today's date string
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  // Check if date is today
  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateString = date.toISOString().split('T')[0];
    return eventsByDate[dateString] || [];
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  // Handle calendar sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const allSnapshots = snapshots || worlds.flatMap((w) => w.snapshotStrategy?.snapshots || []);
      const snapshotEvents = createSnapshotEvents(allSnapshots, worlds[0]?.name || 'World');
      const shootDayEvents = createShootDayEvents(allShootDays, worlds[0]?.name || 'World');
      const allEvents: CalendarEventType[] = [...snapshotEvents, ...shootDayEvents];

      if (allEvents.length === 0) {
        setSyncStatus({
          success: false,
          message: 'No events to sync. Generate snapshots first.',
        });
        return;
      }

      const result = await syncToGoogleCalendar(allEvents);

      if (result.success) {
        setSyncStatus({
          success: true,
          message: `Successfully synced ${result.syncedCount} event${result.syncedCount !== 1 ? 's' : ''} to Google Calendar!`,
        });
        setIsConnected(true);
      } else {
        setSyncStatus({
          success: false,
          message: `Failed to sync events. ${result.errors?.join(', ') || 'Unknown error'}`,
        });
      }
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error);
      setSyncStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync to Google Calendar',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = () => {
    connectGoogleCalendar();
  };

  // Render calendar day
  const renderCalendarDay = (day: number) => {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    const events = getEventsForDate(date);
    const isTodayDate = isToday(date);
    const isCurrentMonth = true; // All days in this loop are current month

    return (
      <div
        key={day}
        className={`min-h-[120px] border border-gray-700 bg-gray-900/50 p-2 ${
          isTodayDate ? 'bg-yellow-500/10 border-yellow-500/50' : ''
        }`}
      >
        {/* Date number */}
        <div className={`text-sm mb-1 ${isTodayDate ? 'font-bold text-yellow-400' : 'text-gray-400'}`}>
          {day}
        </div>

        {/* Events */}
        <div className="space-y-1">
          {events.slice(0, 3).map((event) => (
            <div
              key={event.id}
              onClick={() => handleEventClick(event)}
              onMouseEnter={() => {
                // Hover preview could be shown here
              }}
              className="text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: `${event.worldColor}40`,
                borderLeft: `3px solid ${event.worldColor}`,
              }}
            >
              <div className="font-semibold text-white truncate">
                {event.type === 'post' && '📱 Post'}
                {event.type === 'shoot' && '🎬 Shoot'}
                {event.type === 'edit' && '✏️ Edit'}
                {event.type === 'shot_list' && '📋 Shot List'}
                {event.type === 'release' && '🎵 Release'}
              </div>
              <div className="text-gray-300 truncate text-[10px]">{event.title}</div>
            </div>
          ))}
          {events.length > 3 && (
            <div className="text-xs text-gray-500">+{events.length - 3} more</div>
          )}
        </div>
      </div>
    );
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(
      <div key={`empty-${i}`} className="min-h-[120px] border border-gray-800 bg-gray-950/50" />
    );
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(renderCalendarDay(day));
  }

  // Month name
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Calendar Sync Button - Only show when not synced */}
      {!isConnected && (
        <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div>
            <p className="text-white font-semibold mb-1">Sync to Google Calendar</p>
            <p className="text-sm text-gray-400">
              Connect your calendar to automatically sync posting dates and shoot days
            </p>
          </div>
          <Button
            onClick={handleConnect}
            className="font-semibold bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            Connect Calendar
          </Button>
        </div>
      )}

      {/* Sync Status Message */}
      {syncStatus && (
        <div
          className={`p-3 rounded text-sm ${
            syncStatus.success
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {syncStatus.message}
        </div>
      )}

      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <Button
          onClick={goToPreviousMonth}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-2xl font-semibold text-white">{monthName}</h2>
        <Button
          onClick={goToNextMonth}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0 border border-gray-700 rounded-lg overflow-hidden">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="bg-gray-800 border-b border-gray-700 p-2 text-center text-sm font-semibold text-gray-300"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays}
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <Card
            className="w-full max-w-2xl bg-gray-900 border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-white mb-2">
                    {selectedEvent.type === 'post' && '📱 Post Day'}
                    {selectedEvent.type === 'shoot' && '🎬 Shoot Day'}
                    {selectedEvent.type === 'edit' && '✏️ Edit Day'}
                    {selectedEvent.type === 'shot_list' && '📋 Shot List Deadline'}
                    {selectedEvent.type === 'release' && '🎵 Release Day'}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    {formatPostingDate(selectedEvent.date)}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setSelectedEvent(null)}
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* World info */}
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: selectedEvent.worldColor }}
                />
                <div>
                  <p className="text-white font-semibold">{selectedEvent.worldName}</p>
                  <p className="text-sm text-gray-400">World</p>
                </div>
              </div>

              {/* Event details */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">{selectedEvent.title}</h3>
                {selectedEvent.description && (
                  <p className="text-gray-300">{selectedEvent.description}</p>
                )}
              </div>

              {/* Snapshot details if it's a post */}
              {selectedEvent.type === 'post' && selectedEvent.snapshot && (
                <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-gray-400">Platform</p>
                  <p className="text-white capitalize">{selectedEvent.snapshot.platform}</p>
                  <p className="text-sm text-gray-400">Content Type</p>
                  <p className="text-white capitalize">{selectedEvent.snapshot.contentType}</p>
                  {selectedEvent.snapshot.caption && (
                    <>
                      <p className="text-sm text-gray-400">Caption</p>
                      <p className="text-white italic">"{selectedEvent.snapshot.caption}"</p>
                    </>
                  )}
                </div>
              )}

              {/* Shot list details */}
              {selectedEvent.type === 'shot_list' && selectedEvent.snapshot && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">Shot List Due</p>
                  <p className="text-white">
                    Final shot list needed for filming on{' '}
                    {selectedEvent.snapshot.suggestedFilmingDate
                      ? formatPostingDate(selectedEvent.snapshot.suggestedFilmingDate)
                      : 'TBD'}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {selectedEvent.snapshot.visualDescription}
                  </p>
                </div>
              )}

              {/* Shoot day details */}
              {selectedEvent.type === 'shoot' && selectedEvent.snapshot && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-400 font-semibold mb-2">Filming Day</p>
                  <p className="text-white">{selectedEvent.snapshot.visualDescription}</p>
                </div>
              )}

              {/* Days until */}
              {selectedEvent.type !== 'release' && (
                <div className="text-sm text-gray-400">
                  {(() => {
                    const daysUntil = getDaysUntilPosting(selectedEvent.date);
                    if (daysUntil < 0) {
                      return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago`;
                    } else if (daysUntil === 0) {
                      return 'Today';
                    } else {
                      return `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until`;
                    }
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

