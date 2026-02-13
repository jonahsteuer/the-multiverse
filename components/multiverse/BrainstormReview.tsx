'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { BrainstormResult, ContentFormatAssignment } from '@/types';

interface BrainstormReviewProps {
  result: BrainstormResult;
  completedByName?: string; // e.g., "Ruby"
  onApprove: () => void;
  onSendBack: (notes: string) => void;
  onClose: () => void;
}

/** Get human-readable format name */
function getFormatLabel(format: string, customName?: string): string {
  if (format === 'custom' && customName) return customName;
  switch (format) {
    case 'music_video_snippet': return 'Music Video Snippet';
    case 'bts_performance': return 'BTS Performance Shot';
    case 'visualizer': return 'Visualizer';
    default: return format;
  }
}

/** Get format emoji */
function getFormatEmoji(format: string): string {
  switch (format) {
    case 'music_video_snippet': return '🎬';
    case 'bts_performance': return '🎤';
    case 'visualizer': return '🌊';
    case 'custom': return '✨';
    default: return '📱';
  }
}

/** Get post type badge styling */
function getPostTypeBadge(type: string): { color: string; label: string } {
  switch (type) {
    case 'teaser': return { color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', label: 'Teaser' };
    case 'promo': return { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'Promo' };
    case 'audience-builder': return { color: 'bg-green-500/20 text-green-300 border-green-500/30', label: 'Audience Builder' };
    default: return { color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', label: type };
  }
}

export function BrainstormReview({
  result,
  completedByName,
  onApprove,
  onSendBack,
  onClose,
}: BrainstormReviewProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group assignments by format
  const formatGroups = new Map<string, ContentFormatAssignment[]>();
  for (const assignment of result.formatAssignments) {
    const key = assignment.format + (assignment.customFormatName || '');
    if (!formatGroups.has(key)) {
      formatGroups.set(key, []);
    }
    formatGroups.get(key)!.push(assignment);
  }

  const handleApprove = async () => {
    setIsSubmitting(true);
    await onApprove();
    setIsSubmitting(false);
  };

  const handleSendBack = async () => {
    if (!notes.trim()) return;
    setIsSubmitting(true);
    await onSendBack(notes.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-gradient-to-b from-gray-900 to-black border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💡</span>
                <h2 className="text-xl font-bold text-white">Content Plan Review</h2>
              </div>
              <p className="text-sm text-gray-400">
                {completedByName
                  ? `${completedByName} finished brainstorming content for ${result.galaxyName}`
                  : `Content plan for ${result.galaxyName}`
                }
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Format Assignments Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Post Assignments</h3>
            <div className="space-y-2">
              {result.formatAssignments.map((assignment, i) => {
                const badge = getPostTypeBadge(assignment.postType);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50"
                  >
                    <span className="text-lg">{getFormatEmoji(assignment.format)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">
                        Post {assignment.postIndex + 1}: {getFormatLabel(assignment.format, assignment.customFormatName)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(assignment.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit Days */}
          {result.editDays.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                ✂️ Edit Days ({result.editDays.length})
              </h3>
              <div className="space-y-2">
                {result.editDays.map((editDay, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <span className="text-lg">✂️</span>
                    <div className="flex-1">
                      <div className="text-sm text-white">
                        {getFormatLabel(editDay.format, editDay.customFormatName)} edit
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(editDay.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })} • Covers posts {editDay.postsCovered.map(i => i + 1).join(', ')}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{editDay.duration} min</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shoot Days */}
          {result.shootDays.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                📸 Shoot Days ({result.shootDays.length})
              </h3>
              <div className="space-y-2">
                {result.shootDays.map((shootDay, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <span className="text-lg">📸</span>
                    <div className="flex-1">
                      <div className="text-sm text-white">
                        {getFormatLabel(shootDay.format, shootDay.customFormatName)} shoot
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(shootDay.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })} • {shootDay.reason}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">{shootDay.duration} min</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revision Notes (if previously sent back) */}
          {result.revisionNotes && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="text-xs text-yellow-300 uppercase tracking-wide mb-1">Previous Notes</div>
              <div className="text-sm text-gray-300">{result.revisionNotes}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-purple-500/20 flex-shrink-0">
          {!showNotes ? (
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-medium"
              >
                {isSubmitting ? 'Approving...' : '✅ Looks Good!'}
              </Button>
              <Button
                onClick={() => setShowNotes(true)}
                variant="outline"
                className="flex-1 border-yellow-600/50 text-yellow-300 hover:bg-yellow-500/10 py-3 rounded-xl font-medium"
              >
                📝 Send Back with Notes
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">What would you like changed?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Can we swap posts 3 and 4? I think the visualizer would work better as teaser..."
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white text-sm resize-none h-24 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSendBack}
                  disabled={isSubmitting || !notes.trim()}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-xl font-medium"
                >
                  {isSubmitting ? 'Sending...' : 'Send Back for Revision'}
                </Button>
                <Button
                  onClick={() => setShowNotes(false)}
                  variant="outline"
                  className="border-gray-700 text-gray-300 py-3 rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

