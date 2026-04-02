'use client';

import { useState } from 'react';

interface TopPost {
  er: number;
  plays: number;
  likes: number;
  comments: number;
  duration: number;
  caption: string;
  durationBucket: string;
  dayOfWeek: string;
}

interface AccountSummary {
  username: string;
  postCount: number;
  avgER: number;
  medianER: number;
  avgPlays: number;
  bestDayOfWeek: string;
  bestHourRange: string;
  bestDurationBucket: string;
  topFormats: string[];
  captionInsights: string[];
  growthSignal: string;
  scrapedAt: string;
}

interface AnalyticsResult {
  accountSummary: AccountSummary;
  tier3Context: string;
  topPosts: TopPost[];
  rawPostCount: number;
}

export default function AnalyticsTestPage() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [showTier3, setShowTier3] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  function addLog(msg: string) {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function runScrape() {
    const h = handle.replace(/^@/, '').trim();
    if (!h) return;
    setLoading(true);
    setError('');
    setResult(null);
    setLog([]);
    setElapsed(null);
    setShowTier3(false);
    const t0 = Date.now();

    addLog(`Starting scrape for @${h}...`);
    addLog('Calling /api/mark/artist-analytics/scrape (this takes ~60s)');

    try {
      const res = await fetch('/api/mark/artist-analytics/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: h }),
      });

      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      addLog(`Response received in ${secs}s — HTTP ${res.status}`);

      const data = await res.json();

      if (!res.ok) {
        addLog(`ERROR: ${data.error}`);
        setError(data.error || 'Scrape failed');
        return;
      }

      setElapsed(parseFloat(secs));
      addLog(`Success! ${data.rawPostCount} posts analyzed`);
      addLog(`Avg ER: ${data.accountSummary.avgER}% | Avg plays: ${data.accountSummary.avgPlays.toLocaleString()}`);
      addLog(`Best day: ${data.accountSummary.bestDayOfWeek} | Best length: ${data.accountSummary.bestDurationBucket}`);
      addLog(`Growth: ${data.accountSummary.growthSignal}`);
      if (data.accountSummary.captionInsights.length > 0) {
        data.accountSummary.captionInsights.forEach((i: string) => addLog(`Caption insight: ${i}`));
      }
      addLog(`Top post: ${data.topPosts[0]?.er.toFixed(2)}% ER — "${data.topPosts[0]?.caption?.slice(0, 60)}..."`);
      setResult(data);
    } catch (e: any) {
      addLog(`EXCEPTION: ${e.message}`);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const growthColor = (s: string) => {
    if (s.toLowerCase().includes('up')) return '#4ade80';
    if (s.toLowerCase().includes('down')) return '#f87171';
    return '#facc15';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'monospace', padding: 32 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            Artist Analytics — Local Test
          </h1>
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Jens Technique · Apify scrape · <a href="/mark-training" style={{ color: '#7c3aed' }}>← back to training</a>
          </p>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }}>@</span>
            <input
              value={handle}
              onChange={e => setHandle(e.target.value.replace(/^@/, ''))}
              onKeyDown={e => e.key === 'Enter' && !loading && runScrape()}
              placeholder="instagram handle"
              disabled={loading}
              style={{
                width: '100%', padding: '10px 12px 10px 26px', background: '#1a1a1a',
                border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={runScrape}
            disabled={loading || !handle.trim()}
            style={{
              padding: '10px 20px', background: loading ? '#4c1d95' : '#7c3aed',
              border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, cursor: loading ? 'default' : 'pointer',
              opacity: !handle.trim() ? 0.4 : 1, whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Scanning…' : 'Analyze'}
          </button>
        </div>

        {loading && (
          <p style={{ color: '#a78bfa', fontSize: 12, marginBottom: 16, animation: 'pulse 2s infinite' }}>
            Scraping last 50 posts via Apify… usually takes 45–90s. Check your terminal for live logs.
          </p>
        )}

        {error && (
          <div style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>Error: {error}</p>
          </div>
        )}

        {/* Live log */}
        {log.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <p style={{ color: '#555', fontSize: 11, marginTop: 0, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Log</p>
            {log.map((line, i) => (
              <p key={i} style={{ margin: '2px 0', fontSize: 12, color: line.includes('ERROR') || line.includes('EXCEPTION') ? '#f87171' : line.includes('Success') ? '#4ade80' : '#888' }}>
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Summary banner */}
            <div style={{ background: '#0f0a1f', border: '1px solid #3b1f6b', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>@{result.accountSummary.username}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>{result.rawPostCount} posts analyzed · {elapsed}s</p>
                </div>
                <span style={{ padding: '3px 10px', background: '#4c1d95', borderRadius: 20, fontSize: 10, color: '#c4b5fd', fontWeight: 700 }}>
                  TIER 3 ACTIVE
                </span>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Avg ER', value: `${result.accountSummary.avgER}%`, sub: `median ${result.accountSummary.medianER}%` },
                { label: 'Avg Plays', value: result.accountSummary.avgPlays >= 1000 ? `${(result.accountSummary.avgPlays / 1000).toFixed(1)}K` : String(result.accountSummary.avgPlays), sub: `${result.accountSummary.postCount} posts` },
                { label: 'Best Day', value: result.accountSummary.bestDayOfWeek, sub: result.accountSummary.bestHourRange },
                { label: 'Best Length', value: result.accountSummary.bestDurationBucket, sub: 'videos' },
              ].map(c => (
                <div key={c.label} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</p>
                  <p style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 700, color: '#fff' }}>{c.value}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#555' }}>{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Growth */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Growth Signal</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: growthColor(result.accountSummary.growthSignal) }}>
                {result.accountSummary.growthSignal}
              </p>
            </div>

            {/* Caption insights */}
            {result.accountSummary.captionInsights.length > 0 && (
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Caption Patterns</p>
                {result.accountSummary.captionInsights.map((ins, i) => (
                  <p key={i} style={{ margin: '0 0 4px', fontSize: 12, color: '#ccc' }}>• {ins}</p>
                ))}
              </div>
            )}

            {/* Top posts */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Top 5 Posts</p>
              {result.topPosts.map((p, i) => (
                <div key={i} style={{ borderTop: i > 0 ? '1px solid #1a1a1a' : undefined, paddingTop: i > 0 ? 8 : 0, marginTop: i > 0 ? 8 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>#{i + 1}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>
                      {p.er.toFixed(2)}% ER · {p.plays >= 1000 ? `${(p.plays / 1000).toFixed(1)}K` : p.plays} plays · {p.likes}♥ {p.comments}💬 · {p.duration}s · {p.dayOfWeek}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#666', lineHeight: 1.4 }}>
                    {p.caption || '(no caption)'}
                  </p>
                </div>
              ))}
            </div>

            {/* Tier 3 context toggle */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setShowTier3(!showTier3)}
                style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>Tier 3 Context String (what Mark sees)</span>
                <span>{showTier3 ? '▲ hide' : '▼ show'}</span>
              </button>
              {showTier3 && (
                <pre style={{ margin: 0, padding: 12, borderTop: '1px solid #1a1a1a', fontSize: 11, color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto' }}>
                  {result.tier3Context}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
