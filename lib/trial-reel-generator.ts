import type { EditPiece, EditPlanClip } from '@/app/api/mark-edit/route';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrialReel {
  parentPieceIndex: number;
  variationType: 'hook-swap' | 'length-trim' | 'audio-shift';
  piece: EditPiece;
  captionSuggestion: string;
}

// ─── Caption variation templates ──────────────────────────────────────────────

const HOOK_SWAP_PREFIXES = ['🔥', '👀', '🎵', '⚡', '✨'];
const LENGTH_TRIM_CTAS = ['full song out now', 'stream it 🔗', 'link in bio'];
const AUDIO_SHIFT_CTAS = ['listen to the full version', 'out now 🎶', 'new music just dropped'];

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function baseCaption(piece: EditPiece): string {
  return piece.captionSuggestion?.split('\n')[0] ?? piece.name;
}

// ─── Variation creators ───────────────────────────────────────────────────────

function createHookSwapVariation(piece: EditPiece, pieceIndex: number): TrialReel {
  const cloned: EditPiece = {
    ...piece,
    clips: [...piece.clips.map(c => ({ ...c }))],
    name: `${piece.name} — alt hook`,
  };

  // Rotate clips so clips[1] becomes clips[0] (if there are multiple clips)
  if (cloned.clips.length >= 2) {
    const [first, ...rest] = cloned.clips;
    cloned.clips = [...rest, first];
  }

  const prefix = pickFrom(HOOK_SWAP_PREFIXES, pieceIndex);
  const caption = `${prefix} ${baseCaption(piece)}`;

  return { parentPieceIndex: pieceIndex, variationType: 'hook-swap', piece: cloned, captionSuggestion: caption };
}

function createLengthTrimVariation(piece: EditPiece, pieceIndex: number): TrialReel {
  const cloned: EditPiece = {
    ...piece,
    clips: [...piece.clips.map(c => ({ ...c }))],
    name: `${piece.name} — short cut`,
  };

  // Trim 3–5 seconds from audioDurationSec (minimum 10s)
  const trimBy = 3 + (pieceIndex % 3); // 3, 4, or 5
  const original = piece.audioDurationSec ?? piece.clips.reduce((s, c) => s + c.duration, 0);
  const trimmed = Math.max(10, original - trimBy);
  cloned.audioDurationSec = trimmed;

  // Remove or truncate last clip if it now exceeds the new audio duration
  let accumulated = 0;
  const keptClips: EditPlanClip[] = [];
  for (const clip of cloned.clips) {
    if (accumulated >= trimmed) break;
    const remaining = trimmed - accumulated;
    if (clip.duration <= remaining) {
      keptClips.push(clip);
      accumulated += clip.duration;
    } else {
      keptClips.push({ ...clip, duration: remaining });
      accumulated = trimmed;
    }
  }
  if (keptClips.length > 0) cloned.clips = keptClips;

  const cta = pickFrom(LENGTH_TRIM_CTAS, pieceIndex);
  const caption = `${baseCaption(piece)} · ${cta}`;

  return { parentPieceIndex: pieceIndex, variationType: 'length-trim', piece: cloned, captionSuggestion: caption };
}

function createAudioShiftVariation(piece: EditPiece, pieceIndex: number): TrialReel {
  const cloned: EditPiece = {
    ...piece,
    clips: [...piece.clips.map(c => ({ ...c }))],
    name: `${piece.name} — shifted`,
  };

  // Shift audioStartSec forward 2–3 seconds
  const shiftBy = 2 + (pieceIndex % 2); // 2 or 3
  cloned.audioStartSec = (piece.audioStartSec ?? 0) + shiftBy;

  const cta = pickFrom(AUDIO_SHIFT_CTAS, pieceIndex);
  const caption = `${baseCaption(piece)}\n${cta}`;

  return { parentPieceIndex: pieceIndex, variationType: 'audio-shift', piece: cloned, captionSuggestion: caption };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate 2–3 trial reel variations for a piece.
 * Always: hook-swap + length-trim.
 * Plus audio-shift when piece has >= 5 clips.
 */
export function generateTrialReels(piece: EditPiece, pieceIndex: number): TrialReel[] {
  const reels: TrialReel[] = [];

  reels.push(createHookSwapVariation(piece, pieceIndex));
  reels.push(createLengthTrimVariation(piece, pieceIndex));

  if (piece.clips.length >= 5) {
    reels.push(createAudioShiftVariation(piece, pieceIndex));
  }

  return reels;
}
