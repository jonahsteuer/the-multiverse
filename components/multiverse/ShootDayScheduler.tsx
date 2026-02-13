'use client';

import { useMemo, useState } from 'react';
import type { Snapshot, ShootDay } from '@/types';
import { calculateShootDays, formatShootDay, getDaysUntilShoot } from '@/lib/shoot-day-calculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ShootDaySchedulerProps {
  snapshots: Snapshot[];
  worldId: string;
  worldName: string;
  onConfirmShootDay?: (shootDay: ShootDay) => void;
}

export function ShootDayScheduler({
  snapshots,
  worldId,
  worldName,
  onConfirmShootDay,
}: ShootDaySchedulerProps) {
  const [confirmedShootDays, setConfirmedShootDays] = useState<Set<string>>(new Set());

  const shootDays = useMemo(() => {
    return calculateShootDays(snapshots, worldId);
  }, [snapshots, worldId]);

  const handleConfirm = (shootDay: ShootDay) => {
    setConfirmedShootDays(new Set([...confirmedShootDays, shootDay.id]));
    
    const confirmed: ShootDay = {
      ...shootDay,
      status: 'confirmed',
      confirmedDate: shootDay.date,
    };
    
    if (onConfirmShootDay) {
      onConfirmShootDay(confirmed);
    }
  };

  if (shootDays.length === 0) {
    return (
      <Card className="border-gray-700 bg-black/50">
        <CardContent className="p-6">
          <p className="text-gray-400 font-star-wars">
            No shoot days calculated yet. Generate snapshots first to see suggested shoot days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-star-wars text-yellow-400 mb-2">
          Suggested Shoot Days
        </h3>
        <p className="text-gray-400 font-star-wars text-sm">
          Based on your snapshot schedule, here are the optimal days to film
        </p>
      </div>

      <div className="space-y-4">
        {shootDays.map((shootDay) => {
          const daysUntil = getDaysUntilShoot(shootDay.date);
          const isUpcoming = daysUntil > 0 && daysUntil <= 14;
          const isOverdue = daysUntil < 0;
          const isToday = daysUntil === 0;
          const isConfirmed = confirmedShootDays.has(shootDay.id) || shootDay.status === 'confirmed';

          return (
            <Card
              key={shootDay.id}
              className={`border ${
                isConfirmed
                  ? 'border-green-500 bg-green-500/10'
                  : isToday
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : isUpcoming
                  ? 'border-yellow-500/50 bg-yellow-500/5'
                  : isOverdue
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-gray-700 bg-black/50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-star-wars text-yellow-400">
                        {formatShootDay(shootDay)}
                      </h4>
                      {isConfirmed && (
                        <span className="text-xs px-2 py-1 rounded bg-green-500 text-black font-bold">
                          CONFIRMED
                        </span>
                      )}
                      {isToday && !isConfirmed && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-black font-bold">
                          TODAY
                        </span>
                      )}
                      {isUpcoming && !isToday && !isConfirmed && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                          {daysUntil} day{daysUntil !== 1 ? 's' : ''} away
                        </span>
                      )}
                      {isOverdue && !isConfirmed && (
                        <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                          {Math.abs(daysUntil)} day{Math.abs(daysUntil) !== 1 ? 's' : ''} overdue
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-400 mb-3">
                      {shootDay.snapshots.length} snapshot{shootDay.snapshots.length !== 1 ? 's' : ''} to film
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {shootDay.snapshots.map((snapshotId) => {
                        const snapshot = snapshots.find((s) => s.id === snapshotId);
                        if (!snapshot) return null;
                        return (
                          <span
                            key={snapshotId}
                            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300"
                          >
                            #{snapshot.order} - {snapshot.platform}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {!isConfirmed && (
                    <Button
                      onClick={() => handleConfirm(shootDay)}
                      className="font-star-wars bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                    >
                      Confirm
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


