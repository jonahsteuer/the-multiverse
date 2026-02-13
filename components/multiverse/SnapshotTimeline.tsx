'use client';

import { useMemo } from 'react';
import type { Snapshot } from '@/types';
import { formatPostingDate, getDaysUntilPosting, getOptimalPostingTime } from '@/lib/snapshot-schedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SnapshotTimelineProps {
  snapshots: Snapshot[];
  releaseDate: string;
  worldName: string;
}

export function SnapshotTimeline({ snapshots, releaseDate, worldName }: SnapshotTimelineProps) {
  // Group snapshots by week label
  const groupedSnapshots = useMemo(() => {
    const groups: Record<string, Snapshot[]> = {};
    
    snapshots.forEach((snapshot) => {
      const key = snapshot.weekLabel || 'Unassigned';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(snapshot);
    });

    // Sort groups by order (Week -2, Week -1, Release Day, Week +1, etc.)
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
      const getOrder = (label: string) => {
        if (label === 'Release Day') return 0;
        if (label.startsWith('Week -')) {
          const num = parseInt(label.replace('Week -', ''));
          return -num;
        }
        if (label.startsWith('Week +')) {
          const num = parseInt(label.replace('Week +', ''));
          return num;
        }
        return 999;
      };
      return getOrder(a) - getOrder(b);
    });

    return sortedGroups;
  }, [snapshots]);

  const release = new Date(releaseDate);
  const today = new Date();
  const isReleased = release <= today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-star-wars text-yellow-400 mb-2">
            Posting Schedule
          </h3>
          <p className="text-gray-400 font-star-wars">
            {snapshots.length} snapshots scheduled for "{worldName}"
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Release Date</p>
          <p className="text-lg font-star-wars text-yellow-400">
            {release.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-yellow-500/30" />
        
        <div className="space-y-8 pl-16">
          {groupedSnapshots.map(([weekLabel, weekSnapshots]) => {
            const isReleaseWeek = weekLabel === 'Release Day';
            const isBeforeRelease = weekLabel.startsWith('Week -');
            const isAfterRelease = weekLabel.startsWith('Week +');

            return (
              <div key={weekLabel} className="relative">
                {/* Week marker */}
                <div className="absolute -left-12 top-0">
                  <div
                    className={`w-8 h-8 rounded-full border-4 flex items-center justify-center ${
                      isReleaseWeek
                        ? 'bg-yellow-500 border-yellow-400'
                        : isBeforeRelease
                        ? 'bg-gray-600 border-gray-500'
                        : 'bg-green-600 border-green-500'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-black" />
                  </div>
                </div>

                {/* Week label */}
                <div className="mb-4">
                  <h4 className="text-xl font-star-wars text-yellow-400">
                    {weekLabel}
                  </h4>
                </div>

                {/* Snapshots in this week */}
                <div className="space-y-4">
                  {weekSnapshots
                    .sort((a, b) => {
                      if (!a.postingDate || !b.postingDate) return a.order - b.order;
                      return new Date(a.postingDate).getTime() - new Date(b.postingDate).getTime();
                    })
                    .map((snapshot) => {
                      const daysUntil = snapshot.postingDate
                        ? getDaysUntilPosting(snapshot.postingDate)
                        : null;
                      const isUpcoming = daysUntil !== null && daysUntil > 0 && daysUntil <= 7;
                      const isOverdue = daysUntil !== null && daysUntil < 0;
                      const isToday = daysUntil === 0;

                      return (
                        <Card
                          key={snapshot.id}
                          className={`border ${
                            isToday
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
                                  <span className="text-sm font-star-wars text-yellow-400">
                                    #{snapshot.order}
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                                    {snapshot.platform}
                                  </span>
                                  <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                                    {snapshot.contentType}
                                  </span>
                                  {isToday && (
                                    <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-black font-bold">
                                      TODAY
                                    </span>
                                  )}
                                  {isUpcoming && !isToday && (
                                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                                      {daysUntil} day{daysUntil !== 1 ? 's' : ''} away
                                    </span>
                                  )}
                                  {isOverdue && (
                                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                                      {Math.abs(daysUntil)} day{Math.abs(daysUntil) !== 1 ? 's' : ''} overdue
                                    </span>
                                  )}
                                </div>
                                
                                <p className="text-white mb-2">{snapshot.visualDescription}</p>
                                
                                {snapshot.caption && (
                                  <p className="text-gray-400 italic text-sm mb-2">
                                    "{snapshot.caption}"
                                  </p>
                                )}

                                {snapshot.suggestedFilmingDate && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    📸 Film by: {formatPostingDate(snapshot.suggestedFilmingDate)}
                                  </p>
                                )}
                              </div>

                              <div className="text-right min-w-[140px]">
                                {snapshot.postingDate ? (
                                  <>
                                    <p className="text-sm font-star-wars text-yellow-400 mb-1">
                                      {formatPostingDate(snapshot.postingDate)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {getOptimalPostingTime(snapshot.platform)}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs text-gray-500">Date TBD</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


