'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TeamTask } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fmtSec(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function esc(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLinkHost(url: string): string {
  if (/instagram/i.test(url)) return '📸 Instagram';
  if (/tiktok/i.test(url)) return '🎵 TikTok';
  if (/youtube|youtu\.be/i.test(url)) return '▶️ YouTube';
  return '🔗 Ref';
}

function getLinkIcon(url: string): string {
  if (/dropbox/i.test(url)) return '📦';
  if (/drive\.google|docs\.google/i.test(url)) return '📁';
  if (/youtube|youtu\.be/i.test(url)) return '▶️';
  if (/vimeo/i.test(url)) return '🎬';
  return '🔗';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoundbyteDef {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
}

interface LookOption {
  id: string;
  description: string;
}

interface SceneLookData {
  sceneId: string;
  sceneTitle: string;
  action?: string;
  setting?: string;
  references?: string[];
  looks: LookOption[];
}

interface FootageFile {
  name: string;
  url: string;
  size: number;
}

interface ShootDayModalProps {
  task: TeamTask;
  galaxyId: string;
  /** Kept for backward compat — no longer used (modal now lazy-loads everything from draft) */
  brainstormResult?: unknown;
  onClose: () => void;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function downloadSchedulePdf(
  task: TeamTask,
  sceneLooks: SceneLookData[],
  checkedLookIds: Set<string>,
  soundbytes: SoundbyteDef[],
  location: string,
) {
  const soundbyteRows = soundbytes.length > 0
    ? soundbytes.map(sb => `3–5 shots · ${esc(sb.label)} (${fmtSec(sb.startSec)}–${fmtSec(sb.endSec)})`).join('<br>')
    : '3–5 shots per soundbyte';

  let body = `<div class="meta">${formatDate(task.date)} · ${formatTime(task.startTime)} – ${formatTime(task.endTime)}</div>\n`;
  if (location) body += `<div class="meta">📍 ${esc(location)}</div>\n`;
  body += `<div class="section-header">📋 SHOOT SCHEDULE</div>\n`;

  sceneLooks.forEach((scene, si) => {
    body += `<div class="scene">SCENE ${si + 1}: ${esc(scene.sceneTitle)}</div>\n`;
    if (scene.action) body += `<div class="scene-detail"><strong>💡 Concept:</strong> ${esc(scene.action)}</div>\n`;
    if (scene.setting) body += `<div class="scene-detail"><strong>📌 Setting:</strong> ${esc(scene.setting)}</div>\n`;

    if (scene.references?.length) {
      const refLinks = scene.references.map((url, i) =>
        `<a href="${esc(url)}">${getLinkHost(url)} ${i + 1}</a>`
      ).join(' &nbsp;·&nbsp; ');
      body += `<div class="scene-detail"><strong>References:</strong> ${refLinks}</div>\n`;
    }

    // Only show checked looks (or all if none checked for this scene)
    const checkedForScene = scene.looks.filter(l => checkedLookIds.has(l.id));
    const looksToShow = checkedForScene.length > 0 ? checkedForScene : scene.looks;

    body += `<div class="look-header">Look options${checkedForScene.length > 0 ? ` (${checkedForScene.length} selected)` : ' (all)'}:</div>\n`;
    looksToShow.forEach((look, li) => {
      body += `<div class="look">Look ${li + 1}: ${esc(look.description)}</div>\n`;
      if (soundbytes.length > 0) {
        body += `<div class="soundbyte">${soundbyteRows}</div>\n`;
      }
    });

    if (si < sceneLooks.length - 1) body += `<div class="travel">↓ Travel to next scene</div>\n`;
  });

  body += `<div class="note">✅ Record the full song at EVERY look. Maximum footage = maximum posts to test.</div>\n`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${esc(task.title)} — Shoot Schedule</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; color: #111; font-size: 14px; line-height: 1.65; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #555; margin-bottom: 6px; font-size: 13px; }
  .section-header { font-weight: bold; font-size: 15px; margin: 24px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .scene { font-weight: bold; margin: 22px 0 5px; font-size: 15px; }
  .scene-detail { margin-left: 18px; margin-bottom: 3px; color: #333; font-size: 13px; }
  .look-header { margin-left: 18px; margin-top: 10px; font-size: 12px; color: #666; font-style: italic; }
  .look { margin-left: 18px; font-weight: 600; color: #111; font-size: 13px; margin-top: 7px; }
  .soundbyte { margin-left: 36px; color: #555; font-size: 12px; margin-top: 3px; }
  .travel { margin-left: 18px; color: #888; font-style: italic; margin: 10px 0; font-size: 12px; }
  .note { margin-top: 24px; background: #f8f8f8; padding: 10px 14px; border-left: 3px solid #888; font-size: 13px; }
  a { color: #3b82f6; }
  @media print { body { margin: 20px; } }
</style></head>
<body>
<h1>${esc(task.title)}</h1>
${body}
<script>window.print();<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShootDayModal({ task, galaxyId, onClose }: ShootDayModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Footage
  const [footage, setFootage] = useState<FootageFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  // Schedule
  const [sceneLooks, setSceneLooks] = useState<SceneLookData[] | null>(null);
  const [isGeneratingLooks, setIsGeneratingLooks] = useState(false);
  const [lookGenError, setLookGenError] = useState<string | null>(null);
  const [checkedLookIds, setCheckedLookIds] = useState<Set<string>>(new Set());
  const [confirmedSoundbytes, setConfirmedSoundbytes] = useState<SoundbyteDef[]>([]);
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [crew, setCrew] = useState('');

  // ── Load footage ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!galaxyId) return;
    supabase
      .from('team_tasks')
      .select('id, title, video_url, created_at')
      .eq('galaxy_id', galaxyId)
      .eq('task_category', 'footage')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setFootage(data.map((r: any) => ({ name: r.title, url: r.video_url || '', size: 0 }))
            .filter((f: FootageFile) => f.url));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxyId]);

  // ── Load draft + generate/restore looks ─────────────────────────────────────
  useEffect(() => {
    if (!galaxyId) return;
    const init = async () => {
      const { data: galData } = await supabase
        .from('galaxies').select('brainstorm_draft').eq('id', galaxyId).single();
      const draft = (galData?.brainstorm_draft as any) || {};

      const liked: any[] = draft.allLikedIdeas || [];
      const sbRaw: any[] = draft.confirmedSoundbytes || [];
      const refs: Record<string, string[]> = draft.contentIdeaReferences || {};

      if (draft.confirmedLocation) setLocation(draft.confirmedLocation);
      if (draft.confirmedLocationUrl) setLocationUrl(draft.confirmedLocationUrl);

      const parseTime = (s: string): number => {
        const [m, sec] = (s || '0:00').split(':').map(Number);
        return (m || 0) * 60 + (sec || 0);
      };

      const parsedSoundbytes: SoundbyteDef[] = sbRaw.map((sb: any) => ({
        id: sb.id || String(Math.random()),
        label: sb.section || sb.label || 'Section',
        startSec: typeof sb.startSec === 'number' ? sb.startSec : parseTime(sb.timeRange?.split('–')[0] || '0:00'),
        endSec: typeof sb.endSec === 'number' ? sb.endSec : parseTime(sb.timeRange?.split('–')[1] || '0:30'),
      }));
      setConfirmedSoundbytes(parsedSoundbytes);

      // Check for existing looks + checked state in task's mark_analysis
      const markAnalysis = (task as any).mark_analysis || {};
      if (markAnalysis.sceneLooks?.length > 0) {
        setSceneLooks(markAnalysis.sceneLooks);
        if (markAnalysis.checkedLookIds?.length) {
          setCheckedLookIds(new Set(markAnalysis.checkedLookIds));
        }
        return;
      }

      if (liked.length === 0) return;

      const scenes = liked.map((idea: any, i: number) => ({
        id: idea.id || `scene-${i}`,
        title: idea.title,
        action: idea.action,
        setting: idea.setting,
        references: refs[idea.id] || [],
      }));

      setIsGeneratingLooks(true);
      setLookGenError(null);
      try {
        const res = await fetch('/api/team/generate-shoot-looks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenes,
            location: draft.confirmedLocation || '',
            soundbytes: parsedSoundbytes,
            genre: draft.songEmotionLocal || '',
          }),
        });
        if (!res.ok) throw new Error('Generation failed');
        const { sceneLooks: generated } = await res.json();

        const merged: SceneLookData[] = (generated || []).map((sg: any, i: number) => ({
          ...sg,
          action: scenes[i]?.action,
          setting: scenes[i]?.setting,
          references: scenes[i]?.references || [],
        }));
        setSceneLooks(merged);

        await supabase.from('team_tasks').update({
          mark_analysis: { ...markAnalysis, sceneLooks: merged, checkedLookIds: [] },
        }).eq('id', task.id);
      } catch (err: any) {
        setLookGenError('Could not generate look options. Try reopening the modal.');
        console.error('[ShootDayModal] look gen error:', err);
      } finally {
        setIsGeneratingLooks(false);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galaxyId, task.id]);

  // ── Toggle look checkbox + debounce-save ────────────────────────────────────
  const toggleLook = useCallback((lookId: string) => {
    setCheckedLookIds(prev => {
      const next = new Set(prev);
      if (next.has(lookId)) next.delete(lookId); else next.add(lookId);
      if (checkSaveTimer.current) clearTimeout(checkSaveTimer.current);
      checkSaveTimer.current = setTimeout(async () => {
        const existing = (task as any).mark_analysis || {};
        await supabase.from('team_tasks').update({
          mark_analysis: { ...existing, checkedLookIds: Array.from(next) },
        }).eq('id', task.id);
      }, 800);
      return next;
    });
  }, [task]);

  // ── Add footage link ─────────────────────────────────────────────────────────
  const handleAddLink = async () => {
    if (!linkUrl.trim()) { setUploadError('Please enter a URL.'); return; }
    setIsSavingLink(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const { data: existingTask } = await supabase
        .from('team_tasks').select('team_id').eq('galaxy_id', galaxyId).limit(1).single();
      const teamId = existingTask?.team_id;
      if (!teamId) throw new Error('Team not found');
      const { data: { user } } = await supabase.auth.getUser();
      const name = linkName.trim() || `Shoot footage – ${new Date().toLocaleDateString()}`;
      const { error } = await supabase.from('team_tasks').insert({
        team_id: teamId, galaxy_id: galaxyId, title: name,
        description: `Raw footage: ${name}`, type: 'prep', task_category: 'footage',
        date: new Date().toISOString().split('T')[0], start_time: '00:00', end_time: '00:00',
        video_url: linkUrl.trim(), assigned_by: user?.id || null, status: 'pending',
      });
      if (error) throw error;
      setUploadSuccess('Footage link added! It now appears in the Footage tab of your world.');
      setLinkUrl(''); setLinkName(''); setShowLinkForm(false);
      const { data } = await supabase.from('team_tasks').select('id, title, video_url, created_at')
        .eq('galaxy_id', galaxyId).eq('task_category', 'footage').order('created_at', { ascending: false });
      if (data) setFootage(data.map((r: any) => ({ name: r.title, url: r.video_url || '', size: 0 })).filter((f: FootageFile) => f.url));
    } catch (err: any) {
      setUploadError(`Failed to save link: ${err?.message || 'Unknown error'}`);
    } finally { setIsSavingLink(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div
        className="relative bg-gray-900 border border-yellow-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-500/30">
                🎬 Shoot Day
              </span>
              {task.status === 'completed' && (
                <span className="text-xs font-semibold uppercase tracking-wider text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-500/30">
                  ✓ Completed
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{task.title}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {formatDate(task.date)} · {formatTime(task.startTime)} – {formatTime(task.endTime)}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Location & Crew */}
          {(location || crew) && (
            <div className="space-y-2">
              {location && (
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">📍</span>
                  <div>
                    <p className="text-white font-medium">{location}</p>
                    {locationUrl && (
                      <a href={locationUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm underline break-all">
                        {locationUrl}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {crew && (
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <span className="text-lg">👥</span><span>{crew}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Shoot Schedule ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Shoot Schedule</h3>
              {sceneLooks && sceneLooks.length > 0 && (
                <button
                  onClick={() => downloadSchedulePdf(task, sceneLooks, checkedLookIds, confirmedSoundbytes, location)}
                  className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 hover:border-yellow-400/50 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Download PDF
                </button>
              )}
            </div>

            <div className="bg-gray-950/60 rounded-xl border border-gray-800 p-4 space-y-2">
              {isGeneratingLooks ? (
                <div className="py-10 text-center space-y-3">
                  <div className="text-3xl animate-pulse">✨</div>
                  <p className="text-sm text-gray-300 font-medium">Generating your look options…</p>
                  <p className="text-xs text-gray-500">Mark is reviewing your scenes, location, and references</p>
                </div>
              ) : lookGenError ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-red-400">{lookGenError}</p>
                </div>
              ) : sceneLooks && sceneLooks.length > 0 ? (
                <>
                  {/* Soundbyte chips */}
                  {confirmedSoundbytes.length > 0 && (
                    <div className="pb-3 mb-1 border-b border-gray-800">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Soundbytes</p>
                      <div className="flex flex-wrap gap-2">
                        {confirmedSoundbytes.map(sb => (
                          <span key={sb.id} className="text-[11px] bg-purple-900/30 border border-purple-500/30 text-purple-300 rounded-full px-2.5 py-0.5">
                            {sb.label} · {fmtSec(sb.startSec)}–{fmtSec(sb.endSec)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scene blocks */}
                  {sceneLooks.map((scene, si) => {
                    const checkedCount = scene.looks.filter(l => checkedLookIds.has(l.id)).length;
                    return (
                      <div key={scene.sceneId} className={si > 0 ? 'pt-4 border-t border-gray-800/70' : ''}>
                        <p className="text-white font-bold text-sm mb-1.5">
                          SCENE {si + 1}: {scene.sceneTitle}
                        </p>
                        {scene.action && (
                          <p className="text-gray-300 text-xs pl-2 mb-0.5 leading-relaxed">
                            💡 {scene.action.length > 130 ? scene.action.slice(0, 130) + '…' : scene.action}
                          </p>
                        )}
                        {scene.setting && (
                          <p className="text-gray-400 text-xs pl-2 mb-2 leading-relaxed">
                            📌 {scene.setting.length > 110 ? scene.setting.slice(0, 110) + '…' : scene.setting}
                          </p>
                        )}

                        {/* Reference links */}
                        {scene.references && scene.references.length > 0 && (
                          <div className="flex items-center gap-2 pl-2 mb-2.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Refs</span>
                            {scene.references.map((url, ri) => (
                              <a key={ri} href={url} target="_blank" rel="noopener noreferrer"
                                className="text-[11px] text-blue-400 hover:text-blue-300 underline">
                                {getLinkHost(url)} {ri + 1}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Look checkboxes */}
                        <div className="space-y-1.5 pl-2 mb-2">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                            Look options — choose 2–3
                            {checkedCount > 0 && <span className="ml-1.5 text-green-400">({checkedCount} selected)</span>}
                          </p>
                          {scene.looks.map((look, li) => {
                            const checked = checkedLookIds.has(look.id);
                            return (
                              <button
                                key={look.id}
                                onClick={() => toggleLook(look.id)}
                                className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all ${
                                  checked
                                    ? 'border-green-500/40 bg-green-500/8 text-white'
                                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                                }`}
                              >
                                <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                                  checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-600'
                                }`}>
                                  {checked ? '✓' : ''}
                                </span>
                                <span className="text-xs leading-relaxed">
                                  <span className="font-medium text-white">Look {li + 1}:</span>{' '}
                                  {look.description}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Soundbyte timestamps under looks */}
                        {confirmedSoundbytes.length > 0 && (
                          <div className="pl-2 mt-1 mb-1">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Each selected look:</p>
                            <div className="space-y-0.5">
                              {confirmedSoundbytes.map(sb => (
                                <p key={sb.id} className="text-[11px] text-gray-400">
                                  3–5 shots ·{' '}
                                  <span className="text-purple-400">{sb.label}</span>
                                  {' '}({fmtSec(sb.startSec)}–{fmtSec(sb.endSec)})
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {si < sceneLooks.length - 1 && (
                          <p className="text-gray-600 text-xs pl-2 mt-2 italic">↓ Travel to next scene</p>
                        )}
                      </div>
                    );
                  })}

                  <p className="text-gray-500 text-xs pt-3 border-t border-gray-800 mt-2">
                    ✅ Record the full song at EVERY look. Maximum footage = maximum posts to test.
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm italic py-6 text-center">
                  Complete a brainstorm session to generate your shoot schedule.
                </p>
              )}
            </div>
          </div>

          {/* ── Footage Links ──────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Shoot Footage</h3>
            <div className="bg-gray-950/60 rounded-xl border border-gray-800 p-4 space-y-3">
              <p className="text-gray-500 text-xs">
                Add a Dropbox, Google Drive, or YouTube link to share footage with your team.
                Links appear in the Footage tab of your world.
              </p>
              {showLinkForm ? (
                <div className="space-y-2">
                  <input type="url" placeholder="Paste Dropbox / Google Drive / YouTube URL…" value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50" />
                  <input type="text" placeholder='Label (optional) — e.g. "Scene 1 raw clips"' value={linkName}
                    onChange={e => setLinkName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50" />
                  <div className="flex gap-2">
                    <button onClick={handleAddLink} disabled={isSavingLink || !linkUrl.trim()}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-medium rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
                      {isSavingLink ? 'Saving…' : '+ Add footage link'}
                    </button>
                    <button onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkName(''); setUploadError(null); }}
                      className="text-gray-500 hover:text-gray-300 text-xs px-3 py-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowLinkForm(true); setUploadSuccess(null); setUploadError(null); }}
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2.5 transition-colors w-full">
                  <span>🔗</span>
                  {footage.length === 0 ? 'Add footage link' : 'Add another link'}
                </button>
              )}
              {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
              {uploadSuccess && <p className="text-green-400 text-xs">✓ {uploadSuccess}</p>}
            </div>
          </div>

          <span ref={fileInputRef as any} className="hidden" />
        </div>
      </div>
    </div>
  );
}
