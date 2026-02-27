'use client';

/**
 * /simulate/chat — Layer 2: Onboarding Chat Simulation
 *
 * Runs a scripted conversation through /api/onboarding-chat, then checks the
 * extracted profile data against what we expect for each artist persona.
 * No auth required.
 */

import { useState, useRef, useEffect } from 'react';
import { SimulateNav } from '../SimulateNav';

// ─── scripted conversations ───────────────────────────────────────────────────

interface ScriptLine {
  role: 'user';
  content: string;
}

interface ProfileCheck {
  label: string;
  pass: (p: any) => boolean;
  note?: string;
}

interface ChatScenario {
  id: string;
  label: string;
  creatorName: string;
  tagline: string;
  script: ScriptLine[];
  checks: ProfileCheck[];
}

const SCENARIOS: ChatScenario[] = [
  {
    id: 'kiss-bang',
    label: 'Kiss Bang',
    creatorName: 'Kiss Bang',
    tagline: 'Glam rock · 20 rough MV clips · Editor Ruby · Release in ~18 days',
    script: [
      { role: 'user', content: 'I make Glam Rock' },
      { role: 'user', content: 'Prince and Djo' },
      { role: 'user', content: 'Yes I have a song coming out March 15th called Now You Got It' },
      { role: 'user', content: "It's a standalone single" },
      { role: 'user', content: "I posted a BTS clip from my music video shoot and it got decent engagement" },
      { role: 'user', content: 'Instagram and TikTok' },
      { role: 'user', content: "Haven't posted in a couple months. Used to post 2-3 times a week around my last release" },
      { role: 'user', content: 'Probably 3-4 times a week this time' },
      { role: 'user', content: 'Yes, I have about 20 rough clips from the music video shoot plus some BTS footage' },
      { role: 'user', content: 'None of them are edited yet' },
      { role: 'user', content: 'About 8 hours per week' },
      { role: 'user', content: 'I have a videographer and editor named Ruby' },
    ],
    checks: [
      {
        label: 'Genre captured as glam/rock',
        pass: (p) => p?.genre?.some((g: string) => /glam|rock/i.test(g)),
      },
      {
        label: 'Release "Now You Got It" captured',
        pass: (p) => p?.releases?.some((r: any) => /now you got it/i.test(r.name || '')),
      },
      {
        label: 'Release date is March 15 2026',
        pass: (p) => p?.releases?.some((r: any) => /2026-03-15|march 15/i.test(r.releaseDate || '')),
        note: 'Should be "2026-03-15" in the profile',
      },
      {
        label: 'editedClipCount = 0',
        pass: (p) => p?.editedClipCount === 0 || p?.editedClipCount === null,
      },
      {
        label: 'rawFootageDescription mentions footage/clips',
        pass: (p) => /clip|footage|rough|video|bts/i.test(p?.rawFootageDescription || ''),
      },
      {
        label: 'timeBudgetHoursPerWeek = 8',
        pass: (p) => p?.timeBudgetHoursPerWeek === 8,
      },
      {
        label: 'teamMembers includes Ruby',
        pass: (p) => p?.teamMembers?.some((m: any) => /ruby/i.test(m.name || '')),
      },
      {
        label: 'Ruby has editor or videographer role',
        pass: (p) => p?.teamMembers?.some((m: any) =>
          /ruby/i.test(m.name || '') && /edit|videograph/i.test(m.role || '')
        ),
      },
      {
        label: 'hasTeam = true',
        pass: (p) => p?.hasTeam === true,
      },
      {
        label: 'preferredDays NOT captured (removed question)',
        pass: (p) => !p?.preferredDays || p.preferredDays.length === 0,
        note: 'This question was removed from onboarding',
      },
      {
        label: 'releaseStrategy = build_to_release (auto-inferred)',
        pass: (p) => p?.releaseStrategy === 'build_to_release',
        note: 'Should be inferred, not asked',
      },
      {
        label: 'isComplete = true at end',
        pass: (p) => p?.isComplete === true,
      },
    ],
  },

  {
    id: 'leon-tax',
    label: 'Leon Tax',
    creatorName: 'Leon Tax',
    tagline: 'Alt R&B · No footage · Videographer Carlos · Release in ~6 weeks',
    script: [
      { role: 'user', content: 'Alt R&B, kind of soulful indie vibes' },
      { role: 'user', content: 'Frank Ocean and Steve Lacy' },
      { role: 'user', content: "I have a single I want to release in about 6 weeks" },
      { role: 'user', content: "It's called Hesitate" },
      { role: 'user', content: "I haven't really posted much, mostly just casual stuff" },
      { role: 'user', content: 'Instagram and TikTok' },
      { role: 'user', content: 'Maybe once a month right now. I want to get to 2-3 times a week' },
      { role: 'user', content: "No I don't have any footage yet, starting from scratch" },
      { role: 'user', content: 'About 6 hours a week' },
      { role: 'user', content: 'I have a videographer who also does editing, his name is Carlos' },
    ],
    checks: [
      {
        label: 'Genre captured as R&B / soul / indie',
        pass: (p) => p?.genre?.some((g: string) => /r.b|soul|indie|rnb/i.test(g)),
      },
      {
        label: 'Release "Hesitate" captured',
        pass: (p) => p?.releases?.some((r: any) => /hesitate/i.test(r.name || '')),
      },
      {
        label: 'Release date ~6 weeks from now',
        pass: (p) => {
          const rel = p?.releases?.find((r: any) => /hesitate/i.test(r.name || ''));
          if (!rel?.releaseDate) return false;
          const d = new Date(rel.releaseDate);
          const weeksOut = (d.getTime() - Date.now()) / (7 * 24 * 3600 * 1000);
          return weeksOut > 4 && weeksOut < 9;
        },
        note: 'Should be roughly 6 weeks from today',
      },
      {
        label: 'editedClipCount = 0 or null',
        pass: (p) => p?.editedClipCount === 0 || p?.editedClipCount === null,
      },
      {
        label: 'rawFootageDescription is empty (no footage)',
        pass: (p) => !p?.rawFootageDescription || p.rawFootageDescription.trim() === '',
        note: '"Starting from scratch" — no raw footage',
      },
      {
        label: 'timeBudgetHoursPerWeek = 6',
        pass: (p) => p?.timeBudgetHoursPerWeek === 6,
      },
      {
        label: 'teamMembers includes Carlos',
        pass: (p) => p?.teamMembers?.some((m: any) => /carlos/i.test(m.name || '')),
      },
      {
        label: 'Carlos has videographer or editor role',
        pass: (p) => p?.teamMembers?.some((m: any) =>
          /carlos/i.test(m.name || '') && /videograph|edit/i.test(m.role || '')
        ),
      },
      {
        label: 'hasTeam = true',
        pass: (p) => p?.hasTeam === true,
      },
      {
        label: 'releaseStrategy = build_to_release (auto-inferred)',
        pass: (p) => p?.releaseStrategy === 'build_to_release',
      },
      {
        label: 'isComplete = true at end',
        pass: (p) => p?.isComplete === true,
      },
    ],
  },
];

// ─── types ────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  profileData?: any;
  isComplete?: boolean;
}

type RunState = 'idle' | 'running' | 'done' | 'error';

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ChatSimulatePage() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [finalProfile, setFinalProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgDelayMs, setMsgDelayMs] = useState(800);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  const scenario = SCENARIOS.find(s => s.id === scenarioId)!;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function reset() {
    runningRef.current = false;
    setMessages([]);
    setRunState('idle');
    setStepIndex(0);
    setFinalProfile(null);
    setError(null);
  }

  async function runSimulation() {
    reset();
    await new Promise(r => setTimeout(r, 50));
    runningRef.current = true;
    setRunState('running');

    const history: ConversationMessage[] = [];
    let latestProfile: any = null;

    for (let i = 0; i < scenario.script.length; i++) {
      if (!runningRef.current) break;

      const userMsg = scenario.script[i];
      setStepIndex(i + 1);

      // Show user message
      history.push({ role: 'user', content: userMsg.content });
      setMessages([...history]);

      // Small delay before sending
      await new Promise(r => setTimeout(r, msgDelayMs));
      if (!runningRef.current) break;

      // Build API payload: interleave roles for Claude
      const apiMessages = history.map(m => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch('/api/onboarding-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            creatorName: scenario.creatorName,
            userId: 'sim-test-user',
          }),
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}: ${await res.text()}`);
        }

        const data = await res.json();
        if (data.profileData) latestProfile = data.profileData;

        const assistantMsg: ConversationMessage = {
          role: 'assistant',
          content: data.message,
          profileData: data.profileData,
          isComplete: data.isComplete,
        };
        history.push(assistantMsg);
        setMessages([...history]);
        setFinalProfile({ ...latestProfile, isComplete: data.isComplete || latestProfile?.isComplete });

        if (data.isComplete) {
          setRunState('done');
          return;
        }

        await new Promise(r => setTimeout(r, msgDelayMs / 2));
      } catch (err: any) {
        setError(err.message);
        setRunState('error');
        return;
      }
    }

    setRunState('done');
  }

  const passCount = finalProfile
    ? scenario.checks.filter(c => { try { return c.pass(finalProfile); } catch { return false; } }).length
    : 0;
  const totalChecks = scenario.checks.length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <SimulateNav />

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-49px)]">

        {/* ── left: config + checks ── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">

          {/* scenario selector */}
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Scenario</p>
            <div className="flex flex-col gap-2">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setScenarioId(s.id); reset(); }}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    s.id === scenarioId
                      ? 'bg-yellow-500/10 border-yellow-500/50 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{s.tagline}</div>
                </button>
              ))}
            </div>
          </div>

          {/* controls */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs text-gray-500">Delay</label>
              <input
                type="range" min={200} max={3000} step={100}
                value={msgDelayMs}
                onChange={e => setMsgDelayMs(+e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-12">{msgDelayMs}ms</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={runSimulation}
                disabled={runState === 'running'}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  runState === 'running'
                    ? 'bg-yellow-500/20 text-yellow-400 cursor-not-allowed'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                }`}
              >
                {runState === 'running' ? `Sending ${stepIndex}/${scenario.script.length}…` : '▶ Run'}
              </button>
              {runState !== 'idle' && (
                <button
                  onClick={reset}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {runState === 'running' && (
              <div className="mt-2">
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all duration-300"
                    style={{ width: `${(stepIndex / scenario.script.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* profile checks */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Profile Checks</p>
              {finalProfile && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  passCount === totalChecks
                    ? 'bg-green-500/20 text-green-400'
                    : passCount >= totalChecks * 0.7
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {passCount}/{totalChecks}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {scenario.checks.map((c, i) => {
                let status: 'pass' | 'fail' | 'pending' = 'pending';
                if (finalProfile) {
                  try { status = c.pass(finalProfile) ? 'pass' : 'fail'; }
                  catch { status = 'fail'; }
                }
                return (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border text-sm transition-colors ${
                      status === 'pass' ? 'bg-green-500/10 border-green-500/30' :
                      status === 'fail' ? 'bg-red-500/10 border-red-500/30' :
                      'bg-gray-900 border-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⬜'}
                      </span>
                      <div>
                        <p className={`text-xs leading-snug ${
                          status === 'pass' ? 'text-green-300' :
                          status === 'fail' ? 'text-red-300' :
                          'text-gray-400'
                        }`}>
                          {c.label}
                        </p>
                        {c.note && status === 'fail' && (
                          <p className="text-[10px] text-red-400/70 mt-0.5">{c.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* extracted profile data */}
            {finalProfile && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 mb-2">
                  Extracted profile JSON
                </summary>
                <pre className="text-[10px] text-green-400 bg-black/40 rounded p-2 overflow-x-auto max-h-64">
                  {JSON.stringify(finalProfile, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* ── right: conversation ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
            <span className="text-sm text-white font-medium">
              {scenario.creatorName} → Onboarding with Mark
            </span>
            <span className="text-xs text-gray-500">
              {scenario.script.length} scripted messages
            </span>
            {runState === 'done' && (
              <span className="ml-auto text-xs text-green-400 font-medium">
                ✓ Onboarding complete
              </span>
            )}
            {runState === 'error' && (
              <span className="ml-auto text-xs text-red-400 font-medium">
                ✗ Error — check console
              </span>
            )}
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-600 pt-16">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm">Hit Run to start the simulation</p>
                <p className="text-xs mt-1 text-gray-700">
                  {scenario.script.length} messages will be sent to /api/onboarding-chat
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-yellow-500/20 text-yellow-100 rounded-br-sm'
                    : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' && (
                    <p className="text-[10px] text-gray-500 mb-1 font-medium">Mark</p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.isComplete && (
                    <p className="text-[10px] text-green-400 mt-1">[ONBOARDING_COMPLETE]</p>
                  )}
                  {msg.profileData && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-gray-500 cursor-pointer">
                        profile_data snapshot
                      </summary>
                      <pre className="text-[9px] text-green-400/80 mt-1 overflow-x-auto max-h-32">
                        {JSON.stringify(msg.profileData, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {runState === 'running' && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-sm text-red-300">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>

          {/* script preview */}
          <div className="border-t border-gray-800 p-3">
            <p className="text-[10px] text-gray-600 mb-1 font-medium uppercase tracking-wider">Script Preview</p>
            <div className="flex gap-1.5 flex-wrap">
              {scenario.script.map((s, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    i < stepIndex
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                      : 'bg-gray-900 border-gray-800 text-gray-600'
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
