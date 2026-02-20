'use client';

import { useState } from 'react';
import { TeamTask, TeamMemberRecord } from '@/types';
import { updatePostVideo, updatePostCaption, approvePost, sendPostForRevision } from '@/lib/team';

// ============================================================================
// Helpers (shared with UploadPostsModal)
// ============================================================================

function getPostTypeEmoji(task: TeamTask): string {
  const t = task.title.toLowerCase();
  if (t.includes('release')) return '🎵';
  if (t.includes('teaser')) return '👀';
  if (t.includes('promo')) return '📣';
  if (t.includes('audience')) return '🌱';
  return '📱';
}

function getPostTypeBadgeColor(task: TeamTask): string {
  const t = task.title.toLowerCase();
  if (t.includes('release')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (t.includes('teaser')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (t.includes('promo')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (t.includes('audience')) return 'bg-green-500/20 text-green-300 border-green-500/40';
  return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
}

function getPostStatusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'linked':            return { label: 'Linked',          color: 'bg-blue-500/20 text-blue-300' };
    case 'analyzed':          return { label: 'Analyzed',         color: 'bg-indigo-500/20 text-indigo-300' };
    case 'caption_written':   return { label: 'Caption Ready',    color: 'bg-teal-500/20 text-teal-300' };
    case 'approved':          return { label: '✓ Approved',       color: 'bg-green-500/20 text-green-300' };
    case 'revision_requested':return { label: 'Sent to Editor',   color: 'bg-orange-500/20 text-orange-300' };
    case 'posted':            return { label: '✓ Posted',         color: 'bg-gray-500/20 text-gray-400' };
    default:                  return { label: 'No Video Yet',     color: 'bg-gray-700/50 text-gray-500' };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ============================================================================
// PostDetailModal
// ============================================================================

interface PostDetailModalProps {
  task: TeamTask;
  teamMembers: TeamMemberRecord[];
  onClose: () => void;
  /** Called after a video is successfully linked so parent can refresh teamTasks */
  onPostUpdated?: (updatedTask: TeamTask) => void;
}

export function PostDetailModal({ task: initialTask, teamMembers, onClose, onPostUpdated }: PostDetailModalProps) {
  const [task, setTask] = useState<TeamTask>(initialTask);
  const [videoInput, setVideoInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [captionText, setCaptionText] = useState(task.caption || '');
  const [hashtagsText, setHashtagsText] = useState(task.hashtags || '');
  const [savingCaption, setSavingCaption] = useState(false);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [revisionMember, setRevisionMember] = useState('');
  const [revisionNoteText, setRevisionNoteText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [approving, setApproving] = useState(false);

  const status = task.postStatus || 'unlinked';
  const hasVideo = status !== 'unlinked' && !!task.videoEmbedUrl;
  const statusBadge = getPostStatusBadge(status);
  const editors = teamMembers.filter(m => m.permissions !== 'full');
  const markAnalysis = task.markAnalysis as Record<string, unknown> | null | undefined;

  // ── Link / analyze video ──────────────────────────────────────────────────
  const handleLinkVideo = async () => {
    const url = videoInput.trim();
    if (!url) return;
    setIsAnalyzing(true);
    try {
      const postType = task.title.toLowerCase().includes('teaser') ? 'teaser'
        : task.title.toLowerCase().includes('promo') ? 'promo'
        : task.title.toLowerCase().includes('release') ? 'release'
        : 'audience-builder';

      const res = await fetch('/api/mark/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url, postType, postTitle: task.title }),
      });

      if (!res.ok) {
        console.error('Analysis failed:', await res.text());
        return;
      }

      const result = await res.json();

      await updatePostVideo(task.id, {
        videoUrl: url,
        videoSource: result.source,
        videoEmbedUrl: result.embedUrl,
        markNotes: result.analysis?.markNotes,
        markAnalysis: result.analysis,
        postStatus: 'analyzed',
      });

      const updated: TeamTask = {
        ...task,
        videoUrl: url,
        videoSource: result.source,
        videoEmbedUrl: result.embedUrl,
        markNotes: result.analysis?.markNotes,
        markAnalysis: result.analysis,
        postStatus: 'analyzed',
      };
      setTask(updated);
      setVideoInput('');
      onPostUpdated?.(updated);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Caption save ──────────────────────────────────────────────────────────
  const handleSaveCaption = async () => {
    setSavingCaption(true);
    try {
      await updatePostCaption(task.id, captionText, hashtagsText);
      const updated = { ...task, caption: captionText, hashtags: hashtagsText, postStatus: 'caption_written' };
      setTask(updated);
      setShowCaption(false);
      onPostUpdated?.(updated);
    } finally {
      setSavingCaption(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    setApproving(true);
    try {
      await approvePost(task.id);
      const updated = { ...task, postStatus: 'approved' };
      setTask(updated);
      onPostUpdated?.(updated);
    } finally {
      setApproving(false);
    }
  };

  // ── Send for revision ─────────────────────────────────────────────────────
  const handleSendRevision = async () => {
    if (!revisionMember || !revisionNoteText.trim()) return;
    setIsSending(true);
    try {
      await sendPostForRevision(task.id, revisionMember, revisionNoteText);
      const updated = { ...task, postStatus: 'revision_requested', revisionNotes: revisionNoteText };
      setTask(updated);
      setShowRevisionPanel(false);
      setRevisionNoteText('');
      onPostUpdated?.(updated);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className={`relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border ${
        status === 'approved'
          ? 'border-green-500/40 bg-gray-950'
          : status === 'revision_requested'
          ? 'border-orange-500/40 bg-gray-950'
          : 'border-gray-700/60 bg-gray-950'
      }`}>

        {/* ── Header ── */}
        <div className="flex items-start gap-3 p-4 border-b border-gray-800">
          <span className="text-2xl mt-0.5">{getPostTypeEmoji(task)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white truncate">{task.title}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPostTypeBadgeColor(task)}`}>
                {task.title.split(' ')[0]}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{formatDate(task.date)}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none p-1 -mt-1 -mr-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Video player / link input ── */}
          {hasVideo ? (
            <div className="space-y-2">
              {task.videoSource === 'google_drive' || task.videoSource === 'youtube' ? (
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  <iframe
                    src={task.videoEmbedUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay"
                    title={task.title}
                  />
                </div>
              ) : task.videoSource === 'dropbox' ? (
                <div className="rounded-xl bg-gray-900 aspect-video flex flex-col items-center justify-center gap-3 border border-gray-700">
                  <span className="text-4xl">📦</span>
                  <p className="text-sm text-gray-300 font-medium">Dropbox Video</p>
                  <p className="text-xs text-gray-500 text-center px-6">
                    Dropbox videos can&apos;t be previewed inside the app.
                    <br />Open it in a new tab to watch.
                  </p>
                  <a
                    href={task.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Open in Dropbox →
                  </a>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    src={task.videoEmbedUrl}
                    className="w-full h-full object-contain"
                    controls
                    preload="metadata"
                  />
                </div>
              )}

              {/* Replace link */}
              {!videoInput && (
                <button
                  onClick={() => setVideoInput(task.videoUrl || '')}
                  className="text-xs text-gray-500 hover:text-gray-300 underline"
                >
                  Replace video
                </button>
              )}

              {/* Re-link input */}
              {videoInput !== '' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={videoInput}
                    onChange={e => setVideoInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLinkVideo()}
                    placeholder="Paste new link..."
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleLinkVideo}
                    disabled={isAnalyzing}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white"
                  >
                    {isAnalyzing ? '⏳' : 'Update'}
                  </button>
                  <button onClick={() => setVideoInput('')} className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-gray-300">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── No video yet ── */
            <div className="space-y-2">
              <p className="text-sm text-gray-400">No video linked yet. Paste a link to attach one:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={videoInput}
                  onChange={e => setVideoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLinkVideo()}
                  placeholder="Google Drive, YouTube, Dropbox, or .mp4 link…"
                  autoFocus
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleLinkVideo}
                  disabled={!videoInput.trim() || isAnalyzing}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  {isAnalyzing ? '⏳ Analyzing…' : 'Link'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                📁 Google Drive · 📦 Dropbox · 🎬 YouTube · 🔗 Direct .mp4
              </p>
            </div>
          )}

          {/* ── Mark's Notes ── */}
          {task.markNotes && (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
              <div className="flex items-center gap-2 mb-2">
                <span>🎯</span>
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Mark&apos;s Notes</span>
                {markAnalysis && typeof markAnalysis.score === 'number' && (markAnalysis.score as number) > 0 && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
                    (markAnalysis.score as number) >= 8 ? 'bg-green-500/20 text-green-300' :
                    (markAnalysis.score as number) >= 6 ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {markAnalysis.score as number}/10
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{task.markNotes}</p>

              {/* Strengths / improvements */}
              {markAnalysis && Array.isArray(markAnalysis.strengths) && (markAnalysis.strengths as string[]).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(markAnalysis.strengths as string[]).map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-green-400">
                      <span className="mt-0.5">✓</span><span>{s}</span>
                    </div>
                  ))}
                  {Array.isArray(markAnalysis.improvements) && (markAnalysis.improvements as string[]).map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
                      <span className="mt-0.5">→</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual metadata pills */}
              {markAnalysis && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {typeof markAnalysis.setting === 'string' && markAnalysis.setting !== 'unknown — preview unavailable' && markAnalysis.setting !== 'unknown' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">📍 {markAnalysis.setting as string}</span>
                  )}
                  {typeof markAnalysis.cameraDistance === 'string' && markAnalysis.cameraDistance !== 'unknown' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">📷 {markAnalysis.cameraDistance as string}</span>
                  )}
                  {markAnalysis.hasInstrument && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">🎸 instrument</span>
                  )}
                  {markAnalysis.hasTextOverlay && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">Ⓣ text overlay</span>
                  )}
                  {typeof markAnalysis.energyLevel === 'string' && markAnalysis.energyLevel !== 'unknown' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">
                      {markAnalysis.energyLevel === 'high' ? '⚡' : markAnalysis.energyLevel === 'medium' ? '🌊' : '🌿'} {markAnalysis.energyLevel as string} energy
                    </span>
                  )}
                  {Array.isArray(markAnalysis.colorPalette) && (markAnalysis.colorPalette as string[]).length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span>🎨</span>
                      {(markAnalysis.colorPalette as string[]).slice(0, 5).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Revision notes ── */}
          {task.revisionNotes && (
            <div className="bg-orange-900/20 rounded-xl p-3 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">📝</span>
                <span className="text-xs font-semibold text-orange-300">Revision Notes</span>
              </div>
              <p className="text-sm text-orange-200">{task.revisionNotes}</p>
            </div>
          )}

          {/* ── Caption editor ── */}
          {hasVideo && (
            <div>
              <button
                onClick={() => setShowCaption(!showCaption)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5"
              >
                <span>✏️</span>
                <span>{captionText ? 'Edit caption & hashtags' : 'Add caption & hashtags'}</span>
                <span>{showCaption ? '▲' : '▼'}</span>
              </button>
              {showCaption && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={captionText}
                    onChange={e => setCaptionText(e.target.value)}
                    placeholder="Write your caption..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <input
                    type="text"
                    value={hashtagsText}
                    onChange={e => setHashtagsText(e.target.value)}
                    placeholder="#hashtags #here..."
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCaption}
                      disabled={savingCaption}
                      className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-sm text-white"
                    >
                      {savingCaption ? 'Saving…' : 'Save Caption'}
                    </button>
                    <button onClick={() => setShowCaption(false)} className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm text-gray-300">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {!showCaption && captionText && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{captionText}</p>
              )}
            </div>
          )}

          {/* ── Action buttons ── */}
          {hasVideo && status !== 'approved' && status !== 'posted' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 py-2.5 bg-green-600/80 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
              >
                {approving ? 'Approving…' : '✓ Approve'}
              </button>
              {editors.length > 0 && (
                <button
                  onClick={() => setShowRevisionPanel(!showRevisionPanel)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium text-gray-200 transition-colors"
                >
                  → Send to Editor
                </button>
              )}
            </div>
          )}

          {/* Approved state */}
          {status === 'approved' && (
            <div className="text-center py-2 text-sm text-green-400 font-medium">
              ✓ Approved — ready to schedule
            </div>
          )}

          {/* ── Revision panel ── */}
          {showRevisionPanel && (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40 space-y-3">
              <p className="text-sm text-gray-300 font-semibold">Send for revision</p>
              <select
                value={revisionMember}
                onChange={e => setRevisionMember(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Select team member...</option>
                {editors.map(m => (
                  <option key={m.userId} value={m.userId}>{m.displayName} ({m.role})</option>
                ))}
              </select>
              <textarea
                value={revisionNoteText}
                onChange={e => setRevisionNoteText(e.target.value)}
                placeholder="Revision notes (e.g. 'Try faster cuts in the chorus')"
                rows={2}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSendRevision}
                  disabled={!revisionMember || !revisionNoteText.trim() || isSending}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
                >
                  {isSending ? 'Sending…' : 'Send to Editor'}
                </button>
                <button onClick={() => setShowRevisionPanel(false)} className="px-4 py-2 bg-gray-700 rounded-lg text-sm text-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>{/* end scrollable body */}
      </div>
    </div>
  );
}

