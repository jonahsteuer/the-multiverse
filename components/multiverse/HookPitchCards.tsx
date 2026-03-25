'use client';

import React, { useState } from 'react';
import type { EditPiece, ClipFrames, ClipInfo, SoundbyteSummary } from '@/app/api/mark-edit/route';
import { ClipSwapDrawer } from './ClipSwapDrawer';

// ─── Types ────────────────────────────────────────────────────────────────────

type CardStatus = 'pending' | 'approved' | 'rejected';

interface CardState {
  piece: EditPiece;
  status: CardStatus;
}

interface HookPitchCardsProps {
  pieces: EditPiece[];
  clipFrames: ClipFrames[];
  clipInfos: ClipInfo[];
  soundbytes: SoundbyteSummary[];
  onApprove: (approvedPieces: EditPiece[]) => void;
  onCancel: () => void;
}

// ─── Arc type label map ───────────────────────────────────────────────────────

const ARC_LABELS: Record<string, string> = {
  'build-to-peak':    'Build to peak',
  'peak-valley-peak': 'Peak · valley · peak',
  'even-montage':     'Even montage',
  'slow-build':       'Slow build',
};

// ─── Single card ──────────────────────────────────────────────────────────────

function PitchCard({
  card,
  cardIndex,
  clipFrames,
  clipInfos,
  soundbytes,
  onStatusChange,
  onPieceChange,
}: {
  card: CardState;
  cardIndex: number;
  clipFrames: ClipFrames[];
  clipInfos: ClipInfo[];
  soundbytes: SoundbyteSummary[];
  onStatusChange: (index: number, status: CardStatus) => void;
  onPieceChange: (index: number, piece: EditPiece) => void;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const { piece, status } = card;

  // First keyframe of clips[0]
  const hookClipIndex = piece.clips[0]?.clipIndex ?? 0;
  const hookFrames = clipFrames.find(cf => cf.clipIndex === hookClipIndex);
  const hookThumb = hookFrames?.frames[0]?.dataUri;

  // Soundbyte label for this piece
  const sb = soundbytes.find(s => s.id === piece.soundbyteId);
  const sbLabel = sb ? `${sb.label} · ${fmtSec(sb.startSec)}–${fmtSec(sb.endSec)}` : null;

  // Clip indices used by this piece
  const clipIndices = piece.clips.map(c => c.clipIndex);
  const uniqueIndices = [...new Set(clipIndices)];

  function handleSwap(newClipIndex: number) {
    // Find where newClipIndex currently sits in the clip list
    const newClips = [...piece.clips];
    const swapTargetIdx = newClips.findIndex(c => c.clipIndex === newClipIndex);
    // Swap clips[0] with swapTargetIdx (or just prepend if not found)
    if (swapTargetIdx > 0) {
      [newClips[0], newClips[swapTargetIdx]] = [newClips[swapTargetIdx], newClips[0]];
    } else if (swapTargetIdx === -1) {
      // Clip not in list — replace clips[0] with it
      newClips[0] = { ...newClips[0], clipIndex: newClipIndex };
    }
    onPieceChange(cardIndex, { ...piece, clips: newClips });
    setSwapOpen(false);
  }

  const borderClass =
    status === 'approved' ? 'border-yellow-500/70 shadow-[0_0_12px_rgba(234,179,8,0.15)]' :
    status === 'rejected' ? 'border-gray-700/50' :
    'border-yellow-500/20 hover:border-yellow-500/35';

  const opacityClass = status === 'rejected' ? 'opacity-45' : 'opacity-100';

  return (
    <>
      <div
        className={`relative rounded-xl border bg-gray-950 flex flex-col overflow-hidden transition-all duration-200 ${borderClass} ${opacityClass}`}
        style={{ animation: `slideInRight ${120 + cardIndex * 60}ms ease-out` }}
      >
        {/* Approved badge */}
        {status === 'approved' && (
          <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-lg">
            ✓
          </div>
        )}

        {/* Hook thumbnail */}
        <button
          className="relative w-full bg-black overflow-hidden group"
          style={{ aspectRatio: piece.aspectRatio === '16:9' ? '16/9' : piece.aspectRatio === '1:1' ? '1/1' : piece.aspectRatio === '4:5' ? '4/5' : '9/16', maxHeight: 180 }}
          onClick={() => setSwapOpen(true)}
          title="Tap to swap hook clip"
        >
          {hookThumb ? (
            <img src={hookThumb} alt="Hook frame" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <span className="text-gray-700 text-xs font-star-wars">Clip #{hookClipIndex}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Swap hint */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] text-white bg-black/60 px-2 py-1 rounded font-star-wars">
              swap hook
            </span>
          </div>
          {/* Aspect ratio badge */}
          <div className="absolute bottom-1.5 left-2">
            <span className="text-[8px] text-gray-400 bg-black/60 px-1.5 py-0.5 rounded font-mono">
              {piece.aspectRatio ?? '9:16'}
            </span>
          </div>
        </button>

        {/* Card body */}
        <div className="p-3 flex flex-col gap-1.5 flex-1">
          {/* Piece name */}
          <p className="text-xs font-star-wars text-yellow-400 leading-tight truncate">{piece.name}</p>

          {/* Hook notes — the concept */}
          {piece.hookNotes && (
            <p className="text-[11px] text-white/80 leading-snug">{piece.hookNotes}</p>
          )}

          {/* Soundbyte */}
          {sbLabel && (
            <p className="text-[10px] text-yellow-500/80 font-mono">{sbLabel}</p>
          )}

          {/* Arc type badge */}
          {piece.arcType && (
            <span className="self-start text-[9px] text-gray-400 bg-gray-800/80 border border-gray-700/50 px-2 py-0.5 rounded-full font-mono">
              {ARC_LABELS[piece.arcType] ?? piece.arcType}
            </span>
          )}

          {/* Clip list */}
          <p className="text-[9px] text-gray-600 font-mono mt-0.5">
            clips {uniqueIndices.join(', ')} · {piece.clips.length} cut{piece.clips.length !== 1 ? 's' : ''}
          </p>

          {/* Uniqueness note (collapsed, shown as tooltip-like small text) */}
          {piece.uniquenessNote && (
            <p className="text-[9px] text-gray-600 italic leading-snug line-clamp-2">
              {piece.uniquenessNote}
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-auto pt-2 flex gap-2">
            {status === 'pending' && (
              <>
                <button
                  onClick={() => onStatusChange(cardIndex, 'approved')}
                  className="flex-1 text-[10px] font-star-wars py-1.5 rounded border border-yellow-500/30 bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => onStatusChange(cardIndex, 'rejected')}
                  className="flex-1 text-[10px] font-star-wars py-1.5 rounded border border-red-500/20 bg-red-500/10 text-red-500/70 hover:bg-red-500/20 transition-colors"
                >
                  Cut
                </button>
              </>
            )}
            {(status === 'approved' || status === 'rejected') && (
              <button
                onClick={() => onStatusChange(cardIndex, 'pending')}
                className="flex-1 text-[10px] font-star-wars py-1.5 rounded border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      </div>

      {swapOpen && (
        <ClipSwapDrawer
          currentClipIndex={hookClipIndex}
          clipInfos={clipInfos}
          clipFrames={clipFrames}
          onSwap={handleSwap}
          onClose={() => setSwapOpen(false)}
        />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HookPitchCards({
  pieces,
  clipFrames,
  clipInfos,
  soundbytes,
  onApprove,
  onCancel,
}: HookPitchCardsProps) {
  const [cards, setCards] = useState<CardState[]>(() =>
    pieces.map(piece => ({ piece, status: 'pending' as CardStatus }))
  );

  const approvedCount = cards.filter(c => c.status === 'approved').length;
  const canRender = approvedCount >= 1;

  function handleStatusChange(index: number, status: CardStatus) {
    setCards(prev => prev.map((c, i) => i === index ? { ...c, status } : c));
  }

  function handlePieceChange(index: number, piece: EditPiece) {
    setCards(prev => prev.map((c, i) => i === index ? { ...c, piece } : c));
  }

  function handleRender() {
    const approved = cards.filter(c => c.status === 'approved').map(c => c.piece);
    onApprove(approved);
  }

  return (
    <div className="flex flex-col gap-4" style={{ minHeight: '560px' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Mark's Pitch · {pieces.length} piece{pieces.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-[10px] text-gray-600 mt-0.5">
            Approve what you want rendered. Tap a thumbnail to swap the hook clip.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-[10px] text-gray-600 hover:text-gray-400 font-star-wars transition-colors"
        >
          ← back
        </button>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
        {cards.map((card, i) => (
          <PitchCard
            key={i}
            card={card}
            cardIndex={i}
            clipFrames={clipFrames}
            clipInfos={clipInfos}
            soundbytes={soundbytes}
            onStatusChange={handleStatusChange}
            onPieceChange={handlePieceChange}
          />
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 bg-gray-950/95 backdrop-blur-sm border-t border-yellow-500/10 py-3 flex items-center justify-between gap-4 rounded-b-xl">
        <div>
          <p className="text-xs font-star-wars text-gray-400">
            {approvedCount} of {pieces.length} approved
          </p>
          {approvedCount > 0 && (
            <p className="text-[9px] text-gray-600">
              + {approvedCount * 2}–{approvedCount * 3} trial reels scheduled automatically
            </p>
          )}
        </div>
        <button
          onClick={handleRender}
          disabled={!canRender}
          className={`px-5 py-2 rounded-lg font-star-wars text-xs transition-all ${
            canRender
              ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_16px_rgba(234,179,8,0.3)]'
              : 'bg-yellow-500/20 text-yellow-500/40 opacity-40 cursor-not-allowed'
          }`}
        >
          Render these →
        </button>
      </div>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function fmtSec(secs: number) {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
