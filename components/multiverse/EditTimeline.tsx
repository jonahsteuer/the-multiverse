'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { EditClip } from '../remotion/EditPreviewComposition';

// ─── Constants ────────────────────────────────────────────────────────────────

const RULER_H = 18;
const VIDEO_TRACK_H = 44;
const AUDIO_TRACK_H = 28;
const TRIM_HANDLE_W = 8;
const MIN_CLIP_SEC = 0.3;
const TICK_INTERVAL_SECS = [1, 2, 5, 10, 15, 30]; // pick best for zoom level

// ─── Types ────────────────────────────────────────────────────────────────────

type DragState =
  | { kind: 'reorder'; clipId: string; startX: number; currentX: number; origIndex: number }
  | { kind: 'trim-left'; clipId: string; startX: number; origStartFrom: number; origDuration: number }
  | { kind: 'trim-right'; clipId: string; startX: number; origDuration: number }
  | { kind: 'audio'; startX: number; origAudioStart: number };

export interface EditTimelineProps {
  timeline: EditClip[];
  audioStartSec: number;
  totalDurationSec: number;   // length of the full audio file (for audio block width)
  currentTimeSec?: number;    // playhead position
  onTimelineChange: (newTimeline: EditClip[], newAudioStartSec: number) => void;
  onScrub?: (timeSec: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function pickTickInterval(pps: number): number {
  // We want ticks ~60–120px apart
  for (const t of TICK_INTERVAL_SECS) {
    if (t * pps >= 50) return t;
  }
  return 60;
}

// ─── EditTimeline ─────────────────────────────────────────────────────────────

export function EditTimeline({
  timeline,
  audioStartSec,
  totalDurationSec,
  currentTimeSec,
  onTimelineChange,
  onScrub,
}: EditTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverTrim, setHoverTrim] = useState<string | null>(null); // clipId + side

  // Keep containerWidth in sync
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const editDuration = useMemo(
    () => Math.max(0.1, timeline.reduce((s, c) => s + c.duration, 0)),
    [timeline],
  );

  // pixels-per-second — fit all clips in the container
  const pps = useMemo(() => containerWidth / editDuration, [containerWidth, editDuration]);

  // Cumulative x-offsets for each clip
  const clipOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const c of timeline) { offs.push(acc); acc += c.duration; }
    return offs;
  }, [timeline]);

  const tickInterval = useMemo(() => pickTickInterval(pps), [pps]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const startReorder = useCallback((clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const idx = timeline.findIndex(c => c.id === clipId);
    setDrag({ kind: 'reorder', clipId, startX: e.clientX, currentX: e.clientX, origIndex: idx });
  }, [timeline]);

  const startTrimLeft = useCallback((clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = timeline.find(c => c.id === clipId);
    if (!clip) return;
    setDrag({ kind: 'trim-left', clipId, startX: e.clientX, origStartFrom: clip.startFrom, origDuration: clip.duration });
  }, [timeline]);

  const startTrimRight = useCallback((clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = timeline.find(c => c.id === clipId);
    if (!clip) return;
    setDrag({ kind: 'trim-right', clipId, startX: e.clientX, origDuration: clip.duration });
  }, [timeline]);

  const startAudioDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ kind: 'audio', startX: e.clientX, origAudioStart: audioStartSec });
  }, [audioStartSec]);

  const handleScrub = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onScrub?.(Math.max(0, Math.min(editDuration, x / pps)));
  }, [pps, editDuration, onScrub]);

  // Global mouse move + up
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - drag.startX;
      const deltaSec = deltaPx / pps;

      if (drag.kind === 'reorder') {
        setDrag(d => d && d.kind === 'reorder' ? { ...d, currentX: e.clientX } : d);
        return;
      }

      if (drag.kind === 'trim-left') {
        const newStartFrom = Math.max(0, drag.origStartFrom + deltaSec);
        const newDuration = Math.max(MIN_CLIP_SEC, drag.origDuration - deltaSec);
        onTimelineChange(
          timeline.map(c => c.id === drag.clipId ? { ...c, startFrom: newStartFrom, duration: newDuration } : c),
          audioStartSec,
        );
        return;
      }

      if (drag.kind === 'trim-right') {
        const newDuration = Math.max(MIN_CLIP_SEC, drag.origDuration + deltaSec);
        onTimelineChange(
          timeline.map(c => c.id === drag.clipId ? { ...c, duration: newDuration } : c),
          audioStartSec,
        );
        return;
      }

      if (drag.kind === 'audio') {
        const newStart = Math.max(0, drag.origAudioStart + deltaSec);
        onTimelineChange(timeline, newStart);
      }
    };

    const onUp = (e: MouseEvent) => {
      if (drag.kind === 'reorder') {
        // Determine new position from final mouse X
        const deltaPx = e.clientX - drag.startX;
        const deltaSec = deltaPx / pps;
        const draggedIdx = timeline.findIndex(c => c.id === drag.clipId);
        if (draggedIdx < 0) { setDrag(null); return; }

        // Find target index: where does the dragged clip's center land?
        const draggedCenterSec = (clipOffsets[draggedIdx] ?? 0) + timeline[draggedIdx].duration / 2 + deltaSec;
        let targetIdx = 0;
        for (let i = 0; i < timeline.length; i++) {
          const centerSec = (clipOffsets[i] ?? 0) + timeline[i].duration / 2;
          if (draggedCenterSec > centerSec) targetIdx = i + 1;
        }
        targetIdx = Math.max(0, Math.min(timeline.length - 1, targetIdx > draggedIdx ? targetIdx - 1 : targetIdx));

        if (targetIdx !== draggedIdx) {
          const newTimeline = [...timeline];
          const [item] = newTimeline.splice(draggedIdx, 1);
          newTimeline.splice(targetIdx, 0, item);
          onTimelineChange(newTimeline, audioStartSec);
        }
      }
      setDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, pps, timeline, audioStartSec, clipOffsets, onTimelineChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isDraggingReorder = drag?.kind === 'reorder';
  const dragOffsetSec = isDraggingReorder ? (drag.currentX - drag.startX) / pps : 0;

  // Tick marks for the ruler
  const ticks = useMemo(() => {
    const result: number[] = [];
    for (let t = 0; t <= editDuration + tickInterval; t += tickInterval) {
      if (t <= editDuration + 0.01) result.push(Math.round(t * 100) / 100);
    }
    return result;
  }, [editDuration, tickInterval]);

  const totalH = RULER_H + VIDEO_TRACK_H + 4 + AUDIO_TRACK_H;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[9px] text-yellow-500/60 font-star-wars uppercase tracking-wider">Edit Timeline</span>
        <span className="text-[9px] text-gray-600 font-mono">{fmt(editDuration)} total</span>
      </div>

      <div
        ref={containerRef}
        className="relative bg-black/60 border border-yellow-500/15 rounded-lg overflow-hidden"
        style={{ height: totalH, cursor: drag?.kind === 'audio' ? 'grabbing' : 'default' }}
      >
        {/* ── Time ruler ─────────────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 bg-black/80 cursor-crosshair"
          style={{ height: RULER_H }}
          onClick={handleScrub}
        >
          {ticks.map(t => (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: t * pps, transform: 'translateX(-50%)' }}
            >
              <div className="w-px bg-yellow-500/30" style={{ height: t % (tickInterval * 5) === 0 ? 8 : 5 }} />
              {(t % (tickInterval * 2) === 0 || t === 0) && (
                <span className="text-[7px] text-yellow-500/50 font-mono mt-0.5 whitespace-nowrap">{fmt(t)}</span>
              )}
            </div>
          ))}
          {/* Playhead on ruler */}
          {currentTimeSec !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-px bg-yellow-400 pointer-events-none"
              style={{ left: currentTimeSec * pps }}
            />
          )}
        </div>

        {/* ── Video track ────────────────────────────────────── */}
        <div
          className="absolute left-0 right-0"
          style={{ top: RULER_H, height: VIDEO_TRACK_H }}
        >
          {/* Track background */}
          <div className="absolute inset-0 bg-gray-900/40" />

          {timeline.map((clip, i) => {
            const offsetSec = clipOffsets[i] ?? 0;
            let visualLeft = offsetSec * pps;
            const widthPx = Math.max(8, clip.duration * pps);
            const isDragging = isDraggingReorder && drag?.clipId === clip.id;

            if (isDragging) visualLeft += (drag.currentX - drag.startX);

            // Hue cycle for clips
            const hues = ['#eab308', '#a855f7', '#3b82f6', '#10b981', '#f97316', '#ec4899'];
            const color = hues[i % hues.length];

            return (
              <div
                key={clip.id}
                className="absolute top-1 bottom-1 rounded overflow-hidden"
                style={{
                  left: visualLeft,
                  width: widthPx,
                  zIndex: isDragging ? 20 : 10,
                  opacity: isDragging ? 0.85 : 1,
                  cursor: isDraggingReorder && drag?.clipId === clip.id ? 'grabbing' : 'grab',
                  border: `1px solid ${color}55`,
                  background: `${color}22`,
                  boxShadow: isDragging ? `0 0 0 1px ${color}88` : undefined,
                  transition: isDragging ? 'none' : 'left 0.1s ease',
                }}
              >
                {/* Trim left handle */}
                <div
                  className="absolute left-0 top-0 bottom-0 z-20 flex items-center justify-center hover:bg-white/20 active:bg-white/30"
                  style={{ width: TRIM_HANDLE_W, cursor: 'ew-resize' }}
                  onMouseDown={e => startTrimLeft(clip.id, e)}
                  onMouseEnter={() => setHoverTrim(`${clip.id}-left`)}
                  onMouseLeave={() => setHoverTrim(null)}
                >
                  <div className="w-px h-4 bg-white/40 rounded-full" />
                </div>

                {/* Clip body — grab to reorder */}
                <div
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{ left: TRIM_HANDLE_W, right: TRIM_HANDLE_W }}
                  onMouseDown={e => startReorder(clip.id, e)}
                >
                  <span className="text-[8px] font-star-wars truncate px-1" style={{ color }}>
                    {clip.label ?? `#${i}`}
                  </span>
                  <span className="text-[7px] text-white/30 font-mono absolute bottom-1 right-1">
                    {fmt(clip.duration)}
                  </span>
                </div>

                {/* Trim right handle */}
                <div
                  className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-center hover:bg-white/20 active:bg-white/30"
                  style={{ width: TRIM_HANDLE_W, cursor: 'ew-resize' }}
                  onMouseDown={e => startTrimRight(clip.id, e)}
                  onMouseEnter={() => setHoverTrim(`${clip.id}-right`)}
                  onMouseLeave={() => setHoverTrim(null)}
                >
                  <div className="w-px h-4 bg-white/40 rounded-full" />
                </div>
              </div>
            );
          })}

          {/* Playhead vertical line over video track */}
          {currentTimeSec !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-px bg-yellow-400/70 pointer-events-none"
              style={{ left: currentTimeSec * pps, zIndex: 30 }}
            />
          )}
        </div>

        {/* ── Audio track ─────────────────────────────────────── */}
        <div
          className="absolute left-0 right-0"
          style={{ top: RULER_H + VIDEO_TRACK_H + 4, height: AUDIO_TRACK_H }}
        >
          <div className="absolute inset-0 bg-gray-900/30 border-t border-yellow-500/10" />

          {/* Audio block */}
          <div
            className="absolute top-1 bottom-1 rounded flex items-center px-2 overflow-hidden"
            style={{
              left: Math.max(0, audioStartSec * pps),
              right: 0,
              background: '#10b98122',
              border: '1px solid #10b98155',
              cursor: drag?.kind === 'audio' ? 'grabbing' : 'grab',
              minWidth: 24,
            }}
            onMouseDown={startAudioDrag}
          >
            <span className="text-[8px] text-green-400 font-star-wars select-none">♪ Audio · {fmt(audioStartSec)} offset</span>
          </div>

          {/* Playhead vertical line over audio track */}
          {currentTimeSec !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-px bg-yellow-400/70 pointer-events-none"
              style={{ left: currentTimeSec * pps, zIndex: 30 }}
            />
          )}
        </div>

        {/* Hover tooltip for trim handles */}
        {hoverTrim && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] text-yellow-400 font-star-wars px-2 py-0.5 rounded pointer-events-none z-50">
            drag to trim
          </div>
        )}
      </div>
    </div>
  );
}
