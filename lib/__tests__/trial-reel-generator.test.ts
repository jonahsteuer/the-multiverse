import { describe, it, expect } from 'vitest';
import { generateTrialReels } from '../trial-reel-generator';
import type { EditPiece } from '@/app/api/mark-edit/route';

// ─── Test helper ──────────────────────────────────────────────────────────────

function makePiece(clipCount: number, overrides: Partial<EditPiece> = {}): EditPiece {
  return {
    name: 'Test Piece',
    aspectRatio: '9:16',
    arcType: 'build-to-peak',
    uniquenessNote: 'test',
    clips: Array.from({ length: clipCount }, (_, i) => ({
      clipIndex: i,
      startFrom: 0,
      duration: 3,
      rotation: 0 as const,
      scale: 1,
    })),
    audioStartSec: 28,
    audioDurationSec: 15,
    soundbyteId: 'sb-1',
    captionSuggestion: 'first line\nsecond line',
    hookNotes: 'test hook',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Trial reel generator', () => {
  it('generates 3 variations for piece with 6 clips', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 0);
    expect(reels).toHaveLength(3);
    expect(reels[0].variationType).toBe('hook-swap');
    expect(reels[1].variationType).toBe('length-trim');
    expect(reels[2].variationType).toBe('audio-shift');
  });

  it('generates 2 variations for piece with 3 clips (no audio-shift)', () => {
    const piece = makePiece(3);
    const reels = generateTrialReels(piece, 0);
    expect(reels).toHaveLength(2);
    expect(reels.map(r => r.variationType)).not.toContain('audio-shift');
  });

  it('generates 2 variations for piece with 4 clips (no audio-shift)', () => {
    const piece = makePiece(4);
    const reels = generateTrialReels(piece, 0);
    expect(reels).toHaveLength(2);
  });

  it('generates 3 variations for piece with exactly 5 clips', () => {
    const piece = makePiece(5);
    const reels = generateTrialReels(piece, 0);
    expect(reels).toHaveLength(3);
  });

  it('hook-swap has different clips[0] than original', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 0);
    const hookSwap = reels.find(r => r.variationType === 'hook-swap')!;
    // clips[0] should now be what was clips[1]
    expect(hookSwap.piece.clips[0].clipIndex).toBe(1);
    // original clips[0] should be at the end
    expect(hookSwap.piece.clips[hookSwap.piece.clips.length - 1].clipIndex).toBe(0);
  });

  it('hook-swap with 1 clip keeps clips[0] the same (graceful)', () => {
    const piece = makePiece(1);
    const reels = generateTrialReels(piece, 0);
    const hookSwap = reels.find(r => r.variationType === 'hook-swap')!;
    expect(hookSwap.piece.clips[0].clipIndex).toBe(0);
  });

  it('length-trim has shorter audioDurationSec', () => {
    const piece = makePiece(6, { audioDurationSec: 15 });
    const reels = generateTrialReels(piece, 0);
    const trim = reels.find(r => r.variationType === 'length-trim')!;
    expect(trim.piece.audioDurationSec!).toBeLessThan(15);
    expect(trim.piece.audioDurationSec!).toBeGreaterThanOrEqual(10);
  });

  it('length-trim never goes below 10 seconds', () => {
    const piece = makePiece(3, { audioDurationSec: 10 });
    const reels = generateTrialReels(piece, 0);
    const trim = reels.find(r => r.variationType === 'length-trim')!;
    expect(trim.piece.audioDurationSec!).toBeGreaterThanOrEqual(10);
  });

  it('length-trim keeps clips[0] hook identical', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 0);
    const trim = reels.find(r => r.variationType === 'length-trim')!;
    expect(trim.piece.clips[0].clipIndex).toBe(piece.clips[0].clipIndex);
  });

  it('audio-shift has later audioStartSec', () => {
    const piece = makePiece(6, { audioStartSec: 28 });
    const reels = generateTrialReels(piece, 0);
    const shift = reels.find(r => r.variationType === 'audio-shift')!;
    expect(shift.piece.audioStartSec!).toBeGreaterThan(28);
    expect(shift.piece.audioStartSec!).toBeLessThanOrEqual(31);
  });

  it('audio-shift keeps clips[0] identical', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 0);
    const shift = reels.find(r => r.variationType === 'audio-shift')!;
    expect(shift.piece.clips[0].clipIndex).toBe(piece.clips[0].clipIndex);
  });

  it('each variation has a different captionSuggestion', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 0);
    const captions = reels.map(r => r.captionSuggestion);
    const unique = new Set(captions);
    expect(unique.size).toBe(captions.length);
  });

  it('original piece is not mutated', () => {
    const piece = makePiece(6, { audioStartSec: 28, audioDurationSec: 15 });
    const originalClip0 = piece.clips[0].clipIndex;
    const originalAudio = piece.audioStartSec;
    const originalDuration = piece.audioDurationSec;
    generateTrialReels(piece, 0);
    expect(piece.clips[0].clipIndex).toBe(originalClip0);
    expect(piece.audioStartSec).toBe(originalAudio);
    expect(piece.audioDurationSec).toBe(originalDuration);
  });

  it('all reels carry correct parentPieceIndex', () => {
    const piece = makePiece(6);
    const reels = generateTrialReels(piece, 3);
    for (const reel of reels) {
      expect(reel.parentPieceIndex).toBe(3);
    }
  });
});
