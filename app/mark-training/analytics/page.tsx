'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface TopPost {
  er: number;
  plays: number;
  likes: number;
  comments: number;
  duration: number;
  caption: string;
  durationBucket: string;
  dayOfWeek: string;
  musicName?: string | null;
  isOriginalAudio?: boolean | null;
  isCarousel?: boolean;
  carouselSlideCount?: number;
  captionTone?: string;
  saves?: number;
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
  audioPatterns?: {
    totalReelsWithMusic: number;
    originalAudioCount: number;
    trendingSoundCount: number;
    topSounds: { name: string; count: number; avgER: number }[];
  };
  hashtagEngagement?: {
    topHashtags: { tag: string; avgER: number; postCount: number }[];
    hashtagsUsedCount: number;
    avgHashtagsPerPost: number;
  };
  carouselStats?: {
    carouselCount: number;
    avgCarouselER: number;
    avgSinglePostER: number;
    avgSlideCount: number;
    carouselOutperforms: boolean;
  };
  totalSaves?: number;
  avgSavesPerPost?: number;
  saveRate?: number;
}

interface AnalyticsResult {
  accountSummary: AccountSummary;
  tier3Context: string;
  topPosts: TopPost[];
  rawPostCount: number;
  scrapedAt: string;
}

const S = {
  page: { minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'monospace', padding: 32 } as React.CSSProperties,
  wrap: { maxWidth: 860, margin: '0 auto' } as React.CSSProperties,
  card: { background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12 } as React.CSSProperties,
  cardPurple: { background: '#0f0a1f', border: '1px solid #3b1f6b', borderRadius: 8, padding: 12 } as React.CSSProperties,
  label: { margin: '0 0 8px', fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 1 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 } as React.CSSProperties,
  statVal: { margin: '4px 0 2px', fontSize: 18, fontWeight: 700, color: '#fff' } as React.CSSProperties,
  statSub: { margin: 0, fontSize: 10, color: '#555' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px 10px 26px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  btn: (disabled: boolean, color = '#7c3aed') => ({ padding: '10px 20px', background: disabled ? '#4c1d95' : color, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' as const }),
};

function AnalyticsPageInner() {
  const searchParams = useSearchParams();
  const [handle, setHandle] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [showTier3, setShowTier3] = useState(false);
  const [showTopPosts, setShowTopPosts] = useState(false);
  const [showGapInsights, setShowGapInsights] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [oauthStatus, setOauthStatus] = useState<'success' | 'error' | null>(null);
  const [oauthReason, setOauthReason] = useState('');

  useEffect(() => {
    const status = searchParams.get('instagram_oauth');
    const reason = searchParams.get('reason') || '';
    if (status === 'success') { setOauthStatus('success'); }
    if (status === 'error') { setOauthStatus('error'); setOauthReason(reason); }
    // Restore saved userId/handle from sessionStorage
    const saved = sessionStorage.getItem('analytics_dev_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.userId) setUserId(s.userId);
        if (s.handle) setHandle(s.handle);
      } catch { /* ignore */ }
    }
  }, [searchParams]);

  function addLog(msg: string) {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function runScrape() {
    const h = handle.replace(/^@/, '').trim();
    if (!h) return;
    // Save state so it survives OAuth redirect
    sessionStorage.setItem('analytics_dev_state', JSON.stringify({ userId, handle: h }));
    setLoading(true);
    setError('');
    setResult(null);
    setLog([]);
    setElapsed(null);
    setShowTier3(false);
    setShowTopPosts(false);
    setShowGapInsights(false);
    setOauthStatus(null);
    const t0 = Date.now();

    addLog(`Starting scrape for @${h}...`);
    addLog(`Calling /api/mark/artist-analytics/scrape${userId ? ` (userId: ${userId.slice(0, 8)}…)` : ' (no userId — OAuth data skipped)'}`);
    addLog('Apify + Claude gap analysis — this takes 90–120s');

    try {
      const res = await fetch('/api/mark/artist-analytics/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: h, ...(userId ? { userId } : {}) }),
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
      addLog(`✓ ${data.rawPostCount} posts analyzed`);
      addLog(`Avg ER: ${data.accountSummary.avgER}% | Avg plays: ${data.accountSummary.avgPlays?.toLocaleString()}`);
      addLog(`Best day: ${data.accountSummary.bestDayOfWeek} | Best length: ${data.accountSummary.bestDurationBucket}`);
      addLog(`Growth: ${data.accountSummary.growthSignal}`);
      if (data.accountSummary.audioPatterns) {
        const ap = data.accountSummary.audioPatterns;
        addLog(`Audio: ${ap.originalAudioCount} original, ${ap.trendingSoundCount} trending sounds`);
      }
      if (data.accountSummary.hashtagEngagement) {
        addLog(`Hashtags: ${data.accountSummary.hashtagEngagement.hashtagsUsedCount} unique tags tracked`);
      }
      if (data.accountSummary.carouselStats?.carouselCount > 0) {
        addLog(`Carousels: ${data.accountSummary.carouselStats.carouselCount} posts — ${data.accountSummary.carouselStats.carouselOutperforms ? 'outperform' : 'underperform'} singles`);
      }
      if (data.accountSummary.totalSaves !== undefined) {
        addLog(`Saves (Graph API): avg ${data.accountSummary.avgSavesPerPost}/post · ${data.accountSummary.saveRate}% save rate`);
      }
      const hasGap = data.tier3Context?.includes("Mark's Gap Analysis");
      addLog(`Gap analysis: ${hasGap ? '✓ included in Tier 3 context' : '✗ not found (check ANTHROPIC_API_KEY)'}`);
      addLog(`Top post: ${data.topPosts[0]?.er.toFixed(2)}% ER — "${data.topPosts[0]?.caption?.slice(0, 60)}…"`);
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

  const connectUrl = userId
    ? `/api/auth/instagram?userId=${userId}&returnTo=/mark-training/analytics`
    : null;

  const hasOAuth = result?.accountSummary.totalSaves !== undefined;

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            Artist Analytics — Local Test
          </h1>
          <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Apify scrape · Claude gap analysis · Instagram OAuth ·{' '}
            <a href="/mark-training" style={{ color: '#7c3aed' }}>← back to training</a>
          </p>
        </div>

        {/* OAuth status banner */}
        {oauthStatus === 'success' && (
          <div style={{ background: '#052e16', border: '1px solid #166534', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ color: '#4ade80', margin: 0, fontSize: 13 }}>
              ✓ Instagram connected! Re-run Analyze to fetch saves + reach data.
            </p>
          </div>
        )}
        {oauthStatus === 'error' && (
          <div style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>
              ✗ Instagram OAuth failed{oauthReason ? `: ${oauthReason}` : ''}. Check your INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET.
            </p>
          </div>
        )}

        {/* User ID (for OAuth) */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ ...S.label, marginBottom: 6 }}>Supabase User ID (optional — required for OAuth / saves data)</p>
          <input
            value={userId}
            onChange={e => setUserId(e.target.value.trim())}
            placeholder="paste your Supabase user UUID here"
            style={{ ...S.input, paddingLeft: 12, fontSize: 12, color: '#aaa' }}
          />
          <p style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
            Find it in Supabase → Authentication → Users, or from your browser session. Leave blank to scrape without OAuth.
          </p>
        </div>

        {/* Handle + Analyze */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }}>@</span>
            <input
              value={handle}
              onChange={e => setHandle(e.target.value.replace(/^@/, ''))}
              onKeyDown={e => e.key === 'Enter' && !loading && runScrape()}
              placeholder="instagram handle"
              disabled={loading}
              style={S.input}
            />
          </div>
          <button onClick={runScrape} disabled={loading || !handle.trim()} style={S.btn(loading || !handle.trim())}>
            {loading ? 'Scanning…' : 'Analyze'}
          </button>
        </div>

        {loading && (
          <p style={{ color: '#a78bfa', fontSize: 12, marginBottom: 16 }}>
            Apify scraping + Claude gap analysis… takes 90–120s. Watch your terminal for logs.
          </p>
        )}

        {error && (
          <div style={{ background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>Error: {error}</p>
          </div>
        )}

        {/* Live log */}
        {log.length > 0 && (
          <div style={{ ...S.card, marginBottom: 20 }}>
            <p style={{ ...S.label, marginTop: 0 }}>Log</p>
            {log.map((line, i) => (
              <p key={i} style={{ margin: '2px 0', fontSize: 12, color: line.includes('ERROR') || line.includes('EXCEPTION') ? '#f87171' : line.startsWith('[') && line.includes('✓') ? '#4ade80' : '#888' }}>
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Summary banner */}
            <div style={S.cardPurple}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>@{result.accountSummary.username}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>{result.rawPostCount} posts analyzed · {elapsed}s</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {hasOAuth && (
                    <span style={{ padding: '3px 10px', background: '#14532d', borderRadius: 20, fontSize: 10, color: '#4ade80', fontWeight: 700 }}>
                      OAUTH ✓
                    </span>
                  )}
                  <span style={{ padding: '3px 10px', background: '#4c1d95', borderRadius: 20, fontSize: 10, color: '#c4b5fd', fontWeight: 700 }}>
                    TIER 3 ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Connect Instagram CTA */}
            {!hasOAuth && (
              <div style={{ background: '#1a0f2e', border: '1px solid #3b1f6b', borderRadius: 8, padding: 12 }}>
                <p style={{ ...S.label, marginTop: 0, color: '#7c3aed' }}>Unlock Saves + Reach Data</p>
                <p style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>
                  Connect your Instagram Business/Creator account to see saves per post, reach data, and richer Tier 3 context.
                  {!userId && <span style={{ color: '#f87171' }}> Enter your User ID above first.</span>}
                </p>
                {connectUrl ? (
                  <a
                    href={connectUrl}
                    style={{ display: 'inline-block', padding: '8px 16px', background: 'linear-gradient(to right, #7c3aed, #db2777)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                  >
                    Connect Instagram →
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: '#555' }}>Add User ID above to enable OAuth</span>
                )}
              </div>
            )}

            {/* Core stat cards */}
            <div style={S.grid4}>
              {[
                { label: 'Avg ER', value: `${result.accountSummary.avgER}%`, sub: `median ${result.accountSummary.medianER}%` },
                { label: 'Avg Plays', value: result.accountSummary.avgPlays >= 1000 ? `${(result.accountSummary.avgPlays / 1000).toFixed(1)}K` : String(result.accountSummary.avgPlays), sub: `${result.accountSummary.postCount} posts` },
                { label: 'Best Day', value: result.accountSummary.bestDayOfWeek, sub: result.accountSummary.bestHourRange },
                { label: 'Best Length', value: result.accountSummary.bestDurationBucket, sub: 'videos' },
              ].map(c => (
                <div key={c.label} style={S.card}>
                  <p style={{ ...S.label, marginTop: 0 }}>{c.label}</p>
                  <p style={S.statVal}>{c.value}</p>
                  <p style={S.statSub}>{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Saves (OAuth) */}
            {hasOAuth && (
              <div style={S.card}>
                <p style={{ ...S.label, marginTop: 0, color: '#4ade80' }}>Saves (Graph API)</p>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <p style={S.statVal}>{result.accountSummary.avgSavesPerPost}</p>
                    <p style={S.statSub}>avg saves / post</p>
                  </div>
                  <div>
                    <p style={S.statVal}>{result.accountSummary.saveRate}%</p>
                    <p style={S.statSub}>save rate (saves / reach)</p>
                  </div>
                  <div>
                    <p style={S.statVal}>{result.accountSummary.totalSaves}</p>
                    <p style={S.statSub}>total saves</p>
                  </div>
                </div>
              </div>
            )}

            {/* Growth */}
            <div style={S.card}>
              <p style={{ ...S.label, marginTop: 0 }}>Growth Signal</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: growthColor(result.accountSummary.growthSignal) }}>
                {result.accountSummary.growthSignal}
              </p>
            </div>

            {/* Caption Patterns */}
            {result.accountSummary.captionInsights.length > 0 && (
              <div style={S.card}>
                <p style={{ ...S.label, marginTop: 0 }}>Caption Patterns</p>
                {result.accountSummary.captionInsights.map((ins, i) => (
                  <p key={i} style={{ margin: '0 0 4px', fontSize: 12, color: '#ccc' }}>• {ins}</p>
                ))}
              </div>
            )}

            {/* Audio Patterns */}
            {result.accountSummary.audioPatterns && result.accountSummary.audioPatterns.totalReelsWithMusic > 0 ? (
              <div style={S.card}>
                <p style={{ ...S.label, marginTop: 0 }}>Audio Patterns</p>
                <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#ccc' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{result.accountSummary.audioPatterns.originalAudioCount}</span> original audio
                  </span>
                  <span style={{ fontSize: 13, color: '#ccc' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{result.accountSummary.audioPatterns.trendingSoundCount}</span> trending sounds
                  </span>
                </div>
                {result.accountSummary.audioPatterns.topSounds.length > 0 && (
                  <>
                    <p style={{ ...S.label, marginTop: 0, marginBottom: 6 }}>Top Sounds</p>
                    {result.accountSummary.audioPatterns.topSounds.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: '#c4b5fd' }}>{i + 1}. {s.name}</span>
                        <span style={{ fontSize: 11, color: '#555' }}>{s.count}x · {s.avgER}% ER</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div style={{ ...S.card, opacity: 0.5 }}>
                <p style={{ ...S.label, marginTop: 0 }}>Audio Patterns</p>
                <p style={{ fontSize: 12, color: '#555', margin: 0 }}>No Reels with music data found (account may use original audio or have no Reels)</p>
              </div>
            )}

            {/* Hashtag ER */}
            {result.accountSummary.hashtagEngagement && result.accountSummary.hashtagEngagement.topHashtags.length > 0 ? (
              <div style={S.card}>
                <p style={{ ...S.label, marginTop: 0 }}>
                  Hashtag Performance · {result.accountSummary.hashtagEngagement.hashtagsUsedCount} unique · avg {result.accountSummary.hashtagEngagement.avgHashtagsPerPost}/post
                </p>
                {result.accountSummary.hashtagEngagement.topHashtags.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: '#c4b5fd' }}>#{h.tag}</span>
                    <span style={{ fontSize: 11, color: '#555' }}>{h.avgER}% ER · {h.postCount} posts</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...S.card, opacity: 0.5 }}>
                <p style={{ ...S.label, marginTop: 0 }}>Hashtag Performance</p>
                <p style={{ fontSize: 12, color: '#555', margin: 0 }}>No hashtags with ≥2 uses found in analyzed posts</p>
              </div>
            )}

            {/* Carousel Stats */}
            {result.accountSummary.carouselStats && result.accountSummary.carouselStats.carouselCount > 0 ? (
              <div style={S.card}>
                <p style={{ ...S.label, marginTop: 0 }}>Carousel vs Single Posts</p>
                <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                  <div>
                    <p style={S.statVal}>{result.accountSummary.carouselStats.avgCarouselER}%</p>
                    <p style={S.statSub}>carousel avg ER ({result.accountSummary.carouselStats.carouselCount} posts, avg {result.accountSummary.carouselStats.avgSlideCount} slides)</p>
                  </div>
                  <div>
                    <p style={S.statVal}>{result.accountSummary.carouselStats.avgSinglePostER}%</p>
                    <p style={S.statSub}>single post avg ER</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: result.accountSummary.carouselStats.carouselOutperforms ? '#4ade80' : '#f87171' }}>
                  {result.accountSummary.carouselStats.carouselOutperforms
                    ? '↑ Carousels outperform singles — lean into this format'
                    : '↓ Singles outperform carousels for this account'}
                </p>
              </div>
            ) : (
              <div style={{ ...S.card, opacity: 0.5 }}>
                <p style={{ ...S.label, marginTop: 0 }}>Carousel vs Single</p>
                <p style={{ fontSize: 12, color: '#555', margin: 0 }}>No carousel posts found in last 50</p>
              </div>
            )}

            {/* Gap Analysis */}
            <div style={S.card}>
              <button
                onClick={() => setShowGapInsights(!showGapInsights)}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <p style={{ ...S.label, marginTop: 0, marginBottom: 0, color: result.tier3Context?.includes("Mark's Gap Analysis") ? '#a78bfa' : '#555' }}>
                  Gap Analysis Insights (Claude){result.tier3Context?.includes("Mark's Gap Analysis") ? ' ✓' : ' — not found'}
                </p>
                <span style={{ fontSize: 11, color: '#555' }}>{showGapInsights ? '▲ hide' : '▼ show'}</span>
              </button>
              {showGapInsights && (
                <div style={{ marginTop: 10 }}>
                  {result.tier3Context?.includes("Mark's Gap Analysis") ? (
                    <pre style={{ margin: 0, fontSize: 11, color: '#bbb', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                      {result.tier3Context
                        .split("### Mark's Gap Analysis")[1]
                        ?.split('### Guidance for Mark')[0]
                        ?.trim() || '(empty)'}
                    </pre>
                  ) : (
                    <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
                      Gap analysis not in tier3Context. Check that ANTHROPIC_API_KEY is set and the scrape route logs show the gap analysis completing.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Top Posts */}
            <div style={S.card}>
              <button
                onClick={() => setShowTopPosts(!showTopPosts)}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between' }}
              >
                <p style={{ ...S.label, marginTop: 0, marginBottom: 0 }}>Top 5 Posts</p>
                <span style={{ fontSize: 11, color: '#555' }}>{showTopPosts ? '▲ hide' : '▼ show'}</span>
              </button>
              {showTopPosts && (
                <div style={{ marginTop: 10 }}>
                  {result.topPosts.map((p, i) => (
                    <div key={i} style={{ borderTop: i > 0 ? '1px solid #1a1a1a' : undefined, paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>#{i + 1}</span>
                        <span style={{ fontSize: 11, color: '#666' }}>
                          {p.er.toFixed(2)}% ER · {p.plays >= 1000 ? `${(p.plays / 1000).toFixed(1)}K` : p.plays} plays · {p.likes}♥ {p.comments}💬 · {p.duration}s · {p.dayOfWeek}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#666', lineHeight: 1.4 }}>
                        {p.caption || '(no caption)'}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', background: '#1a1a1a', borderRadius: 4, color: '#555' }}>{p.durationBucket}</span>
                        {p.captionTone && <span style={{ fontSize: 10, padding: '2px 6px', background: '#1a1a1a', borderRadius: 4, color: '#555' }}>{p.captionTone}</span>}
                        {p.musicName && (
                          <span style={{ fontSize: 10, padding: '2px 6px', background: '#2d1a4a', borderRadius: 4, color: '#c4b5fd' }}>
                            {p.isOriginalAudio ? '🎵 Original' : `🎶 ${p.musicName}`}
                          </span>
                        )}
                        {p.isCarousel && (
                          <span style={{ fontSize: 10, padding: '2px 6px', background: '#1a2a3a', borderRadius: 4, color: '#93c5fd' }}>
                            📷 {p.carouselSlideCount} slides
                          </span>
                        )}
                        {p.saves !== undefined && (
                          <span style={{ fontSize: 10, padding: '2px 6px', background: '#1a2e1a', borderRadius: 4, color: '#4ade80' }}>
                            {p.saves} saves
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tier 3 context raw */}
            <div style={{ ...S.card, overflow: 'hidden' }}>
              <button
                onClick={() => setShowTier3(!showTier3)}
                style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between' }}
              >
                <p style={{ ...S.label, marginTop: 0, marginBottom: 0 }}>Tier 3 Context String (what Mark sees)</p>
                <span style={{ fontSize: 11, color: '#555' }}>{showTier3 ? '▲ hide' : '▼ show'}</span>
              </button>
              {showTier3 && (
                <pre style={{ margin: '10px 0 0', fontSize: 11, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 500, overflowY: 'auto' }}>
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

export default function AnalyticsTestPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#888', padding: 32, fontFamily: 'monospace' }}>Loading…</div>}>
      <AnalyticsPageInner />
    </Suspense>
  );
}
