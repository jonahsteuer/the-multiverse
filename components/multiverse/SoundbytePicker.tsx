'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SoundbyteDef {
  id: string;
  label: string;     // e.g. "Chorus", "Verse 1"
  startSec: number;
  endSec: number;
}

interface LyricsSegment {
  start: number;
  end: number;
  text: string;
}

interface SoundbytePickerProps {
  trackUrl: string;
  lyricsSegments?: LyricsSegment[];
  initialSoundbytes?: SoundbyteDef[];
  onConfirm: (soundbytes: SoundbyteDef[]) => void;
  onCancel?: () => void;
  /** When true (standalone editor), shows Cancel button instead of brainstorm context */
  standalone?: boolean;
}

// ─── Region colour palette ──────────────────────────────────────────────────

const REGION_COLORS = [
  'rgba(139, 92, 246, 0.35)',   // purple
  'rgba(59, 130, 246, 0.35)',   // blue
  'rgba(16, 185, 129, 0.35)',   // green
  'rgba(245, 158, 11, 0.35)',   // amber
  'rgba(239, 68, 68, 0.35)',    // red
];

const REGION_BORDER_COLORS = [
  'rgba(139, 92, 246, 0.9)',
  'rgba(59, 130, 246, 0.9)',
  'rgba(16, 185, 129, 0.9)',
  'rgba(245, 158, 11, 0.9)',
  'rgba(239, 68, 68, 0.9)',
];

// ─── Transcript-based soundbyte detection ──────────────────────────────────

function detectSoundbytesFromTranscript(
  segments: LyricsSegment[],
  count = 5
): SoundbyteDef[] {
  const totalDur = segments.length > 0
    ? segments[segments.length - 1].end
    : 180;

  if (segments.length === 0) {
    return buildTimeBased(totalDur, count);
  }

  // Find repeated lyric fragments → likely chorus
  const phraseMap = new Map<string, number[]>();
  for (const seg of segments) {
    const phrase = seg.text.trim().toLowerCase().slice(0, 40);
    if (phrase.length < 5) continue;
    if (!phraseMap.has(phrase)) phraseMap.set(phrase, []);
    phraseMap.get(phrase)!.push(seg.start);
  }
  // Phrases that appear 2+ times are chorus candidates
  const chorusPhrases = [...phraseMap.entries()]
    .filter(([, times]) => times.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  // First chorus occurrence (typically 30–55% into the song)
  let chorusStart = totalDur * 0.35;
  let chorusEnd = totalDur * 0.55;
  if (chorusPhrases.length > 0) {
    const firstChorusTime = chorusPhrases[0][1][0];
    const chorusSeg = segments.find(s => s.start === firstChorusTime);
    if (chorusSeg) {
      chorusStart = chorusSeg.start;
      // Find where chorus block ends (large gap after the repeated lines)
      const related = segments.filter(s =>
        chorusPhrases.slice(0, 3).some(([p]) => s.text.toLowerCase().startsWith(p.slice(0, 20)))
      );
      if (related.length > 0) {
        chorusEnd = Math.min(related[related.length - 1].end + 2, totalDur);
      }
    }
  }

  const pct = (p: number) => Math.round(totalDur * p * 10) / 10;
  const lyricAt = (t: number) => {
    const seg = segments.find(s => s.start <= t && s.end >= t);
    return seg?.text?.trim().slice(0, 50) || '';
  };

  // Build 5 regions that reference actual lyric times
  const all: SoundbyteDef[] = [
    {
      id: 'sb1',
      label: 'Chorus',
      startSec: chorusStart,
      endSec: chorusEnd,
    },
    {
      id: 'sb2',
      label: 'Verse 1',
      startSec: pct(0.08),
      endSec: chorusStart,
    },
    {
      id: 'sb3',
      label: 'Intro',
      startSec: 0,
      endSec: pct(0.12),
    },
    {
      id: 'sb4',
      label: 'Bridge',
      startSec: pct(0.62),
      endSec: pct(0.82),
    },
    {
      id: 'sb5',
      label: 'Outro',
      startSec: pct(0.83),
      endSec: totalDur,
    },
  ];

  void lyricAt; // used for rationale but omitted from the lean interface

  // Clamp all times to valid range and ensure min 5s duration
  return all.slice(0, count).map(sb => ({
    ...sb,
    startSec: Math.max(0, Math.round(sb.startSec * 10) / 10),
    endSec: Math.min(totalDur, Math.round(sb.endSec * 10) / 10),
  })).map(sb => ({
    ...sb,
    endSec: sb.endSec <= sb.startSec + 5 ? Math.min(sb.startSec + 20, totalDur) : sb.endSec,
  }));
}

function buildTimeBased(totalDur: number, count: number): SoundbyteDef[] {
  const labels = ['Intro', 'Verse 1', 'Chorus', 'Verse 2 / Bridge', 'Outro'];
  const boundaries = [0, 0.10, 0.35, 0.58, 0.80, 1.0];
  return Array.from({ length: count }, (_, i) => ({
    id: `sb${i + 1}`,
    label: labels[i] ?? `Section ${i + 1}`,
    startSec: Math.round(totalDur * boundaries[i] * 10) / 10,
    endSec: Math.round(totalDur * boundaries[i + 1] * 10) / 10,
  }));
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SoundbytePicker({
  trackUrl,
  lyricsSegments = [],
  initialSoundbytes,
  onConfirm,
  onCancel,
  standalone = false,
}: SoundbytePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import('wavesurfer.js').default | null>(null);
  const regionsRef = useRef<import('wavesurfer.js/dist/plugins/regions.esm.js').default | null>(null);
  // Tracks the active rAF ID for the region-preview stop loop.
  // Must be cancelled before starting a new preview or full playback.
  const stopAtRafRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingRegionId, setPlayingRegionId] = useState<string | null>(null);

  const [soundbytes, setSoundbytes] = useState<SoundbyteDef[]>(() =>
    initialSoundbytes ?? []
  );
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  // Sync soundbytes ref for WaveSurfer event callbacks
  const soundbytesRef = useRef(soundbytes);
  useEffect(() => { soundbytesRef.current = soundbytes; }, [soundbytes]);

  // ── Initialise WaveSurfer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !trackUrl) return;

    let destroyed = false;

    (async () => {
      try {
        const WaveSurfer = (await import('wavesurfer.js')).default;
        const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.esm.js')).default;

        if (destroyed) return;

        const regions = RegionsPlugin.create();
        regionsRef.current = regions;

        const ws = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: '#4B5563',
          progressColor: '#7C3AED',
          cursorColor: '#A78BFA',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          url: trackUrl,
          plugins: [regions],
        });
        wsRef.current = ws;

        ws.on('ready', () => {
          if (destroyed) return;
          const dur = ws.getDuration();
          setDuration(dur);
          setIsReady(true);
          setIsLoading(false);

          // Build initial soundbytes now that we know duration
          const initial = initialSoundbytes ??
            detectSoundbytesFromTranscript(lyricsSegments, 5);
          setSoundbytes(initial);
          soundbytesRef.current = initial;

          // Paint regions
          initial.forEach((sb, i) => {
            regions.addRegion({
              id: sb.id,
              start: sb.startSec,
              end: sb.endSec,
              content: sb.label,
              color: REGION_COLORS[i % REGION_COLORS.length],
              drag: true,
              resize: true,
            });
          });
        });

        ws.on('error', (e) => {
          if (!destroyed) setLoadError(String(e));
        });

        ws.on('play', () => { if (!destroyed) setIsPlaying(true); });
        ws.on('pause', () => { if (!destroyed) { setIsPlaying(false); setPlayingRegionId(null); } });
        ws.on('finish', () => { if (!destroyed) { setIsPlaying(false); setPlayingRegionId(null); } });

        // Sync region drags back to soundbytes state
        regions.on('region-updated', (region: { id: string; start: number; end: number }) => {
          if (destroyed) return;
          setSoundbytes(prev =>
            prev.map(sb =>
              sb.id === region.id
                ? { ...sb, startSec: Math.round(region.start * 10) / 10, endSec: Math.round(region.end * 10) / 10 }
                : sb
            )
          );
        });

      } catch (err) {
        if (!destroyed) setLoadError('Failed to load audio.');
        console.error('[SoundbytePicker] WaveSurfer init error:', err);
      }
    })();

    return () => {
      destroyed = true;
      if (stopAtRafRef.current !== null) {
        cancelAnimationFrame(stopAtRafRef.current);
        stopAtRafRef.current = null;
      }
      wsRef.current?.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackUrl]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Cancel any in-progress region-preview stop loop before starting a new one.
  const cancelStopLoop = useCallback(() => {
    if (stopAtRafRef.current !== null) {
      cancelAnimationFrame(stopAtRafRef.current);
      stopAtRafRef.current = null;
    }
  }, []);

  const seekAndPlay = useCallback((startSec: number, endSec: number, sbId: string) => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    cancelStopLoop(); // kill any previous region preview loop first
    setPlayingRegionId(sbId);
    ws.setTime(startSec);
    ws.play();
    // Poll until playhead reaches endSec, then stop
    const stopAt = () => {
      if (ws.getCurrentTime() >= endSec) {
        ws.pause();
        setPlayingRegionId(null);
        stopAtRafRef.current = null;
      } else {
        stopAtRafRef.current = requestAnimationFrame(stopAt);
      }
    };
    stopAtRafRef.current = requestAnimationFrame(stopAt);
  }, [isReady, cancelStopLoop]);

  const updateRegionOnWave = useCallback((sb: SoundbyteDef, i: number) => {
    const regions = regionsRef.current;
    if (!regions) return;
    // Remove old and re-add updated
    const existing = regions.getRegions().find((r: { id: string }) => r.id === sb.id);
    if (existing) existing.remove();
    regions.addRegion({
      id: sb.id,
      start: sb.startSec,
      end: sb.endSec,
      content: sb.label,
      color: REGION_COLORS[i % REGION_COLORS.length],
      drag: true,
      resize: true,
    });
  }, []);

  const addSoundbyte = useCallback(() => {
    if (soundbytes.length >= 5 || !duration) return;
    // Place new region at a gap not occupied by existing regions
    const newId = `sb${Date.now()}`;
    const existing = [...soundbytes].sort((a, b) => a.startSec - b.startSec);
    // Find largest gap
    let bestStart = 0;
    let bestGap = 0;
    const points = [0, ...existing.flatMap(s => [s.startSec, s.endSec]), duration];
    for (let i = 0; i < points.length - 1; i += 2) {
      const gapStart = points[i];
      const gapEnd = points[i + 1];
      if (gapEnd - gapStart > bestGap) {
        bestGap = gapEnd - gapStart;
        bestStart = gapStart;
      }
    }
    const newSb: SoundbyteDef = {
      id: newId,
      label: `Section ${soundbytes.length + 1}`,
      startSec: Math.round(bestStart * 10) / 10,
      endSec: Math.round(Math.min(bestStart + Math.max(bestGap * 0.6, 15), duration) * 10) / 10,
    };
    const updated = [...soundbytes, newSb];
    setSoundbytes(updated);
    updateRegionOnWave(newSb, updated.length - 1);
  }, [soundbytes, duration, updateRegionOnWave]);

  const removeSoundbyte = useCallback((id: string) => {
    if (soundbytes.length <= 3) return;
    const regions = regionsRef.current;
    const existing = regions?.getRegions().find((r: { id: string }) => r.id === id);
    if (existing) existing.remove();
    setSoundbytes(prev => prev.filter(sb => sb.id !== id));
  }, [soundbytes.length]);

  const saveLabelEdit = useCallback((id: string) => {
    const trimmed = labelDraft.trim();
    if (!trimmed) { setEditingLabelId(null); return; }
    setSoundbytes(prev => {
      const updated = prev.map(sb => sb.id === id ? { ...sb, label: trimmed } : sb);
      // Update region label on waveform
      const idx = updated.findIndex(sb => sb.id === id);
      if (idx >= 0) updateRegionOnWave(updated[idx], idx);
      return updated;
    });
    setEditingLabelId(null);
  }, [labelDraft, updateRegionOnWave]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Waveform container */}
      <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900/80">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-6 bg-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900/80">
            <p className="text-red-400 text-sm">{loadError}</p>
          </div>
        )}
        <div ref={containerRef} className="px-3 pt-3 pb-1" />
        {/* Playback controls */}
        <div className="flex items-center gap-3 px-3 pb-2.5 pt-0.5">
          <button
            onClick={() => { cancelStopLoop(); wsRef.current?.playPause(); }}
            disabled={!isReady}
            className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center text-white text-xs transition-colors flex-shrink-0"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="text-[11px] text-gray-500">
            {isReady ? `${fmtTime(duration)} total` : 'Loading…'}
          </span>
          <span className="text-[11px] text-gray-600 ml-auto">drag region edges to resize</span>
        </div>
      </div>

      {/* Soundbyte cards */}
      <div className="space-y-2">
        {soundbytes.map((sb, i) => {
          const isEditingThis = editingLabelId === sb.id;
          const isPlayingThis = playingRegionId === sb.id;
          const borderColor = REGION_BORDER_COLORS[i % REGION_BORDER_COLORS.length];
          return (
            <div
              key={sb.id}
              className="rounded-xl bg-gray-800/70 border border-gray-700 p-3 transition-all"
              style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
            >
              <div className="flex items-center gap-2">
                {/* Colour swatch */}
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: borderColor }} />

                {/* Label — editable */}
                {isEditingThis ? (
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={e => setLabelDraft(e.target.value)}
                    onBlur={() => saveLabelEdit(sb.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveLabelEdit(sb.id);
                      if (e.key === 'Escape') setEditingLabelId(null);
                    }}
                    className="flex-1 bg-gray-700 border border-purple-500 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { setEditingLabelId(sb.id); setLabelDraft(sb.label); }}
                    className="flex-1 text-left text-sm font-semibold text-white hover:text-purple-300 transition-colors"
                    title="Click to rename"
                  >
                    {sb.label}
                    <span className="ml-1 text-gray-600 text-[10px] font-normal">✎</span>
                  </button>
                )}

                {/* Time range */}
                <span className="text-[11px] text-gray-400 bg-gray-700/60 px-1.5 py-0.5 rounded flex-shrink-0">
                  {fmtTime(sb.startSec)}–{fmtTime(sb.endSec)}
                </span>
                <span className="text-[11px] text-purple-400 flex-shrink-0">
                  ~{Math.round(sb.endSec - sb.startSec)}s
                </span>

                {/* Play preview */}
                <button
                  onClick={() => {
                    if (isPlayingThis) { wsRef.current?.pause(); setPlayingRegionId(null); }
                    else seekAndPlay(sb.startSec, sb.endSec, sb.id);
                  }}
                  disabled={!isReady}
                  className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-purple-500/30 disabled:opacity-40 flex items-center justify-center text-gray-300 text-xs transition-colors flex-shrink-0"
                  title={isPlayingThis ? 'Stop' : 'Preview'}
                >
                  {isPlayingThis ? '⏹' : '▶'}
                </button>

                {/* Remove — only when count > 3 */}
                <button
                  onClick={() => removeSoundbyte(sb.id)}
                  disabled={soundbytes.length <= 3}
                  className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-500/30 disabled:opacity-20 flex items-center justify-center text-gray-500 hover:text-red-400 text-xs transition-colors flex-shrink-0"
                  title="Remove soundbyte"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add soundbyte */}
      {soundbytes.length < 5 && isReady && (
        <button
          onClick={addSoundbyte}
          className="w-full py-2 rounded-xl border border-dashed border-gray-600 hover:border-purple-500/50 text-gray-500 hover:text-purple-400 text-sm transition-colors"
        >
          + Add soundbyte ({soundbytes.length}/5)
        </button>
      )}

      {/* Count note */}
      <p className="text-[11px] text-gray-600 text-center">
        {soundbytes.length} soundbyte{soundbytes.length !== 1 ? 's' : ''} — each becomes one editing day · min 3, max 5
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {(onCancel || standalone) && (
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
          >
            {standalone ? 'Cancel' : 'Back'}
          </button>
        )}
        <button
          onClick={() => onConfirm(soundbytes)}
          disabled={soundbytes.length < 3}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          Confirm {soundbytes.length} Soundbyte{soundbytes.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}
