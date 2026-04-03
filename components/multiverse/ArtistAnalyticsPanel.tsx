'use client';

import { useState, useEffect, useCallback } from 'react';

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
}

interface AnalyticsData {
  accountSummary: AccountSummary;
  tier3Context: string;
  topPosts: TopPost[];
  rawPostCount: number;
  scrapedAt: string;
}

interface ArtistAnalyticsPanelProps {
  userId: string;
  isAdmin: boolean;
}

export function ArtistAnalyticsPanel({ userId, isAdmin }: ArtistAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState('');
  const [showTopPosts, setShowTopPosts] = useState(false);
  const [showGapInsights, setShowGapInsights] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mark/artist-analytics/load?userId=${userId}`);
      const data = await res.json();
      if (data.analytics) setAnalytics(data.analytics);
      if (data.instagramHandle) {
        setInstagramHandle(data.instagramHandle);
        setHandleInput(data.instagramHandle);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  async function handleScrape() {
    const handle = handleInput.replace(/^@/, '').trim();
    if (!handle) { setError('Enter your Instagram handle first'); return; }
    setIsScraping(true);
    setError('');
    try {
      const res = await fetch('/api/mark/artist-analytics/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: handle, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed');
      setAnalytics(data);
      setInstagramHandle(handle);
    } catch (e: any) {
      setError(e.message || 'Scrape failed. Try again.');
    } finally {
      setIsScraping(false);
    }
  }

  const growthColor = (signal: string) => {
    if (signal.toLowerCase().includes('up')) return 'text-green-400';
    if (signal.toLowerCase().includes('down')) return 'text-red-400';
    return 'text-yellow-400';
  };

  const scrapedAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4">
      {/* Header / Tier 3 Status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Artist Analytics</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Jens Technique — public Apify scrape</p>
        </div>
        {analytics && (
          <span className="px-2 py-0.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-[10px] font-semibold tracking-wide">
            TIER 3 ACTIVE
          </span>
        )}
      </div>

      {/* Instagram Handle Input */}
      <div>
        <label className="block text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">
          Instagram Handle
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
            <input
              type="text"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value.replace(/^@/, ''))}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
              placeholder="yourhandle"
              disabled={isScraping}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleScrape}
            disabled={isScraping || !handleInput.trim()}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            {isScraping ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scanning…
              </span>
            ) : analytics ? 'Re-analyze' : 'Analyze'}
          </button>
        </div>
        {isScraping && (
          <p className="text-[11px] text-purple-400 mt-1.5 animate-pulse">
            Analyzing last 50 posts via Apify + Claude… this takes ~90-120s
          </p>
        )}
        {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading saved analytics…
        </div>
      )}

      {/* Analytics Dashboard */}
      {analytics && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg ER</div>
              <div className="text-xl font-bold text-white">{analytics.accountSummary.avgER}%</div>
              <div className="text-[10px] text-gray-500">median {analytics.accountSummary.medianER}%</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg Views</div>
              <div className="text-xl font-bold text-white">
                {analytics.accountSummary.avgPlays >= 1000
                  ? `${(analytics.accountSummary.avgPlays / 1000).toFixed(1)}K`
                  : analytics.accountSummary.avgPlays}
              </div>
              <div className="text-[10px] text-gray-500">{analytics.accountSummary.postCount} posts</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Best Day</div>
              <div className="text-sm font-semibold text-white">{analytics.accountSummary.bestDayOfWeek}</div>
              <div className="text-[10px] text-gray-500">{analytics.accountSummary.bestHourRange}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Best Length</div>
              <div className="text-sm font-semibold text-white capitalize">{analytics.accountSummary.bestDurationBucket}</div>
              <div className="text-[10px] text-gray-500">videos</div>
            </div>
          </div>

          {/* Growth Signal */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Growth Signal</div>
            <p className={`text-xs font-medium ${growthColor(analytics.accountSummary.growthSignal)}`}>
              {analytics.accountSummary.growthSignal}
            </p>
          </div>

          {/* Caption Insights */}
          {analytics.accountSummary.captionInsights.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Caption Patterns</div>
              <ul className="space-y-1.5">
                {analytics.accountSummary.captionInsights.map((insight, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1.5">
                    <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audio Patterns */}
          {analytics.accountSummary.audioPatterns && analytics.accountSummary.audioPatterns.totalReelsWithMusic > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Audio Patterns</div>
              <div className="flex gap-3 mb-2">
                <div className="text-xs text-gray-300">
                  <span className="text-white font-semibold">{analytics.accountSummary.audioPatterns.originalAudioCount}</span> original
                </div>
                <div className="text-xs text-gray-300">
                  <span className="text-white font-semibold">{analytics.accountSummary.audioPatterns.trendingSoundCount}</span> trending
                </div>
              </div>
              {analytics.accountSummary.audioPatterns.topSounds.length > 0 && (
                <ul className="space-y-1">
                  {analytics.accountSummary.audioPatterns.topSounds.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-[11px] text-gray-400 flex justify-between">
                      <span className="truncate mr-2">{s.name}</span>
                      <span className="text-gray-500 flex-shrink-0">{s.count}x · {s.avgER}% ER</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Hashtag Performance */}
          {analytics.accountSummary.hashtagEngagement && analytics.accountSummary.hashtagEngagement.topHashtags.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Top Hashtags by ER</div>
              <div className="text-[10px] text-gray-500 mb-2">
                {analytics.accountSummary.hashtagEngagement.hashtagsUsedCount} unique · avg {analytics.accountSummary.hashtagEngagement.avgHashtagsPerPost}/post
              </div>
              <ul className="space-y-1">
                {analytics.accountSummary.hashtagEngagement.topHashtags.slice(0, 5).map((h, i) => (
                  <li key={i} className="text-[11px] text-gray-400 flex justify-between">
                    <span className="text-purple-300">#{h.tag}</span>
                    <span className="text-gray-500">{h.avgER}% ER ({h.postCount} posts)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Carousel Stats */}
          {analytics.accountSummary.carouselStats && analytics.accountSummary.carouselStats.carouselCount > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Carousel vs Single</div>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-white font-semibold">{analytics.accountSummary.carouselStats.avgCarouselER}%</span>
                  <span className="text-gray-500 ml-1">carousel ER</span>
                </div>
                <div>
                  <span className="text-white font-semibold">{analytics.accountSummary.carouselStats.avgSinglePostER}%</span>
                  <span className="text-gray-500 ml-1">single ER</span>
                </div>
              </div>
              <p className={`text-[10px] mt-1 ${analytics.accountSummary.carouselStats.carouselOutperforms ? 'text-green-400' : 'text-gray-500'}`}>
                {analytics.accountSummary.carouselStats.carouselOutperforms
                  ? `Carousels outperform — avg ${analytics.accountSummary.carouselStats.avgSlideCount} slides`
                  : `Singles outperform carousels for this account`}
              </p>
            </div>
          )}

          {/* Gap Analysis Insights (from Claude) */}
          {analytics.tier3Context && analytics.tier3Context.includes("Mark's Gap Analysis") && (
            <>
              <button
                onClick={() => setShowGapInsights(!showGapInsights)}
                className="w-full flex items-center justify-between bg-purple-900/20 hover:bg-purple-800/30 border border-purple-500/20 rounded-lg px-3 py-2.5 transition-colors"
              >
                <span className="text-xs font-medium text-purple-300">Gap Analysis Insights</span>
                <span className="text-purple-400 text-xs">{showGapInsights ? '▲' : '▼'}</span>
              </button>
              {showGapInsights && (
                <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                  <div className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-line">
                    {analytics.tier3Context
                      .split("### Mark's Gap Analysis")[1]
                      ?.split('### Guidance for Mark')[0]
                      ?.trim()
                      ?? 'Gap analysis not available yet. Re-analyze to generate.'}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Top Posts Toggle */}
          <button
            onClick={() => setShowTopPosts(!showTopPosts)}
            className="w-full flex items-center justify-between bg-gray-800/50 hover:bg-gray-700/50 rounded-lg px-3 py-2.5 transition-colors"
          >
            <span className="text-xs font-medium text-white">Top 5 Posts</span>
            <span className="text-gray-500 text-xs">{showTopPosts ? '▲' : '▼'}</span>
          </button>

          {showTopPosts && analytics.topPosts.length > 0 && (
            <div className="space-y-2">
              {analytics.topPosts.map((post, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-purple-300">#{i + 1}</span>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{post.er.toFixed(2)}% ER</span>
                      <span>·</span>
                      <span>{post.plays >= 1000 ? `${(post.plays / 1000).toFixed(1)}K` : post.plays} plays</span>
                      <span>·</span>
                      <span>{post.duration}s</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                    {post.caption || '(no caption)'}
                  </p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 capitalize">{post.durationBucket}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">{post.dayOfWeek}</span>
                    {post.musicName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 rounded text-purple-400 truncate max-w-[120px]">
                        {post.isOriginalAudio ? 'Original' : post.musicName}
                      </span>
                    )}
                    {post.isCarousel && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 rounded text-blue-400">
                        {post.carouselSlideCount} slides
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scraped At */}
          <p className="text-[10px] text-gray-600 text-center pt-1">
            Last analyzed {scrapedAgo(analytics.scrapedAt)} · @{analytics.accountSummary.username}
          </p>
        </>
      )}

      {/* Empty state */}
      {!analytics && !isLoading && (
        <div className="py-6 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-gray-400 mb-1">No analytics yet</p>
          <p className="text-[11px] text-gray-600">
            Enter your Instagram handle above to analyze your last 50 posts. Mark will use this data to give you personalized advice.
          </p>
        </div>
      )}
    </div>
  );
}
