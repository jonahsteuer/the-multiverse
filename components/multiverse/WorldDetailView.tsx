'use client';

import { useState, useEffect } from 'react';
import type { World, Universe, ArtistProfile, TeamTask, TeamMemberRecord, BrainstormResult } from '@/types';
import { ReminderSettingsComponent } from './ReminderSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveWorld } from '@/lib/storage';
import { deleteTask, getPostEvents } from '@/lib/team';
import { supabase } from '@/lib/supabase';
import { PostCardModal } from './PostCardModal';
import { SendWithNotesModal } from './SendWithNotesModal';
import { SoundbytePicker } from './SoundbytePicker';
import type { SoundbyteDef } from './SoundbytePicker';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

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

// ─────────────────────────────────────────────
// Snapshot Starter tab
// ─────────────────────────────────────────────

function SnapshotStarterTab({
  galaxyId,
  brainstormResult,
  onStartBrainstorm,
  songEmotion,
  listeningContext,
}: {
  galaxyId: string;
  brainstormResult?: BrainstormResult | null;
  onStartBrainstorm?: (mode?: 'mark_generates' | 'user_idea', songCtx?: { songEmotion?: string; listeningContext?: string }, resume?: boolean) => void;
  songEmotion?: string;
  listeningContext?: string;
}) {
  const [pastResult, setPastResult] = useState<BrainstormResult | null>(brainstormResult ?? null);
  const [isLoading, setIsLoading] = useState(!brainstormResult);
  const [draftInfo, setDraftInfo] = useState<{ step: string; confirmedLocation?: string; scenesLocked?: number } | null>(null);

  useEffect(() => {
    if (brainstormResult) {
      setPastResult(brainstormResult);
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        // Fetch brainstorm_result first (safe, always exists)
        const { data: resultData } = await supabase
          .from('galaxies')
          .select('brainstorm_result')
          .eq('id', galaxyId)
          .single();
        if (resultData?.brainstorm_result) setPastResult(resultData.brainstorm_result as BrainstormResult);
        // C: try fetching brainstorm_draft separately — column may not exist yet
        try {
          const { data: draftData } = await supabase
            .from('galaxies')
            .select('brainstorm_draft')
            .eq('id', galaxyId)
            .single();
          const draft = draftData?.brainstorm_draft as any;
          if (draft?.step) {
            setDraftInfo({
              step: draft.step,
              confirmedLocation: draft.confirmedLocation || undefined,
              scenesLocked: Array.isArray(draft.allLikedIdeas) ? draft.allLikedIdeas.length : 0,
            });
          }
        } catch { /* brainstorm_draft column not yet created — safe to ignore */ }
      } catch {
        // no-op
      } finally {
        setIsLoading(false);
      }
    })();
  }, [galaxyId, brainstormResult]);

  return (
    <div className="space-y-5">
      {/* C: Resume banner — shown when an in-progress draft exists */}
      {draftInfo && (
        <div className="rounded-2xl border border-purple-500/40 bg-purple-900/20 p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-300">Resume your brainstorm session</p>
            <p className="text-xs text-gray-400 mt-1">
              {draftInfo.confirmedLocation && <span>📍 {draftInfo.confirmedLocation} · </span>}
              {(draftInfo.scenesLocked ?? 0) > 0
                ? `${draftInfo.scenesLocked} scene${draftInfo.scenesLocked !== 1 ? 's' : ''} locked in`
                : 'Location selected, scenes pending'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onStartBrainstorm?.('mark_generates', { songEmotion, listeningContext }, true)}
              className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              Resume →
            </button>
            <button
              onClick={async () => {
                setDraftInfo(null);
                await supabase.from('galaxies').update({ brainstorm_draft: null }).eq('id', galaxyId);
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-xl transition-colors"
            >
              Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Entry point buttons */}
      <div className="space-y-3">
        {/* I Have an Idea — user-led */}
        <button
          onClick={() => onStartBrainstorm?.('user_idea', { songEmotion, listeningContext })}
          className="w-full p-5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 hover:border-emerald-500/70 rounded-2xl transition-all text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/30 flex items-center justify-center text-2xl group-hover:bg-emerald-600/50 transition-colors flex-shrink-0">
              💡
            </div>
            <div>
              <p className="text-base font-semibold text-white">I Have an Idea</p>
              <p className="text-sm text-gray-400 mt-0.5">
                Pitch your concept — Mark will refine it, suggest variations, and schedule it
              </p>
            </div>
            <span className="ml-auto text-emerald-400 text-xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        {/* Give Me Ideas — Mark-led */}
        <button
          onClick={() => onStartBrainstorm?.('mark_generates', { songEmotion, listeningContext })}
          className="w-full p-5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 hover:border-purple-500/70 rounded-2xl transition-all text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center text-2xl group-hover:bg-purple-600/50 transition-colors flex-shrink-0">
              🧠
            </div>
            <div>
              <p className="text-base font-semibold text-white">Give Me Ideas</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {pastResult
                  ? 'Generate fresh ideas and build your next content batch'
                  : 'Work with Mark to brainstorm ideas and schedule your content'}
              </p>
            </div>
            <span className="ml-auto text-purple-400 text-xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>
      </div>

      {/* Past session summary */}
      {isLoading ? (
        <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
      ) : pastResult ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Last session</p>
          <div className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {pastResult.formatAssignments.length} posts planned
              </span>
              <span className="text-xs text-gray-500">
                {new Date(pastResult.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Idea chips */}
            <div className="flex flex-wrap gap-1.5">
              {pastResult.formatAssignments.slice(0, 6).map((a, i) => (
                <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  {a.ideaTitle || a.customFormatName || `Post ${i + 1}`}
                </span>
              ))}
              {pastResult.formatAssignments.length > 6 && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-700/50 border border-gray-600/50 text-gray-400">
                  +{pastResult.formatAssignments.length - 6} more
                </span>
              )}
            </div>

            {/* Schedule summary */}
            <div className="grid grid-cols-2 gap-2">
              {pastResult.editDays.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>✂️</span>
                  <span>{pastResult.editDays.length} edit day{pastResult.editDays.length > 1 ? 's' : ''} scheduled</span>
                </div>
              )}
              {pastResult.shootDays.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>📸</span>
                  <span>Shoot: {new Date(pastResult.shootDays[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
              {pastResult.trialReels && pastResult.trialReels.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>🎬</span>
                  <span>{pastResult.trialReels.length} trial reel{pastResult.trialReels.length > 1 ? 's' : ''} scheduled</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-600">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-sm text-gray-500">No content plans yet for this release</p>
          <p className="text-xs text-gray-600 mt-1">Hit the button above to start brainstorming</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface WorldDetailViewProps {
  world: World;
  universe: Universe;
  artistProfile?: ArtistProfile;
  teamId?: string;
  teamTasks?: TeamTask[];
  teamMembers?: TeamMemberRecord[];
  currentUserId?: string | null;
  currentUserName?: string;
  onClose: () => void;
  onUpdate?: (world: World) => void;
  onDelete?: (worldId: string) => void;
  onAskMark?: (context: string) => void;
  onRefreshTasks?: () => void;
  onStartBrainstorm?: (mode?: 'mark_generates' | 'user_idea', songCtx?: { songEmotion?: string; listeningContext?: string }, resume?: boolean) => void;
  brainstormResult?: BrainstormResult | null;
  initialTab?: 'footage' | 'all-posts' | 'snapshot-starter' | 'song-data' | 'settings';
}

// ─────────────────────────────────────────────
// Footage tab
// ─────────────────────────────────────────────

interface FootageItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  uploadedAt: string;
}

function FootageTab({
  teamId,
  galaxyId,
  teamMembers = [],
  currentUserId,
  currentUserName = 'You',
}: {
  teamId: string;
  galaxyId: string;
  teamMembers?: TeamMemberRecord[];
  currentUserId?: string | null;
  currentUserName?: string;
}) {
  const [items, setItems] = useState<FootageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sendNotesTarget, setSendNotesTarget] = useState<{
    itemId: string;
    itemName: string;
    sourceId: string;
  } | null>(null);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, galaxyId]);

  async function resolveTeamId(): Promise<string> {
    if (teamId) return teamId;
    // Fallback: find team_id from an existing task for this galaxy
    const { data } = await supabase
      .from('team_tasks')
      .select('team_id')
      .eq('galaxy_id', galaxyId)
      .limit(1)
      .single();
    return data?.team_id || '';
  }

  async function load() {
    setIsLoading(true);
    try {
      const effectiveTeamId = await resolveTeamId();
      if (!effectiveTeamId) { setIsLoading(false); return; }

      const { data } = await supabase
        .from('team_tasks')
        .select('*')
        .eq('team_id', effectiveTeamId)
        .eq('galaxy_id', galaxyId)
        .eq('task_category', 'footage')
        .order('created_at', { ascending: false });

      setItems((data || []).map((r: any) => ({
        id: r.id,
        name: r.title,
        url: r.video_url || '',
        description: r.description || '',
        uploadedAt: r.created_at,
      })));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !newUrl.trim()) { setError('Name and URL are required.'); return; }
    setIsSaving(true);
    setError('');
    try {
      const effectiveTeamId = await resolveTeamId();
      if (!effectiveTeamId) {
        setError('Team not set up yet. Please try again in a moment.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from('team_tasks').insert({
        team_id: effectiveTeamId,
        galaxy_id: galaxyId,
        title: newName.trim(),
        description: newDesc.trim() || `Raw footage: ${newName.trim()}`,
        type: 'prep',
        task_category: 'footage',
        date: new Date().toISOString().split('T')[0],
        start_time: '00:00',
        end_time: '00:00',
        video_url: newUrl.trim(),
        assigned_by: user?.id || null,
        status: 'pending',
      });
      if (insertErr) {
        console.error('[FootageTab] Supabase insert error:', insertErr);
        throw insertErr;
      }
      setNewName(''); setNewUrl(''); setNewDesc(''); setIsAdding(false);
      await load();
    } catch (err) {
      console.error('[FootageTab] handleAdd error:', err);
      setError('Failed to save. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this footage item?')) return;
    await deleteTask(id);
    setItems(prev => prev.filter(f => f.id !== id));
  }

  async function handleRename(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setItems(prev => prev.map(f => f.id === id ? { ...f, name: trimmed } : f));
    setEditingId(null);
    try {
      await supabase.from('team_tasks').update({ title: trimmed }).eq('id', id);
    } catch { /* non-blocking */ }
  }

  const recipientMembers = teamMembers.filter(m => m.userId !== currentUserId);
  const effectiveTeamId = teamId;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Upload raw footage here so your entire team can access and edit it.
        Links from Google Drive, Dropbox, or YouTube are supported.
      </p>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Loading footage...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm">No footage uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <div className="w-12 h-10 bg-gray-700 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                🎥
              </div>
              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => handleRename(item.id, editingName)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(item.id, editingName);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full bg-gray-700 border border-blue-500/50 rounded px-2 py-0.5 text-sm font-medium text-white focus:outline-none"
                  />
                ) : (
                  <p
                    className="text-sm font-medium text-white truncate cursor-text hover:text-blue-300 transition-colors"
                    title="Click to rename"
                    onClick={() => { setEditingId(item.id); setEditingName(item.name); }}
                  >
                    {item.name}
                  </p>
                )}
                {item.description && !editingId && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
                <p className="text-xs text-gray-600 mt-0.5">{formatDateTime(item.uploadedAt)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                  View
                </a>

                {/* ⋯ menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                    className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                  {openMenuId === item.id && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                      <button
                        onClick={() => {
                          setOpenMenuId(null);
                          if (recipientMembers.length === 0) {
                            alert('Invite a team member first — use the "Invite team members" task on your todo list.');
                            return;
                          }
                          setSendNotesTarget({ itemId: item.id, itemName: item.name, sourceId: item.id });
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
                        onClick={() => { setOpenMenuId(null); handleDelete(item.id); }}
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

      {isAdding ? (
        <div className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 space-y-3">
          <p className="text-sm font-medium text-white">Add footage</p>
          <input type="text" placeholder="Name (e.g. Visualizer raw footage)" value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          <input type="url" placeholder="Paste Google Drive, Dropbox, or YouTube link" value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          <input type="text" placeholder="Notes (optional)" value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={isSaving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors">
              {isSaving ? 'Saving...' : 'Save footage'}
            </button>
            <button onClick={() => { setIsAdding(false); setError(''); }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)}
          className="w-full py-2.5 border border-dashed border-gray-600 hover:border-blue-500/50 text-gray-400 hover:text-blue-400 text-sm rounded-xl transition-colors">
          + Add footage link
        </button>
      )}

      {/* Close menu on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenuId(null)} />
      )}

      {/* Send with notes modal */}
      {sendNotesTarget && effectiveTeamId && (
        <SendWithNotesModal
          teamId={effectiveTeamId}
          galaxyId={galaxyId}
          itemName={sendNotesTarget.itemName}
          sourceType="footage"
          sourceId={sendNotesTarget.sourceId}
          senderName={currentUserName}
          teamMembers={recipientMembers}
          onClose={() => setSendNotesTarget(null)}
          onSent={() => setSendNotesTarget(null)}
          zIndexClass="z-[80]"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// All Posts tab (M: rollout zones, soundbyte tags, sort/filter)
// ─────────────────────────────────────────────

type PostSortKey = 'date' | 'zone' | 'status' | 'soundbyte';

function getRolloutZoneBadge(zone?: string) {
  if (!zone) return null;
  const cfg = {
    'pre-release':  { label: 'Pre-Release', cls: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' },
    'release-week': { label: 'Release Week', cls: 'bg-purple-500/15 border-purple-500/40 text-purple-300' },
    'post-release': { label: 'Post-Release', cls: 'bg-blue-500/15 border-blue-500/40 text-blue-300' },
  } as Record<string, { label: string; cls: string }>;
  const c = cfg[zone];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${c.cls}`}>
      {c.label}
    </span>
  );
}

function AllPostsTab({
  teamId,
  teamMembers,
  galaxyId,
  currentUserId,
  currentUserName,
  onAskMark,
  onRefreshTasks,
  releaseDate,
}: {
  teamId: string;
  teamMembers: TeamMemberRecord[];
  galaxyId: string;
  currentUserId?: string | null;
  currentUserName?: string;
  onAskMark?: (context: string) => void;
  onRefreshTasks?: () => void;
  releaseDate?: string;
}) {
  const [selectedPost, setSelectedPost] = useState<TeamTask | null>(null);
  const [postTasks, setPostTasks] = useState<TeamTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<PostSortKey>('date');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!teamId || !galaxyId) return;
    setIsLoading(true);
    getPostEvents(teamId, galaxyId)
      .then(posts => setPostTasks(posts))
      .catch(() => setPostTasks([]))
      .finally(() => setIsLoading(false));
  }, [teamId, galaxyId]);

  // Derive rollout zone from release date when not stored
  const getZone = (task: TeamTask): string => {
    const ext = task as any;
    if (ext.rolloutZone || ext.rollout_zone) return ext.rolloutZone || ext.rollout_zone;
    if (!releaseDate || !task.date) return '';
    const postD = new Date(task.date);
    const relD = new Date(releaseDate);
    const diff = (postD.getTime() - relD.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < -1) return 'pre-release';
    if (diff <= 7) return 'release-week';
    return 'post-release';
  };

  const getSoundbyte = (task: TeamTask): string | undefined => {
    const ext = task as any;
    return ext.soundbyte || ext.soundbyte_tag;
  };

  const sortedFiltered = [...postTasks]
    .filter(t => filterZone === 'all' || getZone(t) === filterZone)
    .filter(t => {
      if (filterStatus === 'all') return true;
      const status = (t as any).postStatus || (t as any).post_status || 'unlinked';
      return status === filterStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return a.date.localeCompare(b.date);
      if (sortBy === 'zone') {
        const order = ['pre-release', 'release-week', 'post-release', ''];
        return order.indexOf(getZone(a)) - order.indexOf(getZone(b));
      }
      if (sortBy === 'status') {
        const sa = (a as any).postStatus || 'unlinked';
        const sb = (b as any).postStatus || 'unlinked';
        return sa.localeCompare(sb);
      }
      if (sortBy === 'soundbyte') {
        const sa = getSoundbyte(a) || '';
        const sb = getSoundbyte(b) || '';
        return sa.localeCompare(sb);
      }
      return 0;
    });

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500 text-sm">Loading posts...</div>;
  }

  if (postTasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <div className="text-4xl mb-3">📬</div>
        <p className="text-sm text-gray-400 mb-1">No scheduled posts yet</p>
        <p className="text-xs text-gray-600">Open the Calendar to generate your posting schedule.</p>
      </div>
    );
  }

  return (
    <>
      {/* Sort + Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Sort</span>
          {(['date', 'zone', 'status', 'soundbyte'] as PostSortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                sortBy === key ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap ml-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Zone</span>
          {(['all', 'pre-release', 'release-week', 'post-release'] as const).map(z => (
            <button
              key={z}
              onClick={() => setFilterZone(z)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                filterZone === z ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {z === 'all' ? 'All' : z.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap ml-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Status</span>
          {(['all', 'unlinked', 'linked', 'caption_written', 'approved', 'posted'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                filterStatus === s ? 'bg-green-600/20 border-green-500/50 text-green-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[10px] text-gray-600 self-center">
          {sortedFiltered.length} of {postTasks.length} posts
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[52vh] overflow-y-auto pr-1">
        {sortedFiltered.map(task => {
          const ext = task as any;
          const status = ext.postStatus || ext.post_status || 'unlinked';
          const statusInfo = getPostStatusInfo(status);
          const typeColor = getPostTypeColor(task);
          const typeLabel = getPostTypeLabel(task);
          const hasVideo = !!ext.videoUrl || !!ext.video_url;
          const zone = getZone(task);
          const soundbyte = getSoundbyte(task);

          return (
            <button
              key={task.id}
              onClick={() => setSelectedPost(task)}
              className="relative rounded-xl border border-gray-700/60 bg-gray-800/40 hover:bg-gray-800/80 hover:border-blue-500/40 p-3 transition-all cursor-pointer text-left group"
            >
              {/* Thumbnail */}
              <div className={`w-full h-16 rounded-lg mb-2 flex items-center justify-center text-2xl transition-colors ${
                hasVideo ? 'bg-gray-700 group-hover:bg-gray-600' : 'bg-gray-800 border border-dashed border-gray-600'
              }`}>
                {hasVideo ? '🎬' : '📷'}
              </div>

              {/* Type + Rollout badges */}
              <div className="flex flex-wrap gap-1 mb-1">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${typeColor}`}>
                  {typeLabel}
                </span>
                {getRolloutZoneBadge(zone)}
              </div>

              {/* Date */}
              <p className="text-xs text-gray-300 font-medium">{formatDate(task.date)}</p>

              {/* Status */}
              <p className={`text-[10px] mt-0.5 ${statusInfo.color}`}>{statusInfo.label}</p>

              {/* Soundbyte tag */}
              {soundbyte && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] border border-orange-500/30 bg-orange-500/10 text-orange-300 mt-1">
                  🎵 {soundbyte}
                </span>
              )}

              {/* Caption preview */}
              {ext.caption ? (
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{ext.caption}</p>
              ) : (
                <p className="text-[10px] text-gray-600 mt-1 italic group-hover:text-blue-500/50 transition-colors">
                  tap to add content
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* PostCardModal opened from this tab */}
      {selectedPost && (
        <PostCardModal
          task={selectedPost}
          teamId={teamId}
          galaxyId={galaxyId}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setSelectedPost(null)}
          onUpdated={() => {
            setSelectedPost(null);
            onRefreshTasks?.();
          }}
          onAskMark={onAskMark}
          zIndexClass="z-[70]"
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// F15: Track/Song Upload Section
// ─────────────────────────────────────────────

function TrackSection({ world, onUpdate }: { world: World; onUpdate: (w: World) => void }) {
  const [trackUrl, setTrackUrl] = useState((world as any).trackUrl || '');
  const [trackSource, setTrackSource] = useState<'url' | 'file'>('url');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // Song structure — estimated sections
  const defaultStructure = (world as any).songStructure || {
    intro: '0:00–0:14',
    verse1: '0:14–0:28',
    preChorus: '0:28–0:40',
    chorus: '0:40–1:04',
    verse2: '1:04–1:20',
    bridge: '1:20–1:40',
    outroChorus: '1:40–2:00',
  };
  const [structure, setStructure] = useState<Record<string, string>>(defaultStructure);

  const handleFileSave = async () => {
    setUploading(true);
    try {
      const updated = { ...world, trackUrl, songStructure: structure } as World;
      await saveWorld(updated, updated.galaxyId);
      onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[TrackSection] Save error:', err);
    } finally {
      setUploading(false);
    }
  };

  const sectionLabels: [string, string][] = [
    ['intro', 'Intro'],
    ['verse1', 'Verse 1'],
    ['preChorus', 'Pre-Chorus'],
    ['chorus', 'Chorus'],
    ['verse2', 'Verse 2'],
    ['bridge', 'Bridge'],
    ['outroChorus', 'Outro/Chorus'],
  ];

  return (
    <Card className="border-yellow-500/30 bg-black/50">
      <CardHeader>
        <CardTitle className="text-base font-star-wars text-yellow-400">🎵 Track</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-400">Upload your track so Mark can play each soundbyte section during content planning.</p>

        {/* Source toggle */}
        <div className="flex gap-2">
          {(['url', 'file'] as const).map(s => (
            <button
              key={s}
              onClick={() => setTrackSource(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                trackSource === s
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {s === 'url' ? '🔗 Link (SoundCloud / Drive)' : '📂 Upload File'}
            </button>
          ))}
        </div>

        {trackSource === 'url' ? (
          <input
            type="url"
            placeholder="Paste SoundCloud, Dropbox, or Google Drive link..."
            value={trackUrl}
            onChange={e => setTrackUrl(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500/50"
          />
        ) : (
          <label className="block w-full border-2 border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-yellow-500/40 transition-colors">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // For now, create object URL for in-browser playback
                const url = URL.createObjectURL(file);
                setTrackUrl(url);
              }}
            />
            <p className="text-sm text-gray-400">Drop your MP3 here or <span className="text-yellow-400">browse</span></p>
            <p className="text-xs text-gray-600 mt-1">MP3, WAV, AAC supported</p>
          </label>
        )}

        {/* Playback preview */}
        {trackUrl && (
          <div className="flex items-center gap-2 p-2 bg-gray-900/60 rounded-lg">
            <button
              onClick={() => {
                if (!audioRef) {
                  const a = new Audio(trackUrl);
                  a.play();
                  setAudioRef(a);
                } else {
                  audioRef.paused ? audioRef.play() : audioRef.pause();
                }
              }}
              className="w-8 h-8 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 flex items-center justify-center text-yellow-400 transition-all text-xs"
            >
              ▶
            </button>
            <span className="text-xs text-gray-400 truncate flex-1">{trackUrl.startsWith('blob:') ? 'Uploaded file' : trackUrl}</span>
          </div>
        )}

        {/* Song Structure Editor */}
        <div>
          <p className="text-xs font-medium text-gray-300 mb-2">Song Structure (adjust timestamps to match your track)</p>
          <div className="grid grid-cols-2 gap-2">
            {sectionLabels.map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</span>
                <input
                  type="text"
                  value={structure[key] || ''}
                  onChange={e => setStructure(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder="0:00–0:14"
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-yellow-500/50"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleFileSave}
          disabled={uploading || !trackUrl}
          className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 text-sm font-medium transition-all disabled:opacity-50"
        >
          {uploading ? 'Saving...' : saved ? '✓ Saved!' : 'Save Track + Structure'}
        </button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Song Data Tab
// ─────────────────────────────────────────────

function SongDataTab({ world, onUpdate }: { world: World; onUpdate: (w: World) => void }) {
  const [songEmotion, setSongEmotion] = useState(world.songEmotion || '');
  const [listeningContext, setListeningContext] = useState(world.listeningContext || '');
  const [lyrics, setLyrics] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [soundbytes, setSoundbytes] = useState<SoundbyteDef[] | null>(null);
  const [lyricsSegments, setLyricsSegments] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [trackInputMode, setTrackInputMode] = useState<'url' | 'file'>('url');
  const [trackUrlInput, setTrackUrlInput] = useState('');
  const [isSavingTrack, setIsSavingTrack] = useState(false);

  // Load lyrics, track URL, and soundbytes from galaxy/world records
  useEffect(() => {
    async function load() {
      // Lyrics + track_url stored on galaxies row
      const { data: gal } = await supabase
        .from('galaxies')
        .select('lyrics, track_url, lyrics_segments, brainstorm_draft')
        .eq('id', world.galaxyId)
        .single();
      if (gal) {
        setLyrics(gal.lyrics || '');
        setTrackUrl(gal.track_url || '');
        if (gal.lyrics_segments) setLyricsSegments(gal.lyrics_segments);
        // Load saved soundbytes from brainstorm_draft if present
        const draft = gal.brainstorm_draft as any;
        if (draft?.confirmedSoundbytes?.length) {
          setSoundbytes(draft.confirmedSoundbytes.map((sb: any) => ({
            id: sb.id,
            label: sb.section || sb.label || `Section`,
            startSec: parseTimeToSec(sb.timeRange?.split('–')[0] || '0:00'),
            endSec: parseTimeToSec(sb.timeRange?.split('–')[1] || '0:30'),
          })));
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.id, world.galaxyId]);

  function parseTimeToSec(t: string): number {
    const [m, s] = (t || '0:00').split(':').map(Number);
    return (m || 0) * 60 + (s || 0);
  }

  function markSaved(key: string) {
    setSavedSections(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setSavedSections(prev => ({ ...prev, [key]: false })), 2000);
  }

  async function saveSongMeta() {
    setSaving(true);
    try {
      await supabase.from('worlds').update({ song_emotion: songEmotion, listening_context: listeningContext }).eq('id', world.id);
      onUpdate({ ...world, songEmotion, listeningContext });
      markSaved('meta');
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function saveLyrics() {
    setSaving(true);
    try {
      await supabase.from('galaxies').update({ lyrics }).eq('id', world.galaxyId);
      markSaved('lyrics');
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleSoundbyteConfirm(picked: SoundbyteDef[]) {
    setSoundbytes(picked);
    const { data: gal } = await supabase.from('galaxies').select('brainstorm_draft').eq('id', world.galaxyId).single();
    const existing = (gal?.brainstorm_draft as any) || {};
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const converted = picked.map(sb => ({
      id: sb.id,
      section: sb.label,
      timeRange: `${fmtTime(sb.startSec)}–${fmtTime(sb.endSec)}`,
      duration: `~${Math.round(sb.endSec - sb.startSec)}s`,
      rationale: '',
    }));
    await supabase.from('galaxies').update({
      brainstorm_draft: { ...existing, confirmedSoundbytes: converted },
    }).eq('id', world.galaxyId);
    markSaved('soundbytes');
  }

  async function handleSaveTrackUrl() {
    if (!trackUrlInput.trim()) return;
    setIsSavingTrack(true);
    try {
      await supabase.from('galaxies').update({ track_url: trackUrlInput.trim() }).eq('id', world.galaxyId);
      setTrackUrl(trackUrlInput.trim());
      setTrackUrlInput('');
      markSaved('track');
    } catch (e) { console.error(e); }
    setIsSavingTrack(false);
  }

  async function handleTrackFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSavingTrack(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `${world.galaxyId}/track.${ext}`;
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.from('galaxies').update({ track_url: url }).eq('id', world.galaxyId);
      setTrackUrl(url);
      markSaved('track');
    } catch (err) { console.error('[SongDataTab] track upload error:', err); }
    setIsSavingTrack(false);
  }

  return (
    <div className="space-y-6">
      {/* Song Emotion + Listening Context */}
      <Card className="border-yellow-500/30 bg-black/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-star-wars text-yellow-400">Song Context</CardTitle>
            {savedSections['meta'] && <span className="text-[11px] text-green-400">✓ Saved</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Vibe / emotion (1-2 words)</label>
            <input
              value={songEmotion}
              onChange={e => setSongEmotion(e.target.value)}
              placeholder="e.g. heartbreak, confidence, nostalgia"
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/60"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Where do you imagine someone listening?</label>
            <input
              value={listeningContext}
              onChange={e => setListeningContext(e.target.value)}
              placeholder="e.g. late-night drive, gym, morning routine"
              className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/60"
            />
          </div>
          <button
            onClick={saveSongMeta}
            disabled={saving}
            className="px-4 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </CardContent>
      </Card>

      {/* Lyrics */}
      <Card className="border-yellow-500/30 bg-black/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-star-wars text-yellow-400">Lyrics</CardTitle>
            {savedSections['lyrics'] && <span className="text-[11px] text-green-400">✓ Saved</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder="Paste your lyrics here…"
            rows={8}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/60 resize-none font-mono"
          />
          <button
            onClick={saveLyrics}
            disabled={saving}
            className="px-4 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Save lyrics
          </button>
        </CardContent>
      </Card>

      {/* Track & Soundbytes — combined waveform editor */}
      <Card className="border-yellow-500/30 bg-black/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-star-wars text-yellow-400">Track & Soundbytes</CardTitle>
            <div className="flex items-center gap-2">
              {savedSections['soundbytes'] && <span className="text-[11px] text-green-400">✓ Saved</span>}
              {savedSections['track'] && <span className="text-[11px] text-green-400">✓ Track saved</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!trackUrl ? (
            /* ── No track yet — upload UI ── */
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Upload your track to use the waveform soundbyte editor. Soundbytes guide your shoot day schedule and editing sessions.
              </p>
              <div className="flex gap-2">
                {(['url', 'file'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setTrackInputMode(mode)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                      trackInputMode === mode
                        ? 'border-yellow-500/60 bg-yellow-500/15 text-yellow-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {mode === 'url' ? '🔗 Paste link' : '📂 Upload file'}
                  </button>
                ))}
              </div>
              {trackInputMode === 'url' ? (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={trackUrlInput}
                    onChange={e => setTrackUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveTrackUrl()}
                    placeholder="SoundCloud, Dropbox, or Google Drive link…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
                  />
                  <button
                    onClick={handleSaveTrackUrl}
                    disabled={isSavingTrack || !trackUrlInput.trim()}
                    className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSavingTrack ? '…' : 'Save'}
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-2 w-full py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  isSavingTrack ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-gray-700 hover:border-yellow-500/40 hover:bg-yellow-500/5'
                }`}>
                  <span className="text-2xl">{isSavingTrack ? '⏳' : '🎵'}</span>
                  <span className="text-sm text-gray-400">{isSavingTrack ? 'Uploading…' : 'Click to upload audio file'}</span>
                  <span className="text-xs text-gray-600">MP3, WAV, M4A, AIFF</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleTrackFileUpload} disabled={isSavingTrack} />
                </label>
              )}
            </div>
          ) : (
            /* ── Track loaded — show waveform editor directly ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 truncate flex-1 pr-2">
                  🎵 {trackUrl.length > 55 ? '…' + trackUrl.slice(-50) : trackUrl}
                </p>
                <button
                  onClick={async () => {
                    await supabase.from('galaxies').update({ track_url: null }).eq('id', world.galaxyId);
                    setTrackUrl('');
                  }}
                  className="text-[11px] text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  Change
                </button>
              </div>
              <SoundbytePicker
                trackUrl={trackUrl}
                lyricsSegments={lyricsSegments}
                initialSoundbytes={soundbytes ?? undefined}
                onConfirm={handleSoundbyteConfirm}
                standalone
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function WorldDetailView({
  world,
  universe,
  artistProfile,
  teamId = '',
  teamTasks = [],
  teamMembers = [],
  currentUserId,
  currentUserName = 'You',
  onClose,
  onUpdate,
  onDelete,
  onAskMark,
  onRefreshTasks,
  onStartBrainstorm,
  brainstormResult,
  initialTab = 'footage',
}: WorldDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'footage' | 'all-posts' | 'snapshot-starter' | 'song-data' | 'settings'>(initialTab);
  const [currentWorld, setCurrentWorld] = useState<World>(world);

  const releaseDateDisplay = (() => {
    const rd = currentWorld.releaseDate;
    if (!rd) return 'No release date';
    const d = new Date(rd.includes('T') ? rd : rd + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const tabs: { id: 'footage' | 'all-posts' | 'snapshot-starter' | 'song-data' | 'settings'; label: string; icon: string }[] = [
    { id: 'footage', label: 'Footage', icon: '🎬' },
    { id: 'all-posts', label: 'All Posts', icon: '📋' },
    { id: 'snapshot-starter', label: 'Snapshot Starter', icon: '✨' },
    { id: 'song-data', label: 'Song Data', icon: '🎵' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-black/95 border-yellow-500/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-star-wars text-yellow-400 mb-1">{currentWorld.name}</h1>
              <p className="text-sm text-gray-400 font-star-wars">RELEASE DATE: {releaseDateDisplay}</p>
            </div>
            <button
              onClick={onClose}
              className="font-star-wars text-sm border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 px-4 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-yellow-500/20">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-star-wars text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-yellow-400 border-b-2 border-yellow-400 -mb-px'
                    : 'text-gray-400 hover:text-yellow-500/70'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'footage' && (
            <FootageTab
              teamId={teamId}
              galaxyId={currentWorld.galaxyId}
              teamMembers={teamMembers}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          )}

          {activeTab === 'all-posts' && (
            <AllPostsTab
              teamId={teamId}
              teamMembers={teamMembers}
              galaxyId={currentWorld.galaxyId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onAskMark={onAskMark}
              onRefreshTasks={onRefreshTasks}
              releaseDate={currentWorld.releaseDate}
            />
          )}

          {activeTab === 'snapshot-starter' && (
            <SnapshotStarterTab
              galaxyId={currentWorld.galaxyId}
              brainstormResult={brainstormResult}
              songEmotion={currentWorld.songEmotion}
              listeningContext={currentWorld.listeningContext}
              onStartBrainstorm={(mode, songCtx, resume) => {
                onClose();
                onStartBrainstorm?.(mode, songCtx, resume);
              }}
            />
          )}

          {activeTab === 'song-data' && (
            <SongDataTab
              world={currentWorld}
              onUpdate={(updated) => { setCurrentWorld(updated); onUpdate?.(updated); }}
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">

              <div className="grid grid-cols-2 gap-4">
                <Card className="border-yellow-500/30 bg-black/50">
                  <CardHeader>
                    <CardTitle className="text-base font-star-wars text-yellow-400">World Color</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg border-2 border-yellow-500 shadow-lg"
                        style={{ backgroundColor: currentWorld.color }} />
                      <p className="text-white font-mono text-sm">{currentWorld.color}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-500/30 bg-black/50">
                  <CardHeader>
                    <CardTitle className="text-base font-star-wars text-yellow-400">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${currentWorld.isReleased ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-white text-sm">{currentWorld.isReleased ? 'Released' : 'Unreleased'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${currentWorld.isPublic ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className="text-white text-sm">{currentWorld.isPublic ? 'Public' : 'Private'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {currentWorld.snapshotStrategy && (
                <Card className="border-yellow-500/30 bg-black/50">
                  <CardHeader>
                    <CardTitle className="text-base font-star-wars text-yellow-400">Snapshot Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white text-sm">
                      <span className="text-yellow-400 font-star-wars">
                        {currentWorld.snapshotStrategy.snapshots.length}
                      </span>{' '}
                      snapshots scheduled
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Generated: {new Date(currentWorld.snapshotStrategy.generatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              )}

              {currentWorld.visualLandscape.images.length > 0 && (
                <Card className="border-yellow-500/30 bg-black/50">
                  <CardHeader>
                    <CardTitle className="text-base font-star-wars text-yellow-400">Visual References</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3">
                      {currentWorld.visualLandscape.images.map((url, i) => (
                        <img key={i} src={url} alt={`Ref ${i + 1}`}
                          className="w-full h-24 object-cover rounded border border-yellow-500/30" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <ReminderSettingsComponent
                userId={`user-${currentWorld.id}`}
                onSave={(settings) => console.log('Reminder settings saved:', settings)}
              />

              {/* Danger zone — delete world */}
              {onDelete && (
                <div className="border border-red-900/30 rounded-xl p-4 bg-red-950/10">
                  <p className="text-sm text-red-400 font-medium mb-2">Danger Zone</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Permanently delete this world and all its data. This cannot be undone.
                  </p>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${world.name}" and all its data? This cannot be undone.`)) {
                        await onDelete(world.id);
                        onClose();
                      }
                    }}
                    className="text-sm text-red-400 hover:text-red-300 border border-red-600/40 hover:border-red-500/60 px-4 py-2 rounded-lg transition-colors"
                  >
                    🗑️ Delete World
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
