'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Player } from '@remotion/player';
import { EditPreviewComposition, EditClip, getTotalFrames } from '../remotion/EditPreviewComposition';
import { Card } from '../ui/card';
import type { ClipInfo, ClipFrames, EditPiece } from '@/app/api/mark-edit/route';
import { extractFrames } from '@/lib/extract-video-frames';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LibraryEntry {
  clip: EditClip;
  file: File;
  info: ClipInfo;
  frames: string[];      // base64 keyframes for Mark's vision
  analyzing: boolean;    // true while frames are being extracted
}

interface SmartEditTabProps {
  worldName: string;
  teamId: string;
  currentUserId: string;
  currentUserName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pieceToTimeline(piece: EditPiece, library: LibraryEntry[]): EditClip[] {
  return piece.clips
    .map((pc, i) => {
      const entry = library[pc.clipIndex];
      if (!entry) return null;
      return {
        id: `${entry.clip.id}-piece-${i}`,
        url: entry.clip.url,
        startFrom: Math.max(0, pc.startFrom),
        duration: Math.min(pc.duration, entry.info.duration),
        label: pc.label,
      } as EditClip;
    })
    .filter((c): c is EditClip => c !== null);
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

function FileDropZone({ onFiles, hasClips }: { onFiles: (files: File[]) => void; hasClips: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const videos = Array.from(e.dataTransfer.files).filter(
        f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm|avi|mkv)$/i),
      );
      if (videos.length) onFiles(videos);
    },
    [onFiles],
  );

  if (hasClips) {
    return (
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full text-xs border border-dashed border-yellow-500/30 hover:border-yellow-500/60 rounded-lg py-2 text-gray-500 hover:text-yellow-400 transition-colors font-star-wars"
      >
        + Add more clips
        <input ref={inputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = ''; }} />
      </button>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
        dragging ? 'border-yellow-400 bg-yellow-400/10 scale-[1.01]' : 'border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5'
      }`}
    >
      <div className="text-5xl mb-3">🎬</div>
      <p className="text-yellow-400 font-star-wars text-sm">Drop your footage here</p>
      <p className="text-gray-600 text-xs mt-1">or click to browse · MP4, MOV, WebM, AVI</p>
      <input ref={inputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = ''; }} />
    </div>
  );
}

// ─── Clip Thumbnail ───────────────────────────────────────────────────────────

function ClipThumb({ entry, index, onRemove }: { entry: LibraryEntry; index: number; onRemove: () => void }) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-yellow-500/20 bg-black">
      <video
        src={entry.clip.url}
        className="w-full aspect-video object-cover opacity-80"
        preload="metadata"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      {/* Analyzing overlay */}
      {entry.analyzing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-[9px] text-yellow-400/80 font-star-wars animate-pulse">analyzing...</span>
        </div>
      )}
      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-end justify-between">
        <div>
          <span className="text-yellow-400/80 text-[9px] font-star-wars block leading-tight truncate max-w-[90px]">
            {entry.file.name.replace(/\.[^.]+$/, '')}
          </span>
          <span className="text-gray-500 text-[9px] font-mono">{formatDuration(entry.info.duration)}</span>
        </div>
        <div className="flex items-center gap-1">
          {!entry.analyzing && entry.frames.length > 0 && (
            <span title="Mark has seen this clip" className="text-[9px]">👁</span>
          )}
          <span className="text-[10px] bg-black/60 text-yellow-400 font-star-wars px-1.5 py-0.5 rounded">
            #{index}
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 hidden group-hover:flex w-5 h-5 items-center justify-center bg-black/70 text-red-400 rounded text-[10px] hover:bg-red-500/20 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Edit Piece Preview ───────────────────────────────────────────────────────

function PiecePreview({ piece, timeline }: { piece: EditPiece; timeline: EditClip[] }) {
  const totalFrames = getTotalFrames(timeline, FPS);
  const totalSecs = timeline.reduce((s, c) => s + c.duration, 0);

  return (
    <div className="rounded-lg overflow-hidden border border-yellow-500/20 bg-black">
      <div className="px-3 py-2 border-b border-yellow-500/10 flex items-center justify-between">
        <span className="text-xs font-star-wars text-yellow-400 truncate">{piece.name}</span>
        <span className="text-[10px] text-gray-500 font-mono ml-2 flex-shrink-0">{formatDuration(totalSecs)}</span>
      </div>
      {timeline.length > 0 ? (
        <Player
          component={EditPreviewComposition}
          inputProps={{ clips: timeline }}
          durationInFrames={totalFrames}
          fps={FPS}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: '100%' }}
          controls
          loop
        />
      ) : (
        <div className="aspect-[9/16] flex items-center justify-center">
          <span className="text-gray-700 text-xs font-star-wars">No clips</span>
        </div>
      )}
    </div>
  );
}

// ─── Mark Chat ────────────────────────────────────────────────────────────────

function MarkChat({
  messages,
  onSend,
  loading,
  disabled,
}: {
  messages: MarkMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = () => {
    const t = input.trim();
    if (!t || loading || disabled) return;
    onSend(t);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-yellow-500/20 text-yellow-100 font-star-wars'
                  : 'bg-gray-800/80 text-gray-200'
              }`}
            >
              {msg.role === 'assistant' && (
                <span className="text-yellow-400 font-star-wars text-[10px] block mb-1">MARK</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/80 rounded-lg px-3 py-2">
              <span className="text-yellow-400 font-star-wars text-[10px] block mb-1">MARK</span>
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-yellow-400/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={disabled ? 'Upload footage to start...' : 'Tell Mark what you want...'}
          disabled={disabled || loading}
          className="flex-1 bg-black/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/60 font-star-wars disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading || disabled}
          className="bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 text-yellow-400 rounded-lg px-3 py-2 text-xs font-star-wars transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SmartEditTab({
  worldName,
  currentUserId,
  currentUserName,
}: SmartEditTabProps) {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [messages, setMessages] = useState<MarkMessage[]>([]);
  const [markLoading, setMarkLoading] = useState(false);
  const [pieces, setPieces] = useState<{ piece: EditPiece; timeline: EditClip[] }[]>([]);
  const [activePieceIdx, setActivePieceIdx] = useState(0);
  const greetedRef = useRef(false);

  // ── File import ────────────────────────────────────────────────────────────
  const handleFiles = useCallback(
    (files: File[]) => {
      const newEntries: LibraryEntry[] = files.map((file, i) => {
        const url = URL.createObjectURL(file);
        const id = `clip-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        const index = library.length + i;
        const info: ClipInfo = { index, name: file.name.replace(/\.[^.]+$/, ''), duration: 0 };
        const clip: EditClip = { id, url, startFrom: 0, duration: 0, label: info.name };
        return { clip, file, info, frames: [], analyzing: true };
      });

      setLibrary(prev => {
        const all = [...prev, ...newEntries].map((e, i) => ({
          ...e,
          info: { ...e.info, index: i },
        }));
        return all;
      });
    },
    [library.length],
  );

  // Once duration is known, extract frames for Mark's vision
  const updateDuration = useCallback((id: string, duration: number) => {
    setLibrary(prev => {
      const entry = prev.find(e => e.clip.id === id);
      if (!entry || entry.info.duration === duration) return prev; // already set

      const updated = prev.map(e =>
        e.clip.id === id
          ? { ...e, clip: { ...e.clip, duration }, info: { ...e.info, duration }, analyzing: true }
          : e,
      );

      // Kick off async frame extraction
      extractFrames(entry.clip.url, duration, 4).then(frames => {
        setLibrary(cur =>
          cur.map(e => e.clip.id === id ? { ...e, frames, analyzing: false } : e),
        );
      });

      return updated;
    });
  }, []);

  // ── Auto-greet once all clips have frames extracted ───────────────────────
  useEffect(() => {
    const ready = library.length > 0 && library.every(e => e.info.duration > 0 && !e.analyzing);
    if (ready && !greetedRef.current) {
      greetedRef.current = true;
      callMark([], library);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  // ── Mark API call ─────────────────────────────────────────────────────────
  const callMark = useCallback(
    async (currentMessages: MarkMessage[], currentLibrary: LibraryEntry[]) => {
      setMarkLoading(true);
      try {
        // Send frames only on the initial greeting call
        const isFirstCall = currentMessages.filter(m => m.role === 'user').length === 0;
        const clipFrames: ClipFrames[] = isFirstCall
          ? currentLibrary
              .filter(e => e.frames.length > 0)
              .map(e => ({ clipIndex: e.info.index, frames: e.frames }))
          : [];

        // For the initial call we need at least one user message — use a silent trigger
        const messagesToSend: MarkMessage[] =
          currentMessages.length === 0
            ? [{ role: 'user', content: 'I just uploaded my footage.' }]
            : currentMessages;

        const res = await fetch('/api/mark-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesToSend,
            clips: currentLibrary.map(e => e.info),
            clipFrames,
            worldName,
            userName: currentUserName,
          }),
        });
        const data = await res.json();
        const reply: MarkMessage = { role: 'assistant', content: data.message ?? 'No response.' };
        setMessages(prev => [...prev, reply]);

        // Apply edit plan if present
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
    },
    [worldName, currentUserName],
  );

  const sendToMark = useCallback(
    (text: string) => {
      const newMessages: MarkMessage[] = [...messages, { role: 'user', content: text }];
      setMessages(newMessages);
      callMark(newMessages, library);
    },
    [messages, library, callMark],
  );

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary(prev => {
      const entry = prev.find(e => e.clip.id === id);
      if (entry) URL.revokeObjectURL(entry.clip.url);
      return prev.filter(e => e.clip.id !== id).map((e, i) => ({ ...e, info: { ...e.info, index: i } }));
    });
  }, []);

  const hasClips = library.length > 0;
  const activePiece = pieces[activePieceIdx];

  // ── Hidden video elements to detect duration ───────────────────────────────
  const HiddenVideos = (
    <div className="hidden">
      {library.map(entry => (
        <video
          key={entry.clip.id}
          src={entry.clip.url}
          preload="metadata"
          onLoadedMetadata={e => {
            const dur = (e.target as HTMLVideoElement).duration;
            if (dur && dur !== entry.info.duration) updateDuration(entry.clip.id, dur);
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {HiddenVideos}

      {/* Empty state */}
      {!hasClips && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-star-wars text-yellow-400 mb-1">Smart Edit</h3>
            <p className="text-xs text-gray-500">Upload your footage and Mark will edit it into posts for you.</p>
          </div>
          <FileDropZone onFiles={handleFiles} hasClips={false} />
        </div>
      )}

      {/* Main layout once clips are loaded */}
      {hasClips && (
        <div className="grid grid-cols-5 gap-4" style={{ minHeight: '520px' }}>

          {/* Left: Library + Preview */}
          <div className="col-span-3 flex flex-col gap-3">

            {/* Clip library grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
                  Footage · {library.length} clip{library.length !== 1 ? 's' : ''}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {library.map((entry, i) => (
                  <ClipThumb
                    key={entry.clip.id}
                    entry={entry}
                    index={i}
                    onRemove={() => removeFromLibrary(entry.clip.id)}
                  />
                ))}
              </div>
              <FileDropZone onFiles={handleFiles} hasClips={true} />
            </div>

            {/* Pieces / previews */}
            {pieces.length > 0 && (
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
                    Edited Pieces
                  </h3>
                  <div className="flex gap-1 flex-wrap">
                    {pieces.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePieceIdx(i)}
                        className={`text-[10px] px-2 py-1 rounded font-star-wars transition-colors ${
                          i === activePieceIdx
                            ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-400/40'
                            : 'bg-black/40 text-gray-500 border border-yellow-500/10 hover:text-yellow-500/70'
                        }`}
                      >
                        {p.piece.name}
                      </button>
                    ))}
                  </div>
                </div>
                {activePiece && (
                  <PiecePreview piece={activePiece.piece} timeline={activePiece.timeline} />
                )}
              </div>
            )}

            {/* Placeholder when no pieces yet */}
            {pieces.length === 0 && (
              <div className="flex-1 flex items-center justify-center border border-dashed border-yellow-500/15 rounded-xl">
                <div className="text-center p-6">
                  <div className="text-3xl mb-2">✂️</div>
                  <p className="text-gray-600 text-xs font-star-wars">
                    Mark&apos;s edit will appear here
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Mark chat */}
          <div className="col-span-2 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎙️</span>
              <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">Mark</h3>
              {library.some(e => e.analyzing) && !markLoading && (
                <span className="text-[10px] text-gray-500 font-star-wars animate-pulse">reading footage...</span>
              )}
            {markLoading && (
                <span className="text-[10px] text-gray-500 font-star-wars animate-pulse">editing...</span>
              )}
            </div>
            <Card className="flex-1 border-yellow-500/20 bg-black/50 p-3" style={{ minHeight: 0 }}>
              <div className="h-full" style={{ minHeight: '400px' }}>
                <MarkChat
                  messages={messages}
                  onSend={sendToMark}
                  loading={markLoading}
                  disabled={!hasClips}
                />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
