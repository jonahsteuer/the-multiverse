import { addDays } from 'date-fns';
import { generatePostingScheduleOutline } from './posting-schedule-outline';
import type { EditPiece } from '@/app/api/mark-edit/route';
import type { TrialReel } from './trial-reel-generator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledPost {
  pieceIndex: number;
  piece: EditPiece;
  trialReels: TrialReel[];
  postDate: string;       // ISO date string (YYYY-MM-DD)
  trialReelDate: string;  // ISO date string — 1 day before postDate
  weekLabel: string;      // e.g. "Release Week", "Week -2"
  status: 'scheduled' | 'posted' | 'error';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Assigns each approved piece to a Tue/Thu/Fri posting slot generated from
 * the release date. Trial reel dates are the day before each post date.
 */
export function scheduleSmartEditPieces(
  approvedPieces: EditPiece[],
  trialReels: TrialReel[][],
  releaseDate: string,
): ScheduledPost[] {
  const count = approvedPieces.length;
  if (count === 0) return [];

  const outline = generatePostingScheduleOutline(releaseDate, count);

  return approvedPieces.map((piece, i) => {
    const slot = outline[i] ?? outline[outline.length - 1];
    const postDate = slot.postingDate;
    const trialDate = addDays(new Date(postDate + 'T12:00:00'), -1)
      .toISOString()
      .slice(0, 10);

    return {
      pieceIndex: i,
      piece,
      trialReels: trialReels[i] ?? [],
      postDate,
      trialReelDate: trialDate,
      weekLabel: slot.weekLabel ?? '',
      status: 'scheduled' as const,
    };
  });
}
