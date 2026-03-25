import { describe, it, expect } from 'vitest';
import { scheduleSmartEditPieces } from '../smartedit-scheduler';
import type { EditPiece } from '@/app/api/mark-edit/route';
import type { TrialReel } from '../trial-reel-generator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePiece(name: string): EditPiece {
  return {
    name,
    aspectRatio: '9:16',
    arcType: 'build-to-peak',
    uniquenessNote: 'test',
    clips: [{ clipIndex: 0, startFrom: 0, duration: 3, rotation: 0 as const, scale: 1 }],
    audioStartSec: 28,
    audioDurationSec: 15,
    captionSuggestion: 'caption',
    hookNotes: 'hook',
  };
}

function makeTrialReels(count = 2): TrialReel[] {
  return Array.from({ length: count }, (_, i) => ({
    parentPieceIndex: 0,
    variationType: (i === 0 ? 'hook-swap' : 'length-trim') as TrialReel['variationType'],
    piece: makePiece(`variation ${i}`),
    captionSuggestion: `variation caption ${i}`,
  }));
}

const VALID_POST_DAYS = [2, 4, 5]; // Tue=2, Thu=4, Fri=5

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SmartEdit scheduler', () => {
  it('returns one scheduled post per piece', () => {
    const pieces = [makePiece('P1'), makePiece('P2'), makePiece('P3')];
    const reels = pieces.map(() => makeTrialReels());
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    expect(posts).toHaveLength(3);
  });

  it('returns empty array for no pieces', () => {
    const posts = scheduleSmartEditPieces([], [], '2026-04-01');
    expect(posts).toHaveLength(0);
  });

  it('post dates fall on Tue/Thu/Fri', () => {
    const pieces = Array.from({ length: 5 }, (_, i) => makePiece(`P${i}`));
    const reels = pieces.map(() => makeTrialReels());
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    for (const post of posts) {
      const day = new Date(post.postDate + 'T12:00:00').getDay();
      expect(VALID_POST_DAYS).toContain(day);
    }
  });

  it('trial reel dates are exactly 1 day before post dates', () => {
    const pieces = [makePiece('P1'), makePiece('P2'), makePiece('P3')];
    const reels = pieces.map(() => makeTrialReels());
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    for (const post of posts) {
      const postMs = new Date(post.postDate + 'T12:00:00').getTime();
      const trialMs = new Date(post.trialReelDate + 'T12:00:00').getTime();
      expect(postMs - trialMs).toBe(86_400_000); // exactly 24 hours
    }
  });

  it('each post carries its trial reels', () => {
    const pieces = [makePiece('P1'), makePiece('P2')];
    const reels = pieces.map(() => makeTrialReels(2));
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    for (const post of posts) {
      expect(post.trialReels).toHaveLength(2);
    }
  });

  it('posts have correct pieceIndex', () => {
    const pieces = [makePiece('P1'), makePiece('P2'), makePiece('P3')];
    const reels = pieces.map(() => makeTrialReels());
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    posts.forEach((post, i) => {
      expect(post.pieceIndex).toBe(i);
      expect(post.piece.name).toBe(`P${i + 1}`);
    });
  });

  it('all posts start with status scheduled', () => {
    const pieces = [makePiece('P1')];
    const reels = [makeTrialReels()];
    const posts = scheduleSmartEditPieces(pieces, reels, '2026-04-01');
    expect(posts[0].status).toBe('scheduled');
  });

  it('handles single piece', () => {
    const posts = scheduleSmartEditPieces([makePiece('Solo')], [makeTrialReels()], '2026-06-15');
    expect(posts).toHaveLength(1);
    const day = new Date(posts[0].postDate + 'T12:00:00').getDay();
    expect(VALID_POST_DAYS).toContain(day);
  });
});
