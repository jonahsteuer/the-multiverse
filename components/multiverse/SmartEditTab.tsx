'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Player } from '@remotion/player';
import { EditPreviewComposition, EditClip, getTotalFrames } from '../remotion/EditPreviewComposition';
import { Card } from '../ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SmartEditTabProps {
  worldName: string;
  teamId: string;
  currentUserId: string;
  currentUserName: string;
  artistName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 30;
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/avi', 'video/x-msvideo'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function bytesToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FileDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const videos = Array.from(e.dataTransfer.files).filter(
      f => ACCEPTED_VIDEO_TYPES.includes(f.type) || f.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)
    );
    if (videos.length) onFiles(videos);
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        dragging ? 'border-yellow-400 bg-yellow-400/10' : 'border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/5'
      }`}
    >
      <div className="text-3xl mb-2">🎬</div>
      <p className="text-yellow-400 font-star-wars text-sm">Drop video files here</p>
      <p className="text-gray-500 text-xs mt-1">or click to browse · MP4, MOV, WebM, AVI</p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function ClipCard({
  clip,
  file,
  isSelected,
  onSelect,
  onRemove,
  onAddToTimeline,
}: {
  clip: EditClip;
  file: File;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onAddToTimeline: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(clip.duration);

  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        isSelected ? 'border-yellow-400 bg-yellow-400/10' : 'border-yellow-500/20 hover:border-yellow-500/40'
      }`}
      onClick={onSelect}
    >
      <div className="relative mb-2 rounded overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={clip.url}
          className="w-full h-full object-cover"
          preload="metadata"
          onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
        />
        <div className="absolute bottom-1 right-1 bg-black/70 text-yellow-400 text-xs px-1.5 py-0.5 rounded font-mono">
          {formatDuration(duration)}
        </div>
      </div>
      <p className="text-xs text-gray-300 truncate font-star-wars">{file.name}</p>
      <p className="text-xs text-gray-600 mt-0.5">{bytesToMB(file.size)} MB</p>
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={e => { e.stopPropagation(); onAddToTimeline(); }}
          className="flex-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded px-2 py-1 transition-colors font-star-wars"
        >
          + Timeline
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded px-2 py-1 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function TimelineStrip({
  clips,
  fileMap,
  onRemove,
  onReorder,
}: {
  clips: EditClip[];
  fileMap: Map<string, File>;
  onRemove: (id: string) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  if (clips.length === 0) {
    return (
      <div className="border border-dashed border-yellow-500/20 rounded-lg p-4 text-center">
        <p className="text-gray-600 text-xs font-star-wars">Timeline empty · add clips from the library</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {clips.map((clip, i) => {
        const file = fileMap.get(clip.id);
        const widthRem = Math.max(4, Math.min(12, clip.duration * 0.5));
        return (
          <div
            key={clip.id}
            draggable
            onDragStart={() => setDraggingIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (draggingIdx !== null && draggingIdx !== i) {
                onReorder(draggingIdx, i);
              }
              setDraggingIdx(null);
            }}
            style={{ minWidth: `${widthRem}rem`, maxWidth: `${widthRem}rem` }}
            className={`relative flex-shrink-0 rounded border border-yellow-500/30 bg-black/50 overflow-hidden group transition-opacity ${
              draggingIdx === i ? 'opacity-40' : ''
            }`}
          >
            {file && (
              <video src={clip.url} className="w-full h-10 object-cover opacity-60" preload="metadata" />
            )}
            <div className="absolute inset-0 flex flex-col justify-between p-1">
              <span className="text-yellow-400 text-[9px] font-star-wars truncate leading-tight">
                {clip.label ?? file?.name.replace(/\.[^.]+$/, '') ?? clip.id.slice(0, 8)}
              </span>
              <span className="text-gray-500 text-[9px] font-mono">{formatDuration(clip.duration)}</span>
            </div>
            <button
              onClick={() => onRemove(clip.id)}
              className="absolute top-0.5 right-0.5 hidden group-hover:flex text-red-400 bg-black/60 rounded w-4 h-4 items-center justify-center text-[10px]"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MarkChat({
  messages,
  onSend,
  loading,
  clips,
}: {
  messages: MarkMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  clips: EditClip[];
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">🎬</div>
            <p className="text-gray-500 text-xs font-star-wars leading-relaxed">
              Tell Mark what kind of edit you&apos;re going for — style, pacing, vibe — and he&apos;ll help you craft the sequence.
            </p>
            {clips.length > 0 && (
              <p className="text-yellow-500/60 text-xs mt-2 font-star-wars">
                {clips.length} clip{clips.length !== 1 ? 's' : ''} in timeline
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-yellow-500/20 text-yellow-100 font-star-wars'
                  : 'bg-gray-800 text-gray-200'
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
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-yellow-400 font-star-wars text-[10px] block mb-1">MARK</span>
              <span className="text-gray-400 text-xs animate-pulse">thinking...</span>
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
          placeholder="Ask Mark about your edit..."
          className="flex-1 bg-black/50 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/60 font-star-wars"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
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
  teamId,
  currentUserId,
  currentUserName,
  artistName,
}: SmartEditTabProps) {
  // Library: all imported files
  const [library, setLibrary] = useState<{ clip: EditClip; file: File }[]>([]);
  // Timeline: ordered clips for the preview
  const [timeline, setTimeline] = useState<EditClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  // Mark chat
  const [messages, setMessages] = useState<MarkMessage[]>([]);
  const [markLoading, setMarkLoading] = useState(false);

  const fileMap = new Map<string, File>(library.map(({ clip, file }) => [clip.id, file]));

  // ── File import ──────────────────────────────────────────────────────────
  const handleFiles = useCallback((files: File[]) => {
    const newEntries = files.map(file => {
      const url = URL.createObjectURL(file);
      const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const clip: EditClip = {
        id,
        url,
        startFrom: 0,
        duration: 10, // will be updated when video metadata loads
        label: file.name.replace(/\.[^.]+$/, ''),
      };
      return { clip, file };
    });
    setLibrary(prev => [...prev, ...newEntries]);
  }, []);

  const removeFromLibrary = useCallback((id: string) => {
    setLibrary(prev => {
      const entry = prev.find(e => e.clip.id === id);
      if (entry) URL.revokeObjectURL(entry.clip.url);
      return prev.filter(e => e.clip.id !== id);
    });
    setTimeline(prev => prev.filter(c => c.id !== id));
  }, []);

  // ── Timeline ops ─────────────────────────────────────────────────────────
  const addToTimeline = useCallback((clip: EditClip) => {
    setTimeline(prev => {
      if (prev.find(c => c.id === clip.id)) return prev; // already added
      return [...prev, clip];
    });
  }, []);

  const removeFromTimeline = useCallback((id: string) => {
    setTimeline(prev => prev.filter(c => c.id !== id));
  }, []);

  const reorderTimeline = useCallback((fromIdx: number, toIdx: number) => {
    setTimeline(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // Update clip duration once video metadata is available (via native video el in ClipCard)
  const updateClipDuration = useCallback((id: string, duration: number) => {
    setLibrary(prev =>
      prev.map(e => e.clip.id === id ? { ...e, clip: { ...e.clip, duration } } : e)
    );
    setTimeline(prev =>
      prev.map(c => c.id === id ? { ...c, duration } : c)
    );
  }, []);

  // ── Mark chat ────────────────────────────────────────────────────────────
  const sendToMark = useCallback(async (text: string) => {
    const newMessages: MarkMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setMarkLoading(true);

    const clipSummary = timeline.length > 0
      ? `Current timeline: ${timeline.map((c, i) => `clip ${i + 1} "${c.label ?? c.id}" (${formatDuration(c.duration)})`).join(', ')}.`
      : 'No clips in timeline yet.';

    const systemContext = `You are Mark, an experienced music industry creative director and video editor advisor.
You're helping ${artistName ?? currentUserName} edit a video for their release "${worldName}".
${clipSummary}
Give concise, practical advice about video editing, pacing, transitions, and storytelling.
Keep responses to 3-5 sentences max. Suggest specific clip ordering, cut timing, or visual ideas.`;

    try {
      const res = await fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: {
            userId: currentUserId,
            userName: currentUserName,
            currentRelease: { name: worldName },
          },
          systemOverride: systemContext,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message ?? 'No response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Having trouble reaching you right now — check your connection.' }]);
    } finally {
      setMarkLoading(false);
    }
  }, [messages, timeline, worldName, currentUserId, currentUserName, artistName]);

  // ── Remotion player props ─────────────────────────────────────────────────
  const totalFrames = getTotalFrames(timeline, FPS);

  return (
    <div className="space-y-4">
      {/* Top: Library + Preview side by side */}
      <div className="grid grid-cols-5 gap-4" style={{ minHeight: '340px' }}>

        {/* Library — 2 cols */}
        <div className="col-span-2 flex flex-col gap-3">
          <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Clip Library
          </h3>
          <FileDropZone onFiles={handleFiles} />
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ maxHeight: '220px' }}>
            {library.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-4 font-star-wars">No clips yet</p>
            )}
            {library.map(({ clip, file }) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                file={file}
                isSelected={selectedClipId === clip.id}
                onSelect={() => setSelectedClipId(clip.id === selectedClipId ? null : clip.id)}
                onRemove={() => removeFromLibrary(clip.id)}
                onAddToTimeline={() => {
                  // Grab current duration from video metadata if updated
                  const current = library.find(e => e.clip.id === clip.id)?.clip ?? clip;
                  addToTimeline(current);
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview — 3 cols */}
        <div className="col-span-3 flex flex-col gap-2">
          <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Preview
          </h3>
          <div className="rounded-lg overflow-hidden bg-black border border-yellow-500/20 flex-1 flex items-center justify-center" style={{ minHeight: '240px' }}>
            {timeline.length > 0 ? (
              <Player
                component={EditPreviewComposition}
                inputProps={{ clips: timeline }}
                durationInFrames={totalFrames}
                fps={FPS}
                compositionWidth={1920}
                compositionHeight={1080}
                style={{ width: '100%' }}
                controls
                loop
              />
            ) : (
              <div className="text-center p-8">
                <div className="text-4xl mb-3">🎞️</div>
                <p className="text-gray-600 text-xs font-star-wars">
                  Add clips to the timeline to preview your edit
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline strip */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Timeline · {timeline.length} clip{timeline.length !== 1 ? 's' : ''}
            {timeline.length > 0 && (
              <span className="text-gray-500 ml-2">
                {formatDuration(timeline.reduce((s, c) => s + c.duration, 0))} total
              </span>
            )}
          </h3>
          {timeline.length > 0 && (
            <button
              onClick={() => setTimeline([])}
              className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors font-star-wars"
            >
              Clear all
            </button>
          )}
        </div>
        <TimelineStrip
          clips={timeline}
          fileMap={fileMap}
          onRemove={removeFromTimeline}
          onReorder={reorderTimeline}
        />
      </div>

      {/* Mark chat */}
      <Card className="border-yellow-500/20 bg-black/50 p-4" style={{ height: '280px' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎙️</span>
          <h3 className="text-xs font-star-wars text-yellow-400 uppercase tracking-wider">
            Ask Mark About Your Edit
          </h3>
        </div>
        <div style={{ height: 'calc(100% - 36px)' }}>
          <MarkChat
            messages={messages}
            onSend={sendToMark}
            loading={markLoading}
            clips={timeline}
          />
        </div>
      </Card>
    </div>
  );
}
