import { describe, it, expect } from 'vitest';
import { selectWinner, type TrialReelEngagement } from '../instagram-posting';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReel(
  variationType: TrialReelEngagement['variationType'],
  watchThroughRate: number,
  engagementCount: number,
  mediaId = `mock-${variationType}`,
): TrialReelEngagement {
  return { variationType, instagramMediaId: mediaId, watchThroughRate, engagementCount };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('selectWinner', () => {
  it('returns null for empty array', () => {
    const { winner } = selectWinner([]);
    expect(winner).toBeNull();
  });

  it('returns null when all reels have zero metrics', () => {
    const reels = [
      makeReel('hook-swap', 0, 0),
      makeReel('length-trim', 0, 0),
    ];
    const { winner } = selectWinner(reels);
    expect(winner).toBeNull();
  });

  it('picks the reel with the highest watch-through rate (clear winner)', () => {
    const reels = [
      makeReel('hook-swap', 0.45, 120),
      makeReel('length-trim', 0.72, 80),  // highest WTR
      makeReel('audio-shift', 0.31, 200),
    ];
    const { winner } = selectWinner(reels);
    expect(winner?.variationType).toBe('length-trim');
  });

  it('uses engagement tiebreaker when two reels are within 5% WTR', () => {
    const reels = [
      makeReel('hook-swap', 0.700, 150),   // within 5% of top
      makeReel('length-trim', 0.710, 90),  // top WTR
      makeReel('audio-shift', 0.400, 500), // far below — not in tie group
    ];
    // 5% threshold: 0.710 * 0.95 = 0.6745 → hook-swap (0.700) qualifies
    const { winner } = selectWinner(reels);
    expect(winner?.variationType).toBe('hook-swap'); // higher engagement
  });

  it('uses engagement tiebreaker for all three reels within 5%', () => {
    const reels = [
      makeReel('hook-swap', 0.800, 50),
      makeReel('length-trim', 0.820, 300),  // highest engagement
      makeReel('audio-shift', 0.810, 200),
    ];
    // top = 0.820, threshold = 0.779 → all qualify
    const { winner } = selectWinner(reels);
    expect(winner?.variationType).toBe('length-trim');
  });

  it('ignores a reel outside the 5% tie window when picking by engagement', () => {
    const reels = [
      makeReel('hook-swap', 0.900, 1000),  // highest engagement but far below top WTR
      makeReel('length-trim', 0.950, 100), // top
      makeReel('audio-shift', 0.940, 80),  // within 5% of 0.95
    ];
    // threshold = 0.950 * 0.95 = 0.9025; hook-swap = 0.900 < 0.9025 → excluded
    // tie group: length-trim + audio-shift; engagement winner = length-trim (100 > 80)
    const { winner } = selectWinner(reels);
    expect(winner?.variationType).toBe('length-trim');
  });

  it('returns a reason string for clear winner', () => {
    const reels = [makeReel('hook-swap', 0.5, 50), makeReel('length-trim', 0.8, 30)];
    const { reason } = selectWinner(reels);
    expect(reason).toMatch(/watch-through/i);
  });

  it('returns a reason string for tiebreaker winner', () => {
    const reels = [
      makeReel('hook-swap', 0.800, 500),
      makeReel('length-trim', 0.810, 100),
    ];
    const { reason } = selectWinner(reels);
    expect(reason).toMatch(/tiebreaker/i);
  });

  it('works with a single reel that has non-zero metrics', () => {
    const reels = [makeReel('hook-swap', 0.6, 200)];
    const { winner } = selectWinner(reels);
    expect(winner?.variationType).toBe('hook-swap');
  });

  it('does not mutate the input array order', () => {
    const reels = [
      makeReel('hook-swap', 0.3, 100),
      makeReel('length-trim', 0.8, 50),
      makeReel('audio-shift', 0.6, 75),
    ];
    const original = reels.map(r => r.variationType);
    selectWinner(reels);
    expect(reels.map(r => r.variationType)).toEqual(original);
  });
});
