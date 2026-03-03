'use client';

import { useState, useEffect } from 'react';
import type { World, Universe, ArtistProfile, TeamTask, TeamMemberRecord } from '@/types';
import { ReminderSettingsComponent } from './ReminderSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveWorld } from '@/lib/storage';
import { deleteTask } from '@/lib/team';
import { supabase } from '@/lib/supabase';

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
  const t = task.title.toLowerCase();
  if (t.includes('release')) return 'Release Day';
  if (t.includes('teaser')) return 'Teaser';
  if (t.includes('promo')) return 'Promo';
  if (t.includes('audience')) return 'Audience Builder';
  return 'Post';
}

function getPostTypeColor(task: TeamTask): string {
  const t = task.title.toLowerCase();
  if (t.includes('release')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (t.includes('teaser')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (t.includes('promo')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (t.includes('audience')) return 'bg-green-500/20 text-green-300 border-green-500/40';
  return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
}

function getPostStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'linked': return { label: 'Linked', color: 'text-blue-400' };
    case 'analyzed': return { label: 'Analyzed', color: 'text-indigo-400' };
    case 'caption_written': return { label: 'Caption Ready', color: 'text-teal-400' };
    case 'approved': return { label: '✓ Approved', color: 'text-green-400' };
    case 'revision_requested': return { label: 'Needs Revision', color: 'text-orange-400' };
    case 'posted': return { label: '✓ Posted', color: 'text-gray-400' };
    default: return { label: 'Pending', color: 'text-gray-500' };
  }
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
  onClose: () => void;
  onUpdate?: (world: World) => void;
  onDelete?: (worldId: string) => void;
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

function FootageTab({ teamId, galaxyId }: { teamId: string; galaxyId: string }) {
  const [items, setItems] = useState<FootageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, galaxyId]);

  async function load() {
    if (!teamId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('team_tasks')
        .select('*')
        .eq('team_id', teamId)
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
    if (!teamId) { setError('Team not loaded yet.'); return; }
    setIsSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from('team_tasks').insert({
        team_id: teamId,
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
      if (insertErr) throw insertErr;
      setNewName(''); setNewUrl(''); setNewDesc(''); setIsAdding(false);
      await load();
    } catch {
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
                <p className="text-sm font-medium text-white truncate">{item.name}</p>
                {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
                <p className="text-xs text-gray-600 mt-0.5">{formatDateTime(item.uploadedAt)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                  View
                </a>
                <button onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-500/70 hover:text-red-400 p-1 rounded transition-colors">✕</button>
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Edits tab (All Posts — same as old "All Posts" tab in EnhancedCalendar)
// ─────────────────────────────────────────────

function EditsTab({
  teamTasks,
  galaxyId,
}: {
  teamTasks: TeamTask[];
  galaxyId: string;
}) {
  const postTasks = teamTasks
    .filter(t =>
      t.galaxyId === galaxyId &&
      t.taskCategory === 'event' &&
      ['post', 'release', 'audience-builder', 'teaser', 'promo'].includes(t.type)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
      {postTasks.map(task => {
        const ext = task as any;
        const status = ext.postStatus || ext.post_status || 'pending';
        const statusInfo = getPostStatusLabel(status);
        const typeColor = getPostTypeColor(task);
        const hasVideo = !!ext.videoUrl || !!ext.video_url;

        return (
          <div
            key={task.id}
            className="relative rounded-xl border border-gray-700/60 bg-gray-800/40 hover:bg-gray-800/70 p-3 transition-colors cursor-default"
          >
            {/* Video thumbnail placeholder */}
            <div className={`w-full h-20 rounded-lg mb-2 flex items-center justify-center text-2xl ${hasVideo ? 'bg-gray-700' : 'bg-gray-800 border border-dashed border-gray-600'}`}>
              {hasVideo ? '🎬' : '📷'}
            </div>

            {/* Type badge */}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeColor} mb-1`}>
              {getPostTypeLabel(task)}
            </span>

            {/* Date */}
            <p className="text-xs text-gray-300 font-medium">{formatDate(task.date)}</p>

            {/* Status */}
            <p className={`text-[10px] mt-0.5 ${statusInfo.color}`}>{statusInfo.label}</p>

            {/* Caption preview */}
            {ext.caption && (
              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{ext.caption}</p>
            )}
            {!ext.caption && !hasVideo && (
              <p className="text-[10px] text-gray-600 mt-1 italic">tap to add content</p>
            )}
          </div>
        );
      })}
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
  onClose,
  onUpdate,
  onDelete,
}: WorldDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'footage' | 'edits' | 'settings'>('footage');
  const [currentWorld, setCurrentWorld] = useState<World>(world);

  // Fix release date timezone
  const releaseDateDisplay = (() => {
    const rd = currentWorld.releaseDate;
    if (!rd) return 'No release date';
    const d = new Date(rd.includes('T') ? rd : rd + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const tabs: { id: 'footage' | 'edits' | 'settings'; label: string; icon: string }[] = [
    { id: 'footage', label: 'Footage', icon: '🎬' },
    { id: 'edits', label: 'Edits', icon: '✂️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-black/95 border-yellow-500/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-star-wars text-yellow-400 mb-1">
                {currentWorld.name}
              </CardTitle>
              <p className="text-sm text-gray-400 font-star-wars">
                RELEASE DATE: {releaseDateDisplay}
              </p>
            </div>
            <div className="flex gap-2">
              {onDelete && (
                <Button
                  onClick={async () => {
                    if (confirm(`Delete "${world.name}" and all its snapshots? This cannot be undone.`)) {
                      await onDelete(world.id);
                      onClose();
                    }
                  }}
                  variant="outline"
                  className="font-star-wars border-red-600/50 text-red-400 hover:bg-red-600/20"
                >
                  🗑️ Erase World
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                className="font-star-wars border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
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

          {/* Footage tab */}
          {activeTab === 'footage' && (
            <FootageTab teamId={teamId} galaxyId={currentWorld.id} />
          )}

          {/* Edits tab — mirrors the old "All Posts" view */}
          {activeTab === 'edits' && (
            <EditsTab teamTasks={teamTasks} galaxyId={currentWorld.id} />
          )}

          {/* Settings tab */}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
