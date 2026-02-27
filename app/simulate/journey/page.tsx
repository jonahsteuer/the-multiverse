'use client';

/**
 * /simulate/journey — Layer 3: Full User Journey Test
 *
 * A guided manual test runner for the full end-to-end experience.
 * Each step shows what to do, what to expect, and lets you mark pass/fail
 * with optional notes. Progress is saved to localStorage.
 *
 * Run scenarios:
 *   A) Kiss Bang first session (onboarding → galaxy → calendar → todo)
 *   B) Ruby joins (invite acceptance → galaxy view → shared events)
 *   C) Task assignment (Kiss Bang assigns → Ruby receives)
 *   D) Calling Mark (post-onboarding questions)
 */

import { useState, useEffect } from 'react';
import { SimulateNav } from '../SimulateNav';

// ─── types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'pass' | 'fail' | 'skip';

interface JourneyStep {
  id: string;
  phase: string;
  action: string;
  expected: string[];
  watchFor?: string[];
}

interface StepResult {
  status: StepStatus;
  note: string;
}

interface Journey {
  id: string;
  label: string;
  description: string;
  testAccountNote: string;
  steps: JourneyStep[];
}

// ─── journey definitions ──────────────────────────────────────────────────────

const JOURNEYS: Journey[] = [
  {
    id: 'kiss-bang-session-1',
    label: 'Kiss Bang — First Session',
    description: 'Full flow from account creation through calendar review',
    testAccountNote: 'Create a NEW account with creator name "Kiss Bang Test" (not your main account)',
    steps: [
      {
        id: 'signup',
        phase: 'Account Creation',
        action: 'Go to localhost:3000. Fill out the signup form: creator name = "Kiss Bang Test", type = Artist. Hit Enter the Multiverse.',
        expected: [
          'Redirected to conversational onboarding (Mark chat bubble appears)',
          'Mark introduces himself and asks about your music genre',
          'No error screens or blank pages',
        ],
      },
      {
        id: 'onboarding-genre',
        phase: 'Onboarding',
        action: 'Say: "I make Glam Rock"',
        expected: [
          'Mark acknowledges glam rock',
          'Mark asks about musical inspirations (NOT platforms or posting frequency yet)',
        ],
        watchFor: ['Mark skips ahead to posting frequency before getting genre/release info'],
      },
      {
        id: 'onboarding-release',
        phase: 'Onboarding',
        action: 'Work through the conversation: Prince and Djo → "Now You Got It" releasing March 15 (standalone single) → BTS post that got decent engagement → Instagram and TikTok → Used to post 2-3x/week, want 3-4x → Yes have about 20 rough MV clips → None edited → 8 hours/week → Videographer/editor named Ruby',
        expected: [
          'Mark asks ONE question at a time throughout',
          'Mark does NOT ask what your release strategy is (should auto-infer)',
          'Mark does NOT ask about preferred posting days',
          'Mark does NOT ask "does that aesthetic feel right?"',
          'Mark asks how many clips are edited (follow-up after footage question)',
          'Mark gets Ruby\'s name and role specifically',
          'Mark says something like "Perfect, I\'ve got what I need" at the end',
        ],
        watchFor: [
          'Mark asking about preferred posting days (removed question)',
          'Mark asking "what do you want to focus on?" for release strategy',
          'Mark skipping the "how many edited?" follow-up',
          'Mark finishing without capturing team members',
        ],
      },
      {
        id: 'galaxy-view-loads',
        phase: 'Galaxy View',
        action: 'Onboarding completes. Observe what appears next.',
        expected: [
          '"Now You Got It" world appears orbiting the sun in 3D',
          'No overlap between galaxy/sun and the todo list',
          'Galaxy is shifted DOWN so todo list has clear space',
          'Post-onboarding conversation or walkthrough begins',
        ],
        watchFor: ['3D sun overlapping the todo list panel'],
      },
      {
        id: 'todo-list',
        phase: 'Todo List',
        action: 'Look at the todo list panel in the top left.',
        expected: [
          'Task 1: Invite team members',
          'Task 2: Review & organize existing footage (est. ~45m) — because has raw footage',
          'Task 3: Send first batch to Ruby for editing (est. ~20m)',
          'NO "Brainstorm content ideas" task (has footage, skip straight to review)',
          'NO "Plan shoot day" task (has footage)',
          'Times shown as "est. Xm" NOT as "22:10"',
        ],
        watchFor: [
          '"Brainstorm content ideas" appearing (should be review footage instead)',
          'Clock times showing (22:10) instead of estimates',
          'More than 3 tasks on first load',
        ],
      },
      {
        id: 'calendar-week1',
        phase: 'Calendar',
        action: 'Open the calendar view (click the calendar icon or scroll right).',
        expected: [
          'TODAY has at least 2 tasks (review footage + send to Ruby)',
          'Tasks spread across multiple days this week — NOT all on Sunday',
          'Phase label says "Pre-release" for weeks before March 15',
          'Phase label says "Release Week" for the week of March 15',
        ],
        watchFor: [
          'All week tasks piled onto Sunday',
          '"Prep Phase" / "Posting Phase" labels (old static labels)',
        ],
      },
      {
        id: 'calendar-events',
        phase: 'Calendar',
        action: 'Look for post events on the calendar (colored event cards).',
        expected: [
          '3 Teaser posts in the ~1-2 weeks before March 15',
          'Now You Got It Release Day on March 15',
          '3+ Promo posts in the week(s) after March 15',
          'NO Audience Builder post on the day immediately before March 15',
          'Post events show as distinct colored cards (not plain tasks)',
        ],
        watchFor: [
          'Audience Builder on day BEFORE release (should be Teaser)',
          'Only 1 teaser before release (should be 3)',
          'Duplicate post events on same day',
          'Teaser posts AFTER release date',
        ],
      },
      {
        id: 'calendar-scroll',
        phase: 'Calendar',
        action: 'Click the "Next →" button on the calendar to scroll forward.',
        expected: [
          'Calendar advances 4 weeks forward',
          'Post-release promo tasks visible in later weeks',
          '"← Previous" button works to scroll back',
        ],
        watchFor: ['No next/previous buttons visible', 'Button appears but does nothing'],
      },
    ],
  },

  {
    id: 'ruby-joins',
    label: 'Ruby Joins the Galaxy',
    description: 'Invite flow and shared calendar for a team member',
    testAccountNote: 'Use your main Kiss Bang account + a second browser or incognito for Ruby',
    steps: [
      {
        id: 'invite-send',
        phase: 'Invite Flow',
        action: 'As Kiss Bang: click "Invite team members" in the todo list. Fill in Ruby\'s name and your secondary test email. Send invite.',
        expected: [
          'Invite sent confirmation appears',
          'A unique invite link is generated',
          '"Invite team members" task gets a checkmark or is dismissed',
        ],
      },
      {
        id: 'invite-accept',
        phase: 'Invite Flow',
        action: 'Open the invite link in a different browser (incognito). Accept as Ruby. Sign up with a different email.',
        expected: [
          'Ruby lands on the galaxy view for "Now You Got It"',
          'Galaxy shows the same orbiting world as Kiss Bang\'s view',
          '"Now You Got It" world is visible in the 3D view',
        ],
        watchFor: ['Galaxy appears empty (no world orbiting)', 'Ruby sees the signup form instead of the galaxy'],
      },
      {
        id: 'ruby-calendar',
        phase: 'Ruby\'s Calendar',
        action: 'As Ruby, open the calendar.',
        expected: [
          '3 Teaser posts visible (shared from Kiss Bang)',
          '1 Release Day event for Now You Got It on March 15',
          '3+ Promo posts after March 15',
          'NO unassigned tasks from Kiss Bang\'s prep work',
          'ONLY events + any tasks specifically assigned to Ruby',
        ],
        watchFor: [
          'Ruby seeing Kiss Bang\'s "Review footage" or "Upload clips" tasks',
          'No shared events showing (calendar is blank)',
          '6 Audience Builder posts instead of 3 Teaser + 3 Promo',
        ],
      },
    ],
  },

  {
    id: 'task-assignment',
    label: 'Task Assignment',
    description: 'Kiss Bang assigns a task to Ruby',
    testAccountNote: 'Requires both accounts active. Kiss Bang must have Ruby on team.',
    steps: [
      {
        id: 'right-click-todo',
        phase: 'Task Assignment',
        action: 'As Kiss Bang: right-click "Review & organize existing footage" on the todo list.',
        expected: [
          'A small dropdown/menu appears with team member names',
          'Ruby appears as an assignable option',
          'Clicking Ruby assigns the task',
        ],
        watchFor: ['Right-click opens browser context menu instead', 'No team members listed'],
      },
      {
        id: 'task-disappears',
        phase: 'Task Assignment',
        action: 'After assigning to Ruby, look at Kiss Bang\'s todo list and calendar.',
        expected: [
          '"Review & organize existing footage" disappears from Kiss Bang\'s todo list',
          'The task is no longer on Kiss Bang\'s calendar',
        ],
        watchFor: ['Task stays on Kiss Bang\'s list after assigning'],
      },
      {
        id: 'ruby-receives',
        phase: 'Task Assignment',
        action: 'Switch to Ruby\'s account. Check her todo list and calendar.',
        expected: [
          '"Review & organize existing footage" now appears on Ruby\'s todo list',
          'The task appears on Ruby\'s calendar on its scheduled day',
          'Ruby sees ONLY her assigned tasks + the 7 shared events',
        ],
        watchFor: ['Task does not appear on Ruby\'s calendar', 'Ruby sees Kiss Bang\'s entire task list'],
      },
      {
        id: 'right-click-calendar',
        phase: 'Task Assignment',
        action: 'As Kiss Bang: right-click a task directly on the calendar (not the todo list).',
        expected: [
          'Same assignment dropdown appears',
          'Can assign calendar tasks to team members',
        ],
        watchFor: ['Right-click on calendar has no effect'],
      },
    ],
  },

  {
    id: 'call-mark',
    label: 'Calling Mark Post-Onboarding',
    description: 'Testing Mark\'s in-app assistant after setup is complete',
    testAccountNote: 'Use your main Kiss Bang account after full onboarding',
    steps: [
      {
        id: 'mark-button-visible',
        phase: 'Mark UI',
        action: 'After onboarding and walkthrough are complete, look for the Mark button.',
        expected: [
          '"Call Mark" button visible in top right of galaxy view',
          'Button has a small icon or avatar for Mark',
          'Mark chat panel is hidden/minimized until clicked',
        ],
        watchFor: ['Mark is still talking / mic is still active', 'No "Call Mark" button visible'],
      },
      {
        id: 'mark-content-ideas',
        phase: 'Mark Chat',
        action: 'Click "Call Mark". Ask: "My calendar just shows generic posts like Teaser Post. Can you help me turn these into actual post ideas?"',
        expected: [
          'Mark responds with 3-5 specific post concept ideas based on glam rock / Now You Got It',
          'Mark references what he knows about Kiss Bang (genre, MV footage, Ruby)',
          'Ideas fit the teaser phase (before release)',
          'Mark does NOT ask basic questions already answered in onboarding',
        ],
        watchFor: [
          'Mark asks "what genre do you make?" (already knows)',
          'Mark gives generic tips instead of specific ideas',
          'Mark doesn\'t reference the MV footage or Ruby',
        ],
      },
      {
        id: 'mark-posting-frequency',
        phase: 'Mark Chat',
        action: 'Ask Mark: "I\'m currently at 3 posts a week. Should I increase?"',
        expected: [
          'Mark references that 3-4x is a good target',
          'Mark gives a specific recommendation (yes/no) with reasoning',
          'Mark factors in the 8hrs/week budget Kiss Bang mentioned',
        ],
        watchFor: [
          'Mark just says "yes more is better" without reasoning',
          'Mark ignores the time budget constraint',
        ],
      },
      {
        id: 'mark-new-release',
        phase: 'Mark Chat',
        action: 'Ask Mark: "I have a couple more songs I want to release after this one. Can you help me make a plan?"',
        expected: [
          'Mark asks for the names and approximate release dates',
          'Mark keeps asking follow-up questions until he has enough info',
          'Mark recommends a 5-6 week waterfall schedule between releases',
          'Mark confirms with Kiss Bang before adding anything to the calendar',
        ],
        watchFor: [
          'Mark adds releases without asking for names/dates',
          'Mark recommends releases less than 4 weeks apart without explanation',
          'Mark asks Kiss Bang what their "strategy" should be (should recommend)',
        ],
      },
    ],
  },
];

// ─── storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'simulate-journey-results';

function loadResults(): Record<string, Record<string, StepResult>> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveResults(r: Record<string, Record<string, StepResult>>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

// ─── components ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { icon: string; cls: string }> = {
    pending: { icon: '⬜', cls: 'text-gray-500' },
    pass:    { icon: '✅', cls: 'text-green-400' },
    fail:    { icon: '❌', cls: 'text-red-400' },
    skip:    { icon: '⏭️', cls: 'text-gray-600' },
  };
  const { icon, cls } = map[status];
  return <span className={`text-base ${cls}`}>{icon}</span>;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const [journeyId, setJourneyId] = useState(JOURNEYS[0].id);
  const [results, setResults] = useState<Record<string, Record<string, StepResult>>>({});
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => { setResults(loadResults()); }, []);

  const journey = JOURNEYS.find(j => j.id === journeyId)!;
  const journeyResults = results[journeyId] || {};

  function setStepResult(stepId: string, status: StepStatus, note = '') {
    const updated = {
      ...results,
      [journeyId]: {
        ...journeyResults,
        [stepId]: { status, note },
      },
    };
    setResults(updated);
    saveResults(updated);
  }

  function updateNote(stepId: string, note: string) {
    const cur = journeyResults[stepId] || { status: 'pending' as StepStatus, note: '' };
    setStepResult(stepId, cur.status, note);
  }

  function clearJourney() {
    const updated = { ...results };
    delete updated[journeyId];
    setResults(updated);
    saveResults(updated);
  }

  const stepsDone = journey.steps.filter(s => {
    const r = journeyResults[s.id];
    return r?.status === 'pass' || r?.status === 'fail' || r?.status === 'skip';
  }).length;

  const stepsPassed = journey.steps.filter(s => journeyResults[s.id]?.status === 'pass').length;
  const stepsFailed = journey.steps.filter(s => journeyResults[s.id]?.status === 'fail').length;

  // Group steps by phase
  const phases = [...new Set(journey.steps.map(s => s.phase))];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <SimulateNav />

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-49px)]">

        {/* ── left: journey selector + summary ── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Scenario</p>
            <div className="space-y-2">
              {JOURNEYS.map(j => {
                const jr = results[j.id] || {};
                const passed = j.steps.filter(s => jr[s.id]?.status === 'pass').length;
                const failed = j.steps.filter(s => jr[s.id]?.status === 'fail').length;
                const done = j.steps.filter(s => jr[s.id]?.status && jr[s.id].status !== 'pending').length;
                return (
                  <button
                    key={j.id}
                    onClick={() => setJourneyId(j.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      j.id === journeyId
                        ? 'bg-blue-500/10 border-blue-500/40 text-white'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-sm">{j.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{j.steps.length} steps</div>
                    {done > 0 && (
                      <div className="flex gap-2 mt-1">
                        {passed > 0 && <span className="text-[10px] text-green-400">{passed} ✓</span>}
                        {failed > 0 && <span className="text-[10px] text-red-400">{failed} ✗</span>}
                        <span className="text-[10px] text-gray-600">{done}/{j.steps.length}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* current journey summary */}
          <div className="p-4 border-b border-gray-800">
            <div className="bg-gray-900 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-2">{journey.description}</p>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${journey.steps.length ? (stepsDone / journey.steps.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">{stepsDone}/{journey.steps.length} done</span>
                <span className="text-green-400">{stepsPassed} pass</span>
                <span className="text-red-400">{stepsFailed} fail</span>
              </div>
            </div>
            <div className="mt-3 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-[11px] text-yellow-300 font-medium mb-0.5">Test Account</p>
              <p className="text-[10px] text-yellow-200/70">{journey.testAccountNote}</p>
            </div>
            {stepsDone > 0 && (
              <button
                onClick={clearJourney}
                className="mt-2 w-full text-xs text-gray-600 hover:text-red-400 transition-colors"
              >
                Clear progress
              </button>
            )}
          </div>

          {/* phase summary */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Phases</p>
            <div className="space-y-1">
              {phases.map(phase => {
                const phaseSteps = journey.steps.filter(s => s.phase === phase);
                const pPassed = phaseSteps.filter(s => journeyResults[s.id]?.status === 'pass').length;
                const pFailed = phaseSteps.filter(s => journeyResults[s.id]?.status === 'fail').length;
                return (
                  <div key={phase} className="flex items-center gap-2 text-xs py-1 border-b border-gray-800/50">
                    <span className="text-gray-400 flex-1">{phase}</span>
                    {pPassed > 0 && <span className="text-green-400">{pPassed}✓</span>}
                    {pFailed > 0 && <span className="text-red-400">{pFailed}✗</span>}
                    <span className="text-gray-700">{phaseSteps.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── right: steps ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <h2 className="text-white font-semibold text-lg">{journey.label}</h2>

          {phases.map(phase => (
            <div key={phase}>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2 mt-4">{phase}</p>
              <div className="space-y-3">
                {journey.steps.filter(s => s.phase === phase).map(step => {
                  const result = journeyResults[step.id] || { status: 'pending' as StepStatus, note: '' };
                  const isExpanded = expandedStep === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`border rounded-xl overflow-hidden transition-colors ${
                        result.status === 'pass' ? 'border-green-500/30 bg-green-500/5' :
                        result.status === 'fail' ? 'border-red-500/30 bg-red-500/5' :
                        result.status === 'skip' ? 'border-gray-700/50 bg-gray-900/30 opacity-60' :
                        'border-gray-700 bg-gray-900/50'
                      }`}
                    >
                      {/* header row */}
                      <div
                        className="flex items-start gap-3 p-4 cursor-pointer"
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      >
                        <StatusBadge status={result.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-snug">{step.action}</p>
                          {result.note && !isExpanded && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">Note: {result.note}</p>
                          )}
                        </div>
                        <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-800/50 pt-3">
                          {/* expected */}
                          <div>
                            <p className="text-[11px] text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Expected</p>
                            <ul className="space-y-1">
                              {step.expected.map((e, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                  <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                                  <span>{e}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* watch for */}
                          {step.watchFor && step.watchFor.length > 0 && (
                            <div>
                              <p className="text-[11px] text-red-400/80 mb-1.5 font-medium uppercase tracking-wider">Watch For</p>
                              <ul className="space-y-1">
                                {step.watchFor.map((w, i) => (
                                  <li key={i} className="text-sm text-red-300/70 flex items-start gap-2">
                                    <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                                    <span>{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* notes */}
                          <div>
                            <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wider">Notes</p>
                            <textarea
                              value={result.note}
                              onChange={e => updateNote(step.id, e.target.value)}
                              placeholder="What did you observe? Any bugs?"
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-gray-500"
                              rows={2}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>

                          {/* action buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); setStepResult(step.id, 'pass', result.note); }}
                              className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
                            >
                              ✅ Pass
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setStepResult(step.id, 'fail', result.note); }}
                              className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                            >
                              ❌ Fail
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setStepResult(step.id, 'skip', result.note); }}
                              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* summary card when all done */}
          {stepsDone === journey.steps.length && journey.steps.length > 0 && (
            <div className={`mt-6 p-5 rounded-xl border text-center ${
              stepsFailed === 0
                ? 'bg-green-500/10 border-green-500/40'
                : 'bg-yellow-500/10 border-yellow-500/40'
            }`}>
              <p className="text-2xl mb-2">{stepsFailed === 0 ? '🎉' : '⚠️'}</p>
              <p className="text-white font-semibold text-lg">
                {stepsFailed === 0 ? 'All steps passed!' : `${stepsFailed} issue${stepsFailed > 1 ? 's' : ''} found`}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {stepsPassed}/{journey.steps.length} passed · {stepsFailed} failed · {journey.steps.length - stepsDone} skipped
              </p>
              {stepsFailed > 0 && (
                <div className="mt-3 text-left">
                  <p className="text-xs text-yellow-400 mb-2 font-medium">Failed steps:</p>
                  {journey.steps.filter(s => journeyResults[s.id]?.status === 'fail').map(s => (
                    <div key={s.id} className="text-xs text-red-300 mb-1">
                      <span className="text-red-400">❌</span> {s.action.substring(0, 80)}…
                      {journeyResults[s.id]?.note && (
                        <p className="text-gray-500 ml-4">Note: {journeyResults[s.id].note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
