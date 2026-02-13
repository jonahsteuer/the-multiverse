/**
 * Generate initial posting schedule outline (6-8 dates)
 * Based on optimal posting frequency before and after release
 */

export interface PostingScheduleOutline {
  id: string;
  postingDate: string; // ISO date string
  weekLabel: string; // e.g., "Week -2", "Release Week", "Week +1"
  status: 'pending' | 'approved'; // pending = no snapshot idea yet
  snapshotId?: string; // If approved, link to snapshot
}

/**
 * Generate 6-8 optimal posting dates based on release date
 * Distribution: 2 weeks before, release week, 8 weeks after
 */
export function generatePostingScheduleOutline(
  releaseDate: string,
  count: number = 7 // Default to 7, can be 6-8
): PostingScheduleOutline[] {
  const release = new Date(releaseDate);
  release.setHours(12, 0, 0, 0);

  const daysBefore = 14; // 2 weeks before
  const daysAfter = 56; // 8 weeks after
  
  // Distribute dates across timeline
  const outlines: PostingScheduleOutline[] = [];
  
  // Calculate positions (0 = 14 days before, 1 = 56 days after)
  for (let i = 0; i < count; i++) {
    const position = i / (count - 1 || 1);
    
    let daysOffset: number;
    if (position <= 0.2) {
      // First 20%: distribute across 14 days before release
      const daysFromStart = Math.round(position * 5 * daysBefore);
      daysOffset = -daysBefore + daysFromStart;
    } else if (position <= 0.4) {
      // Next 20%: release week
      daysOffset = Math.round((position - 0.2) * 5 * 7) - 7;
    } else {
      // Remaining 60%: distribute across 56 days after
      const daysFromRelease = Math.round((position - 0.4) * (5/3) * daysAfter);
      daysOffset = daysFromRelease;
    }

    const postingDate = new Date(release);
    postingDate.setDate(postingDate.getDate() + daysOffset);
    
    // Adjust to optimal posting days (Tuesday/Thursday/Friday)
    const dayOfWeek = postingDate.getDay();
    if (dayOfWeek === 0) { // Sunday -> move to Friday
      postingDate.setDate(postingDate.getDate() - 2);
    } else if (dayOfWeek === 6) { // Saturday -> move to Friday
      postingDate.setDate(postingDate.getDate() - 1);
    } else if (dayOfWeek === 1) { // Monday -> move to Tuesday
      postingDate.setDate(postingDate.getDate() + 1);
    } else if (dayOfWeek === 2) { // Tuesday -> keep
      // Keep as is
    } else if (dayOfWeek === 3) { // Wednesday -> move to Thursday
      postingDate.setDate(postingDate.getDate() + 1);
    } else if (dayOfWeek === 4) { // Thursday -> keep
      // Keep as is
    } else if (dayOfWeek === 5) { // Friday -> keep
      // Keep as is
    }

    // Calculate week label
    const daysFromRelease = daysOffset;
    let weekLabel: string;
    if (daysFromRelease < -7) {
      weekLabel = `Week -${Math.ceil(Math.abs(daysFromRelease) / 7)}`;
    } else if (daysFromRelease < 0) {
      weekLabel = 'Week -1';
    } else if (daysFromRelease === 0) {
      weekLabel = 'Release Week';
    } else if (daysFromRelease <= 7) {
      weekLabel = 'Week +1';
    } else {
      weekLabel = `Week +${Math.ceil(daysFromRelease / 7)}`;
    }

    outlines.push({
      id: `outline-${i + 1}`,
      postingDate: postingDate.toISOString().split('T')[0],
      weekLabel,
      status: 'pending',
    });
  }

  return outlines;
}


