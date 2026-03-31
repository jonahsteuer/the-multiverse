'use client';

import { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatTurn {
  role: 'mark' | 'user';
  content: string;
  tiersActive?: string[];
}

interface AccountSummary {
  username: string;
  postCount: number;
  avgER: number;
  medianER: number;
  avgViews: number;
  bestDayOfWeek: string;
  bestHourRange: string;
  bestDurationBucket: string;
  captionInsights: string[];
  growthSignal: string;
}

interface TopPost {
  er: number;
  views: number;
  duration: number;
  caption: string;
  durationBucket: string;
  dayOfWeek: string;
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    'Tier 1': 'bg-gray-700 text-gray-300',
    'Tier 2': 'bg-blue-900 text-blue-300',
    'Tier 3': 'bg-emerald-900 text-emerald-300',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${colors[tier] ?? 'bg-gray-800 text-gray-400'}`}>
      {tier}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  // Account / scrape state
  const [username, setUsername] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [tier3Context, setTier3Context] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [tiersActive, setTiersActive] = useState<string[]>(['Tier 1', 'Tier 2']);
  const [sessionId] = useState(() => `intel-${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Feedback state
  const [feedbackTarget, setFeedbackTarget] = useState<{ index: number; content: string } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'good' | 'needs_work' | 'wrong' | 'neutral'>('neutral');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState<number | null>(null);

  // Log state
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    fetch('/api/mark/train/intelligence/feedback').then(r => r.json()).then(d => setLogCount(d.count ?? 0));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // ── Send greeting when page loads (or when Tier 3 activates) ──────────────

  async function sendGreeting(t3: string, summary: AccountSummary | null) {
    setChatLoading(true);
    const greeting = summary
      ? `I just scraped @${summary.username} — ${summary.postCount} posts, ${summary.avgER}% avg ER. Brief me on what you're seeing and what I should be working on.`
      : `I haven't connected an account yet. Give me a quick rundown of what you know right now (Tier 1 + Tier 2) and what you'd need from me to get more specific.`;

    const userTurn: ChatTurn = { role: 'user', content: greeting };
    setMessages([userTurn]);

    try {
      const res = await fetch('/api/mark/train/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: greeting }],
          tier3Context: t3,
          sessionId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([userTurn, { role: 'mark', content: data.reply, tiersActive: data.tiersActive }]);
      setTiersActive(data.tiersActive ?? ['Tier 1', 'Tier 2']);
    } catch (e: any) {
      setMessages([userTurn, { role: 'mark', content: `Error: ${e.message}`, tiersActive: [] }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Scrape account ─────────────────────────────────────────────────────────

  async function handleScrape() {
    if (!username.trim()) return;
    setScraping(true);
    setScrapeError('');
    try {
      const res = await fetch('/api/mark/train/intelligence/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAccountSummary(data.accountSummary);
      setTopPosts(data.topPosts ?? []);
      setTier3Context(data.tier3Context ?? '');
      setMessages([]);
      await sendGreeting(data.tier3Context ?? '', data.accountSummary);
    } catch (e: any) {
      setScrapeError(e.message ?? 'Scrape failed');
    } finally {
      setScraping(false);
    }
  }

  // ── Send chat message ──────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setChatLoading(true);

    const newUserTurn: ChatTurn = { role: 'user', content: text };
    const updatedMessages = [...messages, newUserTurn];
    setMessages(updatedMessages);

    const apiMessages = updatedMessages.map(m => ({
      role: m.role === 'mark' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/mark/train/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, tier3Context, sessionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([...updatedMessages, { role: 'mark', content: data.reply, tiersActive: data.tiersActive }]);
      setTiersActive(data.tiersActive ?? tiersActive);
    } catch (e: any) {
      setMessages([...updatedMessages, { role: 'mark', content: `Error: ${e.message}`, tiersActive: [] }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Submit feedback ────────────────────────────────────────────────────────

  async function handleFeedback() {
    if (!feedbackTarget || !feedbackText.trim()) return;
    setFeedbackSaving(true);
    try {
      const res = await fetch('/api/mark/train/intelligence/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          markResponse: feedbackTarget.content,
          userFeedback: feedbackText.trim(),
          feedbackType,
          tiersActive,
          username: accountSummary?.username,
        }),
      });
      const data = await res.json();
      setLogCount(data.logCount ?? logCount + 1);
      setFeedbackSaved(feedbackTarget.index);
      setFeedbackTarget(null);
      setFeedbackText('');
      setFeedbackType('neutral');
    } catch (e: any) {
      alert('Error saving feedback: ' + e.message);
    } finally {
      setFeedbackSaving(false);
    }
  }

  const hasStarted = messages.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="border-b border-gray-800 pb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-yellow-400 tracking-wide">MARK — 3-TIER INTELLIGENCE</h1>
              <span className="text-xs text-gray-600 border border-gray-800 rounded px-2 py-0.5">TESTING</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Developer Only · Feedback logs to <code className="text-gray-600">lib/mark-intelligence-training-log.json</code></p>
          </div>
          {logCount > 0 && (
            <div className="text-xs text-gray-600 text-right">
              <div className="text-yellow-600 font-bold">{logCount}</div>
              <div>logged</div>
            </div>
          )}
        </div>

        {/* Tier status bar */}
        <div className="flex gap-3 items-center bg-gray-900 border border-gray-800 rounded px-4 py-2.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Active tiers:</span>
          <div className="flex items-center gap-1.5">
            <TierBadge tier="Tier 1" />
            <span className="text-gray-700 text-xs">Universal truths</span>
          </div>
          <span className="text-gray-700">·</span>
          <div className="flex items-center gap-1.5">
            <TierBadge tier="Tier 2" />
            <span className="text-gray-700 text-xs">Live trends</span>
          </div>
          <span className="text-gray-700">·</span>
          <div className="flex items-center gap-1.5">
            {tiersActive.includes('Tier 3')
              ? <><TierBadge tier="Tier 3" /><span className="text-gray-700 text-xs">@{accountSummary?.username}</span></>
              : <><span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-600">Tier 3</span><span className="text-gray-700 text-xs">no account</span></>
            }
          </div>
        </div>

        {/* Account setup */}
        <div className="space-y-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Artist Instagram Account</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !scraping && handleScrape()}
              placeholder="@username or username"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleScrape}
              disabled={scraping || !username.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded disabled:opacity-40 hover:bg-emerald-500 transition-colors whitespace-nowrap"
            >
              {scraping ? 'Scraping…' : 'Build Tier 3'}
            </button>
          </div>
          {scrapeError && <div className="text-xs text-red-400">{scrapeError}</div>}
          {scraping && (
            <div className="text-xs text-gray-500 animate-pulse">
              Scraping account via Apify → analyzing post history → building Tier 3 context…
            </div>
          )}
        </div>

        {/* Account summary card */}
        {accountSummary && (
          <div className="bg-gray-900 border border-emerald-900/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-emerald-400">@{accountSummary.username}</div>
              <div className="text-xs text-gray-500">{accountSummary.postCount} posts analyzed</div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Avg ER', value: `${accountSummary.avgER}%` },
                { label: 'Avg Views', value: accountSummary.avgViews.toLocaleString() },
                { label: 'Best Day', value: accountSummary.bestDayOfWeek },
                { label: 'Best Length', value: accountSummary.bestDurationBucket },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-sm font-bold text-gray-100 mt-0.5">{value}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400">{accountSummary.growthSignal}</div>
            {accountSummary.captionInsights.length > 0 && (
              <div className="space-y-1">
                {accountSummary.captionInsights.map((insight, i) => (
                  <div key={i} className="text-xs text-gray-400 flex gap-2">
                    <span className="text-emerald-500 shrink-0">→</span>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            )}
            {topPosts.length > 0 && (
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                  Top {topPosts.length} posts by ER
                </summary>
                <div className="mt-2 space-y-1">
                  {topPosts.map((p, i) => (
                    <div key={i} className="flex gap-3 text-xs text-gray-400 border border-gray-800 rounded px-2 py-1.5">
                      <span className="text-emerald-500 font-bold shrink-0">{p.er.toFixed(2)}%</span>
                      <span className="text-gray-600 shrink-0">{p.views.toLocaleString()}v</span>
                      <span className="text-gray-600 shrink-0">{p.duration}s</span>
                      <span className="truncate">{p.caption}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Start chat button (if no account but want to chat anyway) */}
        {!hasStarted && !scraping && (
          <button
            onClick={() => sendGreeting('', null)}
            disabled={chatLoading}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm font-bold rounded hover:border-yellow-600 hover:text-yellow-400 transition-colors disabled:opacity-40"
          >
            {chatLoading ? 'Starting…' : 'Start Chat (Tier 1 + Tier 2 only)'}
          </button>
        )}

        {/* Chat */}
        {hasStarted && (
          <div className="space-y-3">
            <div className="text-xs text-gray-600 uppercase tracking-wider">Chat with Mark</div>

            {messages.map((turn, i) => (
              <div key={i}>
                <div className={`rounded p-4 ${turn.role === 'mark' ? 'bg-gray-900 border border-gray-800' : 'bg-gray-800 border border-gray-700'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs uppercase tracking-wider font-bold ${turn.role === 'mark' ? 'text-yellow-500' : 'text-blue-400'}`}>
                      {turn.role === 'mark' ? 'Mark' : 'You'}
                    </span>
                    {turn.role === 'mark' && turn.tiersActive?.map(t => <TierBadge key={t} tier={t} />)}
                  </div>
                  <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{turn.content}</div>
                </div>

                {/* Feedback trigger — only on Mark turns */}
                {turn.role === 'mark' && (
                  <div className="mt-1 ml-1">
                    {feedbackSaved === i ? (
                      <span className="text-xs text-emerald-600">✓ Feedback logged</span>
                    ) : feedbackTarget?.index === i ? (
                      <div className="mt-2 space-y-2 bg-gray-900 border border-gray-700 rounded p-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Feedback on this response</div>
                        <div className="flex gap-2">
                          {(['good', 'needs_work', 'wrong'] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setFeedbackType(type)}
                              className={`text-xs px-2 py-1 rounded font-bold transition-colors ${feedbackType === type
                                ? type === 'good' ? 'bg-emerald-700 text-white' : type === 'wrong' ? 'bg-red-800 text-white' : 'bg-yellow-700 text-white'
                                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {type === 'good' ? '✓ Good' : type === 'needs_work' ? '~ Needs work' : '✗ Wrong'}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={feedbackText}
                          onChange={e => setFeedbackText(e.target.value)}
                          placeholder="What was good, wrong, or missing? Be specific…"
                          rows={3}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleFeedback}
                            disabled={feedbackSaving || !feedbackText.trim()}
                            className="px-3 py-1.5 bg-yellow-600 text-gray-950 text-xs font-bold rounded disabled:opacity-40 hover:bg-yellow-500 transition-colors"
                          >
                            {feedbackSaving ? 'Saving…' : 'Log Feedback'}
                          </button>
                          <button
                            onClick={() => { setFeedbackTarget(null); setFeedbackText(''); }}
                            className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFeedbackTarget({ index: i, content: turn.content })}
                        className="text-xs text-gray-700 hover:text-gray-400 transition-colors"
                      >
                        + give feedback on this
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="bg-gray-900 border border-gray-800 rounded p-4">
                <div className="text-xs text-yellow-500 uppercase tracking-wider font-bold mb-2">Mark</div>
                <div className="text-sm text-gray-500 animate-pulse">Thinking…</div>
              </div>
            )}

            <div ref={chatEndRef} />

            {/* Input */}
            <div className="space-y-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !chatLoading) handleSend();
                }}
                placeholder="Ask Mark anything… (⌘↵ to send)"
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={chatLoading || !input.trim()}
                  className="px-4 py-2 bg-yellow-500 text-gray-950 text-sm font-bold rounded disabled:opacity-40 hover:bg-yellow-400 transition-colors"
                >
                  {chatLoading ? 'Sending…' : 'Send'}
                </button>
                <button
                  onClick={() => { setMessages([]); setTier3Context(''); setAccountSummary(null); setTopPosts([]); setFeedbackTarget(null); }}
                  className="px-4 py-2 bg-gray-800 text-gray-400 text-sm rounded hover:text-gray-200 transition-colors"
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
