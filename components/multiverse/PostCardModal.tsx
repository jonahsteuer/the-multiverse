'use client';

import { useState, useEffect, useRef } from 'react';
import type { TeamTask, TeamMemberRecord, PostEdit } from '@/types';
import {
  getPostEdits,
  createPostEdit,
  deletePostEdit,
  updatePostCaption,
  approvePost,
} from '@/lib/team';
import { SendWithNotesModal } from './SendWithNotesModal';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getPostTypeLabel(task: TeamTask): string {
  const t = (task.type + ' ' + task.title).toLowerCase();
  if (t.includes('release')) return 'Release Day';
  if (t.includes('teaser')) return 'Teaser';
  if (t.includes('promo')) return 'Promo';
  if (t.includes('audience')) return 'Audience Builder';
  return 'Post';
}

function getPostTypeColor(task: TeamTask): string {
  const t = (task.type + ' ' + task.title).toLowerCase();
  if (t.includes('release')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (t.includes('teaser')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (t.includes('promo')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (t.includes('audience')) return 'bg-green-500/20 text-green-300 border-green-500/40';
  return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
}

function getPostStatusInfo(status: string): { label: string; color: string } {
  switch (status) {
    case 'linked': return { label: 'Linked', color: 'text-blue-400' };
    case 'analyzed': return { label: 'Analyzed', color: 'text-indigo-400' };
    case 'caption_written': return { label: 'Caption Ready', color: 'text-teal-400' };
    case 'revision_requested': return { label: 'Needs Revision', color: 'text-orange-400' };
    case 'scheduled': return { label: 'Scheduled', color: 'text-cyan-400' };
    case 'approved': return { label: '✓ Approved', color: 'text-green-400' };
    case 'posted': return { label: '✓ Posted', color: 'text-gray-400' };
    default: return { label: 'Pending', color: 'text-gray-500' };
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface PostCardModalProps {
  task: TeamTask;
  teamId: string;
  /** Real Supabase galaxy UUID — overrides task.galaxyId when provided */
  galaxyId?: string;
  teamMembers: TeamMemberRecord[];
  currentUserId?: string | null;
  currentUserName?: string;
  onClose: () => void;
  onUpdated?: () => void;
  onAskMark?: (context: string) => void;
  /** z-index class override (default: z-[60]) */
  zIndexClass?: string;
}

/** Returns true only if str looks like a Postgres UUID */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function PostCardModal({
  task,
  teamId,
  galaxyId: galaxyIdProp,
  teamMembers,
  currentUserId,
  currentUserName = 'You',
  onClose,
  onUpdated,
  onAskMark,
  zIndexClass = 'z-[60]',
}: PostCardModalProps) {
  const [edits, setEdits] = useState<PostEdit[]>([]);
  const [isLoadingEdits, setIsLoadingEdits] = useState(true);
  const [caption, setCaption] = useState(task.caption || '');
  const [hashtags, setHashtags] = useState(task.hashtags || '');
  const [newEditUrl, setNewEditUrl] = useState('');
  const [newEditDesc, setNewEditDesc] = useState('');
  const [isUploadingEdit, setIsUploadingEdit] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [captionSaved, setCaptionSaved] = useState(false);
  const [openMenuEditId, setOpenMenuEditId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(
    (task as any).postStatus || (task as any).post_status || 'pending'
  );
  const [sendNotesTarget, setSendNotesTarget] = useState<{
    editName: string;
    sourceType: 'post_edit';
    sourceId: string;
    editUrl?: string;
  } | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingVersionName, setEditingVersionName] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEdits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuEditId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuEditId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuEditId]);

  async function loadEdits() {
    setIsLoadingEdits(true);
    try {
      const loaded = await getPostEdits(task.id);
      setEdits(loaded);
    } finally {
      setIsLoadingEdits(false);
    }
  }

  async function handleUploadEdit() {
    if (!newEditUrl.trim()) { setUploadError('URL is required.'); return; }
    const effectiveTeamId = task.teamId || teamId;
    if (!effectiveTeamId) { setUploadError('Team not loaded. Please try again.'); return; }
    // Prefer the explicit prop; fall back to task field only if it's a real UUID
    const rawGalaxyId = galaxyIdProp || task.galaxyId || '';
    const effectiveGalaxyId = isValidUUID(rawGalaxyId) ? rawGalaxyId : null;
    setIsUploadingEdit(true);
    setUploadError('');
    try {
      const versionNumber = edits.length + 1;
      const edit = await createPostEdit(
        effectiveTeamId,
        effectiveGalaxyId,
        task.id,
        newEditUrl.trim(),
        currentUserName,
        versionNumber > 1 ? (newEditDesc.trim() || undefined) : undefined,
        versionNumber,
      );
      if (edit) {
        setEdits(prev => [...prev, edit]);
        setNewEditUrl('');
        setNewEditDesc('');
        setShowUploadForm(false);
        if (currentStatus === 'pending' || currentStatus === 'unlinked') {
          setCurrentStatus('linked');
        }
        onUpdated?.();
      } else {
        setUploadError('Failed to save — check console for details.');
      }
    } catch (err) {
      console.error('[PostCardModal] handleUploadEdit error:', err);
      setUploadError('Failed to save. Try again.');
    } finally {
      setIsUploadingEdit(false);
    }
  }

  async function handleDeleteEdit(editId: string) {
    if (!confirm('Remove this edit version?')) return;
    await deletePostEdit(editId);
    setEdits(prev => prev.filter(e => e.id !== editId));
    onUpdated?.();
  }

  async function handleSaveCaption() {
    setIsSavingCaption(true);
    try {
      await updatePostCaption(task.id, caption, hashtags);
      setCurrentStatus('caption_written');
      setCaptionSaved(true);
      setTimeout(() => setCaptionSaved(false), 2500);
      onUpdated?.();
    } finally {
      setIsSavingCaption(false);
    }
  }

  async function handleFinalize() {
    await approvePost(task.id);
    setCurrentStatus('approved');
    onUpdated?.();
  }

  async function handleRenameVersion(editId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) { setEditingVersionId(null); return; }
    setEdits(prev => prev.map(e => e.id === editId ? { ...e, uploaderName: trimmed } : e));
    setEditingVersionId(null);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('post_edits').update({ uploader_name: trimmed }).eq('id', editId);
    } catch (err) {
      console.warn('[PostCardModal] rename failed:', err);
    }
  }

  const typeLabel = getPostTypeLabel(task);
  const typeColor = getPostTypeColor(task);
  const statusInfo = getPostStatusInfo(currentStatus);
  const recipientMembers = teamMembers.filter(m => m.userId !== currentUserId);
  const isFinalized = currentStatus === 'approved' || currentStatus === 'posted';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 ${zIndexClass} flex items-center justify-center p-4`}
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl bg-gray-900 border border-gray-700/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-gray-800 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
              <h2 className="text-lg font-semibold text-white leading-tight">{task.title}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{formatDate(task.date)}</p>
              {task.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
              )}
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

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">

            {/* Edit Versions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Edit Versions</h3>
                {!showUploadForm && (
                  <button
                    onClick={() => setShowUploadForm(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    + Upload version
                  </button>
                )}
              </div>

              {isLoadingEdits ? (
                <div className="text-center py-6 text-gray-600 text-xs">Loading edits...</div>
              ) : edits.length === 0 && !showUploadForm ? (
                <div className="text-center py-6 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                  <div className="text-2xl mb-2">🎬</div>
                  <p className="text-sm text-gray-400">No edits uploaded yet</p>
                  <p className="text-xs text-gray-600 mt-0.5">Upload the first version to get started</p>
                  <button
                    onClick={() => setShowUploadForm(true)}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    Upload version 1
                  </button>
                </div>
              ) : (
                <div className="space-y-2" ref={menuRef}>
                  {edits.map(edit => (
                    <div
                      key={edit.id}
                      className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50"
                    >
                      {/* Version badge */}
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-300">v{edit.versionNumber}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {editingVersionId === edit.id ? (
                            <input
                              autoFocus
                              value={editingVersionName}
                              onChange={e => setEditingVersionName(e.target.value)}
                              onBlur={() => handleRenameVersion(edit.id, editingVersionName)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameVersion(edit.id, editingVersionName);
                                if (e.key === 'Escape') setEditingVersionId(null);
                              }}
                              className="bg-gray-700 border border-blue-500/50 rounded px-2 py-0.5 text-xs font-medium text-white focus:outline-none w-36"
                            />
                          ) : (
                            <span
                              className="text-xs font-medium text-white cursor-text hover:text-blue-300 transition-colors"
                              title="Click to rename"
                              onClick={() => { setEditingVersionId(edit.id); setEditingVersionName(edit.uploaderName); }}
                            >
                              {edit.uploaderName}
                            </span>
                          )}
                          <span className="text-xs text-gray-600">·</span>
                          <span className="text-xs text-gray-500">{formatDateTime(edit.createdAt)}</span>
                          {edit.versionNumber === edits.length && edits.length > 1 && (
                            <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                              latest
                            </span>
                          )}
                        </div>
                        {edit.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{edit.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={edit.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                        >
                          View
                        </a>

                        {/* ⋯ menu */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuEditId(openMenuEditId === edit.id ? null : edit.id)}
                            className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {openMenuEditId === edit.id && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                              <button
                                onClick={() => {
                                  setOpenMenuEditId(null);
                                  if (recipientMembers.length === 0) {
                                    alert('Invite a team member first — use the "Invite team members" task on your todo list.');
                                    return;
                                  }
                                  setSendNotesTarget({
                                    editName: `${typeLabel} v${edit.versionNumber}`,
                                    sourceType: 'post_edit',
                                    sourceId: task.id,
                                    editUrl: edit.videoUrl,
                                  });
                                }}
                                className={`w-full text-left text-sm px-3 py-2.5 flex items-center gap-2 transition-colors ${
                                  recipientMembers.length > 0
                                    ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    : 'text-gray-500 cursor-default'
                                }`}
                              >
                                <span>📤</span>
                                <span>Send with notes</span>
                                {recipientMembers.length === 0 && (
                                  <span className="ml-auto text-[10px] text-gray-600">no teammates</span>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuEditId(null);
                                  handleDeleteEdit(edit.id);
                                }}
                                className="w-full text-left text-sm px-3 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                              >
                                <span>🗑️</span> Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload form */}
              {showUploadForm && (
                <div className="mt-3 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 space-y-3">
                  <p className="text-sm font-medium text-white">
                    Upload Version {edits.length + 1}
                  </p>
                  <input
                    type="url"
                    placeholder="Paste Google Drive, YouTube, or Dropbox link"
                    value={newEditUrl}
                    onChange={e => setNewEditUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUploadEdit()}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                  {edits.length > 0 && (
                    <input
                      type="text"
                      placeholder="What changed in this version? (optional)"
                      value={newEditDesc}
                      onChange={e => setNewEditDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                  )}
                  {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleUploadEdit}
                      disabled={isUploadingEdit}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {isUploadingEdit ? 'Saving...' : 'Save version'}
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadForm(false);
                        setUploadError('');
                        setNewEditUrl('');
                        setNewEditDesc('');
                      }}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Caption & Hashtags */}
            <div className="border-t border-gray-800 pt-5 space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Caption & Hashtags</h3>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write your caption here..."
                rows={3}
                className="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
              />
              <input
                type="text"
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                placeholder="#hashtag1 #hashtag2 #hashtag3"
                className="w-full px-3 py-2.5 bg-gray-800/60 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveCaption}
                  disabled={isSavingCaption}
                  className="text-xs px-4 py-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50"
                >
                  {captionSaved ? '✓ Saved' : isSavingCaption ? 'Saving...' : 'Save caption'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-800 bg-gray-950/50 flex-shrink-0 gap-3">
            <button
              onClick={() => {
                onAskMark?.(
                  `I need help with my ${typeLabel.toLowerCase()} post scheduled for ${formatDate(task.date)}. ` +
                  `It has ${edits.length} edit version${edits.length !== 1 ? 's' : ''} uploaded. ` +
                  `Current status: ${statusInfo.label}.`
                );
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-sm font-medium rounded-xl transition-colors"
            >
              🎤 Ask Mark for help
            </button>

            {isFinalized ? (
              <span className={`text-sm font-medium ${statusInfo.color}`}>
                {currentStatus === 'posted' ? '✓ Posted' : '✓ Approved'}
              </span>
            ) : (
              <button
                onClick={handleFinalize}
                disabled={edits.length === 0}
                title={edits.length === 0 ? 'Upload at least one edit version to finalize' : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700/60 disabled:text-gray-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {edits.length === 0 ? '⟳ Upload edit first' : '✓ Finalize post'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Send with notes modal */}
      {sendNotesTarget && (
        <SendWithNotesModal
          teamId={teamId}
          galaxyId={task.galaxyId || ''}
          itemName={sendNotesTarget.editName}
          sourceType={sendNotesTarget.sourceType}
          sourceId={sendNotesTarget.sourceId}
          editUrl={sendNotesTarget.editUrl}
          senderName={currentUserName}
          senderUserId={currentUserId || undefined}
          teamMembers={recipientMembers}
          onClose={() => setSendNotesTarget(null)}
          onSent={() => setSendNotesTarget(null)}
          zIndexClass="z-[70]"
        />
      )}
    </>
  );
}
