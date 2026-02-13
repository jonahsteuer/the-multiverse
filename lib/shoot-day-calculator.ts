/**
 * Utility functions for calculating optimal shoot days
 * Shoot days should be 1 week before posting dates
 */

import type { Snapshot, ShootDay } from '@/types';

/**
 * Calculate suggested shoot days based on snapshot posting dates
 * Groups snapshots that can be filmed on the same day
 */
export function calculateShootDays(
  snapshots: Snapshot[],
  worldId: string
): ShootDay[] {
  // Filter snapshots that have posting dates
  const snapshotsWithDates = snapshots.filter((s) => s.postingDate && s.suggestedFilmingDate);

  if (snapshotsWithDates.length === 0) {
    return [];
  }

  // Group snapshots by filming date
  const groupedByDate = new Map<string, Snapshot[]>();

  snapshotsWithDates.forEach((snapshot) => {
    if (!snapshot.suggestedFilmingDate) return;
    
    const date = snapshot.suggestedFilmingDate;
    if (!groupedByDate.has(date)) {
      groupedByDate.set(date, []);
    }
    groupedByDate.get(date)!.push(snapshot);
  });

  // Create shoot days
  const shootDays: ShootDay[] = Array.from(groupedByDate.entries()).map(
    ([date, dateSnapshots], index) => {
      return {
        id: `shoot-day-${worldId}-${index + 1}`,
        worldId,
        date,
        suggestedDate: date,
        status: 'suggested' as const,
        snapshots: dateSnapshots.map((s) => s.id),
        createdAt: new Date().toISOString(),
      };
    }
  );

  // Sort by date
  return shootDays.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/**
 * Find optimal shoot days considering team availability
 * Suggests alternative dates if original date conflicts
 */
export function suggestOptimalShootDays(
  shootDays: ShootDay[],
  unavailableDates: string[] = []
): ShootDay[] {
  return shootDays.map((shootDay) => {
    const originalDate = new Date(shootDay.date);
    let suggestedDate = shootDay.date;

    // If original date is unavailable, suggest next available weekday
    if (unavailableDates.includes(shootDay.date)) {
      let checkDate = new Date(originalDate);
      let attempts = 0;
      
      while (unavailableDates.includes(checkDate.toISOString().split('T')[0]) && attempts < 14) {
        checkDate.setDate(checkDate.getDate() + 1);
        // Skip weekends
        if (checkDate.getDay() === 0) checkDate.setDate(checkDate.getDate() + 1);
        if (checkDate.getDay() === 6) checkDate.setDate(checkDate.getDate() + 1);
        attempts++;
      }
      
      suggestedDate = checkDate.toISOString().split('T')[0];
    }

    return {
      ...shootDay,
      suggestedDate,
    };
  });
}

/**
 * Format shoot day for display
 */
export function formatShootDay(shootDay: ShootDay): string {
  const date = new Date(shootDay.date);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get days until shoot day
 */
export function getDaysUntilShoot(shootDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shoot = new Date(shootDate);
  shoot.setHours(0, 0, 0, 0);
  const diff = shoot.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}


