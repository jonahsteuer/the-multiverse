'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { EditPreviewComposition, EditClip, getTotalFrames, getCompositionSize, AspectRatio } from '../remotion/EditPreviewComposition';
import { Card } from '../ui/card';
import { supabase } from '@/lib/supabase';
import type { World } from '@/types';
import type { ClipInfo, ClipFrames, SoundbyteSummary, EditPiece } from '@/app/api/mark-edit/route';
import { extractFrames, VideoFrame } from '@/lib/extract-video-frames';
import { detectMouthOpennessInVideo, findLipSyncOffset } from '@/lib/detect-mouth-openness';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkMessage { role: 'user' | 'assistant'; content: string; }

interface LibraryEntry {
  clip: EditClip;
  file: File;
  info: ClipInfo;
  frames: VideoFrame[];
  analyzing: boolean;
  lipSyncData?: Array<{ timeSec: number; openness: number }>;
}

interface PieceState { piece: EditPiece; timeline: EditClip[]; }

interface SavedSession {
  messages: MarkMessage[];
  pieces: EditPiece[];        // edit plan without timelines (re-applied when footage uploaded)
  clipInfos: ClipInfo[];      // names + durations so we can show what was loaded
  savedAt: string;
}

// ─── Session persistence ──────────────────────────────────────────────────────

function sessionKey(worldId: string) { return `smart-edit-${worldId}`; }

function loadSession(worldId: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(worldId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(worldId: string, session: SavedSession) {
  try { localStorage.setItem(sessionKey(worldId), JSON.stringify(session)); }
  catch { /* quota exceeded — silent */ }
}

function clearSession(worldId: string) {
  try { localStorage.removeItem(sessionKey(worldId)); } catch { /* */ }
}

interface SmartEditTabProps {
  world: World;
  teamId: string;
  currentUserId: string;
  currentUserName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSec(secs: number) {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTimeRange(range: string): [number, number] {
  const parts = range.split('–');
  const parse = (t: string) => {
    const [m, s] = t.trim().split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  };
  return [parse(parts[0] || '0:00'), parse(parts[1] || '0:30')];
}

function pieceToTimeline(piece: EditPiece, library: LibraryEntry[]): EditClip[] {
  return piece.clips
    .map((pc, i) => {
      const entry = library[pc.clipIndex];
      if (!entry) return null;
      return {
        id: `${entry.clip.id}-p${i}`,
        url: entry.clip.url,
        startFrom: Math.max(0, pc.startFrom),
        duration: Math.min(pc.duration, entry.info.duration),
        label: pc.label,
      } as EditClip;
    })
    .filter((c): c is EditClip => c !== null);
}

// ─── MediaRecorder download ───────────────────────────────────────────────────

async function recordPlayerToBlob(
  playerRef: React.RefObject<PlayerRef | null>,
  durationSec: number,
  onProgress: (pct: number) => void,
): Promise<Blob | null> {
  const playerEl = document.querySelector('.remotion-player video') as HTMLVideoElement | null;
  if (!playerEl) return null;

  const stream = (playerEl as any).captureStream?.() || (playerEl as any).mozCaptureStream?.();
  if (!stream) return null;

  return new Promise(resolve => {
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    rec.start(100);
    playerRef.current?.play();
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(1, (Date.now() - start) / (durationSec * 1000));
      onProgress(pct);
      if (pct >= 1) { clearInterval(tick); rec.stop(); }
    }, 200);
  });
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

function FileDropZone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const accept = (files: File[]) => {
    const vids = files.filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm|avi|mkv)$/i));
    if (vids.length) onFiles(vids);
  };
  if (compact) return (
    <button onClick={() => ref.current?.click()}
      className="w-full text-xs border border-dashed border-yellow-500/30 hover:border-yellow-500/60 rounded-lg py-2 text-gray-500 hover:text-yellow-400 transition-colors font-star-wars">
      + Add more clips
      <input ref={ref} type="file" accept="video/*" multiple className="hidden"
        onChange={e => { accept(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </button>
  );
  return (
    <div onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); accept(Array.from(e.dataTransfer.files)); }}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-yellow-400 bg-yellow-400/10' : 'border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5'}`}>
      <div className="text-5xl mb-3">🎬</div>
      <p className="text-yellow-400 font-star-wars text-sm">Drop your footage here</p>
      <p className="text-gray-600 text-xs mt-1">MP4 · MOV · WebM · AVI</p>
      <input ref={ref} type="file" accept="video/*" multiple className="hidden"
        onChange={e => { accept(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}

// ─── Clip thumbnail ───────────────────────────────────────────────────────────

function ClipThumb({ entry, index, onRemove, onLipSync, lipSyncing }:
  { entry: LibraryEntry; index: number; onRemove: () => void; onLipSync: () => void; lipSyncing: boolean }) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-yellow-500/20 bg-black">
      <video src={entry.clip.url} className="w-full aspect-video object-cover opacity-70" preload="metadata" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      {entry.analyzing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-[9px] text-yellow-400 font-star-wars animate-pulse">reading...</span>
        </div>
      )}
      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between">
        <div>
          <span className="text-yellow-400/80 text-[9px] font-star-wars block truncate max-w-[80px]">
            {entry.file.name.replace(/\.[^.]+$/, '')}
          </span>
          <span className="text-gray-500 text-[9px] font-mono">{fmtSec(entry.info.duration)}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {!entry.analyzing && entry.frames.length > 0 && <span title="Mark has seen this clip" className="text-[9px]">👁</span>}
          {entry.lipSyncData && <span title="Lip sync data ready" className="text-[9px]">👄</span>}
          <span className="text-[10px] bg-black/60 text-yellow-400 font-star-wars px-1 py-0.5 rounded">#{index}</span>
        </div>
      </div>
      <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
        {!entry.lipSyncData && !lipSyncing && (
          <button onClick={onLipSync} title="Detect lip sync"
            className="w-5 h-5 flex items-center justify-center bg-black/70 text-purple-400 rounded text-[9px] hover:bg-purple-500/20">👄</button>
        )}
        <button onClick={onRemove}
          className="w-5 h-5 flex items-center justify-center bg-black/70 text-red-400 rounded text-[10px] hover:bg-red-500/20">✕</button>
      </div>
      {lipSyncing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span className="text-[9px] text-purple-400 font-star-wars animate-pulse">lip sync...</span>
        </div>
      )}
    </div>
  );
}

// ─── Piece preview ────────────────────────────────────────────────────────────

function PiecePreview({ piece, timeline, audioUrl, playerRef }:
  { piece: EditPiece; timeline: EditClip[]; audioUrl: string | null; playerRef: React.RefObject<PlayerRef | null> }) {
  const totalFrames = getTotalFrames(timeline, FPS);
  const { width, height } = getCompositionSize(piece.aspectRatio ?? '9:16');
  const totalSecs = timeline.reduce((s, c) => s + c.duration, 0);
  return (
    <div className="rounded-lg overflow-hidden border border-yellow-500/20 bg-black">
      <div className="px-3 py-1.5 border-b border-yellow-500/10 flex items-center gap-2">
        <span className="text-xs font-star-wars text-yellow-400 truncate flex-1">{piece.name}</span>
        <span className="text-[9px] text-gray-600 font-mono">{piece.aspectRatio ?? '9:16'}</span>
        <span className="text-[9px] text-gray-500 font-mono">{fmtSec(totalSecs)}</span>
      </div>
      {timeline.length > 0 ? (
        <Player
          ref={playerRef}
          component={EditPreviewComposition}
          inputProps={{
            clips: timeline,
            audioUrl: audioUrl ?? undefined,
            audioStartSec: piece.audioStartSec,
            audioDurationSec: piece.audioDurationSec,
          }}
          durationInFrames={totalFrames}
          fps={FPS}
          compositionWidth={width}
          compositionHeight={height}
          style={{ width: '100%' }}
          controls
          loop
          className="remotion-player"
        />
      ) : (
        <div className="aspect-[9/16] flex items-center justify-center">
          <span className="text-gray-700 text-xs font-star-wars">No clips</span>
        </div>
      )}
      {piece.captionSuggestion && (
        <div className="px-3 py-2 border-t border-yellow-500/10">
          <p className="text-[9px] text-gray-500 font-star-wars mb-0.5">CAPTION SUGGESTION</p>
          <p className="text-xs text-gray-300 whitespace-pre-line">{piece.captionSuggestion}</p>
        </div>
      )}
      {piece.hookNotes && (
        <div className="px-3 py-1.5 border-t border-yellow-500/10">
          <p className="text-[9px] text-gray-500 font-star-wars mb-0.5">HOOK</p>
          <p className="text-xs text-gray-400">{piece.hookNotes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Mark chat ────────────────────────────────────────────────────────────────

function MarkChat({ messages, onSend, loading, disabled }:
  { messages: MarkMessage[]; onSend: (t: string) => void; loading: boolean; disabled?: boolean }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  const send = () => { const t = input.trim(); if (!t || loading || disabled) return; onSend(t); setInput(''); };
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-yellow-500/20 text-yellow-100 font-star-wars' : 'bg-gray-800/80 text-gray-200'}`}>
              {msg.role === 'assistant' && <span className="text-yellow-400 font-star-wars text-[10px] block mb-1">MARK</span>}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/80 rounded-lg px-3 py-2">
              <span className="text-yellow-400 font-star-wars text-[10px] block mb-1">MARK</span>
              <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={disabled ? 'Upload footage to start...' : 'Tell Mark what you want...'}
          disabled={disabled || loading}
          className="flex-1 bg-black/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/60 font-star-wars disabled:opacity-40" />
        <button onClick={send} disabled={!input.trim() || loading || disabled}
          className="bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 text-yellow-400 rounded-lg px-3 py-2 text-xs font-star-wars transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SmartEditTab({ world, currentUserId, currentUserName }: SmartEditTabProps) {
  // ── Session restore ────────────────────────────────────────────────────────
  const savedSession = loadSession(world.id);

  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [messages, setMessages] = useState<MarkMessage[]>(savedSession?.messages ?? []);
  const [markLoading, setMarkLoading] = useState(false);
  const [pieces, setPieces] = useState<PieceState[]>([]);
  const [activePieceIdx, setActivePieceIdx] = useState(0);
  const [soundbytes, setSoundbytes] = useState<SoundbyteSummary[]>([]);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  // Saved pieces (plan only, no timeline) awaiting footage re-upload
  const [pendingPieces, setPendingPieces] = useState<EditPiece[]>(savedSession?.pieces ?? []);
  const [savedClipInfos] = useState<ClipInfo[]>(savedSession?.clipInfos ?? []);
  const [savedAt] = useState<string | null>(savedSession?.savedAt ?? null);
  const [audioFileUrl, setAudioFileUrl] = useState<string | null>(null); // user-uploaded audio
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [lipSyncingId, setLipSyncingId] = useState<string | null>(null);
  const greetedRef = useRef(!!savedSession); // don't re-greet if restoring a session
  const playerRef = useRef<PlayerRef>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // ── Autosave session whenever messages or pieces change ──────────────────
  useEffect(() => {
    if (messages.length === 0 && pieces.length === 0) return;
    saveSession(world.id, {
      messages,
      pieces: pieces.map(p => p.piece),
      clipInfos: library.map(e => e.info),
      savedAt: new Date().toISOString(),
    });
  }, [messages, pieces, library, world.id]);

  // ── Auto-apply pending pieces when footage matches ───────────────────────
  useEffect(() => {
    if (!pendingPieces.length || !library.length) return;
    const allReady = library.every(e => e.info.duration > 0 && !e.analyzing);
    if (!allReady) return;
    const applied = pendingPieces.map(piece => ({ piece, timeline: pieceToTimeline(piece, library) }));
    setPieces(applied);
    setPendingPieces([]);
  }, [library, pendingPieces]);

  const handleStartFresh = useCallback(() => {
    clearSession(world.id);
    setMessages([]);
    setPieces([]);
    setPendingPieces([]);
    setLibrary(prev => { prev.forEach(e => URL.revokeObjectURL(e.clip.url)); return []; });
    greetedRef.current = false;
  }, [world.id]);

  // ── Load soundbytes from galaxy ──────────────────────────────────────────
  useEffect(() => {
    if (!world.galaxyId) return;
    supabase
      .from('galaxies')
      .select('track_url, brainstorm_draft')
      .eq('id', world.galaxyId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.track_url) setTrackUrl(data.track_url);
        const raw = data.brainstorm_draft?.confirmedSoundbytes ?? [];
        const parsed: SoundbyteSummary[] = raw.map((sb: any) => {
          const [startSec, endSec] = parseTimeRange(sb.timeRange || '0:00–0:30');
          return { id: sb.id, label: sb.section || sb.label || 'Section', startSec, endSec };
        });
        setSoundbytes(parsed);
      });
  }, [world.galaxyId]);

  // ── File import ──────────────────────────────────────────────────────────
  const handleFiles = useCallback((files: File[]) => {
    const newEntries: LibraryEntry[] = files.map((file, i) => {
      const url = URL.createObjectURL(file);
      const id = `clip-${Date.now()}-${i}`;
      const index = library.length + i;
      const info: ClipInfo = { index, name: file.name.replace(/\.[^.]+$/, ''), duration: 0 };
      const clip: EditClip = { id, url, startFrom: 0, duration: 0, label: info.name };
      return { clip, file, info, frames: [], analyzing: true };
    });
    setLibrary(prev => {
      const all = [...prev, ...newEntries].map((e, i) => ({ ...e, info: { ...e.info, index: i } }));
      return all;
    });
  }, [library.length]);

  const updateDuration = useCallback((id: string, duration: number) => {
    setLibrary(prev => {
      const entry = prev.find(e => e.clip.id === id);
      if (!entry || entry.info.duration > 0) return prev;
      const updated = prev.map(e =>
        e.clip.id === id ? { ...e, clip: { ...e.clip, duration }, info: { ...e.info, duration } } : e
      );
      // Kick off frame extraction
      extractFrames(entry.clip.url, duration).then(frames => {
        setLibrary(cur => cur.map(e => e.clip.id === id ? { ...e, frames, analyzing: false } : e));
      });
      return updated;
    });
  }, []);

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary(prev => {
      const entry = prev.find(e => e.clip.id === id);
      if (entry) URL.revokeObjectURL(entry.clip.url);
      return prev.filter(e => e.clip.id !== id).map((e, i) => ({ ...e, info: { ...e.info, index: i } }));
    });
  }, []);

  // ── Lip sync detection ───────────────────────────────────────────────────
  const runLipSync = useCallback(async (entry: LibraryEntry) => {
    setLipSyncingId(entry.clip.id);
    try {
      const data = await detectMouthOpennessInVideo(entry.clip.url, entry.info.duration, 10);
      setLibrary(prev => prev.map(e => e.clip.id === entry.clip.id ? { ...e, lipSyncData: data } : e));

      // If we have a soundbyte, find best alignment and tell Mark
      if (soundbytes.length > 0) {
        const sb = soundbytes[0];
        const { videoStartSec, confidence } = findLipSyncOffset(data, sb.startSec, sb.endSec - sb.startSec);
        const msg = `Lip sync analysis done for clip #${entry.info.index} ("${entry.info.name}"). Best alignment for "${sb.label}" soundbyte: clip should start at ${videoStartSec.toFixed(1)}s (confidence: ${Math.round(confidence * 100)}%). Want me to apply this to the edit?`;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
      }
    } finally {
      setLipSyncingId(null);
    }
  }, [soundbytes]);

  // ── Audio upload ─────────────────────────────────────────────────────────
  const handleAudioFile = (file: File) => {
    if (audioFileUrl) URL.revokeObjectURL(audioFileUrl);
    const url = URL.createObjectURL(file);
    setAudioFileUrl(url);
    setMessages(prev => [...prev, { role: 'assistant', content: `Got your audio file "${file.name}". I'll use this for the edit. Want me to re-cut with the audio in mind?` }]);
  };

  // ── Auto-greet ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ready = library.length > 0 && library.every(e => e.info.duration > 0 && !e.analyzing);
    if (ready && !greetedRef.current) {
      greetedRef.current = true;
      callMark([], library);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  // ── Mark API call ────────────────────────────────────────────────────────
  const callMark = useCallback(async (currentMessages: MarkMessage[], currentLibrary: LibraryEntry[]) => {
    setMarkLoading(true);
    try {
      const isFirst = currentMessages.filter(m => m.role === 'user').length === 0;
      const clipFrames: ClipFrames[] = isFirst
        ? currentLibrary.filter(e => e.frames.length > 0).map(e => ({ clipIndex: e.info.index, frames: e.frames }))
        : [];

      const messagesToSend = currentMessages.length === 0
        ? [{ role: 'user' as const, content: 'I just uploaded my footage.' }]
        : currentMessages;

      const res = await fetch('/api/mark-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend,
          clips: currentLibrary.map(e => e.info),
          clipFrames,
          soundbytes,
          trackUrl: audioFileUrl ?? trackUrl,
          worldName: world.name,
          userName: currentUserName,
          genre: 'music',
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message ?? 'No response.' }]);

      // After first footage analysis, fire background artist niche build so Mark
      // has niche-specific intelligence for all future edits for this artist.
      if (isFirst && data.message) {
        fetch('/api/mark/build-artist-niche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artistName: currentUserName,
            footageInsights: data.message,
          }),
        }).catch(() => { /* background — don't surface errors to user */ });
      }

      if (data.editPlan?.pieces) {
        const newPieces = (data.editPlan.pieces as EditPiece[]).map(piece => ({
          piece,
          timeline: pieceToTimeline(piece, currentLibrary),
        }));
        setPieces(newPieces);
        setActivePieceIdx(0);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Having trouble connecting right now.' }]);
    } finally {
      setMarkLoading(false);
    }
  }, [world.name, currentUserName, soundbytes, trackUrl, audioFileUrl]);

  const sendToMark = useCallback((text: string) => {
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    callMark(next, library);
  }, [messages, library, callMark]);

  // ── Download via MediaRecorder ───────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!pieces[activePieceIdx] || downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const totalSecs = pieces[activePieceIdx].timeline.reduce((s, c) => s + c.duration, 0);
      const blob = await recordPlayerToBlob(playerRef, totalSecs + 1, pct => setDownloadProgress(pct));
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${pieces[activePieceIdx].piece.name.replace(/\s+/g, '-')}.webm`;
        a.click();
      }
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  }, [pieces, activePieceIdx, downloading]);

  // ── Hidden video elements (duration detection) ───────────────────────────
  const HiddenVideos = (
    <div className="hidden">
      {library.map(e => (
        <video key={e.clip.id} src={e.clip.url} preload="metadata" muted
          onLoadedMetadata={ev => {
            const d = (ev.target as HTMLVideoElement).duration;
            if (d && d !== e.info.duration) updateDuration(e.clip.id, d);
          }} />
      ))}
    </div>
  );

  const hasClips = library.length > 0;
  const activePiece = pieces[activePieceIdx];
  const effectiveAudio = audioFileUrl ?? trackUrl;

  return (
    <div className="space-y-4">
      {HiddenVideos}

      {/* Empty state */}
      {!hasClips && (
        <div className="space-y-4">
          {/* Restore banner */}
          {savedAt && (savedClipInfos.length > 0 || messages.length > 0) && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-start gap-3">
              <span className="text-lg mt-0.5">🔁</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-star-wars text-yellow-400">
                  Session saved {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {messages.length} message{messages.length !== 1 ? 's' : ''} with Mark
                  {savedClipInfos.length > 0 && ` · ${savedClipInfos.length} clip${savedClipInfos.length !== 1 ? 's' : ''} (${savedClipInfos.map(c => c.name).join(', ')})`}
                  {pendingPieces.length > 0 && ` · ${pendingPieces.length} edited piece${pendingPieces.length !== 1 ? 's' : ''} ready to restore`}
                </p>
                {pendingPieces.length > 0 && (
                  <p className="text-[10px] text-yellow-500/60 mt-1 font-star-wars">
                    Re-upload your footage to restore the preview
                  </p>
                )}
              </div>
              <button
                onClick={handleStartFresh}
                className="text-[10px] text-gray-500 hover:text-red-400 font-star-wars transition-colors whitespace-nowrap"
              >
                Start fresh
              </button>
            </div>
          )}

          <div className="text-center">
            <h3 className="text-sm font-star-wars text-yellow-400 mb-1">Smart Edit</h3>
            <p className="text-xs text-gray-500">
              {pendingPieces.length > 0
                ? 'Re-upload your footage to restore Mark\'s edit.'
                : 'Upload your footage — Mark will watch it and edit it into posts.'}
            </p>
            {soundbytes.length > 0 && (
              <p className="text-xs text-yellow-500/60 mt-1">
                {soundbytes.length} soundbyte{soundbytes.length !== 1 ? 's' : ''} loaded from this release
              </p>
            )}
          </div>
          <FileDropZone onFiles={handleFiles} />
        </div>
      )}

      {hasClips && (
        <div className="grid grid-cols-5 gap-4" style={{ minHeight: '560px' }}>

          {/* Left: Library + pieces */}
          <div className="col-span-3 flex flex-col gap-3">

            {/* Clip grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
                  Footage · {library.length} clip{library.length !== 1 ? 's' : ''}
                  {library.some(e => e.analyzing) && <span className="text-gray-600 ml-1 animate-pulse">· reading...</span>}
                </h3>
                <button
                  onClick={handleStartFresh}
                  className="text-[10px] text-gray-600 hover:text-red-400 font-star-wars transition-colors"
                >
                  Start fresh
                </button>
                {/* Audio upload */}
                <div className="flex items-center gap-2">
                  {soundbytes.length > 0 && (
                    <span className="text-[9px] text-yellow-500/60 font-star-wars">{soundbytes.length} soundbytes</span>
                  )}
                  <button onClick={() => audioInputRef.current?.click()}
                    className={`text-[10px] px-2 py-1 rounded font-star-wars transition-colors border ${audioFileUrl ? 'border-green-500/40 text-green-400 bg-green-500/10' : 'border-yellow-500/20 text-gray-500 hover:text-yellow-400'}`}
                    title="Upload audio file for this edit">
                    {audioFileUrl ? '🎵 Audio loaded' : '+ Audio'}
                  </button>
                  <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = ''; }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                {library.map((entry, i) => (
                  <ClipThumb key={entry.clip.id} entry={entry} index={i}
                    onRemove={() => removeFromLibrary(entry.clip.id)}
                    onLipSync={() => runLipSync(entry)}
                    lipSyncing={lipSyncingId === entry.clip.id} />
                ))}
              </div>
              <FileDropZone onFiles={handleFiles} compact />
            </div>

            {/* Pieces */}
            {pieces.length > 0 ? (
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">Edited Pieces</h3>
                    {pieces.map((p, i) => (
                      <button key={i} onClick={() => setActivePieceIdx(i)}
                        className={`text-[10px] px-2 py-1 rounded font-star-wars transition-colors ${i === activePieceIdx ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-400/40' : 'bg-black/40 text-gray-500 border border-yellow-500/10 hover:text-yellow-500/70'}`}>
                        {p.piece.name}
                      </button>
                    ))}
                  </div>
                  {activePiece && (
                    <button onClick={handleDownload} disabled={downloading}
                      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded font-star-wars transition-colors bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 disabled:opacity-50 border border-yellow-500/30">
                      {downloading ? `${Math.round(downloadProgress * 100)}%` : '⬇ Download'}
                    </button>
                  )}
                </div>
                {activePiece && (
                  <PiecePreview
                    piece={activePiece.piece}
                    timeline={activePiece.timeline}
                    audioUrl={effectiveAudio}
                    playerRef={playerRef}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border border-dashed border-yellow-500/15 rounded-xl">
                <div className="text-center p-6">
                  <div className="text-3xl mb-2">✂️</div>
                  <p className="text-gray-600 text-xs font-star-wars">Mark's edit will appear here</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Mark chat */}
          <div className="col-span-2 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎙️</span>
              <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">Mark</h3>
              {markLoading && <span className="text-[10px] text-gray-500 font-star-wars animate-pulse">editing...</span>}
              {lipSyncingId && <span className="text-[10px] text-purple-400 font-star-wars animate-pulse">lip sync...</span>}
            </div>
            <Card className="flex-1 border-yellow-500/20 bg-black/50 p-3" style={{ minHeight: '460px' }}>
              <div className="h-full">
                <MarkChat messages={messages} onSend={sendToMark} loading={markLoading} disabled={!hasClips} />
              </div>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
