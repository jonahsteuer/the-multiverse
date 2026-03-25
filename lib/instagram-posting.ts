import type { TrialReel } from './trial-reel-generator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrialReelEngagement {
  variationType: TrialReel['variationType'];
  instagramMediaId: string;
  /** 0–1 ratio: video_views / reach */
  watchThroughRate: number;
  /** likes + comments + shares + saves */
  engagementCount: number;
}

export interface WinnerResult {
  winner: TrialReelEngagement | null;
  reason: string;
}

export interface SchedulePostResult {
  success: boolean;
  instagramMediaId?: string;
  error?: string;
}

// ─── Winner selection ─────────────────────────────────────────────────────────

/**
 * Selects the winning trial reel variation.
 *
 * Algorithm:
 * 1. Primary: highest watch-through rate (video_views / reach).
 * 2. Tiebreaker (within 5% of top): highest engagement count.
 * 3. Returns null if no valid metrics (all zero reach, e.g. not posted yet).
 */
export function selectWinner(reels: TrialReelEngagement[]): WinnerResult {
  if (reels.length === 0) return { winner: null, reason: 'No trial reels to evaluate' };

  const validReels = reels.filter(r => r.watchThroughRate > 0 || r.engagementCount > 0);
  if (validReels.length === 0) return { winner: null, reason: 'No engagement data available yet' };

  // Sort by watch-through rate descending
  const sorted = [...validReels].sort((a, b) => b.watchThroughRate - a.watchThroughRate);
  const top = sorted[0];

  // Find all reels within 5% of the top watch-through rate
  const threshold = top.watchThroughRate * 0.95;
  const tied = sorted.filter(r => r.watchThroughRate >= threshold);

  if (tied.length === 1) {
    return {
      winner: top,
      reason: `Best watch-through rate (${(top.watchThroughRate * 100).toFixed(1)}%)`,
    };
  }

  // Tiebreaker: highest engagement count
  const byEngagement = [...tied].sort((a, b) => b.engagementCount - a.engagementCount);
  const winner = byEngagement[0];
  return {
    winner,
    reason: `Tiebreaker — highest engagement (${winner.engagementCount}) among ${tied.length} reels within 5% watch-through`,
  };
}

// ─── Schedule a post via the API route ────────────────────────────────────────

/**
 * Schedules an Instagram post by sending a Blob + metadata to
 * `/api/instagram/schedule-post`. The route uploads the blob to Supabase
 * Storage and calls the Instagram Content Publishing API.
 */
export async function scheduleInstagramPost(opts: {
  blob: Blob;
  caption: string;
  scheduledPublishTime: string; // ISO timestamp
  pieceIndex: number;
  isTrialReel?: boolean;
  variationType?: TrialReel['variationType'];
}): Promise<SchedulePostResult> {
  try {
    const formData = new FormData();
    formData.append('video', opts.blob, `piece-${opts.pieceIndex}.mp4`);
    formData.append('caption', opts.caption);
    formData.append('scheduledPublishTime', opts.scheduledPublishTime);
    formData.append('pieceIndex', String(opts.pieceIndex));
    if (opts.isTrialReel) formData.append('isTrialReel', 'true');
    if (opts.variationType) formData.append('variationType', opts.variationType);

    const res = await fetch('/api/instagram/schedule-post', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.message ?? `HTTP ${res.status}` };
    }

    return res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
