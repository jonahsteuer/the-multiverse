'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Universe, World, Galaxy, CalendarEvent as CalendarEventType } from '@/types';
import { formatPostingDate, getDaysUntilPosting } from '@/lib/snapshot-schedule';
import { calculateShootDays } from '@/lib/shoot-day-calculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { connectGoogleCalendar, checkCalendarConnection, disconnectGoogleCalendar } from '@/lib/google-oauth';
import { syncToGoogleCalendar, createSnapshotEvents, createShootDayEvents } from '@/lib/google-calendar';

interface CalendarEvent {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  type: 'post' | 'shoot' | 'edit' | 'shot_list' | 'release' | 'treatment';
  title: string;
  description?: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  snapshotId?: string;
  shootDayId?: string;
}

interface MasterScheduleProps {
  universe: Universe;
  selectedWorldId?: string; // If provided, auto-navigate to this world's date range
  onEventClick?: (event: CalendarEvent) => void;
  onWorldSelect?: (worldId: string) => void;
}

export function MasterSchedule({ universe, selectedWorldId, onEventClick, onWorldSelect }: MasterScheduleProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState<any[]>([]);
  const [isFetchingGoogleEvents, setIsFetchingGoogleEvents] = useState(false);

  // Get all worlds from all galaxies (deduplicate by ID to avoid duplicates)
  const allWorlds = useMemo(() => {
    const worldsMap = new Map<string, World>();
    universe.galaxies.forEach((galaxy) => {
      galaxy.worlds.forEach((world) => {
        // Only add if we haven't seen this world ID before
        if (!worldsMap.has(world.id)) {
          worldsMap.set(world.id, world);
        }
      });
    });
    return Array.from(worldsMap.values());
  }, [universe]);

  // Fetch Google Calendar events
  const fetchGoogleCalendarEvents = async () => {
    if (!isConnected) return;
    
    setIsFetchingGoogleEvents(true);
    try {
      const timeMin = new Date(year, month, 1).toISOString();
      const timeMax = new Date(year, month + 1, 0).toISOString();
      
      const response = await fetch(`/api/calendar/fetch?timeMin=${timeMin}&timeMax=${timeMax}`);
      if (response.ok) {
        const data = await response.json();
        setGoogleCalendarEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
    } finally {
      setIsFetchingGoogleEvents(false);
    }
  };

  // Check calendar connection on mount and after OAuth redirect
  useEffect(() => {
    const checkConnection = async () => {
      const connected = await checkCalendarConnection();
      setIsConnected(connected);
      
      // Check if we just returned from OAuth (URL has calendar_connected or calendar_error param)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('calendar_connected') === 'true') {
        setSyncStatus({
          success: true,
          message: 'Google Calendar connected successfully! You can now sync your events.',
        });
        setIsConnected(true);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        // Fetch events after connection
        setTimeout(() => fetchGoogleCalendarEvents(), 1000);
      } else if (urlParams.get('calendar_error')) {
        const errorMessage = urlParams.get('calendar_error') || 'Unknown error occurred';
        setSyncStatus({
          success: false,
          message: `Failed to connect Google Calendar: ${errorMessage}`,
        });
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (connected) {
        // If already connected, fetch events
        fetchGoogleCalendarEvents();
      }
    };
    checkConnection();
  }, []);

  // Get first day of month and number of days (needed for useEffect)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Refetch Google Calendar events when month changes
  useEffect(() => {
    if (isConnected) {
      fetchGoogleCalendarEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, isConnected]);

  // Auto-navigate to selected world's date range
  useEffect(() => {
    if (selectedWorldId) {
      const world = allWorlds.find((w) => w.id === selectedWorldId);
      if (world) {
        // Find the earliest date for this world (including all event types)
        const dates: string[] = [];
        
        // Add release date
        dates.push(world.releaseDate);
        
        // Add all snapshot-related dates
        if (world.snapshotStrategy) {
          world.snapshotStrategy.snapshots.forEach((snapshot) => {
            if (snapshot.postingDate) dates.push(snapshot.postingDate);
            if (snapshot.suggestedFilmingDate) {
              dates.push(snapshot.suggestedFilmingDate);
              // Add treatment deadline (1 week before filming)
              const filmingDate = new Date(snapshot.suggestedFilmingDate);
              const treatmentDate = new Date(filmingDate);
              treatmentDate.setDate(treatmentDate.getDate() - 7);
              dates.push(treatmentDate.toISOString().split('T')[0]);
              // Add shot list deadline (3 days before filming)
              const shotListDate = new Date(filmingDate);
              shotListDate.setDate(shotListDate.getDate() - 3);
              dates.push(shotListDate.toISOString().split('T')[0]);
            }
          });
        }

        if (dates.length > 0) {
          const sortedDates = dates.sort();
          const earliestDate = new Date(sortedDates[0]);
          // Navigate to the month containing the first event for this world
          setCurrentDate(new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1));
        }
      }
    }
  }, [selectedWorldId, allWorlds]);

  // Build calendar events from all worlds in universe
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    allWorlds.forEach((world) => {
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

      // Add snapshots (posting dates)
      if (world.snapshotStrategy && world.snapshotStrategy.snapshots) {
        world.snapshotStrategy.snapshots.forEach((snapshot) => {
          if (snapshot.postingDate) {
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
              });

              // Add treatment deadline (1 week before shoot day)
              const treatmentDate = new Date(filmingDate);
              treatmentDate.setDate(treatmentDate.getDate() - 7); // 1 week before filming

              events.push({
                id: `treatment-${snapshot.id}`,
                date: treatmentDate.toISOString().split('T')[0],
                type: 'treatment',
                title: `Treatment Due: ${world.name}`,
                description: `Treatment needed for shoot on ${formatPostingDate(snapshot.suggestedFilmingDate)}`,
                worldId: world.id,
                worldName: world.name,
                worldColor: world.color,
                snapshotId: snapshot.id,
              });
            }
          }
        });
      }
    });

    // Add Google Calendar events
    googleCalendarEvents.forEach((googleEvent) => {
      const eventDate = googleEvent.start?.split('T')[0] || googleEvent.start;
      if (eventDate) {
        events.push({
          id: `google-${googleEvent.id}`,
          date: eventDate,
          type: 'post' as const, // Default type for Google Calendar events
          title: googleEvent.title,
          description: googleEvent.description || '',
          worldId: '', // Google Calendar events don't have worldId
          worldName: 'Google Calendar',
          worldColor: '#4285F4', // Google blue
        });
      }
    });

    return events;
  }, [allWorlds, googleCalendarEvents]);

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

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 6 = Saturday

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
    if (onWorldSelect) {
      onWorldSelect(event.worldId);
    }
  };

  // Handle calendar sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      // Create events from all snapshots and shoot days
      const allSnapshots = allWorlds.flatMap((w) => w.snapshotStrategy?.snapshots || []);
      const allShootDays = allWorlds.flatMap((w) => {
        if (w.snapshotStrategy) {
          return calculateShootDays(w.snapshotStrategy.snapshots, w.id);
        }
        return [];
      });

      const snapshotEvents = createSnapshotEvents(allSnapshots, universe.name);
      const shootDayEvents = createShootDayEvents(allShootDays, universe.name);
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

  // Render calendar day
  const renderCalendarDay = (day: number) => {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    const events = getEventsForDate(date);
    const isTodayDate = isToday(date);
    const hasSelectedWorldEvents = selectedWorldId && events.some((e) => e.worldId === selectedWorldId);
    
    // Separate events by selected world vs others
    const selectedWorldEvents = selectedWorldId 
      ? events.filter((e) => e.worldId === selectedWorldId)
      : [];
    const otherWorldEvents = selectedWorldId
      ? events.filter((e) => e.worldId !== selectedWorldId)
      : events;

    // Calculate minimum height based on number of events (each event ~40px)
    const minHeight = Math.max(120, 40 + (events.length * 40));

    return (
      <div
        key={day}
        className={`border border-gray-700 bg-gray-900/50 p-2 ${
          isTodayDate ? 'bg-yellow-500/10 border-yellow-500/50' : ''
        } ${hasSelectedWorldEvents ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}
        style={{ minHeight: `${minHeight}px` }}
      >
        {/* Date number */}
        <div className={`text-sm mb-1 ${isTodayDate ? 'font-bold text-yellow-400' : 'text-gray-400'}`}>
          {day}
        </div>

        {/* Events - Show all events stacked */}
        <div className="space-y-1">
          {/* Show selected world's events first (highlighted) */}
          {selectedWorldEvents.map((event) => {
            return (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="text-xs p-1.5 rounded cursor-pointer hover:opacity-90 transition-all shadow-md"
                style={{
                  backgroundColor: `${event.worldColor}60`,
                  borderLeft: `4px solid ${event.worldColor}`,
                  border: `2px solid ${event.worldColor}`,
                }}
              >
                <div className="font-semibold text-white truncate">
                  {event.type === 'post' && '📱 Post'}
                  {event.type === 'shoot' && '🎬 Shoot'}
                  {event.type === 'edit' && '✏️ Edit'}
                  {event.type === 'shot_list' && '📋 Shot List'}
                  {event.type === 'treatment' && '📄 Treatment'}
                  {event.type === 'release' && '🎵 Release'}
                </div>
                <div className="text-white truncate text-[10px] font-medium">{event.title}</div>
              </div>
            );
          })}
          
          {/* Show other worlds' events (less prominent) */}
          {otherWorldEvents.map((event) => {
            return (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
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
                  {event.type === 'treatment' && '📄 Treatment'}
                  {event.type === 'release' && '🎵 Release'}
                </div>
                <div className="text-gray-300 truncate text-[10px]">{event.title}</div>
              </div>
            );
          })}
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
      {/* Calendar Sync Button - Show connect or disconnect */}
      {!isConnected ? (
        <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div>
            <p className="text-white font-semibold mb-1">Sync to Google Calendar</p>
            <p className="text-sm text-gray-400">
              Connect your calendar to automatically sync posting dates and shoot days
            </p>
          </div>
          {isConnected ? (
            <Button
              onClick={fetchGoogleCalendarEvents}
              disabled={isFetchingGoogleEvents}
              variant="outline"
              className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            >
              {isFetchingGoogleEvents ? 'Refreshing...' : '🔄 Refresh Calendar'}
            </Button>
          ) : (
            <Button
              onClick={connectGoogleCalendar}
              className="font-semibold bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              Connect Calendar
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <div>
              <p className="text-white font-semibold mb-1">Google Calendar Connected</p>
              <p className="text-sm text-gray-400">
                Your events will sync automatically when you click "Sync to Calendar"
              </p>
            </div>
          </div>
          <Button
            onClick={async () => {
              const disconnected = await disconnectGoogleCalendar();
              if (disconnected) {
                setIsConnected(false);
                setSyncStatus({
                  success: true,
                  message: 'Google Calendar disconnected successfully',
                });
              }
            }}
            variant="outline"
            className="font-semibold border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            Disconnect
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

      {/* World Filter (if multiple worlds) - Show all worlds, highlight selected */}
      {allWorlds.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-400 mr-2">Filter by world:</span>
          <Button
            variant={!selectedWorldId ? 'default' : 'outline'}
            onClick={() => onWorldSelect?.('')}
            className="text-sm"
          >
            All Worlds
          </Button>
          {allWorlds.map((world) => (
            <Button
              key={world.id}
              variant={selectedWorldId === world.id ? 'default' : 'outline'}
              onClick={() => onWorldSelect?.(world.id)}
              className="text-sm"
              style={{
                backgroundColor: selectedWorldId === world.id ? world.color : undefined,
                borderColor: world.color,
                color: selectedWorldId === world.id ? '#000' : world.color,
              }}
            >
              {world.name}
            </Button>
          ))}
          {selectedWorldId && (
            <span className="text-xs text-gray-500 ml-2">
              (Showing all events, highlighting {allWorlds.find(w => w.id === selectedWorldId)?.name})
            </span>
          )}
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
                    {selectedEvent.type === 'treatment' && '📄 Treatment Deadline'}
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

