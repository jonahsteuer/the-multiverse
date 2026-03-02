'use client';

import { useState, useEffect, useRef } from 'react';
import { TeamTask, TeamMemberRecord } from '@/types';
import { updatePostVideo, updatePostCaption, approvePost, sendPostForRevision, getPostEvents, updateTask, VideoAnalysis } from '@/lib/team';

// ============================================================================
// Helpers
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
    case 'linked': return { label: 'Linked', color: 'bg-blue-500/20 text-blue-300' };
    case 'analyzed': return { label: 'Analyzed', color: 'bg-indigo-500/20 text-indigo-300' };
    case 'caption_written': return { label: 'Caption Ready', color: 'bg-teal-500/20 text-teal-300' };
    case 'approved': return { label: '✓ Approved', color: 'bg-green-500/20 text-green-300' };
    case 'revision_requested': return { label: 'Sent to Editor', color: 'bg-orange-500/20 text-orange-300' };
    case 'posted': return { label: '✓ Posted', color: 'bg-gray-500/20 text-gray-400 line-through' };
    default: return { label: 'No Video', color: 'bg-gray-700/50 text-gray-500' };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ============================================================================
// Post Card Component
// ============================================================================

function PostCard({
  task,
  teamMembers,
  onVideoLinked,
  onApprove,
  onSendForRevision,
}: {
  task: TeamTask & { videoUrl?: string; videoEmbedUrl?: string; markNotes?: string; markAnalysis?: VideoAnalysis; caption?: string; hashtags?: string; postStatus?: string; revisionNotes?: string };
  teamMembers: TeamMemberRecord[];
  onVideoLinked: (taskId: string, videoUrl: string) => Promise<void>;
  onApprove: (taskId: string) => Promise<void>;
  onSendForRevision: (taskId: string, memberId: string, notes: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [captionText, setCaptionText] = useState(task.caption || '');
  const [hashtagsText, setHashtagsText] = useState(task.hashtags || '');
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [revisionMember, setRevisionMember] = useState('');
  const [revisionNoteText, setRevisionNoteText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const taskExt = task as any;
  const status = taskExt.postStatus || 'unlinked';
  const hasVideo = status !== 'unlinked' && taskExt.videoEmbedUrl;
  const statusBadge = getPostStatusBadge(status);

  const handleLinkVideo = async () => {
    if (!videoInput.trim()) return;
    setIsAnalyzing(true);
    try {
      await onVideoLinked(task.id, videoInput.trim());
      setVideoInput('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async () => {
    await onApprove(task.id);
  };

  const handleSendRevision = async () => {
    if (!revisionMember || !revisionNoteText.trim()) return;
    setIsSending(true);
    try {
      await onSendForRevision(task.id, revisionMember, revisionNoteText);
      setShowRevisionPanel(false);
      setRevisionNoteText('');
    } finally {
      setIsSending(false);
    }
  };

  const editors = teamMembers.filter(m => m.permissions !== 'full');

  return (
    <div className={`rounded-xl border transition-all ${
      status === 'approved' 
        ? 'border-green-500/40 bg-green-900/10' 
        : status === 'revision_requested'
        ? 'border-orange-500/40 bg-orange-900/10'
        : 'border-gray-700/50 bg-gray-900/40'
    }`}>
      {/* Header Row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-xl">{getPostTypeEmoji(task)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{task.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPostTypeBadgeColor(task)}`}>
              {task.title.split(' ')[0]}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{formatDate(task.date)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
          <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-700/30 pt-3">
          
          {/* Video embed or link input */}
          {hasVideo ? (
            <div className="space-y-2">
              {/* Embedded video player */}
              {taskExt.videoSource === 'google_drive' || taskExt.videoSource === 'youtube' ? (
                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                  <iframe
                    src={taskExt.videoEmbedUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay"
                    title={task.title}
                  />
                </div>
              ) : taskExt.videoSource === 'dropbox' ? (
                <div className="rounded-lg overflow-hidden bg-gray-900 aspect-video flex flex-col items-center justify-center gap-3 border border-gray-700">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm text-gray-300 font-medium">Dropbox Video</p>
                  <p className="text-xs text-gray-500 text-center px-4">Dropbox videos can't be previewed directly in the app.<br/>Open it in a new tab to watch.</p>
                  <a
                    href={taskExt.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Open in Dropbox →
                  </a>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    src={taskExt.videoEmbedUrl}
                    className="w-full h-full object-contain"
                    controls
                    preload="metadata"
                  />
                </div>
              )}
              
              {/* Re-link option */}
              <button
                onClick={() => setVideoInput(taskExt.videoUrl || '')}
                className="text-xs text-gray-500 hover:text-gray-300 underline"
              >
                Replace video
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Paste a link to link a video to this post slot:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={videoInput}
                  onChange={e => setVideoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLinkVideo()}
                  placeholder="Google Drive, YouTube, Dropbox, or .mp4 link..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleLinkVideo}
                  disabled={!videoInput.trim() || isAnalyzing}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  {isAnalyzing ? '⏳' : 'Link'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                📁 Google Drive · 📦 Dropbox · 🎬 YouTube · 🔗 Direct .mp4
              </p>
            </div>
          )}

          {/* Re-link input if triggered */}
          {hasVideo && videoInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={videoInput}
                onChange={e => setVideoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLinkVideo()}
                placeholder="New video link..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleLinkVideo}
                disabled={isAnalyzing}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm text-white"
              >
                {isAnalyzing ? '⏳' : 'Update'}
              </button>
            </div>
          )}

          {/* Mark's Analysis */}
          {hasVideo && taskExt.markNotes && (
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🎯</span>
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Mark's Notes</span>
                {taskExt.markAnalysis?.score > 0 && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-bold ${
                    taskExt.markAnalysis.score >= 8 ? 'bg-green-500/20 text-green-300' :
                    taskExt.markAnalysis.score >= 6 ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {taskExt.markAnalysis.score}/10
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{taskExt.markNotes}</p>
              
              {/* Analysis details */}
              {taskExt.markAnalysis && taskExt.markAnalysis.strengths?.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {taskExt.markAnalysis.strengths.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-green-400">
                      <span className="mt-0.5">✓</span><span>{s}</span>
                    </div>
                  ))}
                  {taskExt.markAnalysis.improvements?.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
                      <span className="mt-0.5">→</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual details pills */}
              {taskExt.markAnalysis && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {taskExt.markAnalysis.setting && taskExt.markAnalysis.setting !== 'unknown — preview unavailable' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">📍 {taskExt.markAnalysis.setting}</span>
                  )}
                  {taskExt.markAnalysis.cameraDistance && taskExt.markAnalysis.cameraDistance !== 'unknown' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">📷 {taskExt.markAnalysis.cameraDistance}</span>
                  )}
                  {taskExt.markAnalysis.hasInstrument && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">🎸 instrument</span>
                  )}
                  {taskExt.markAnalysis.hasTextOverlay && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">Ⓣ text overlay</span>
                  )}
                  {taskExt.markAnalysis.energyLevel && taskExt.markAnalysis.energyLevel !== 'unknown' && (
                    <span className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-400">
                      {taskExt.markAnalysis.energyLevel === 'high' ? '⚡' : taskExt.markAnalysis.energyLevel === 'medium' ? '🌊' : '🌿'} {taskExt.markAnalysis.energyLevel} energy
                    </span>
                  )}
                  {/* Color palette dots */}
                  {taskExt.markAnalysis.colorPalette?.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span>🎨</span>
                      {taskExt.markAnalysis.colorPalette.slice(0, 4).map((c: string, i: number) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Revision notes (if sent to editor) */}
          {taskExt.revisionNotes && (
            <div className="bg-orange-900/20 rounded-lg p-3 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">📝</span>
                <span className="text-xs font-semibold text-orange-300">Revision Notes</span>
              </div>
              <p className="text-sm text-orange-200">{taskExt.revisionNotes}</p>
            </div>
          )}

          {/* Caption editor */}
          {hasVideo && (
            <div>
              <button
                onClick={() => setShowCaption(!showCaption)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
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
                  <button
                    onClick={async () => {
                      await updatePostCaption(task.id, captionText, hashtagsText);
                      setShowCaption(false);
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm text-white"
                  >
                    Save Caption
                  </button>
                </div>
              )}
              {!showCaption && captionText && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{captionText}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {hasVideo && status !== 'approved' && status !== 'posted' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleApprove}
                className="flex-1 py-2 bg-green-600/80 hover:bg-green-500 rounded-lg text-sm font-medium text-white transition-colors"
              >
                ✓ Approve
              </button>
              {editors.length > 0 && (
                <button
                  onClick={() => setShowRevisionPanel(!showRevisionPanel)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-200 transition-colors"
                >
                  → Send to Editor
                </button>
              )}
            </div>
          )}

          {/* Revision panel */}
          {showRevisionPanel && (
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40 space-y-2">
              <p className="text-xs text-gray-300 font-semibold">Send for revision</p>
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
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm text-white"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
                <button
                  onClick={() => setShowRevisionPanel(false)}
                  className="px-3 py-2 bg-gray-700 rounded-lg text-sm text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {status === 'approved' && (
            <div className="text-center text-sm text-green-400 py-1">
              ✓ Approved — ready to post on {formatDate(task.date)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Upload Posts Modal
// ============================================================================

// Parse expected count from upload task title e.g. "Upload 15 edits" → 15
function parseExpectedCount(title: string): number | null {
  const m = title.match(/upload\s+(\d+)\s+edits?/i);
  return m ? parseInt(m[1]) : null;
}

// Get tomorrow's date string
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

interface UploadPostsModalProps {
  teamId: string;
  galaxyId: string;
  galaxyName: string;
  teamMembers: TeamMemberRecord[];
  uploadTask?: TeamTask; // optional: the "Upload X edits" task that opened this modal
  onUploadTaskUpdated?: (updated: TeamTask) => void;
  onAskMark?: (contextMessage: string) => void; // open MarkChatPanel with contextual greeting
  onClose: () => void;
}

export function UploadPostsModal({
  teamId,
  galaxyId,
  galaxyName,
  teamMembers,
  uploadTask,
  onUploadTaskUpdated,
  onAskMark,
  onClose,
}: UploadPostsModalProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track how many were linked when modal opened (for carryover calculation)
  const baselineLinkedRef = useRef<number | null>(null);

  const expectedCount = uploadTask ? parseExpectedCount(uploadTask.title) : null;

  useEffect(() => {
    loadPosts();
  }, [teamId, galaxyId]);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const events = await getPostEvents(teamId, galaxyId);
      setPosts(events);
      // Record baseline: how many were already linked when modal opened
      if (baselineLinkedRef.current === null) {
        baselineLinkedRef.current = events.filter((p: any) => p.postStatus && p.postStatus !== 'unlinked').length;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const linkedCount = posts.filter(p => p.postStatus && p.postStatus !== 'unlinked').length;
  const approvedCount = posts.filter(p => p.postStatus === 'approved' || p.postStatus === 'posted').length;
  const newlyLinked = baselineLinkedRef.current !== null ? linkedCount - baselineLinkedRef.current : 0;
  const sessionGoalMet = expectedCount !== null && newlyLinked >= expectedCount;

  const handleClose = async () => {
    // Carryover: if upload task exists and goal not met, reschedule remaining to tomorrow
    if (uploadTask && !uploadTask.id.startsWith('default-') && expectedCount !== null) {
      const remaining = Math.max(0, expectedCount - newlyLinked);
      if (remaining > 0 && newlyLinked > 0) {
        // Partially done — reschedule remaining to tomorrow
        const updated = await updateTask(uploadTask.id, {
          date: tomorrowStr(),
          title: `Upload ${remaining} edits`,
        });
        if (updated) onUploadTaskUpdated?.(updated);
      } else if (sessionGoalMet) {
        // All done for this session — mark complete
        const updated = await updateTask(uploadTask.id, { status: 'completed' });
        if (updated) onUploadTaskUpdated?.(updated);
      }
    }
    onClose();
  };

  const handleAskMark = () => {
    const taskName = uploadTask?.title ?? 'Upload edits';
    const remaining = expectedCount !== null ? Math.max(0, expectedCount - newlyLinked) : null;
    const contextMessage = remaining !== null && remaining > 0
      ? `Need help uploading your edits? You've got ${remaining} clips left to pair to post slots — I can walk you through it.`
      : `Need help uploading your edits? Just paste a Google Drive, YouTube, or Dropbox link next to each post slot and I'll take a look.`;
    onAskMark?.(contextMessage) ?? console.log('[UploadPostsModal] No onAskMark handler — task:', taskName);
  };

  const handleVideoLinked = async (taskId: string, videoUrl: string) => {
    // Call analyze-video API
    const post = posts.find(p => p.id === taskId);
    const postType = post?.title.toLowerCase().includes('teaser') ? 'teaser'
      : post?.title.toLowerCase().includes('promo') ? 'promo'
      : post?.title.toLowerCase().includes('release') ? 'release'
      : 'audience-builder';

    try {
      const res = await fetch('/api/mark/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          postType,
          postTitle: post?.title,
        }),
      });

      if (!res.ok) {
        console.error('Analysis failed:', await res.text());
        return;
      }

      const result = await res.json();

      // Save to Supabase
      await updatePostVideo(taskId, {
        videoUrl,
        videoSource: result.source,
        videoEmbedUrl: result.embedUrl,
        markNotes: result.analysis?.markNotes,
        markAnalysis: result.analysis,
        postStatus: 'analyzed',
      });

      // Update local state
      setPosts(prev => prev.map(p => p.id === taskId ? {
        ...p,
        videoUrl,
        videoSource: result.source,
        videoEmbedUrl: result.embedUrl,
        markNotes: result.analysis?.markNotes,
        markAnalysis: result.analysis,
        postStatus: 'analyzed',
      } : p));
    } catch (err) {
      console.error('Error analyzing video:', err);
    }
  };

  const handleApprove = async (taskId: string) => {
    await approvePost(taskId);
    setPosts(prev => prev.map(p => p.id === taskId ? { ...p, postStatus: 'approved' } : p));
  };

  const handleSendForRevision = async (taskId: string, memberId: string, notes: string) => {
    await sendPostForRevision(taskId, memberId, notes);
    setPosts(prev => prev.map(p => p.id === taskId ? {
      ...p,
      postStatus: 'revision_requested',
      revisionNotes: notes,
    } : p));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={handleClose}
    >
      <div
        className="bg-gray-950 border border-gray-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              {uploadTask ? uploadTask.title : 'Upload Posts'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {galaxyName}
              {expectedCount && (
                <span className={`ml-2 font-medium ${sessionGoalMet ? 'text-green-400' : 'text-purple-400'}`}>
                  · Today&apos;s goal: {expectedCount} edits
                  {newlyLinked > 0 && ` · ${newlyLinked} linked this session`}
                </span>
              )}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Mark intro */}
        <div className="px-5 py-3 bg-purple-900/20 border-b border-purple-800/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">M</div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {linkedCount === 0
                ? `Let's get your content matched up. Paste a Google Drive, YouTube, or Dropbox link next to each post slot and I'll take a look at each one.`
                : sessionGoalMet
                ? `Nice work — you've hit today's goal of ${expectedCount} uploads. You can keep going or come back tomorrow for the rest.`
                : linkedCount === posts.length
                ? `All ${posts.length} slots are linked. ${approvedCount} approved so far.`
                : `Looking good — ${linkedCount} of ${posts.length} linked so far. Keep going.`
              }
            </p>
          </div>
        </div>

        {/* Progress */}
        {posts.length > 0 && (
          <div className="px-5 py-2.5 border-b border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{linkedCount}/{posts.length} linked</span>
              {expectedCount && (
                <span className={sessionGoalMet ? 'text-green-400' : 'text-purple-400'}>
                  {sessionGoalMet ? `✓ Goal met (${expectedCount} today)` : `Goal: ${newlyLinked}/${expectedCount} today`}
                </span>
              )}
              <span>{approvedCount}/{posts.length} approved</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${sessionGoalMet ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
                style={{ width: `${posts.length > 0 ? (linkedCount / posts.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Post list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-sm">Loading post slots...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-sm font-medium text-gray-400">No scheduled post slots yet</p>
              <p className="text-xs mt-1">Post slots are created when your calendar is generated for this release.</p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                task={post}
                teamMembers={teamMembers}
                onVideoLinked={handleVideoLinked}
                onApprove={handleApprove}
                onSendForRevision={handleSendForRevision}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={handleAskMark}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all"
          >
            <span>🎯</span><span>Ask Mark for help</span>
          </button>
          <div className="flex-1" />
          {sessionGoalMet && (
            <button
              onClick={async () => {
                if (uploadTask && !uploadTask.id.startsWith('default-')) {
                  const updated = await updateTask(uploadTask.id, { status: 'completed' });
                  if (updated) onUploadTaskUpdated?.(updated);
                }
                onClose();
              }}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              ✓ Mark complete & close
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-colors"
          >
            Done for now
          </button>
        </div>
      </div>
    </div>
  );
}

