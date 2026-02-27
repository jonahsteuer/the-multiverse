'use client';

/**
 * /simulate — Developer testing page for calendar + onboarding output validation.
 *
 * No auth required. Shows EnhancedCalendar + todo list rendered from fixture
 * profiles so you can verify calendar generation logic without going through
 * the full onboarding flow.
 *
 * Add ?scenario=kiss-bang-raw (or any scenario id) to deep-link.
 */

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TeamTask } from '@/types';
import { SCENARIOS, type SimScenario, daysFromNow } from '@/lib/simulate-profiles';
import { SimulateNav } from './SimulateNav';

const EnhancedCalendar = dynamic(
  () => import('@/components/multiverse/EnhancedCalendar').then(mod => ({ default: mod.EnhancedCalendar })),
  { ssr: false, loading: () => <div className="p-8 text-yellow-400 animate-pulse">Loading calendar…</div> }
);

// ─── tier colours ────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  'content-ready': { bg: 'bg-green-500/10', border: 'border-green-500/40', badge: 'bg-green-500/20 text-green-300' },
  'raw-footage':   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', badge: 'bg-yellow-500/20 text-yellow-300' },
  'content-light': { bg: 'bg-blue-500/10', border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-300' },
  'solo':          { bg: 'bg-purple-500/10', border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-300' },
};

const TIER_LABELS: Record<string, string> = {
  'content-ready': 'Content Ready',
  'raw-footage':   'Raw Footage',
  'content-light': 'Content Light',
  'solo':          'Solo / No Content',
};

// ─── todo task generator (mirrors GalaxyView's displayTasks logic) ───────────

function generateDefaultTodos(scenario: SimScenario): { title: string; est: string; type: string }[] {
  const { artistProfile, teamMembers } = scenario;
  const editedClipCount = (artistProfile as any).editedClipCount ?? 0;
  const rawFootageDesc: string = (artistProfile as any).rawFootageDescription || '';
  const hasRawFootage = rawFootageDesc.length > 0;
  const isContentReady = editedClipCount >= 10;
  const hasRawButNoEdited = !isContentReady && hasRawFootage;

  const roughMatch = rawFootageDesc.match(/\b(\d+)\b/);
  const roughClipCount = roughMatch ? parseInt(roughMatch[1]) : 10;

  const editorMember = teamMembers.find(m =>
    m.role?.toLowerCase().includes('edit') || m.role?.toLowerCase().includes('videograph')
  );
  const editorName = editorMember?.displayName;

  const tasks: { title: string; est: string; type: string }[] = [
    { title: 'Invite team members', est: 'est. 15m', type: 'invite' },
  ];

  if (isContentReady) {
    tasks.push({ title: `Upload post edits 1–10`, est: 'est. 30m', type: 'prep' });
    if (editorName) {
      tasks.push({ title: `Send edit notes to ${editorName}`, est: 'est. 20m', type: 'prep' });
    }
    tasks.push({ title: 'Finalize posts', est: 'est. 25m', type: 'prep' });
  } else if (hasRawButNoEdited) {
    const batchOne = Math.min(10, roughClipCount);
    tasks.push({ title: `Review & organize existing footage`, est: 'est. 45m', type: 'prep' });
    tasks.push({
      title: editorName
        ? `Send first batch to ${editorName} for editing`
        : `Edit first batch (posts 1–${batchOne})`,
      est: 'est. 20m',
      type: 'prep',
    });
  } else {
    tasks.push({ title: 'Brainstorm content ideas', est: 'est. 45m', type: 'brainstorm' });
    tasks.push({
      title: editorName ? `Plan shoot day with ${editorName}` : 'Plan shoot day',
      est: 'est. 30m',
      type: 'prep',
    });
  }

  return tasks;
}

// ─── todo list preview component ────────────────────────────────────────────

function TodoPreview({ scenario }: { scenario: SimScenario }) {
  const todos = generateDefaultTodos(scenario);
  return (
    <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white font-semibold text-sm">📋 TODO LIST</span>
        <span className="text-gray-500 text-xs ml-auto">{todos.length} tasks</span>
      </div>
      <div className="space-y-2">
        {todos.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-black/30">
            <div className="w-4 h-4 rounded border border-gray-600 flex-shrink-0" />
            <span className="text-sm text-white flex-1">{t.title}</span>
            <span className="text-[11px] text-gray-500 font-mono">{t.est}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── expected outcomes panel ─────────────────────────────────────────────────

function ExpectedOutcomes({ scenario }: { scenario: SimScenario }) {
  return (
    <div className="space-y-4">
      {/* Expected todo */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Expected Todo Tasks</p>
        <ul className="space-y-1">
          {scenario.expectedTodos.map((t, i) => (
            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Expected calendar */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Expected Calendar Shape</p>
        <ul className="space-y-1">
          {scenario.expectedCalendar.map((t, i) => (
            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Watch for */}
      <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
        <p className="text-xs text-red-400 mb-2 font-medium uppercase tracking-wider">Watch For (Known Bug Patterns)</p>
        <ul className="space-y-1">
          {scenario.watchFor.map((t, i) => (
            <li key={i} className="text-sm text-red-300/80 flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">{t.startsWith('❌') ? '' : '⚠️'}</span>
              <span>{t.startsWith('❌') ? t : t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── profile summary card ─────────────────────────────────────────────────────

function ProfileSummary({ scenario }: { scenario: SimScenario }) {
  const style = TIER_STYLES[scenario.tier];
  const profile = scenario.artistProfile as any;
  const releaseDate = profile.releases?.[0]?.releaseDate;
  return (
    <div className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-white text-lg">{scenario.artistName}</p>
          <p className="text-gray-400 text-sm">"{scenario.songName}"</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${style.badge}`}>
          {TIER_LABELS[scenario.tier]}
        </span>
      </div>
      <p className="text-gray-400 text-sm mb-3">{scenario.tagline}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-black/20 rounded-lg p-2">
          <p className="text-gray-500">Release</p>
          <p className="text-white">{releaseDate || 'TBD'} <span className="text-gray-400">({scenario.releaseDaysFromNow}d)</span></p>
        </div>
        <div className="bg-black/20 rounded-lg p-2">
          <p className="text-gray-500">Time Budget</p>
          <p className="text-white">{profile.timeBudgetHoursPerWeek}h / week</p>
        </div>
        <div className="bg-black/20 rounded-lg p-2">
          <p className="text-gray-500">Edited Clips</p>
          <p className="text-white">{profile.editedClipCount || 0}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-2">
          <p className="text-gray-500">Team</p>
          <p className="text-white">
            {scenario.teamMembers.length > 0
              ? scenario.teamMembers.map(m => `${m.displayName} (${m.role})`).join(', ')
              : 'Solo'}
          </p>
        </div>
        {profile.rawFootageDescription && (
          <div className="col-span-2 bg-black/20 rounded-lg p-2">
            <p className="text-gray-500">Raw Footage</p>
            <p className="text-white">{profile.rawFootageDescription}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SimulatePage() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const [jsonOpen, setJsonOpen] = useState(false);

  // read ?scenario= from URL on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('scenario');
    if (p && SCENARIOS.find(s => s.id === p)) setActiveId(p);
  }, []);

  const scenario = useMemo(() => SCENARIOS.find(s => s.id === activeId)!, [activeId]);

  // Keep release date fresh (relative to today)
  const profile = useMemo(() => {
    const p = { ...scenario.artistProfile } as any;
    if (p.releases?.length) {
      p.releases = p.releases.map((r: any) => ({
        ...r,
        releaseDate: daysFromNow(scenario.releaseDaysFromNow),
      }));
    }
    return p;
  }, [scenario]);

  const releaseDate = daysFromNow(scenario.releaseDaysFromNow);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <SimulateNav />

      {/* ── scenario tabs ── */}
      <div className="px-6 pt-4 pb-3">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">Select Scenario</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map(s => {
            const style = TIER_STYLES[s.tier];
            const active = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  active
                    ? `${style.bg} ${style.border} text-white shadow-lg`
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── main split ── */}
      <div className="flex gap-0 h-[calc(100vh-110px)]">

        {/* ── left column ── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800 overflow-y-auto p-4 space-y-4">
          <ProfileSummary scenario={scenario} />
          <TodoPreview scenario={scenario} />
          <ExpectedOutcomes scenario={scenario} />

          {/* profile JSON toggle */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setJsonOpen(o => !o)}
              className="w-full px-4 py-2.5 text-xs text-gray-400 hover:text-white flex items-center justify-between transition-colors"
            >
              <span>Profile JSON</span>
              <span>{jsonOpen ? '▲' : '▼'}</span>
            </button>
            {jsonOpen && (
              <pre className="p-3 text-[10px] text-green-400 overflow-x-auto bg-black/40 max-h-80">
                {JSON.stringify(profile, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* ── right column: calendar ── */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-white font-semibold">
              {scenario.songName} — Calendar Preview
            </h2>
            <span className="text-xs text-gray-500">
              Release: {releaseDate} ({scenario.releaseDaysFromNow} days from now)
            </span>
            <span className="ml-auto text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
              admin view · no Google Sync · no DB
            </span>
          </div>

          <EnhancedCalendar
            key={scenario.id}
            songName={scenario.songName}
            releaseDate={releaseDate}
            artistProfile={profile}
            teamMembers={scenario.teamMembers}
            userPermissions="full"
            showGoogleSync={false}
            teamTasks={[]}
            currentUserId="sim-admin-user"
            onTaskComplete={() => {}}
            onSharedEventsGenerated={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
