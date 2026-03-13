'use client';

import { useState } from 'react';
import type { TeamTask } from '@/types';
import { completeTask } from '@/lib/team';

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

interface ReviewNotesModalProps {
  task: TeamTask;
  onClose: () => void;
  onReviewed?: () => void;
  /** Called when user clicks "View in All Posts" or "View in Footage" */
  onViewSource?: (sourceType: 'post_edit' | 'footage', sourceId: string) => void;
}

export function ReviewNotesModal({
  task,
  onClose,
  onReviewed,
  onViewSource,
}: ReviewNotesModalProps) {
  const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);

  const analysis = (task.markAnalysis || {}) as Record<string, any>;
  const sourceType = analysis.sourceType as 'post_edit' | 'footage' | undefined;
  const sourceId = analysis.sourceId as string | undefined;
  const senderName = (analysis.senderName as string) || 'Your teammate';
  const itemName = (analysis.itemName as string) || 'item';
  const note = (analysis.note as string) || task.description || '';
  const videoUrl = analysis.videoUrl as string | undefined;
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;

  async function handleMarkReviewed() {
    setIsMarkingReviewed(true);
    try {
      if (task.id && !task.id.startsWith('default-')) {
        await completeTask(task.id);
      }
      onReviewed?.();
      onClose();
    } finally {
      setIsMarkingReviewed(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-700/60 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white leading-tight">{task.title}</h2>
            <p className="text-xs text-gray-400 mt-1">Notes from {senderName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 -mr-1 -mt-1 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — side by side on md+ */}
        <div className="flex flex-col md:flex-row min-h-[240px] max-h-[60vh] overflow-hidden">
          {/* Left: Video */}
          <div className="flex-1 bg-gray-800/30 flex flex-col items-center justify-center p-5 border-b md:border-b-0 md:border-r border-gray-800">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">{itemName}</p>

            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full rounded-xl"
                height="200"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : videoUrl ? (
              <div className="text-center">
                <div className="text-3xl mb-3">🎬</div>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  View footage →
                </a>
              </div>
            ) : (
              <div className="text-center text-gray-600">
                <div className="text-3xl mb-2">📁</div>
                <p className="text-xs text-gray-500">No video preview available</p>
              </div>
            )}

            {sourceType && sourceId && onViewSource && (
              <button
                onClick={() => {
                  onClose();
                  onViewSource(sourceType, sourceId);
                }}
                className="mt-4 text-xs text-yellow-400 hover:text-yellow-300 px-3 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
              >
                View in {sourceType === 'post_edit' ? 'All Posts →' : 'Footage →'}
              </button>
            )}
          </div>

          {/* Right: Note */}
          <div className="flex-1 p-5 overflow-y-auto">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
              {senderName}'s notes
            </p>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{note}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleMarkReviewed}
            disabled={isMarkingReviewed}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {isMarkingReviewed ? 'Marking...' : '✓ Mark as reviewed'}
          </button>
        </div>
      </div>
    </div>
  );
}
