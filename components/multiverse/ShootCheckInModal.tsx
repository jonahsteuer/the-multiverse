'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { TeamTask } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlannedLook {
  id: string;
  description: string;
}

interface PlannedScene {
  id: string;
  title: string;
  action?: string;
  setting?: string;
  looks: PlannedLook[];
}

interface PlannedSoundbyte {
  id: string;
  section: string;
  timeRange: string;
  duration: string;
}

interface LookCapture {
  lookId: string;
  wasShot: boolean;
  takes: number;
  soundbytesCovered: string[]; // soundbyte section names
  updatedDescription: string;
}

interface SceneCapture {
  sceneId: string;
  wasShot: boolean;
  updatedTitle: string;
  updatedDescription: string;
  looks: LookCapture[];
}

interface AlternateLocation {
  mapsLink: string;
  reason: string;
}

export interface CheckInData {
  submittedAt: string;
  footageLink: string;
  shotAtPlannedLocation: boolean;
  plannedLocation: string;
  alternateLocations: AlternateLocation[];
  scenes: SceneCapture[];
  notes: string;
}

interface ShootCheckInModalProps {
  task: TeamTask;
  teamId: string;
  galaxyId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

/** Assign skeleton posts to captured footage — batch 1 goal: test soundbyte performance */
function generateEditDayInstructions(
  checkIn: CheckInData,
  soundbytes: PlannedSoundbyte[],
  shootNum: number = 1,
  batchNum: number = 1,
): string {
  // Collect usable looks (was shot = true)
  const usableLooks: Array<{
    sceneTitle: string;
    lookDesc: string;
    soundbytesCovered: string[];
    takes: number;
  }> = [];

  for (const scene of checkIn.scenes) {
    if (!scene.wasShot) continue;
    for (const look of scene.looks) {
      if (!look.wasShot) continue;
      usableLooks.push({
        sceneTitle: scene.updatedTitle,
        lookDesc: look.updatedDescription,
        soundbytesCovered: look.soundbytesCovered,
        takes: look.takes,
      });
    }
  }

  if (usableLooks.length === 0) {
    return 'No footage was captured — reschedule shoot before editing.';
  }

  // Distribute 5 posts across usable footage + soundbytes
  // Batch 1 goal: rotate soundbytes to find best performer
  const lines: string[] = [
    `EDIT DAY ${batchNum} — Batch ${shootNum}.${batchNum}`,
    `Goal: Test which soundbyte drives the most engagement.`,
    `Footage link: ${checkIn.footageLink || 'Not provided'}`,
    '',
  ];

  for (let postNum = 1; postNum <= 5; postNum++) {
    const postId = `${shootNum}.${batchNum}${postNum}`;
    const look = usableLooks[(postNum - 1) % usableLooks.length];
    // Rotate soundbytes: 0→1→2→0→1
    const sb = soundbytes[(postNum - 1) % Math.max(soundbytes.length, 1)];
    // Only use soundbytes the look actually covered (fallback to any sb)
    const activeSb = look.soundbytesCovered.includes(sb?.section)
      ? sb
      : soundbytes.find(s => look.soundbytesCovered.includes(s.section)) || sb;

    const targetLen = activeSb ? activeSb.duration.replace('~', '') : '~30s';

    lines.push(`── POST ${postId} ──────────────────────────────`);
    lines.push(`Scene:     ${look.sceneTitle}`);
    lines.push(`Look:      ${look.lookDesc}`);
    lines.push(`Soundbyte: ${activeSb ? `${activeSb.section} — ${activeSb.timeRange}` : 'TBD'}`);
    lines.push(`Length:    ${targetLen} (match soundbyte length ± a few seconds)`);
    lines.push(`Takes:     ${look.takes} available — pick the cleanest`);
    lines.push(`Trial 1 for Post ${postId}: same clip, caption variation A`);
    lines.push(`Trial 2 for Post ${postId}: same clip, caption variation B`);
    lines.push('');
  }

  if (checkIn.notes) {
    lines.push(`SHOOT NOTES: ${checkIn.notes}`);
  }

  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShootCheckInModal({
  task,
  teamId,
  galaxyId,
  onClose,
  onSubmitted,
}: ShootCheckInModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Planned data loaded from galaxy
  const [plannedScenes, setPlannedScenes] = useState<PlannedScene[]>([]);
  const [plannedSoundbytes, setPlannedSoundbytes] = useState<PlannedSoundbyte[]>([]);
  const [plannedLocation, setPlannedLocation] = useState('');

  // Form state
  const [footageLink, setFootageLink] = useState('');
  const [shotAtPlannedLocation, setShotAtPlannedLocation] = useState<boolean | null>(null);
  const [alternateLocations, setAlternateLocations] = useState<AlternateLocation[]>([
    { mapsLink: '', reason: '' },
  ]);
  const [sceneCaptures, setSceneCaptures] = useState<SceneCapture[]>([]);
  const [notes, setNotes] = useState('');

  // If already submitted, load the saved data
  const [existingCheckIn, setExistingCheckIn] = useState<CheckInData | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: gal } = await supabase
          .from('galaxies')
          .select('brainstorm_liked_scenes, brainstorm_draft')
          .eq('id', galaxyId)
          .single();

        const scenes: PlannedScene[] = (gal?.brainstorm_liked_scenes || []).map((s: any, i: number) => ({
          id: s.id || `scene-${i}`,
          title: s.title || `Scene ${i + 1}`,
          action: s.action || s.concept || '',
          setting: s.setting || '',
          looks: (s.looks || []).map((l: any, j: number) => ({
            id: `look-${i}-${j}`,
            description: typeof l === 'string' ? l : l.description || l.label || `Look ${j + 1}`,
          })),
        }));

        const draft = (gal?.brainstorm_draft as any) || {};
        const sbs: PlannedSoundbyte[] = (draft.confirmedSoundbytes || []).map((sb: any) => ({
          id: sb.id || sb.section,
          section: sb.section,
          timeRange: sb.timeRange,
          duration: sb.duration,
        }));
        const location = draft.confirmedLocation || '';

        setPlannedScenes(scenes);
        setPlannedSoundbytes(sbs);
        setPlannedLocation(location);

        // Check if already submitted
        const existing = (task as any).markAnalysis?.checkIn as CheckInData | undefined;
        if (existing?.submittedAt) {
          setExistingCheckIn(existing);
          setSubmitted(true);
        } else {
          // Initialise capture state from planned scenes
          setSceneCaptures(scenes.map(scene => ({
            sceneId: scene.id,
            wasShot: true,
            updatedTitle: scene.title,
            updatedDescription: scene.action || '',
            looks: scene.looks.map(look => ({
              lookId: look.id,
              wasShot: true,
              takes: 3,
              soundbytesCovered: sbs.map(s => s.section),
              updatedDescription: look.description,
            })),
          })));
        }
      } catch (e) {
        console.error('[ShootCheckInModal] load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [galaxyId, task]);

  const updateSceneCapture = (sceneIdx: number, patch: Partial<SceneCapture>) => {
    setSceneCaptures(prev => prev.map((s, i) => i === sceneIdx ? { ...s, ...patch } : s));
  };

  const updateLookCapture = (sceneIdx: number, lookIdx: number, patch: Partial<LookCapture>) => {
    setSceneCaptures(prev => prev.map((s, i) => {
      if (i !== sceneIdx) return s;
      return {
        ...s,
        looks: s.looks.map((l, j) => j === lookIdx ? { ...l, ...patch } : l),
      };
    }));
  };

  const toggleSoundbyteCovered = (sceneIdx: number, lookIdx: number, sbSection: string) => {
    const current = sceneCaptures[sceneIdx]?.looks[lookIdx]?.soundbytesCovered || [];
    const next = current.includes(sbSection)
      ? current.filter(s => s !== sbSection)
      : [...current, sbSection];
    updateLookCapture(sceneIdx, lookIdx, { soundbytesCovered: next });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const checkIn: CheckInData = {
        submittedAt: new Date().toISOString(),
        footageLink,
        shotAtPlannedLocation: shotAtPlannedLocation ?? true,
        plannedLocation,
        alternateLocations: shotAtPlannedLocation === false
          ? alternateLocations.filter(a => a.mapsLink)
          : [],
        scenes: sceneCaptures,
        notes,
      };

      // Save to mark_analysis on the check-in task
      const existing = (task as any).markAnalysis || {};
      await supabase
        .from('team_tasks')
        .update({
          mark_analysis: { ...existing, checkIn },
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // Generate and update Edit Day 1 instructions
      const instructions = generateEditDayInstructions(checkIn, plannedSoundbytes);

      // Find the Edit Day 1 task for this galaxy (closest future edit task)
      const { data: editTasks } = await supabase
        .from('team_tasks')
        .select('id, title, date, description')
        .eq('team_id', teamId)
        .eq('galaxy_id', galaxyId)
        .eq('type', 'edit')
        .gte('date', task.date)
        .order('date', { ascending: true })
        .limit(1);

      if (editTasks && editTasks.length > 0) {
        const editTask = editTasks[0];
        await supabase
          .from('team_tasks')
          .update({
            description: instructions,
            mark_analysis: { editInstructions: instructions, generatedAt: new Date().toISOString() },
          })
          .eq('id', editTask.id);
      }

      // Store alternate location note for future Mark recommendations
      if (shotAtPlannedLocation === false && alternateLocations.some(a => a.mapsLink)) {
        const { data: galData } = await supabase
          .from('galaxies')
          .select('brainstorm_draft')
          .eq('id', galaxyId)
          .single();
        const draft = (galData?.brainstorm_draft as Record<string, unknown>) || {};
        const altLocNote = alternateLocations
          .filter(a => a.mapsLink)
          .map(a => `${a.mapsLink} — ${a.reason}`)
          .join('; ');
        await supabase
          .from('galaxies')
          .update({ brainstorm_draft: { ...draft, alternateLocationNotes: altLocNote } })
          .eq('id', galaxyId);
      }

      setSubmitted(true);
      setExistingCheckIn(checkIn);
      onSubmitted?.();
    } catch (e) {
      console.error('[ShootCheckInModal] submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';
  const labelCls = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block';
  const sectionCls = 'rounded-xl border border-gray-700/60 bg-gray-900/50 p-4 space-y-3';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">🎬 Shoot Check-in</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {task.date ? formatDate(task.date) : ''} · {(task as any).description?.split('\n')[0] || 'Log what was captured today'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl font-light">✕</button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submitted && existingCheckIn ? (
          /* ── Already submitted: read-only summary ── */
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
              <span>✓</span> Check-in submitted — Edit Day instructions generated
            </div>
            {existingCheckIn.footageLink && (
              <div>
                <p className={labelCls}>Footage</p>
                <a
                  href={existingCheckIn.footageLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline text-sm break-all"
                >
                  {existingCheckIn.footageLink}
                </a>
              </div>
            )}
            <div>
              <p className={labelCls}>Scenes captured</p>
              <div className="space-y-2">
                {existingCheckIn.scenes.map(s => (
                  <div key={s.sceneId} className="flex items-start gap-2 text-sm">
                    <span className={s.wasShot ? 'text-green-400' : 'text-gray-600'}>
                      {s.wasShot ? '✓' : '✗'}
                    </span>
                    <div>
                      <span className={s.wasShot ? 'text-white' : 'text-gray-500 line-through'}>{s.updatedTitle}</span>
                      {s.wasShot && (
                        <span className="text-gray-500 text-xs ml-2">
                          {s.looks.filter(l => l.wasShot).length}/{s.looks.length} looks
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        ) : (
          /* ── Check-in form ── */
          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

            {/* Footage Link */}
            <div className={sectionCls}>
              <p className={labelCls}>Footage Link</p>
              <input
                className={inputCls}
                placeholder="Paste Google Drive or Dropbox link..."
                value={footageLink}
                onChange={e => setFootageLink(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className={sectionCls}>
              <p className={labelCls}>Location</p>
              {plannedLocation && (
                <p className="text-sm text-gray-400 mb-2">
                  Planned: <span className="text-white">{plannedLocation}</span>
                </p>
              )}
              <p className="text-sm text-gray-300 mb-2">Did you shoot at the planned location?</p>
              <div className="flex gap-2">
                {[true, false].map(val => (
                  <button
                    key={String(val)}
                    onClick={() => setShotAtPlannedLocation(val)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      shotAtPlannedLocation === val
                        ? val ? 'bg-green-600/30 border-green-500 text-green-300' : 'bg-red-600/20 border-red-500 text-red-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {val ? '✓ Yes' : '✗ No — different location'}
                  </button>
                ))}
              </div>

              {shotAtPlannedLocation === false && (
                <div className="mt-3 space-y-3">
                  {alternateLocations.map((loc, i) => (
                    <div key={i} className="space-y-2 p-3 bg-gray-800/60 rounded-xl border border-gray-700">
                      <input
                        className={inputCls}
                        placeholder="Google Maps link for actual location..."
                        value={loc.mapsLink}
                        onChange={e => setAlternateLocations(prev => prev.map((l, j) => j === i ? { ...l, mapsLink: e.target.value } : l))}
                      />
                      <input
                        className={inputCls}
                        placeholder="Why did you choose this location instead?"
                        value={loc.reason}
                        onChange={e => setAlternateLocations(prev => prev.map((l, j) => j === i ? { ...l, reason: e.target.value } : l))}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setAlternateLocations(prev => [...prev, { mapsLink: '', reason: '' }])}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    + Add another location
                  </button>
                </div>
              )}
            </div>

            {/* Scenes */}
            {plannedScenes.map((scene, si) => {
              const capture = sceneCaptures[si];
              if (!capture) return null;
              return (
                <div key={scene.id} className={sectionCls}>
                  {/* Scene header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => updateSceneCapture(si, { wasShot: !capture.wasShot })}
                        className={`w-5 h-5 rounded border flex items-center justify-center text-xs flex-shrink-0 transition-colors ${
                          capture.wasShot
                            ? 'bg-green-600/40 border-green-500 text-green-300'
                            : 'bg-gray-800 border-gray-600 text-gray-600'
                        }`}
                      >
                        {capture.wasShot ? '✓' : ''}
                      </button>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Scene {si + 1}</p>
                        <input
                          className="w-full bg-transparent border-b border-gray-700 text-sm font-semibold text-white pb-1 focus:outline-none focus:border-purple-500"
                          value={capture.updatedTitle}
                          onChange={e => updateSceneCapture(si, { updatedTitle: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {capture.wasShot && (
                    <>
                      {/* Updated scene description */}
                      <textarea
                        rows={2}
                        className={`${inputCls} resize-none text-xs`}
                        placeholder="Updated scene description (what was actually shot)..."
                        value={capture.updatedDescription}
                        onChange={e => updateSceneCapture(si, { updatedDescription: e.target.value })}
                      />

                      {/* Looks */}
                      <div className="space-y-3">
                        {scene.looks.map((look, li) => {
                          const lc = capture.looks[li];
                          if (!lc) return null;
                          return (
                            <div key={look.id} className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/60 space-y-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateLookCapture(si, li, { wasShot: !lc.wasShot })}
                                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 transition-colors ${
                                    lc.wasShot
                                      ? 'bg-blue-600/40 border-blue-500 text-blue-300'
                                      : 'bg-gray-800 border-gray-600 text-gray-600'
                                  }`}
                                >
                                  {lc.wasShot ? '✓' : ''}
                                </button>
                                <span className="text-xs text-gray-500">Look {li + 1}</span>
                                <input
                                  className="flex-1 bg-transparent border-b border-gray-700 text-xs text-white pb-0.5 focus:outline-none focus:border-blue-500"
                                  value={lc.updatedDescription}
                                  onChange={e => updateLookCapture(si, li, { updatedDescription: e.target.value })}
                                />
                              </div>

                              {lc.wasShot && (
                                <div className="flex flex-wrap items-center gap-3 pl-6">
                                  {/* Takes */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-500">Takes:</span>
                                    {[1, 2, 3, 4, 5].map(n => (
                                      <button
                                        key={n}
                                        onClick={() => updateLookCapture(si, li, { takes: n })}
                                        className={`w-6 h-6 rounded text-[11px] font-medium transition-colors ${
                                          lc.takes === n
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => updateLookCapture(si, li, { takes: Math.max(1, lc.takes + 1) })}
                                      className="text-[11px] text-gray-500 hover:text-gray-300"
                                    >
                                      {lc.takes > 5 ? `${lc.takes} ▾` : '+'}
                                    </button>
                                  </div>

                                  {/* Soundbytes */}
                                  {plannedSoundbytes.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] text-gray-500">Soundbytes:</span>
                                      {plannedSoundbytes.map(sb => (
                                        <button
                                          key={sb.id}
                                          onClick={() => toggleSoundbyteCovered(si, li, sb.section)}
                                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                            lc.soundbytesCovered.includes(sb.section)
                                              ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                                              : 'bg-gray-700 border-gray-600 text-gray-500 hover:border-gray-500'
                                          }`}
                                        >
                                          {sb.section}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Notes */}
            <div className={sectionCls}>
              <p className={labelCls}>Notes</p>
              <textarea
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Anything Mark should know — lighting, energy, unexpected moments, what worked or didn't..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || shotAtPlannedLocation === null}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Edit Day instructions...
                </span>
              ) : (
                'Submit Check-in → Generate Edit Day 1 Instructions'
              )}
            </button>

            {shotAtPlannedLocation === null && (
              <p className="text-center text-xs text-gray-500">Answer the location question above to continue</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
