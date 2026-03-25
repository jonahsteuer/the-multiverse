import { describe, it, expect } from 'vitest';
import type { EditPiece } from '@/app/api/mark-edit/route';

// ─── Parser extracted from route.ts response handling ────────────────────────
// This mirrors the exact logic used in SmartEditTab callMark() and route.ts

function parseEditPlan(text: string): { pieces: EditPiece[] } | null {
  const planMatch = text.match(/\[EDIT_PLAN\]([\s\S]*?)\[\/EDIT_PLAN\]/);
  if (!planMatch) return null;
  try {
    return JSON.parse(planMatch[1].trim());
  } catch {
    return null;
  }
}

function parsePass1(text: string): { lipsyncClips: number[]; detectedSoundbyte?: { label: string; confidence: string } } | null {
  const match = text.match(/\[PASS1\]([\s\S]*?)\[\/PASS1\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FOUR_PIECE_RESPONSE =
  'Here are 4 unique pieces. [EDIT_PLAN]' +
  JSON.stringify({
    pieces: [
      { name: 'Power Walk Hook', aspectRatio: '9:16', arcType: 'build-to-peak', uniquenessNote: 'Different hook clip 0, linear build', clips: [{ clipIndex: 0, startFrom: 0, duration: 3.5, rotation: 270, scale: 1.0 }], audioStartSec: 28, audioDurationSec: 15, soundbyteId: 'sb-1', captionSuggestion: 'drop everything\nyou need to hear this', hookNotes: 'Opens mid-walk, immediate energy' },
      { name: 'Raw Studio Feel', aspectRatio: '9:16', arcType: 'even-montage', uniquenessNote: 'Clip 2 hook, held shots vs quick cuts', clips: [{ clipIndex: 2, startFrom: 0.5, duration: 4.0, rotation: 0, scale: 1.0 }], audioStartSec: 28, audioDurationSec: 20, soundbyteId: 'sb-1', captionSuggestion: 'recorded this at 2am\nit became something', hookNotes: 'Studio authenticity, slower burn' },
      { name: 'Peak Energy Burst', aspectRatio: '9:16', arcType: 'peak-valley-peak', uniquenessNote: 'Clip 5 as hook, high-low-high vs linear', clips: [{ clipIndex: 5, startFrom: 0, duration: 2.0, rotation: 0, scale: 1.0 }], audioStartSec: 28, audioDurationSec: 15, soundbyteId: 'sb-1', captionSuggestion: 'this is the moment', hookNotes: 'Peaks immediately for familiar audience' },
      { name: 'Slow Reveal', aspectRatio: '4:5', arcType: 'slow-build', uniquenessNote: 'Different aspect ratio, clip 8 hook, 40% different clip set', clips: [{ clipIndex: 8, startFrom: 0, duration: 5.0, rotation: 0, scale: 1.0 }], audioStartSec: 30, audioDurationSec: 25, soundbyteId: 'sb-1', captionSuggestion: 'patience.\nthen everything at once', hookNotes: 'Feed format, held opening shot' },
    ],
  }) +
  '[/EDIT_PLAN]';

const SINGLE_PIECE_RESPONSE =
  "Here's your edit. [EDIT_PLAN]" +
  JSON.stringify({ pieces: [{ name: 'Single Cut', aspectRatio: '9:16', arcType: 'build-to-peak', uniquenessNote: 'Only piece', clips: [{ clipIndex: 0, startFrom: 0, duration: 3.0, rotation: 0, scale: 1.0 }], audioStartSec: 0, audioDurationSec: 15, captionSuggestion: 'caption', hookNotes: 'hook' }] }) +
  '[/EDIT_PLAN]';

const makePieceJSON = (name: string, arcType: string) =>
  ({ name, aspectRatio: '9:16', arcType, uniquenessNote: '', clips: [], audioStartSec: 0, audioDurationSec: 15, captionSuggestion: '', hookNotes: '' });

const EIGHT_PIECE_RESPONSE =
  '[EDIT_PLAN]' +
  JSON.stringify({ pieces: ['P1','P2','P3','P4','P5','P6','P7','P8'].map((n, i) => makePieceJSON(n, ['build-to-peak','even-montage','slow-build','peak-valley-peak'][i % 4])) }) +
  '[/EDIT_PLAN]';

const PASS1_HIGH_CONFIDENCE = `I can see clear lip sync on clips 0, 2, and 5 — all mapped to the chorus. Ready for Pass 2.
[PASS1]{"lipsyncClips":[0,2,5],"detectedSoundbyte":{"label":"Chorus","confidence":"high"}}[/PASS1]`;

const PASS1_LOW_CONFIDENCE = `I see mouth movement but can't determine the section. What part of the song did you record to?
[PASS1]{"lipsyncClips":[1],"detectedSoundbyte":{"label":"","confidence":"low"}}[/PASS1]`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Edit plan parser', () => {
  it('parses multi-piece edit plan — all 4 pieces returned', () => {
    const plan = parseEditPlan(FOUR_PIECE_RESPONSE);
    expect(plan).not.toBeNull();
    expect(plan!.pieces).toHaveLength(4);
  });

  it('each piece has required fields', () => {
    const plan = parseEditPlan(FOUR_PIECE_RESPONSE)!;
    for (const piece of plan.pieces) {
      expect(piece.name).toBeTruthy();
      expect(piece.aspectRatio).toBeTruthy();
      expect(piece.clips).toBeDefined();
      expect(piece.hookNotes).toBeTruthy();
      expect(piece.captionSuggestion).toBeTruthy();
    }
  });

  it('parses arcType on every piece', () => {
    const plan = parseEditPlan(FOUR_PIECE_RESPONSE)!;
    const validArcTypes = ['build-to-peak', 'peak-valley-peak', 'even-montage', 'slow-build'];
    for (const piece of plan.pieces) {
      expect(validArcTypes).toContain(piece.arcType);
    }
  });

  it('parses uniquenessNote on every piece', () => {
    const plan = parseEditPlan(FOUR_PIECE_RESPONSE)!;
    for (const piece of plan.pieces) {
      expect(typeof piece.uniquenessNote).toBe('string');
    }
  });

  it('handles single piece — backward compatibility', () => {
    const plan = parseEditPlan(SINGLE_PIECE_RESPONSE);
    expect(plan).not.toBeNull();
    expect(plan!.pieces).toHaveLength(1);
    expect(plan!.pieces[0].name).toBe('Single Cut');
  });

  it('rejects pieces exceeding 6 cap — slice logic', () => {
    const plan = parseEditPlan(EIGHT_PIECE_RESPONSE);
    expect(plan).not.toBeNull();
    // Raw parse returns 8; SmartEditTab caps at 6 via .slice(0, 6)
    const capped = plan!.pieces.slice(0, 6);
    expect(capped).toHaveLength(6);
    expect(capped[capped.length - 1].name).toBe('P6');
  });

  it('returns null for response with no edit plan', () => {
    const plan = parseEditPlan("Here's my analysis. No edit plan yet.");
    expect(plan).toBeNull();
  });

  it('returns null for malformed JSON inside tags', () => {
    const plan = parseEditPlan('[EDIT_PLAN]{bad json here}[/EDIT_PLAN]');
    expect(plan).toBeNull();
  });
});

describe('Pass 1 parser', () => {
  it('parses lipsyncClips and detectedSoundbyte with high confidence', () => {
    const pass1 = parsePass1(PASS1_HIGH_CONFIDENCE);
    expect(pass1).not.toBeNull();
    expect(pass1!.lipsyncClips).toEqual([0, 2, 5]);
    expect(pass1!.detectedSoundbyte?.label).toBe('Chorus');
    expect(pass1!.detectedSoundbyte?.confidence).toBe('high');
  });

  it('parses low confidence pass1 with empty label', () => {
    const pass1 = parsePass1(PASS1_LOW_CONFIDENCE);
    expect(pass1).not.toBeNull();
    expect(pass1!.lipsyncClips).toEqual([1]);
    expect(pass1!.detectedSoundbyte?.confidence).toBe('low');
    expect(pass1!.detectedSoundbyte?.label).toBe('');
  });

  it('returns null for response with no pass1 tag', () => {
    const pass1 = parsePass1('Just a regular message from Mark.');
    expect(pass1).toBeNull();
  });
});
