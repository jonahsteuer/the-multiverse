'use client';

import { useState, useEffect } from 'react';
import { TeamTask } from '@/types';
import { deleteTask } from '@/lib/team';
import { supabase } from '@/lib/supabase';

interface FootageItem {
  id: string;
  name: string;
  url: string;
  description?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

interface UploadFootageModalProps {
  teamId: string;
  galaxyId: string;
  galaxyName: string;
  footageTask?: TeamTask;
  onAskMark?: (contextMessage: string) => void;
  onClose: () => void;
  onFootageUploaded?: () => void;
}

function detectVideoType(url: string): 'google_drive' | 'youtube' | 'dropbox' | 'direct' {
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'google_drive';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('dropbox.com')) return 'dropbox';
  return 'direct';
}

function getThumbnailUrl(url: string): string | null {
  const type = detectVideoType(url);
  if (type === 'youtube') {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?\s]+)/);
    if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
  }
  return null;
}

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function UploadFootageModal({
  teamId,
  galaxyId,
  galaxyName,
  footageTask,
  onAskMark,
  onClose,
  onFootageUploaded,
}: UploadFootageModalProps) {
  const [footageItems, setFootageItems] = useState<FootageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // New item form state
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFootage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, galaxyId]);

  const loadFootage = async () => {
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

      if (data) {
        setFootageItems(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.title as string,
          url: (r.video_url as string) || '',
          description: (r.description as string) || '',
          uploadedAt: r.created_at as string,
          uploadedBy: (r.assigned_by as string) || undefined,
        })));
      }
    } catch (e) {
      console.error('[UploadFootageModal] Error loading footage:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFootage = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      setError('Please enter a name and URL for your footage.');
      return;
    }
    if (!teamId) {
      setError('Team not loaded yet — please try again in a moment.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertErr } = await supabase.from('team_tasks').insert({
        team_id: teamId,
        galaxy_id: galaxyId,
        title: newName.trim(),
        description: newDescription.trim() || `Raw footage: ${newName.trim()}`,
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

      setNewName('');
      setNewUrl('');
      setNewDescription('');
      setIsAdding(false);
      await loadFootage();
      onFootageUploaded?.();
    } catch (e) {
      console.error('[UploadFootageModal] Error saving footage:', e);
      setError('Failed to save footage. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this footage item?')) return;
    try {
      await deleteTask(id);
      setFootageItems(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      console.error('[UploadFootageModal] Error deleting footage:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-700/50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 mb-2">
              Prep
            </div>
            <h2 className="text-xl font-semibold text-white">Upload footage</h2>
            <p className="text-sm text-gray-400 mt-0.5">{galaxyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* What to do */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              WHAT TO DO
            </p>
            <p className="text-sm text-gray-300 leading-relaxed">
              Upload your raw footage so your team can access and edit it. Paste a link from
              Google Drive, Dropbox, or YouTube. All team members will be able to view these clips.
            </p>
          </div>

          {/* Existing footage */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              UPLOADED FOOTAGE
            </p>

            {isLoading ? (
              <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
            ) : footageItems.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-sm">
                <div className="text-2xl mb-2">🎬</div>
                No footage uploaded yet
              </div>
            ) : (
              <div className="space-y-2">
                {footageItems.map(item => {
                  const thumb = getThumbnailUrl(item.url);
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                      {thumb ? (
                        <img src={thumb} alt={item.name} className="w-14 h-10 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-10 bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-500 text-lg">
                          🎥
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500 truncate">{item.description}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-0.5">{formatDate(item.uploadedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs text-red-500/70 hover:text-red-400 transition-colors p-1 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add footage form */}
          {isAdding ? (
            <div className="space-y-3 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
              <p className="text-sm font-medium text-white">Add footage</p>
              <input
                type="text"
                placeholder="Name (e.g. Visualizer raw footage)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="url"
                placeholder="Paste Google Drive, Dropbox, or YouTube link"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddFootage}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save footage'}
                </button>
                <button
                  onClick={() => { setIsAdding(false); setError(''); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 border border-dashed border-gray-600 hover:border-blue-500/50 text-gray-400 hover:text-blue-400 text-sm rounded-xl transition-colors"
            >
              + Add footage link
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={() => onAskMark?.('The user has the Upload footage task open and may need help uploading their raw footage to the platform.')}
            className="w-full py-3 bg-purple-900/60 hover:bg-purple-800/60 border border-purple-700/50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            🎯 Ask Mark for help
          </button>
        </div>
      </div>
    </div>
  );
}
