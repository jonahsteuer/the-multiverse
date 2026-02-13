/**
 * Snapshot Schedule Calculator
 * 
 * Calculates optimal snapshot posting schedule based on:
 * - Release date
 * - Next release date (if applicable)
 * - Artist capacity (hours per week)
 * - Platforms (TikTok = higher frequency, Instagram/YouTube = lower)
 * - Adaptive frequency (adjusts based on posting performance)
 */

import { addWeeks, subWeeks, differenceInWeeks, format, addDays, isBefore, isAfter } from 'date-fns';
import type { SnapshotScheduleConfig } from '@/types';

export interface SnapshotSchedule {
  totalSnapshots: number;
  snapshotsPerWeek: number;
  postingDates: string[]; // ISO date strings
  timeline: {
    startDate: string; // ISO date
    endDate: string; // ISO date
    durationWeeks: number;
  };
  snapshots: ScheduledSnapshot[];
}

export interface ScheduledSnapshot {
  id: string;
  postingDate: string; // ISO date
  weekLabel: string; // "Week -2", "Release Week", "Week +1", etc.
  order: number;
  platform: 'instagram' | 'tiktok' | 'youtube';
  suggestedTime?: string; // "14:00" (2pm)
}

/**
 * Calculate optimal posting frequency based on platform
 */
function getPlatformFrequency(platforms: string[]): number {
  // TikTok prefers higher frequency (4-7 posts/week)
  // Instagram prefers medium (2-3 posts/week)
  // YouTube prefers lower (1-2 posts/week)
  
  if (platforms.includes('tiktok')) {
    return 5; // Default to 5 posts/week for TikTok
  } else if (platforms.includes('instagram')) {
    return 2.5; // Default to 2-3 posts/week for Instagram
  } else if (platforms.includes('youtube')) {
    return 1.5; // Default to 1-2 posts/week for YouTube
  }
  
  return 2.5; // Default medium frequency
}

/**
 * Calculate capacity based on hours per week
 */
function getCapacityFromHours(hoursPerWeek: string): number {
  // How many snapshots can artist create per week based on hours
  switch (hoursPerWeek) {
    case '2-4':
      return 1.5; // ~1-2 snapshots per week
    case '5-8':
      return 2.5; // ~2-3 snapshots per week
    case '9-12':
      return 3.5; // ~3-4 snapshots per week
    case '13+':
      return 4.5; // ~4-5 snapshots per week
    default:
      return 2.5; // Default medium
  }
}

/**
 * Calculate adaptive frequency based on posting performance
 */
function calculateAdaptiveFrequency(
  config: SnapshotScheduleConfig,
  baseSnapshotsPerWeek: number
): number {
  if (!config.postingHistory || config.postingHistory.length === 0) {
    // No history yet, use base frequency
    return baseSnapshotsPerWeek;
  }

  // Calculate posting rate (how many they actually posted vs. scheduled)
  const recentHistory = config.postingHistory.slice(-14); // Last 2 weeks
  const scheduled = recentHistory.length;
  const posted = recentHistory.filter(h => h.posted).length;
  const postingRate = scheduled > 0 ? posted / scheduled : 1;

  // If posting rate is high (>90%), increase frequency
  if (postingRate >= 0.9) {
    return Math.min(baseSnapshotsPerWeek + 0.5, 7); // Cap at 7 per week
  }
  
  // If posting rate is low (<70%), decrease frequency
  if (postingRate < 0.7) {
    return Math.max(baseSnapshotsPerWeek - 0.5, 1); // Minimum 1 per week
  }

  // Otherwise, keep base frequency
  return baseSnapshotsPerWeek;
}

/**
 * Generate optimal posting dates
 * Prefers Tuesday, Thursday, Friday (optimal posting days)
 */
function generatePostingDates(
  startDate: Date,
  endDate: Date,
  totalSnapshots: number,
  snapshotsPerWeek: number
): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDate);
  let snapshotCount = 0;

  // Optimal posting days (Tuesday=2, Thursday=4, Friday=5)
  const optimalDays = [2, 4, 5];

  while (isBefore(currentDate, endDate) && snapshotCount < totalSnapshots) {
    const dayOfWeek = currentDate.getDay();
    
    // If it's an optimal day, add it
    if (optimalDays.includes(dayOfWeek)) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      snapshotCount++;
    }
    
    // Move to next day
    currentDate = addDays(currentDate, 1);
    
    // If we've added enough for this week, skip to next week
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week
    
    const snapshotsThisWeek = dates.filter(d => {
      const dDate = new Date(d);
      return dDate >= weekStart && dDate < addDays(weekStart, 7);
    }).length;

    if (snapshotsThisWeek >= Math.ceil(snapshotsPerWeek)) {
      // Move to next week
      currentDate = addDays(weekStart, 7);
    }
  }

  return dates.slice(0, totalSnapshots);
}

/**
 * Calculate snapshot schedule
 */
export function calculateSnapshotSchedule(
  config: SnapshotScheduleConfig
): SnapshotSchedule {
  // Step 1: Calculate timeline
  const releaseDate = new Date(config.releaseDate);
  const startDate = subWeeks(releaseDate, 2); // 2 weeks before release
  
  const endDate = config.nextReleaseDate
    ? subWeeks(new Date(config.nextReleaseDate), 2) // Stop 2 weeks before next release
    : addWeeks(releaseDate, 8); // Or 8 weeks after release
  
  const durationWeeks = differenceInWeeks(endDate, startDate);

  // Step 2: Calculate base capacity
  const platformFrequency = getPlatformFrequency(config.platforms);
  const hoursCapacity = getCapacityFromHours(config.hoursPerWeek);
  
  // Use the lower of the two (platform preference vs. artist capacity)
  let baseSnapshotsPerWeek = Math.min(platformFrequency, hoursCapacity);

  // Step 3: Apply adaptive frequency (if posting history exists)
  const snapshotsPerWeek = calculateAdaptiveFrequency(config, baseSnapshotsPerWeek);

  // Step 4: Calculate total snapshots (cap at 8 per world)
  const totalSnapshots = Math.min(
    Math.ceil(snapshotsPerWeek * durationWeeks),
    8 // Max per world
  );

  // Step 5: Generate posting dates
  const postingDates = generatePostingDates(
    startDate,
    endDate,
    totalSnapshots,
    snapshotsPerWeek
  );

  // Step 6: Create snapshot objects with week labels
  const snapshots: ScheduledSnapshot[] = postingDates.map((date, index) => {
    const dateObj = new Date(date);
    const releaseDateObj = new Date(config.releaseDate);
    const weeksDiff = Math.round((dateObj.getTime() - releaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 7));
    
    let weekLabel: string;
    if (weeksDiff < 0) {
      weekLabel = `Week ${weeksDiff}`; // "Week -2", "Week -1"
    } else if (weeksDiff === 0) {
      weekLabel = 'Release Week';
    } else {
      weekLabel = `Week +${weeksDiff}`; // "Week +1", "Week +2"
    }

    // Determine platform (use primary or distribute)
    const platform = config.platforms[0] as 'instagram' | 'tiktok' | 'youtube';

    // Optimal posting time (2pm for most platforms)
    const suggestedTime = '14:00';

    return {
      id: `snapshot-${index + 1}`,
      postingDate: date,
      weekLabel,
      order: index + 1,
      platform,
      suggestedTime,
    };
  });

  return {
    totalSnapshots,
    snapshotsPerWeek,
    postingDates,
    timeline: {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      durationWeeks,
    },
    snapshots,
  };
}

/**
 * Update schedule based on posting performance
 */
export function updateScheduleWithPerformance(
  config: SnapshotScheduleConfig,
  currentSchedule: SnapshotSchedule
): SnapshotSchedule {
  // Recalculate with updated posting history
  const updatedConfig = {
    ...config,
    currentTargetSnapshotsPerWeek: calculateAdaptiveFrequency(
      config,
      currentSchedule.snapshotsPerWeek
    ),
  };

  return calculateSnapshotSchedule(updatedConfig);
}


