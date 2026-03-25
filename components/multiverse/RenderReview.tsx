'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { EditPreviewComposition, getTotalFrames, getCompositionSize } from '../remotion/EditPreviewComposition';
import type { EditPiece, SoundbyteSummary } from '@/app/api/mark-edit/route';
import type { EditClip } from '@/components/remotion/EditPreviewComposition';
import type { TrialReel } from '@/lib/trial-reel-generator';
import type { ExportQueueItem } from '@/lib/export-queue';

// ─── Types ────────────────────────────────────────────────────────────────────

type PieceStatus = 'pending' | 'approved' | 'revision' | 'killed';

export interface ReEditFeedback {
  quickTags: string[];
  freeText?: string;
}

interface PieceReviewState {
  status: PieceStatus;
  feedback?: ReEditFeedback;
}

export interface RenderReviewProps {
  pieces: EditPiece[];
  timelines: EditClip[][];           // timelines[pieceIndex] = resolved EditClip[]
  trialReels: TrialReel[][];         // trialReels[pieceIndex]
  audioUrl: string | null;
  soundbytes: SoundbyteSummary[];
  exportQueue: ExportQueueItem[];
  onApprove: (pieceIndex: number) => void;
  onKill: (pieceIndex: number) => void;
  onReEdit: (pieceIndex: number, feedback: ReEditFeedback) => void;
  onComplete: (approvedIndices: number[], approvedTrialReels: TrialReel[][]) => void;
}

const FPS = 30;

const QUICK_TAGS = [
  'Faster cuts',
  'Slower pacing',
  'Swap opening clip',
  'Different ending',
  'More lip sync',
  'Less movement',
];

// ─── Variation strip button ───────────────────────────────────────────────────

function VariationButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] font-star-wars px-2 py-1 rounded border transition-all ${
        active
          ? 'border-yellow-500/60 bg-yellow-500/15 text-yellow-400'
          : 'border-gray-700/50 bg-black/30 text-gray-500 hover:text-gray-300 hover:border-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Re-edit panel ────────────────────────────────────────────────────────────

function ReEditPanel({
  onSend,
  onCancel,
  loading,
}: {
  onSend: (feedback: ReEditFeedback) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }

  function handleSend() {
    if (selectedTags.length === 0 && !freeText.trim()) return;
    onSend({ quickTags: selectedTags, freeText: freeText.trim() || undefined });
  }

  return (
    <div className="border border-gray-700/50 rounded-lg bg-gray-900/60 p-3 space-y-3">
      <p className="text-[10px] font-star-wars text-gray-400 uppercase tracking-wider">Tell Mark what to fix</p>

      {/* Quick tag pills */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-[9px] font-star-wars px-2 py-1 rounded-full border transition-all ${
              selectedTags.includes(tag)
                ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400'
                : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Free text */}
      <textarea
        value={freeText}
        onChange={e => setFreeText(e.target.value)}
        placeholder="Anything else... (optional)"
        rows={2}
        className="w-full bg-black/50 border border-gray-700/50 rounded text-xs text-gray-300 placeholder-gray-600 px-2 py-1.5 resize-none focus:outline-none focus:border-yellow-500/40"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSend}
          disabled={loading || (selectedTags.length === 0 && !freeText.trim())}
          className="flex-1 text-[10px] font-star-wars py-1.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/30 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Sending...' : 'Send to Mark →'}
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] font-star-wars py-1.5 px-3 rounded border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RenderReview({
  pieces,
  timelines,
  trialReels,
  audioUrl,
  soundbytes,
  exportQueue,
  onApprove,
  onKill,
  onReEdit,
  onComplete,
}: RenderReviewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeVariation, setActiveVariation] = useState(0); // 0 = main, 1+ = trial reels
  const [reviewStates, setReviewStates] = useState<PieceReviewState[]>(
    () => pieces.map(() => ({ status: 'pending' as PieceStatus })),
  );
  const [reEditOpen, setReEditOpen] = useState(false);
  const [reEditLoading, setReEditLoading] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const currentPiece = pieces[currentIdx];
  const currentTimeline = timelines[currentIdx] ?? [];
  const currentTrialReels = trialReels[currentIdx] ?? [];
  const currentState = reviewStates[currentIdx];
  const exportItem = exportQueue[currentIdx];

  // Build the active clip set — main edit or a trial reel variation
  const activeClips: EditClip[] = useMemo(() => {
    if (activeVariation === 0) return currentTimeline;
    const trialPiece = currentTrialReels[activeVariation - 1]?.piece;
    if (!trialPiece) return currentTimeline;
    // Trial reels reference clipIndices — map them through main timeline's url lookup
    const urlMap: Record<number, string> = {};
    currentTimeline.forEach(clip => {
      // Recover clipIndex from the clip id convention: `{clipId}-p{i}`
      const match = clip.id.match(/-p(\d+)$/);
      if (match) {
        const pos = parseInt(match[1]);
        const pc = currentPiece.clips[pos];
        if (pc) urlMap[pc.clipIndex] = clip.url;
      }
    });
    return trialPiece.clips.map((pc, i) => ({
      id: `trial-${pc.clipIndex}-${i}`,
      url: urlMap[pc.clipIndex] ?? currentTimeline[0]?.url ?? '',
      startFrom: pc.startFrom,
      duration: pc.duration,
      label: pc.label,
      rotation: pc.rotation,
      scale: pc.scale,
    }));
  }, [currentIdx, activeVariation, currentTimeline, currentTrialReels, currentPiece]);

  const activePieceData = activeVariation === 0
    ? currentPiece
    : (currentTrialReels[activeVariation - 1]?.piece ?? currentPiece);

  const totalFrames = getTotalFrames(activeClips, FPS);
  const { width, height } = getCompositionSize(activePieceData?.aspectRatio ?? '9:16');

  const playerInputProps = useMemo(() => ({
    clips: activeClips,
    audioUrl: audioUrl ?? undefined,
    audioStartSec: activePieceData?.audioStartSec,
    audioDurationSec: activePieceData?.audioDurationSec,
  }), [activeClips, audioUrl, activePieceData]);

  function setStatus(index: number, status: PieceStatus) {
    setReviewStates(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
  }

  function handleApprove() {
    setStatus(currentIdx, 'approved');
    onApprove(currentIdx);
    // Auto-advance to next pending piece
    const nextPending = pieces.findIndex((_, i) => i > currentIdx && reviewStates[i]?.status === 'pending');
    if (nextPending >= 0) { setCurrentIdx(nextPending); setActiveVariation(0); }
  }

  function handleKill() {
    setStatus(currentIdx, 'killed');
    onKill(currentIdx);
    const nextPending = pieces.findIndex((_, i) => i > currentIdx && reviewStates[i]?.status === 'pending');
    if (nextPending >= 0) { setCurrentIdx(nextPending); setActiveVariation(0); }
  }

  function handleUndo() {
    setStatus(currentIdx, 'pending');
  }

  function handleSendReEdit(feedback: ReEditFeedback) {
    setReEditLoading(true);
    setStatus(currentIdx, 'revision');
    setReEditOpen(false);
    onReEdit(currentIdx, feedback);
    setReEditLoading(false);
  }

  function handleComplete() {
    const approvedIndices = reviewStates
      .map((s, i) => (s.status === 'approved' ? i : -1))
      .filter(i => i >= 0);
    const approvedTrialReels = approvedIndices.map(i => trialReels[i] ?? []);
    onComplete(approvedIndices, approvedTrialReels);
  }

  const allReviewed = reviewStates.every(s => s.status !== 'pending' && s.status !== 'revision');
  const approvedCount = reviewStates.filter(s => s.status === 'approved').length;

  const statusBadge: Record<PieceStatus, { label: string; cls: string }> = {
    pending:  { label: 'Pending',  cls: 'text-gray-500 bg-gray-800/60 border-gray-700/50' },
    approved: { label: 'Approved', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
    revision: { label: 'Revision', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    killed:   { label: 'Killed',   cls: 'text-red-400/70 bg-red-500/10 border-red-500/20' },
  };

  return (
    <div className="flex flex-col gap-3" style={{ minHeight: '560px' }}>

      {/* Header nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setCurrentIdx(i => Math.max(0, i - 1)); setActiveVariation(0); }}
          disabled={currentIdx === 0}
          className="text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors text-lg"
        >
          ←
        </button>
        <div className="flex-1">
          <p className="text-xs font-star-wars text-yellow-400 truncate">{currentPiece?.name}</p>
          <p className="text-[9px] text-gray-600">{currentIdx + 1} of {pieces.length}</p>
        </div>
        {/* Status badge */}
        <span className={`text-[9px] font-star-wars px-2 py-0.5 rounded border ${statusBadge[currentState.status].cls}`}>
          {statusBadge[currentState.status].label}
        </span>
        <button
          onClick={() => { setCurrentIdx(i => Math.min(pieces.length - 1, i + 1)); setActiveVariation(0); }}
          disabled={currentIdx === pieces.length - 1}
          className="text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors text-lg"
        >
          →
        </button>
      </div>

      {/* Player — lazy-mounted: only active piece has a live Player */}
      <div className="relative rounded-lg overflow-hidden bg-black border border-yellow-500/15"
           style={{ maxHeight: 340, aspectRatio: `${width}/${height}` }}>
        {exportItem?.status === 'exporting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            <p className="text-[10px] text-yellow-400 font-star-wars animate-pulse">Rendering...</p>
            <p className="text-[9px] text-gray-600 mt-1">{Math.round((exportItem.progress ?? 0) * 100)}%</p>
          </div>
        ) : (
          <Player
            key={`${currentIdx}-${activeVariation}-${audioUrl ?? 'no-audio'}`}
            ref={playerRef}
            component={EditPreviewComposition as any}
            inputProps={playerInputProps as any}
            durationInFrames={totalFrames}
            fps={FPS}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: '100%', height: '100%' }}
            controls
          />
        )}
      </div>

      {/* Variation strip */}
      {currentTrialReels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <VariationButton label="Main edit" active={activeVariation === 0} onClick={() => setActiveVariation(0)} />
          {currentTrialReels.map((tr, i) => (
            <VariationButton
              key={i}
              label={tr.variationType === 'hook-swap' ? 'Alt hook' : tr.variationType === 'length-trim' ? 'Short cut' : 'Shifted audio'}
              active={activeVariation === i + 1}
              onClick={() => setActiveVariation(i + 1)}
            />
          ))}
        </div>
      )}

      {/* Action area */}
      {!reEditOpen && (
        <div className="flex gap-2">
          {currentState.status === 'pending' || currentState.status === 'revision' ? (
            <>
              <button
                onClick={handleApprove}
                className="flex-1 py-2 text-[11px] font-star-wars rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/30 transition-colors"
              >
                Approve — send to calendar
              </button>
              <button
                onClick={() => setReEditOpen(true)}
                className="flex-1 py-2 text-[11px] font-star-wars rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Re-edit
              </button>
              <button
                onClick={handleKill}
                className="px-3 py-2 text-[11px] font-star-wars rounded-lg border border-red-500/20 text-red-500/60 hover:bg-red-500/10 transition-colors"
              >
                Kill
              </button>
            </>
          ) : (
            <button
              onClick={handleUndo}
              className="flex-1 py-2 text-[11px] font-star-wars rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {reEditOpen && (
        <ReEditPanel
          onSend={handleSendReEdit}
          onCancel={() => setReEditOpen(false)}
          loading={reEditLoading}
        />
      )}

      {/* Piece dots nav */}
      <div className="flex items-center justify-center gap-1.5">
        {pieces.map((_, i) => {
          const s = reviewStates[i]?.status ?? 'pending';
          return (
            <button
              key={i}
              onClick={() => { setCurrentIdx(i); setActiveVariation(0); }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIdx ? 'scale-125' : ''
              } ${
                s === 'approved' ? 'bg-yellow-500' :
                s === 'killed'   ? 'bg-red-500/50' :
                s === 'revision' ? 'bg-blue-500/60' :
                'bg-gray-700'
              }`}
            />
          );
        })}
      </div>

      {/* Complete bar */}
      {allReviewed && (
        <div className="border-t border-yellow-500/10 pt-3 flex items-center justify-between">
          <p className="text-[10px] text-gray-500 font-star-wars">
            {approvedCount} piece{approvedCount !== 1 ? 's' : ''} approved · sending to calendar
          </p>
          <button
            onClick={handleComplete}
            className="text-[11px] font-star-wars px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 transition-colors shadow-[0_0_16px_rgba(234,179,8,0.25)]"
          >
            Schedule these →
          </button>
        </div>
      )}
    </div>
  );
}
