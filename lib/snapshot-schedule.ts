/**
 * Utility functions for calculating snapshot posting schedules
 * Based on release date: 2 weeks before, 8 weeks after
 */

import type { Snapshot } from '@/types';

/**
 * Calculate posting dates for snapshots based on release date
 * Distribution: 2 weeks before release, release week, 8 weeks after
 */
export function calculatePostingDates(
  snapshots: Omit<Snapshot, 'id' | 'worldId' | 'postingDate' | 'weekLabel'>[],
  releaseDate: string
): Omit<Snapshot, 'id' | 'worldId'>[] {
  const release = new Date(releaseDate);
  release.setHours(12, 0, 0, 0); // Set to noon for consistency

  // Sort snapshots by order
  const sortedSnapshots = [...snapshots].sort((a, b) => a.order - b.order);

  // Calculate total days in schedule: 14 days before + release day + 56 days after = 71 days
  const daysBefore = 14;
  const daysAfter = 56;
  const totalDays = daysBefore + 1 + daysAfter;

  // Distribute snapshots across the timeline
  const snapshotsWithDates = sortedSnapshots.map((snapshot, index) => {
    // Calculate position in timeline (0 = 14 days before, 0.5 = release day, 1 = 56 days after)
    const position = index / (sortedSnapshots.length - 1 || 1);
    
    let daysOffset: number;
    if (position <= 0.5) {
      // First half: distribute across 14 days before release
      const daysFromStart = Math.round(position * 2 * daysBefore);
      daysOffset = -daysBefore + daysFromStart;
    } else {
      // Second half: distribute across release day and 56 days after
      const daysFromRelease = Math.round((position - 0.5) * 2 * (daysAfter + 1));
      daysOffset = daysFromRelease;
    }

    const postingDate = new Date(release);
    postingDate.setDate(postingDate.getDate() + daysOffset);
    
    // Adjust to optimal posting time (Tuesday/Thursday/Friday afternoons)
    const dayOfWeek = postingDate.getDay();
    if (dayOfWeek === 0) { // Sunday -> move to Friday
      postingDate.setDate(postingDate.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday -> move to Friday
      postingDate.setDate(postingDate.getDate() - 1);
    } else if (dayOfWeek === 1) { // Monday -> move to Tuesday
      postingDate.setDate(postingDate.getDate() + 1);
    }

    // Calculate week label
    const daysFromRelease = daysOffset;
    let weekLabel: string;
    if (daysFromRelease < -7) {
      weekLabel = `Week -${Math.ceil(Math.abs(daysFromRelease) / 7)}`;
    } else if (daysFromRelease < 0) {
      weekLabel = 'Week -1';
    } else if (daysFromRelease === 0) {
      weekLabel = 'Release Day';
    } else if (daysFromRelease <= 7) {
      weekLabel = 'Week +1';
    } else {
      weekLabel = `Week +${Math.ceil(daysFromRelease / 7)}`;
    }

    return {
      ...snapshot,
      postingDate: postingDate.toISOString().split('T')[0],
      weekLabel,
    };
  });

  return snapshotsWithDates;
}

/**
 * Calculate suggested filming dates (1 week before posting date)
 */
export function calculateFilmingDates<T extends Pick<Snapshot, 'postingDate'>>(snapshots: T[]): T[] {
  return snapshots.map((snapshot) => {
    if (!snapshot.postingDate) return snapshot;

    const postingDate = new Date(snapshot.postingDate);
    const filmingDate = new Date(postingDate);
    filmingDate.setDate(filmingDate.getDate() - 7); // 1 week before

    return {
      ...snapshot,
      suggestedFilmingDate: filmingDate.toISOString().split('T')[0],
    };
  });
}

/**
 * Get optimal posting time based on platform
 */
export function getOptimalPostingTime(platform: Snapshot['platform']): string {
  const times: Record<Snapshot['platform'], string> = {
    instagram: '2:00 PM',
    tiktok: '6:00 PM',
    youtube: '3:00 PM',
    twitter: '12:00 PM',
  };
  return times[platform] || '2:00 PM';
}

/**
 * Format date for display
 */
export function formatPostingDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get days until posting date
 */
export function getDaysUntilPosting(postingDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const post = new Date(postingDate);
  post.setHours(0, 0, 0, 0);
  const diff = post.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}


