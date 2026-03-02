'use client';

import { useState, useEffect } from 'react';
import { TeamTask } from '@/types';
import { getPostEvents, updatePostCaption, approvePost } from '@/lib/team';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getPostTypeEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('release')) return '🎵';
  if (t.includes('teaser')) return '👀';
  if (t.includes('promo')) return '📣';
  if (t.includes('audience')) return '🌱';
  return '📱';
}

function getPostTypeBadgeClasses(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('release')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (t.includes('teaser')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (t.includes('promo')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (t.includes('audience')) return 'bg-green-500/20 text-green-300 border-green-500/40';
  return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
}

function getPostTypeLabel(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('release')) return 'Release';
  if (t.includes('teaser')) return 'Teaser';
  if (t.includes('promo')) return 'Promo';
  if (t.includes('audience')) return 'Audience';
  return 'Post';
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FinalizePostsModalProps {
  teamId: string;
  galaxyId: string;
  galaxyName: string;
  finalizeTask: TeamTask;
  onAskMark?: (contextMessage: string) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FinalizePostsModal({
  teamId,
  galaxyId,
  galaxyName,
  finalizeTask,
  onAskMark,
  onClose,
}: FinalizePostsModalProps) {
  const [posts, setPosts] = useState<TeamTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [hashtagsDraft, setHashtagsDraft] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Expected count from task title e.g. "Finalize 15 posts" → 15
  const expectedCount = (() => {
    const m = finalizeTask.title.match(/finalize (\d+) posts?/i);
    return m ? parseInt(m[1]) : null;
  })();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const all = await getPostEvents(teamId, galaxyId);
        // Only show posts that have a video linked (ready to finalize)
        const linked = (all as TeamTask[]).filter(
          p => p.videoUrl || (p as any).videoEmbedUrl
        );
        setPosts(linked);
        if (linked.length > 0) {
          setActivePostId(linked[0].id);
          setCaptionDraft(linked[0].caption || '');
          setHashtagsDraft(linked[0].hashtags || '');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [teamId, galaxyId]);

  const activePost = posts.find(p => p.id === activePostId) ?? null;
  const finalizedCount = posts.filter(
    p => p.postStatus === 'approved' || p.postStatus === 'posted'
  ).length;
  const isFullyFinalized = posts.length > 0 && finalizedCount === posts.length;

  const handleSelectPost = (post: TeamTask) => {
    setActivePostId(post.id);
    setCaptionDraft(post.caption || '');
    setHashtagsDraft(post.hashtags || '');
  };

  const handleFinalizePost = async () => {
    if (!activePost) return;
    setIsFinalizing(true);
    try {
      await updatePostCaption(activePost.id, captionDraft, hashtagsDraft);
      await approvePost(activePost.id);

      // Update local state
      const updatedPost = {
        ...activePost,
        caption: captionDraft,
        hashtags: hashtagsDraft,
        postStatus: 'approved',
      };
      const updatedPosts = posts.map(p => (p.id === activePost.id ? updatedPost : p));
      setPosts(updatedPosts);

      // Auto-advance to next unfinalized post
      const next = updatedPosts.find(
        p => p.id !== activePost.id && p.postStatus !== 'approved' && p.postStatus !== 'posted'
      );
      if (next) handleSelectPost(next);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleAskMark = () => {
    const msg = activePost
      ? `I need help writing a caption and hashtags for my ${getPostTypeLabel(activePost.title)} post scheduled for ${formatShortDate(activePost.date)}, for my song "${galaxyName}". Can you suggest an engaging caption and 10–15 relevant hashtags?`
      : `I need help writing captions and hashtags for my posts for "${galaxyName}".`;
    onAskMark?.(msg);
  };

  const activeIsDone =
    activePost?.postStatus === 'approved' || activePost?.postStatus === 'posted';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{finalizeTask.title}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {galaxyName}
              {posts.length > 0 && (
                <span
                  className={`ml-2 font-medium ${
                    isFullyFinalized ? 'text-green-400' : 'text-purple-400'
                  }`}
                >
                  · {finalizedCount}/{posts.length} finalized
                  {expectedCount && posts.length < expectedCount && (
                    <span className="text-gray-500">
                      {' '}(showing {posts.length} with videos — {expectedCount - posts.length} still need upload)
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-sm">Loading posts...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-gray-500">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-sm font-medium text-gray-400">No uploaded posts to finalize yet</p>
              <p className="text-xs mt-1 text-gray-500">
                Complete your upload tasks first — posts with videos will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Left sidebar: post list */}
            <div className="w-52 border-r border-gray-800 overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2.5 border-b border-gray-800">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                  Posts to Finalize
                </p>
              </div>
              {posts.map(post => {
                const isDone =
                  post.postStatus === 'approved' || post.postStatus === 'posted';
                const isActive = post.id === activePostId;
                return (
                  <button
                    key={post.id}
                    onClick={() => handleSelectPost(post)}
                    className={`w-full text-left p-3 border-b border-gray-800/40 transition-colors ${
                      isActive
                        ? 'bg-purple-900/20 border-l-2 border-l-purple-500'
                        : 'hover:bg-gray-900 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{getPostTypeEmoji(post.title)}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getPostTypeBadgeClasses(post.title)}`}
                      >
                        {getPostTypeLabel(post.title)}
                      </span>
                      {isDone && (
                        <span className="ml-auto text-green-400 text-xs">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{formatShortDate(post.date)}</p>
                    {post.caption && !isDone && (
                      <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                        {post.caption.slice(0, 30)}…
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: caption + hashtag editor */}
            {activePost ? (
              <div className="flex-1 flex flex-col p-5 overflow-y-auto">
                {/* Post header */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl">{getPostTypeEmoji(activePost.title)}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{activePost.title}</h3>
                    <p className="text-xs text-gray-400">{formatShortDate(activePost.date)}</p>
                  </div>
                  {activeIsDone && (
                    <span className="ml-auto text-xs px-2.5 py-1 bg-green-500/20 text-green-300 border border-green-500/40 rounded-full font-medium">
                      ✓ Finalized
                    </span>
                  )}
                </div>

                {/* Caption */}
                <div className="mb-4">
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 block font-medium">
                    Caption
                  </label>
                  <textarea
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    placeholder={`Write a caption for this ${getPostTypeLabel(activePost.title).toLowerCase()} post…`}
                    rows={5}
                    disabled={activeIsDone}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 block font-medium">
                    Hashtags
                  </label>
                  <input
                    value={hashtagsDraft}
                    onChange={e => setHashtagsDraft(e.target.value)}
                    placeholder="#hashtag1 #hashtag2 #hashtag3…"
                    disabled={activeIsDone}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                  />
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Tip: aim for 10–15 hashtags mixing broad and niche tags
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Footer */}
        {!isLoading && posts.length > 0 && (
          <div className="p-4 border-t border-gray-800 flex items-center gap-3">
            <button
              onClick={handleAskMark}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm font-medium transition-all"
            >
              <span>🎯</span>
              <span>Ask Mark for help</span>
            </button>
            <div className="flex-1" />
            {isFullyFinalized ? (
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                ✓ All posts finalized!
              </button>
            ) : activePost && !activeIsDone ? (
              <button
                onClick={handleFinalizePost}
                disabled={isFinalizing || !captionDraft.trim()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {isFinalizing ? 'Finalizing…' : '✓ Finalize this post'}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
              >
                Done for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
