'use client';

import { useState, useRef, useEffect } from 'react';
import type { TeamTask, TeamMemberRecord } from '@/types';
import { MarkContext } from '@/lib/mark-knowledge';
import { updateTask, saveTaskMarkAnalysis } from '@/lib/team';

// ── Video URL parsing ─────────────────────────────────────────────────────────

interface ClipEntry {
  id: string;
  url: string;
  source: 'google_drive' | 'dropbox' | 'youtube' | 'direct';
  embedUrl: string;
  thumbnailUrl: string | null;
  label: string;
  revisionNotes?: string;
  caption?: string;
  hashtags?: string;
  finalized?: boolean;
  addedAt: string;
}

function parseVideoUrl(url: string): Omit<ClipEntry, 'id' | 'label' | 'addedAt'> | null {
  try {
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return {
        url,
        source: 'google_drive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
      };
    }
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      return {
        url,
        source: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
    const dropboxMatch = url.match(/dropbox\.com\/(s|sh|scl\/fi)\//);
    if (dropboxMatch) {
      const cleanUrl = url.replace(/[?&](dl|raw)=[^&]*/g, '').replace(/[?&]$/, '');
      const sep = cleanUrl.includes('?') ? '&' : '?';
      return { url, source: 'dropbox', embedUrl: `${cleanUrl}${sep}raw=1`, thumbnailUrl: null };
    }
    if (url.match(/\.(mp4|mov|webm|avi)(\?.*)?$/i)) {
      return { url, source: 'direct', embedUrl: url, thumbnailUrl: null };
    }
    return null;
  } catch {
    return null;
  }
}

function parseUploadRange(title: string): { start: number; end: number; count: number } | null {
  const match = title.match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return { start, end, count: end - start + 1 };
  }
  return null;
}

function sourceIcon(source: string) {
  switch (source) {
    case 'google_drive': return '📁';
    case 'youtube': return '▶️';
    case 'dropbox': return '📦';
    default: return '🎬';
  }
}

function sourceLabel(source: string) {
  switch (source) {
    case 'google_drive': return 'Google Drive';
    case 'youtube': return 'YouTube';
    case 'dropbox': return 'Dropbox';
    default: return 'Direct link';
  }
}

function getClipsFromTask(t: TeamTask): ClipEntry[] {
  const clips = (t.markAnalysis as Record<string, unknown>)?.clips;
  return Array.isArray(clips) ? (clips as ClipEntry[]) : [];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getTaskTypeLabel(type: string): string {
  switch (type) {
    case 'invite_team':  return 'Team Setup';
    case 'brainstorm':   return 'Brainstorm';
    case 'prep':         return 'Prep';
    case 'film':         return 'Film';
    case 'edit':         return 'Edit';
    case 'review':       return 'Review';
    case 'post':         return 'Post';
    case 'release':      return 'Release';
    case 'shoot':        return 'Shoot';
    default:             return 'Task';
  }
}

function getTaskTypeColor(type: string): string {
  switch (type) {
    case 'invite_team':  return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'brainstorm':   return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'film':
    case 'shoot':        return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'edit':         return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'review':       return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    case 'post':         return 'bg-green-500/20 text-green-300 border-green-500/40';
    default:             return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function formatTaskDate(dateStr: string, startTime: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const [h, m] = startTime.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── Mark mini-chat ────────────────────────────────────────────────────────────

interface MarkMessage { role: 'user' | 'assistant'; content: string; }

function MarkMiniChat({ context, initialPrompt }: { context: MarkContext; initialPrompt?: string }) {
  const [messages, setMessages] = useState<MarkMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (initialPrompt && messages.length === 0) sendMessage(initialPrompt, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const sendMessage = async (text: string, isAuto = false) => {
    const userMsg: MarkMessage = { role: 'user', content: text };
    const updatedMessages = isAuto ? [userMsg] : [...messages, userMsg];
    if (!isAuto) setMessages(prev => [...prev, userMsg]);
    else setMessages([userMsg]);
    setIsLoading(true);
    setInput('');
    try {
      const res = await fetch('/api/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, context }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || data.reply || "I'm here — what do you need?";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 text-sm py-4">Ask Mark anything about this task</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <span className="text-xs mr-2 mt-1 flex-shrink-0">🎯</span>}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${
              msg.role === 'user' ? 'bg-purple-600/40 text-white' : 'bg-gray-800 text-gray-100'
            }`}>{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <span className="text-xs mr-2 mt-1">🎯</span>
            <div className="bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-400">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-700 pt-3 mt-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim() && !isLoading) sendMessage(input.trim()); } }}
            placeholder="Ask Mark..."
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => { if (input.trim() && !isLoading) sendMessage(input.trim()); }}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-sm transition-colors self-end"
          >Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Clips View ─────────────────────────────────────────────────────────

function UploadClipsView({
  task,
  onTaskUpdated,
  onAskMark,
}: {
  task: TeamTask;
  onTaskUpdated?: (t: TeamTask) => void;
  onAskMark: () => void;
}) {
  const range = parseUploadRange(task.title);
  const expectedCount = range?.count ?? null;
  const isFootage = task.title.toLowerCase().includes('footage');
  const noun = isFootage ? 'footage clip' : 'edit';

  const [clips, setClips] = useState<ClipEntry[]>(() => getClipsFromTask(task));
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const addClip = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (clips.some(c => c.url === url)) { setUrlError('This URL is already in the list.'); return; }
    const parsed = parseVideoUrl(url);
    if (!parsed) { setUrlError('Unrecognized URL. Paste a Google Drive, YouTube, or Dropbox link.'); return; }
    const newClip: ClipEntry = {
      ...parsed,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: `${isFootage ? 'Footage' : 'Edit'} ${clips.length + (range?.start ?? 1)}`,
      addedAt: new Date().toISOString(),
    };
    setClips(prev => [...prev, newClip]);
    setUrlInput('');
    setUrlError('');
  };

  const removeClip = (id: string) => setClips(prev => prev.filter(c => c.id !== id));

  const persistClips = async (clipsToSave: ClipEntry[]) => {
    if (!task.id || task.id.startsWith('default-')) return;
    const newAnalysis = { ...((task.markAnalysis as Record<string, unknown>) || {}), clips: clipsToSave };
    await saveTaskMarkAnalysis(task.id, newAnalysis);
    onTaskUpdated?.({ ...task, markAnalysis: newAnalysis });
  };

  const handleSave = async () => {
    setSaving(true);
    await persistClips(clips);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleComplete = async () => {
    setCompleting(true);
    await persistClips(clips);
    await updateTask(task.id, { status: 'completed' });
    setCompleting(false);
    onTaskUpdated?.({ ...task, status: 'completed' });
  };

  const allUploaded = expectedCount !== null ? clips.length >= expectedCount : clips.length > 0;

  return (
    <div className="p-5 space-y-5">
      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Upload Progress</h3>
          <span className={`text-sm font-semibold ${allUploaded ? 'text-green-400' : 'text-white'}`}>
            {clips.length}{expectedCount ? ` / ${expectedCount}` : ''} {noun}{clips.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expectedCount && (
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${allUploaded ? 'bg-green-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min((clips.length / expectedCount) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Clip list */}
      {clips.length > 0 && (
        <div className="space-y-2">
          {clips.map((clip, i) => (
            <div key={clip.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
              {clip.thumbnailUrl ? (
                <img src={clip.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-14 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                  {sourceIcon(clip.source)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{clip.label || `${isFootage ? 'Footage' : 'Edit'} ${i + 1}`}</p>
                <p className="text-xs text-gray-500">{sourceLabel(clip.source)}</p>
              </div>
              <button onClick={() => removeClip(clip.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add URL input */}
      {(!expectedCount || clips.length < expectedCount) && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Add {noun} link
          </h3>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlError(''); }}
              onKeyDown={e => e.key === 'Enter' && addClip()}
              placeholder="Paste Google Drive, YouTube, or Dropbox link..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={addClip}
              disabled={!urlInput.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
            >Add</button>
          </div>
          {urlError && <p className="text-xs text-red-400 mt-1.5">{urlError}</p>}
          <p className="text-xs text-gray-600 mt-1.5">Supports Google Drive share links, YouTube, Dropbox, and direct .mp4 URLs</p>
        </div>
      )}

      {/* Actions */}
      {clips.length > 0 && (
        <div className="space-y-2 pt-1">
          {!allUploaded && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving...' : justSaved ? '✓ Progress saved' : 'Save progress'}
            </button>
          )}
          {allUploaded && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {completing ? 'Completing...' : `✓ All ${noun}s uploaded — mark complete`}
            </button>
          )}
        </div>
      )}

      {/* Ask Mark */}
      <button
        onClick={onAskMark}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all"
      >
        <span>🎯</span><span>Ask Mark for help</span>
      </button>
    </div>
  );
}

// ── Send Revisions View ───────────────────────────────────────────────────────

function SendRevisionsView({
  task,
  allTasks,
  onTaskUpdated,
  onAskMark,
}: {
  task: TeamTask;
  allTasks: TeamTask[];
  onTaskUpdated?: (t: TeamTask) => void;
  onAskMark: () => void;
}) {
  // Gather all clips from all upload tasks in the same galaxy
  const uploadTasks = allTasks.filter(t =>
    t.galaxyId === task.galaxyId &&
    (t.title.toLowerCase().includes('upload edits') || t.title.toLowerCase().includes('upload footage'))
  );

  const allClipsWithSource = uploadTasks.flatMap(ut =>
    getClipsFromTask(ut).map(c => ({ ...c, uploadTaskId: ut.id }))
  );

  const editorName = (() => {
    // Extract editor name from task title e.g. "Send edits back to Ruby with notes"
    const match = task.title.match(/back to ([A-Za-z]+)\s+with/i);
    return match ? match[1] : 'your editor';
  })();

  // Local state for notes — keyed by clipId
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    allClipsWithSource.forEach(c => { init[c.id] = c.revisionNotes || ''; });
    return init;
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const hasAnyNotes = Object.values(notes).some(n => n.trim().length > 0);
  const clipsWithNotes = allClipsWithSource.filter(c => notes[c.id]?.trim());

  const handleSend = async () => {
    setSending(true);
    // Update each upload task's mark_analysis with the revised notes
    for (const ut of uploadTasks) {
      const clips = getClipsFromTask(ut).map(c => ({
        ...c,
        revisionNotes: notes[c.id] ?? c.revisionNotes,
      }));
      const newAnalysis = { ...((ut.markAnalysis as Record<string, unknown>) || {}), clips };
      await saveTaskMarkAnalysis(ut.id, newAnalysis);
      onTaskUpdated?.({ ...ut, markAnalysis: newAnalysis });
    }
    // Mark this task as completed
    await updateTask(task.id, { status: 'completed' });
    onTaskUpdated?.({ ...task, status: 'completed' });
    setSending(false);
    setSent(true);
  };

  if (allClipsWithSource.length === 0) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm text-gray-400 font-medium">No uploads yet</p>
          <p className="text-xs text-gray-600 mt-1">Complete your &quot;Upload edits&quot; tasks first, then come back here to send revisions.</p>
        </div>
        <button onClick={onAskMark} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all">
          <span>🎯</span><span>Ask Mark for help</span>
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm text-white font-semibold">Revisions sent to {editorName}</p>
          <p className="text-xs text-gray-500 mt-1">{clipsWithNotes.length} clip{clipsWithNotes.length !== 1 ? 's' : ''} flagged for revision</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {task.description && <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>}

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          {allClipsWithSource.length} clips uploaded
        </h3>
        <p className="text-xs text-gray-600">Add notes to clips that need revision. Leave blank for clips that look ready.</p>
      </div>

      <div className="space-y-3">
        {allClipsWithSource.map((clip, i) => (
          <div key={clip.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-3">
              {clip.thumbnailUrl ? (
                <img src={clip.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-14 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                  {sourceIcon(clip.source)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{clip.label || `Edit ${i + 1}`}</p>
                <p className="text-xs text-gray-500">{sourceLabel(clip.source)}</p>
              </div>
              {notes[clip.id]?.trim() ? (
                <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded-full flex-shrink-0">Revision</span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 border border-green-500/40 rounded-full flex-shrink-0">Ready</span>
              )}
            </div>
            <textarea
              value={notes[clip.id] || ''}
              onChange={e => setNotes(prev => ({ ...prev, [clip.id]: e.target.value }))}
              placeholder="Add revision notes (leave blank if this clip looks good)..."
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1">
        <button
          onClick={handleSend}
          disabled={sending}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            hasAnyNotes
              ? 'bg-orange-600 hover:bg-orange-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          } disabled:opacity-40`}
        >
          {sending ? 'Sending...' : hasAnyNotes
            ? `Send ${clipsWithNotes.length} revision${clipsWithNotes.length !== 1 ? 's' : ''} to ${editorName} →`
            : `All clips look ready — mark complete ✓`}
        </button>
      </div>

      <button onClick={onAskMark} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all">
        <span>🎯</span><span>Ask Mark for help</span>
      </button>
    </div>
  );
}

// ── Finalize Posts View ───────────────────────────────────────────────────────

function FinalizePostsView({
  task,
  allTasks,
  onTaskUpdated,
  onAskMark,
}: {
  task: TeamTask;
  allTasks: TeamTask[];
  onTaskUpdated?: (t: TeamTask) => void;
  onAskMark: () => void;
}) {
  // Find matching upload task for the same batch range
  const finalizeRange = parseUploadRange(task.title);

  const uploadTasks = allTasks.filter(t =>
    t.galaxyId === task.galaxyId &&
    (t.title.toLowerCase().includes('upload edits') || t.title.toLowerCase().includes('upload footage'))
  );

  // Get clips from the matching upload task (same range) or all upload tasks if no range
  const matchingClips: ClipEntry[] = (() => {
    if (finalizeRange) {
      const matchingUpload = uploadTasks.find(ut => {
        const r = parseUploadRange(ut.title);
        return r && r.start === finalizeRange.start && r.end === finalizeRange.end;
      });
      return matchingUpload ? getClipsFromTask(matchingUpload) : [];
    }
    return uploadTasks.flatMap(ut => getClipsFromTask(ut));
  })();

  const matchingUploadTaskId = (() => {
    if (finalizeRange) {
      const ut = uploadTasks.find(t => {
        const r = parseUploadRange(t.title);
        return r && r.start === finalizeRange.start && r.end === finalizeRange.end;
      });
      return ut?.id ?? null;
    }
    return uploadTasks[0]?.id ?? null;
  })();

  // Local state: captions + hashtags per clip
  const [captions, setCaptions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    matchingClips.forEach(c => { init[c.id] = c.caption || ''; });
    return init;
  });
  const [hashtags, setHashtags] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    matchingClips.forEach(c => { init[c.id] = c.hashtags || ''; });
    return init;
  });
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);

  const readyCount = matchingClips.filter(c => captions[c.id]?.trim() && hashtags[c.id]?.trim()).length;
  const allReady = matchingClips.length > 0 && readyCount === matchingClips.length;

  const handleFinalize = async () => {
    setFinalizing(true);
    if (matchingUploadTaskId) {
      const uploadTask = uploadTasks.find(t => t.id === matchingUploadTaskId);
      if (uploadTask) {
        const updatedClips = getClipsFromTask(uploadTask).map(c => ({
          ...c,
          caption: captions[c.id] ?? c.caption,
          hashtags: hashtags[c.id] ?? c.hashtags,
          finalized: true,
        }));
        const newAnalysis = { ...((uploadTask.markAnalysis as Record<string, unknown>) || {}), clips: updatedClips };
        await saveTaskMarkAnalysis(matchingUploadTaskId, newAnalysis);
        onTaskUpdated?.({ ...uploadTask, markAnalysis: newAnalysis });
      }
    }
    await updateTask(task.id, { status: 'completed' });
    onTaskUpdated?.({ ...task, status: 'completed' });
    setFinalizing(false);
    setFinalized(true);
  };

  if (matchingClips.length === 0) {
    return (
      <div className="p-5 space-y-5">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm text-gray-400 font-medium">No uploads found for this batch</p>
          <p className="text-xs text-gray-600 mt-1">Complete the matching &quot;Upload edits&quot; task first, then come back here to finalize.</p>
        </div>
        <button onClick={onAskMark} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all">
          <span>🎯</span><span>Ask Mark for help</span>
        </button>
      </div>
    );
  }

  if (finalized) {
    return (
      <div className="p-5">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-sm text-white font-semibold">Posts finalized!</p>
          <p className="text-xs text-gray-500 mt-1">{matchingClips.length} post{matchingClips.length !== 1 ? 's' : ''} ready to schedule</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {task.description && <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>}

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          {matchingClips.length} posts to finalize
        </h3>
        <p className="text-xs text-gray-600">
          Add a caption and hashtags to each post. {readyCount > 0 && `${readyCount} of ${matchingClips.length} ready.`}
        </p>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${allReady ? 'bg-green-500' : 'bg-purple-500'}`}
          style={{ width: `${matchingClips.length > 0 ? (readyCount / matchingClips.length) * 100 : 0}%` }}
        />
      </div>

      <div className="space-y-4">
        {matchingClips.map((clip, i) => {
          const captionFilled = !!captions[clip.id]?.trim();
          const hashtagsFilled = !!hashtags[clip.id]?.trim();
          const ready = captionFilled && hashtagsFilled;
          return (
            <div key={clip.id} className={`bg-gray-900 border rounded-xl p-3 space-y-3 ${ready ? 'border-green-700/50' : 'border-gray-800'}`}>
              <div className="flex items-center gap-3">
                {clip.thumbnailUrl ? (
                  <img src={clip.thumbnailUrl} alt="" className="w-14 h-10 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-14 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                    {sourceIcon(clip.source)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{clip.label || `Edit ${i + 1}`}</p>
                  {clip.revisionNotes && (
                    <p className="text-xs text-orange-400 mt-0.5 truncate">Note: {clip.revisionNotes}</p>
                  )}
                </div>
                {ready && <span className="text-green-400 text-base flex-shrink-0">✓</span>}
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Caption</label>
                <textarea
                  value={captions[clip.id] || ''}
                  onChange={e => setCaptions(prev => ({ ...prev, [clip.id]: e.target.value }))}
                  placeholder="Write a caption..."
                  rows={2}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Hashtags</label>
                <input
                  type="text"
                  value={hashtags[clip.id] || ''}
                  onChange={e => setHashtags(prev => ({ ...prev, [clip.id]: e.target.value }))}
                  placeholder="#music #newrelease #rock"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 pt-1">
        <button
          onClick={handleFinalize}
          disabled={finalizing || !allReady}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {finalizing ? 'Finalizing...' : allReady
            ? `🚀 Finalize all ${matchingClips.length} posts`
            : `Add captions & hashtags to all posts (${readyCount}/${matchingClips.length} ready)`}
        </button>
      </div>

      <button onClick={onAskMark} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all">
        <span>🎯</span><span>Ask Mark for help</span>
      </button>
    </div>
  );
}

// ── Default View ──────────────────────────────────────────────────────────────

function DefaultView({
  task,
  onTaskUpdated,
  onAskMark,
}: {
  task: TeamTask;
  onTaskUpdated?: (t: TeamTask) => void;
  onAskMark: () => void;
}) {
  const [notes, setNotes] = useState(task.description || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const handleSaveNotes = async () => {
    if (!task.id || task.id.startsWith('default-')) return;
    setSavingNotes(true);
    try {
      await updateTask(task.id, { description: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      onTaskUpdated?.({ ...task, description: notes });
    } catch (e) {
      console.error('[TaskPanel] Failed to save notes:', e);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {task.description && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What to do</h3>
          <p className="text-sm text-gray-200 leading-relaxed">{task.description}</p>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes / Links</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes, Drive links, or context..."
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleSaveNotes}
          disabled={savingNotes}
          className="mt-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {savingNotes ? 'Saving...' : notesSaved ? '✓ Saved' : 'Save notes'}
        </button>
      </div>

      <button
        onClick={onAskMark}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all"
      >
        <span>🎯</span><span>Ask Mark for help</span>
      </button>
    </div>
  );
}

// ── Main TaskPanel ────────────────────────────────────────────────────────────

interface TaskPanelProps {
  task: TeamTask;
  allTasks: TeamTask[];
  teamMembers: TeamMemberRecord[];
  markContext: MarkContext;
  onClose: () => void;
  onTaskUpdated?: (updated: TeamTask) => void;
}

export function TaskPanel({ task: initialTask, allTasks, teamMembers, markContext, onClose, onTaskUpdated }: TaskPanelProps) {
  const [task, setTask] = useState(initialTask);
  const [showMark, setShowMark] = useState(false);
  const [markPrompt, setMarkPrompt] = useState<string | undefined>(undefined);

  const titleLower = task.title.toLowerCase();
  const isSendRevisionsTask = titleLower.includes('send edits back') || (titleLower.includes('send') && titleLower.includes('with notes'));
  const isFinalizeTask = titleLower.includes('finalize posts');
  const isBrainstorm = task.type === 'brainstorm';

  // Brainstorm tasks: auto-open Mark in brainstorm mode
  useEffect(() => {
    if (isBrainstorm) {
      const releaseName = markContext.currentRelease?.name || 'your upcoming release';
      const genreRaw = markContext.artistProfile?.genre;
      const artistGenre = Array.isArray(genreRaw) ? genreRaw.join(', ') : (typeof genreRaw === 'string' ? genreRaw : '');
      setMarkPrompt(`Let's brainstorm content ideas for ${releaseName}${artistGenre ? ` (${artistGenre})` : ''}. I need TikTok/Instagram Reel ideas that stop the scroll. Give me 5 specific concepts with a first-frame visual description and why it works for my sound.`);
      setShowMark(true);
    }
  }, [isBrainstorm, markContext]);

  const handleTaskUpdated = (updated: TeamTask) => {
    setTask(updated);
    onTaskUpdated?.(updated);
  };

  const handleAskMark = () => {
    setMarkPrompt(undefined);
    setShowMark(true);
  };

  const assignee = task.assignedTo ? teamMembers.find(m => m.userId === task.assignedTo) : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      onClick={onClose}
    >
      {/* Modal card */}
      <div
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getTaskTypeColor(task.type)}`}>
                {getTaskTypeLabel(task.type)}
              </span>
              {assignee && (
                <span className="text-[11px] text-gray-500">→ {assignee.displayName}</span>
              )}
              {task.status === 'completed' && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-green-500/20 text-green-300 border-green-500/40">Done</span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white leading-snug">{task.title}</h2>
            <p className="text-xs text-gray-500 mt-1">{formatTaskDate(task.date, task.startTime)}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {showMark ? (
            <div className="flex flex-col h-full p-4" style={{ minHeight: 0 }}>
              {!isBrainstorm && (
                <button
                  onClick={() => { setShowMark(false); setMarkPrompt(undefined); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-3 transition-colors"
                >← Back to task</button>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🎯</span>
                <span className="text-sm font-semibold text-white">Mark</span>
                {isBrainstorm && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded-full">Brainstorm mode</span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <MarkMiniChat context={markContext} initialPrompt={markPrompt} />
              </div>
            </div>
          ) : isSendRevisionsTask ? (
            <SendRevisionsView task={task} allTasks={allTasks} onTaskUpdated={handleTaskUpdated} onAskMark={handleAskMark} />
          ) : isFinalizeTask ? (
            <FinalizePostsView task={task} allTasks={allTasks} onTaskUpdated={handleTaskUpdated} onAskMark={handleAskMark} />
          ) : (
            <DefaultView task={task} onTaskUpdated={handleTaskUpdated} onAskMark={handleAskMark} />
          )}
        </div>
      </div>
    </div>
  );
}
