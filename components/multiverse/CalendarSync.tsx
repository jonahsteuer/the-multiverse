'use client';

import { useState, useEffect } from 'react';
import type { Snapshot, ShootDay, CalendarEvent } from '@/types';
import { createSnapshotEvents, createShootDayEvents, syncToGoogleCalendar } from '@/lib/google-calendar';
import { connectGoogleCalendar, checkCalendarConnection } from '@/lib/google-oauth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CalendarSyncProps {
  snapshots: Snapshot[];
  shootDays: ShootDay[];
  worldName: string;
}

export function CalendarSync({ snapshots, shootDays, worldName }: CalendarSyncProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const connected = await checkCalendarConnection();
      setIsConnected(connected);
    };
    checkConnection();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      // Create events from snapshots and shoot days
      const snapshotEvents = createSnapshotEvents(snapshots, worldName);
      const shootDayEvents = createShootDayEvents(shootDays, worldName);
      const allEvents: CalendarEvent[] = [...snapshotEvents, ...shootDayEvents];

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

  return (
    <Card className="border-yellow-500/30 bg-black/50">
      <CardHeader>
        <CardTitle className="text-xl font-star-wars text-yellow-400">
          Google Calendar Sync
        </CardTitle>
        <CardDescription className="text-gray-400 font-star-wars">
          Sync your posting schedule and shoot days to Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <>
            <p className="text-gray-400 text-sm">
              Connect your Google Calendar to automatically sync posting dates and shoot days.
            </p>
            <Button
              onClick={handleConnect}
              className="w-full font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              Connect Google Calendar
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>✓</span>
              <span>Connected to Google Calendar</span>
            </div>
            
            <div className="text-sm text-gray-400 space-y-1">
              <p>
                • {snapshots.filter((s) => s.postingDate).length} posting date{snapshots.filter((s) => s.postingDate).length !== 1 ? 's' : ''}
              </p>
              <p>
                • {shootDays.length} shoot day{shootDays.length !== 1 ? 's' : ''}
              </p>
            </div>

            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync to Calendar'}
            </Button>

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
          </>
        )}
      </CardContent>
    </Card>
  );
}

