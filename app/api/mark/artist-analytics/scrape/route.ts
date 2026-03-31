/**
 * POST /api/mark/artist-analytics/scrape
 *
 * Jens Technique: Scrapes the artist's own public Instagram account via Apify,
 * builds a Tier 3 intelligence context string, and saves it to Supabase.
 *
 * Input:  { username: string, userId: string }
 * Output: { accountSummary, tier3Context, topPosts, rawPostCount }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawPost {
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number;
  timestamp?: string;
  type?: string;
  displayUrl?: string;
  url?: string;
}

interface AnalyzedPost {
  caption: string;
  likes: number;
  comments: number;
  views: number;
  er: number;
  duration: number;
  timestamp: string;
  dayOfWeek: string;
  hour: number;
  type: string;
  captionLength: number;
  hasQuestion: boolean;
  hasEmoji: boolean;
  hasLyricQuote: boolean;
  durationBucket: 'short' | 'medium' | 'long';
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
  topFormats: string[];
  captionInsights: string[];
  growthSignal: string;
  scrapedAt: string;
}

// ─── Apify scraper ────────────────────────────────────────────────────────────

async function scrapeProfile(username: string): Promise<RawPost[]> {
  const handle = username.replace(/^@/, '').trim();
  const profileUrl = `https://www.instagram.com/${handle}/`;

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [profileUrl],
        resultsType: 'posts',
        resultsLimit: 50,
      }),
    },
  );

  const { data } = await startRes.json();
  if (!data?.id) throw new Error('Failed to start Apify run');

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const { data: run } = await fetch(
      `https://api.apify.com/v2/actor-runs/${data.id}?token=${APIFY_TOKEN}`,
    ).then(r => r.json());

    if (run.status === 'SUCCEEDED') {
      const items = await fetch(
        `https://api.apify.com/v2/actor-runs/${data.id}/dataset/items?token=${APIFY_TOKEN}&limit=50`,
      ).then(r => r.json());
      return Array.isArray(items) ? items : [];
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
      throw new Error(`Apify run ${run.status}`);
    }
  }
  throw new Error('Apify scrape timed out');
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function analyzePost(p: RawPost): AnalyzedPost {
  const views = p.videoViewCount ?? p.videoPlayCount ?? 0;
  const likes = p.likesCount ?? 0;
  const comments = p.commentsCount ?? 0;
  const er = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const duration = p.videoDuration ?? 0;
  const caption = p.caption ?? '';
  const ts = p.timestamp ? new Date(p.timestamp) : new Date();

  const durationBucket: 'short' | 'medium' | 'long' =
    duration < 20 ? 'short' : duration < 45 ? 'medium' : 'long';

  return {
    caption: caption.slice(0, 200),
    likes,
    comments,
    views,
    er: Math.round(er * 100) / 100,
    duration,
    timestamp: p.timestamp ?? '',
    dayOfWeek: DAYS[ts.getDay()],
    hour: ts.getHours(),
    type: p.type ?? 'Video',
    captionLength: caption.length,
    hasQuestion: caption.includes('?'),
    hasEmoji: /\p{Emoji}/u.test(caption),
    hasLyricQuote: /["'"'][^"'"']{10,}["'"']/.test(caption) || (caption.includes('\n') && caption.length > 40),
    durationBucket,
  };
}

function buildAccountSummary(posts: AnalyzedPost[], username: string): AccountSummary {
  const scrapedAt = new Date().toISOString();

  if (posts.length === 0) {
    return {
      username, postCount: 0, avgER: 0, medianER: 0, avgViews: 0,
      bestDayOfWeek: 'unknown', bestHourRange: 'unknown', bestDurationBucket: 'unknown',
      topFormats: [], captionInsights: [], growthSignal: 'No posts found.', scrapedAt,
    };
  }

  const sorted = [...posts].sort((a, b) => a.er - b.er);
  const medianER = sorted[Math.floor(sorted.length / 2)].er;
  const avgER = posts.reduce((s, p) => s + p.er, 0) / posts.length;
  const avgViews = posts.reduce((s, p) => s + p.views, 0) / posts.length;

  // Best day of week by avg ER
  const byDay: Record<string, number[]> = {};
  posts.forEach(p => {
    if (!byDay[p.dayOfWeek]) byDay[p.dayOfWeek] = [];
    byDay[p.dayOfWeek].push(p.er);
  });
  const bestDayOfWeek = Object.entries(byDay)
    .map(([day, ers]) => ({ day, avg: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.day ?? 'unknown';

  // Best hour bucket
  const byHour: Record<string, number[]> = {};
  posts.forEach(p => {
    const bucket = p.hour < 6 ? 'night (12–6am)' : p.hour < 12 ? 'morning (6am–12pm)' : p.hour < 18 ? 'afternoon (12–6pm)' : 'evening (6pm–12am)';
    if (!byHour[bucket]) byHour[bucket] = [];
    byHour[bucket].push(p.er);
  });
  const bestHourRange = Object.entries(byHour)
    .map(([hr, ers]) => ({ hr, avg: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.hr ?? 'unknown';

  // Best duration bucket
  const byDuration: Record<string, number[]> = {};
  posts.forEach(p => {
    if (!byDuration[p.durationBucket]) byDuration[p.durationBucket] = [];
    byDuration[p.durationBucket].push(p.er);
  });
  const bestDurationBucket = Object.entries(byDuration)
    .map(([d, ers]) => ({ d, avg: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.d ?? 'unknown';

  // Caption insights
  const captionInsights: string[] = [];
  const withQ = posts.filter(p => p.hasQuestion);
  const withoutQ = posts.filter(p => !p.hasQuestion);
  if (withQ.length >= 3 && withoutQ.length >= 3) {
    const qER = withQ.reduce((s, p) => s + p.er, 0) / withQ.length;
    const noQER = withoutQ.reduce((s, p) => s + p.er, 0) / withoutQ.length;
    if (qER > noQER * 1.2) captionInsights.push(`Captions with a question average ${(qER / noQER).toFixed(1)}x higher ER (${qER.toFixed(2)}% vs ${noQER.toFixed(2)}%)`);
    else if (noQER > qER * 1.2) captionInsights.push(`Captions without a question actually outperform question captions for this account`);
  }

  const shortCaps = posts.filter(p => p.captionLength < 60);
  const longCaps = posts.filter(p => p.captionLength >= 60);
  if (shortCaps.length >= 3 && longCaps.length >= 3) {
    const shortER = shortCaps.reduce((s, p) => s + p.er, 0) / shortCaps.length;
    const longER = longCaps.reduce((s, p) => s + p.er, 0) / longCaps.length;
    if (shortER > longER * 1.2) captionInsights.push(`Short captions (<60 chars) outperform longer ones (${shortER.toFixed(2)}% vs ${longER.toFixed(2)}% ER)`);
    else if (longER > shortER * 1.2) captionInsights.push(`Longer captions (60+ chars) outperform short ones for this account`);
  }

  // Growth signal
  const recentPosts = [...posts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  const olderPosts = [...posts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(-10);
  const recentAvgER = recentPosts.reduce((s, p) => s + p.er, 0) / (recentPosts.length || 1);
  const olderAvgER = olderPosts.reduce((s, p) => s + p.er, 0) / (olderPosts.length || 1);
  const growthSignal = recentAvgER > olderAvgER * 1.1
    ? `Trending UP — recent posts averaging ${recentAvgER.toFixed(2)}% ER vs ${olderAvgER.toFixed(2)}% on older posts`
    : recentAvgER < olderAvgER * 0.9
    ? `Trending DOWN — recent posts averaging ${recentAvgER.toFixed(2)}% ER vs ${olderAvgER.toFixed(2)}% on older posts`
    : `Stable at ~${avgER.toFixed(2)}% ER`;

  return {
    username, postCount: posts.length,
    avgER: Math.round(avgER * 100) / 100,
    medianER: Math.round(medianER * 100) / 100,
    avgViews: Math.round(avgViews),
    bestDayOfWeek, bestHourRange, bestDurationBucket,
    topFormats: [bestDurationBucket + ' duration', bestDayOfWeek + ' posting'],
    captionInsights,
    growthSignal,
    scrapedAt,
  };
}

function buildTier3Context(posts: AnalyzedPost[], summary: AccountSummary, username: string): string {
  const top5 = [...posts].sort((a, b) => b.er - a.er).slice(0, 5);
  const bottom3 = [...posts].sort((a, b) => a.er - b.er).slice(0, 3);

  const top5Lines = top5.map((p, i) =>
    `  ${i + 1}. ${p.er.toFixed(2)}% ER | ${p.views.toLocaleString()} views | ${p.duration}s | ${p.durationBucket} | "${p.caption.slice(0, 80).replace(/\n/g, ' ')}"`
  ).join('\n');

  const bottom3Lines = bottom3.map((p, i) =>
    `  ${i + 1}. ${p.er.toFixed(2)}% ER | ${p.views.toLocaleString()} views | ${p.duration}s | "${p.caption.slice(0, 60).replace(/\n/g, ' ')}"`
  ).join('\n');

  const captionNotes = summary.captionInsights.length > 0
    ? summary.captionInsights.join('\n')
    : 'Not enough variation in the data to draw caption conclusions yet.';

  return `## TIER 3: ARTIST-SPECIFIC INTELLIGENCE — @${username}
Scraped: ${new Date(summary.scrapedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}

### Account Overview
- Posts analyzed: ${summary.postCount}
- Average engagement rate: ${summary.avgER}%
- Median engagement rate: ${summary.medianER}%
- Average views per post: ${summary.avgViews.toLocaleString()}
- Growth signal: ${summary.growthSignal}

### What's Working Best for This Account
- Best day to post: ${summary.bestDayOfWeek}
- Best time of day: ${summary.bestHourRange}
- Best video length: ${summary.bestDurationBucket} videos

### Top 5 Posts (by engagement rate)
${top5Lines}

### Bottom 3 Posts (lowest engagement — avoid these patterns)
${bottom3Lines}

### Caption Patterns
${captionNotes}

### Guidance for Mark
Use this data to make advice SPECIFIC to this artist's actual track record. When suggesting formats, reference their best performers. When discussing engagement, anchor to their ${summary.avgER}% baseline. If they're above ${(summary.avgER * 1.5).toFixed(1)}%, that's a strong post for them. If they're below ${(summary.avgER * 0.5).toFixed(1)}%, it underperformed. Never give advice that contradicts what's actually working in their data.`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { username, userId } = await req.json() as { username: string; userId?: string };
    if (!username?.trim()) return NextResponse.json({ error: 'username required' }, { status: 400 });
    if (!APIFY_TOKEN) return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });

    const handle = username.replace(/^@/, '').trim();
    const raw = await scrapeProfile(handle);
    if (!raw.length) return NextResponse.json({ error: 'No posts found for this account' }, { status: 404 });

    const analyzed = raw.map(analyzePost);
    const summary = buildAccountSummary(analyzed, handle);
    const tier3Context = buildTier3Context(analyzed, summary, handle);

    // Top posts for UI display
    const topPosts = [...analyzed]
      .sort((a, b) => b.er - a.er)
      .slice(0, 5)
      .map(p => ({
        er: p.er,
        views: p.views,
        duration: p.duration,
        caption: p.caption.slice(0, 100),
        durationBucket: p.durationBucket,
        dayOfWeek: p.dayOfWeek,
      }));

    // Save to Supabase if userId provided
    if (userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: prof } = await supabase
            .from('profiles')
            .select('onboarding_profile')
            .eq('id', userId)
            .single();

          const updatedProfile = {
            ...(prof?.onboarding_profile || {}),
            instagramHandle: handle,
            instagramAnalytics: {
              accountSummary: summary,
              tier3Context,
              topPosts,
              rawPostCount: raw.length,
              scrapedAt: summary.scrapedAt,
            },
          };

          await supabase
            .from('profiles')
            .update({ onboarding_profile: updatedProfile })
            .eq('id', userId);

          console.log(`[artist-analytics/scrape] Saved Tier 3 for user ${userId} (@${handle})`);
        } catch (dbErr) {
          console.error('[artist-analytics/scrape] DB save failed:', dbErr);
          // Non-blocking — still return the data
        }
      }
    }

    return NextResponse.json({
      accountSummary: summary,
      tier3Context,
      topPosts,
      rawPostCount: raw.length,
    });

  } catch (e: any) {
    console.error('[artist-analytics/scrape]', e);
    return NextResponse.json({ error: e.message ?? 'Scrape failed' }, { status: 500 });
  }
}
