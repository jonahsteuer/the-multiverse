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

export const maxDuration = 300;

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawPost {
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;  // unique reach — NOT the public "plays" number
  videoPlayCount?: number;  // total plays — this IS the public "X plays" shown on Reels
  videoDuration?: number;
  timestamp?: string;
  type?: string;
  productType?: string;
  displayUrl?: string;
  url?: string;
  // --- NEW Apify fields ---
  musicInfo?: {
    musicName?: string;
    musicArtist?: string;
    musicUrl?: string;
    isOriginalAudio?: boolean;
  } | null;
  images?: string[];       // carousel slide URLs — length = slide count
  childPosts?: any[];      // carousel child media objects
}

interface AnalyzedPost {
  caption: string;
  likes: number;
  comments: number;
  plays: number;        // videoPlayCount — public-facing play count (what Instagram shows)
  reach: number;        // videoViewCount — unique accounts who saw it
  er: number;           // (likes + comments) / plays * 100  [for video posts]
  duration: number;
  timestamp: string;
  dayOfWeek: string;
  hour: number;
  type: string;
  isVideo: boolean;
  captionLength: number;
  hasQuestion: boolean;
  hasEmoji: boolean;
  hasLyricQuote: boolean;
  durationBucket: 'short' | 'medium' | 'long' | 'image';
  // --- NEW fields ---
  musicName: string | null;        // e.g. "Original Audio" or "Trending Sound Name"
  musicArtist: string | null;      // e.g. "Artist Name"
  isOriginalAudio: boolean | null; // true = original, false = trending sound, null = unknown/image
  hashtags: string[];              // raw hashtag list from post
  isCarousel: boolean;             // true if type === 'Sidecar'
  carouselSlideCount: number;      // images?.length or 0 if not carousel
  captionTone: string;             // computed: 'question' | 'story' | 'hype' | 'vulnerable' | 'cta' | 'neutral'
}

interface AccountSummary {
  username: string;
  postCount: number;
  videoPostCount: number;
  avgER: number;
  medianER: number;
  avgPlays: number;
  avgLikes: number;
  avgComments: number;
  bestDayOfWeek: string;
  bestHourRange: string;
  bestDurationBucket: string;
  topFormats: string[];
  captionInsights: string[];
  growthSignal: string;
  scrapedAt: string;
  // --- NEW fields ---
  audioPatterns?: {
    totalReelsWithMusic: number;
    originalAudioCount: number;
    trendingSoundCount: number;
    topSounds: { name: string; count: number; avgER: number }[];  // top 5 by frequency
  };
  hashtagEngagement?: {
    topHashtags: { tag: string; avgER: number; postCount: number }[];  // top 10 by ER
    hashtagsUsedCount: number;
    avgHashtagsPerPost: number;
  };
  carouselStats?: {
    carouselCount: number;
    avgCarouselER: number;
    avgSinglePostER: number;
    avgSlideCount: number;
    carouselOutperforms: boolean;  // avgCarouselER > avgSinglePostER
  };
}

// ─── Apify scraper ────────────────────────────────────────────────────────────

async function scrapeProfile(username: string): Promise<RawPost[]> {
  const handle = username.replace(/^@/, '').trim();
  const profileUrl = `https://www.instagram.com/${handle}/`;

  console.log(`[artist-analytics/scrape] Starting Apify run for ${profileUrl}`);
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

  const startBody = await startRes.json();
  console.log(`[artist-analytics/scrape] Apify start response (HTTP ${startRes.status}):`, JSON.stringify(startBody));
  const { data } = startBody;
  if (!data?.id) {
    const apifyError = startBody?.error?.message || startBody?.message || JSON.stringify(startBody);
    throw new Error(`Failed to start Apify run: ${apifyError}`);
  }
  console.log(`[artist-analytics/scrape] Run started, id=${data.id}`);

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const { data: run } = await fetch(
      `https://api.apify.com/v2/actor-runs/${data.id}?token=${APIFY_TOKEN}`,
    ).then(r => r.json());

    console.log(`[artist-analytics/scrape] Poll: run status=${run?.status}`);
    if (run.status === 'SUCCEEDED') {
      const items = await fetch(
        `https://api.apify.com/v2/actor-runs/${data.id}/dataset/items?token=${APIFY_TOKEN}&limit=50`,
      ).then(r => r.json());
      console.log(`[artist-analytics/scrape] Got ${Array.isArray(items) ? items.length : 0} items`);
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
  // FIX: videoPlayCount is the public "X plays" number Instagram shows on Reels.
  // videoViewCount is unique reach (lower). Always use plays as primary for ER.
  const plays = p.videoPlayCount ?? 0;
  const reach = p.videoViewCount ?? 0;
  const likes = p.likesCount ?? 0;
  const comments = p.commentsCount ?? 0;
  const duration = p.videoDuration ?? 0;
  const caption = p.caption ?? '';
  const ts = p.timestamp ? new Date(p.timestamp) : new Date();
  const isVideo = duration > 0 || plays > 0;

  // ER = (likes + comments) / plays for video posts.
  // For image posts (no plays), we can't calculate ER the same way — flag as 0.
  const er = plays > 0 ? ((likes + comments) / plays) * 100 : 0;

  const durationBucket: 'short' | 'medium' | 'long' | 'image' =
    !isVideo ? 'image' : duration < 20 ? 'short' : duration < 45 ? 'medium' : 'long';

  // --- Audio extraction (Reels only — null-safe) ---
  const musicName = p.musicInfo?.musicName ?? null;
  const musicArtist = p.musicInfo?.musicArtist ?? null;
  const isOriginalAudio = p.musicInfo?.isOriginalAudio ?? null;

  // --- Hashtags (already available, just pass through) ---
  const hashtags = p.hashtags ?? [];

  // --- Carousel detection ---
  const isCarousel = (p.type === 'Sidecar') || (p.productType === 'carousel_album');
  const carouselSlideCount = isCarousel ? (p.images?.length ?? p.childPosts?.length ?? 0) : 0;

  // --- Caption tone (simple heuristic — Claude does deeper analysis in gap analysis) ---
  const captionTone: string =
    caption.includes('?') ? 'question' :
    (caption.includes('DM') || caption.includes('link in bio') || caption.includes('comment')) ? 'cta' :
    (/[!]{2,}|LET'S|LETS GO|HUGE|MASSIVE|FIRE/i.test(caption)) ? 'hype' :
    (/honest|real talk|vulnerable|scared|nervous|anxiety/i.test(caption)) ? 'vulnerable' :
    (caption.includes('\n') && caption.length > 100) ? 'story' :
    'neutral';

  console.log(`[analyzePost] ${p.url?.split('/p/')[1]?.replace('/', '') ?? '?'} plays=${plays} reach=${reach} likes=${likes} comments=${comments} er=${er.toFixed(1)}%`);

  return {
    caption: caption.slice(0, 200),
    likes,
    comments,
    plays,
    reach,
    er: Math.round(er * 100) / 100,
    duration,
    timestamp: p.timestamp ?? '',
    dayOfWeek: DAYS[ts.getDay()],
    hour: ts.getHours(),
    type: p.type ?? 'Video',
    isVideo,
    captionLength: caption.length,
    hasQuestion: caption.includes('?'),
    hasEmoji: /\p{Emoji}/u.test(caption),
    hasLyricQuote: /["'"'][^"'"']{10,}["'"']/.test(caption) || (caption.includes('\n') && caption.length > 40),
    durationBucket,
    musicName,
    musicArtist,
    isOriginalAudio,
    hashtags,
    isCarousel,
    carouselSlideCount,
    captionTone,
  };
}

function buildAccountSummary(posts: AnalyzedPost[], username: string): AccountSummary {
  const scrapedAt = new Date().toISOString();

  if (posts.length === 0) {
    return {
      username, postCount: 0, videoPostCount: 0, avgER: 0, medianER: 0,
      avgPlays: 0, avgLikes: 0, avgComments: 0,
      bestDayOfWeek: 'unknown', bestHourRange: 'unknown', bestDurationBucket: 'unknown',
      topFormats: [], captionInsights: [], growthSignal: 'No posts found.', scrapedAt,
    };
  }

  // Only use video posts for ER/play stats (image posts have no plays)
  const videoPosts = posts.filter(p => p.isVideo && p.plays > 0);
  const videoPostCount = videoPosts.length;

  const erPosts = videoPosts.length > 0 ? videoPosts : posts;
  const sorted = [...erPosts].sort((a, b) => a.er - b.er);
  const medianER = sorted[Math.floor(sorted.length / 2)].er;
  const avgER = erPosts.reduce((s, p) => s + p.er, 0) / erPosts.length;
  const avgPlays = videoPosts.length > 0
    ? videoPosts.reduce((s, p) => s + p.plays, 0) / videoPosts.length
    : 0;
  const avgLikes = posts.reduce((s, p) => s + p.likes, 0) / posts.length;
  const avgComments = posts.reduce((s, p) => s + p.comments, 0) / posts.length;

  // Best day of week by avg ER — use only video posts with plays > 0
  const byDay: Record<string, number[]> = {};
  erPosts.forEach(p => {
    if (!byDay[p.dayOfWeek]) byDay[p.dayOfWeek] = [];
    byDay[p.dayOfWeek].push(p.er);
  });
  const bestDayOfWeek = Object.entries(byDay)
    .map(([day, ers]) => ({ day, avg: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.day ?? 'unknown';

  // Best hour bucket — use only video posts
  const byHour: Record<string, number[]> = {};
  erPosts.forEach(p => {
    const bucket = p.hour < 6 ? 'night (12–6am)' : p.hour < 12 ? 'morning (6am–12pm)' : p.hour < 18 ? 'afternoon (12–6pm)' : 'evening (6pm–12am)';
    if (!byHour[bucket]) byHour[bucket] = [];
    byHour[bucket].push(p.er);
  });
  const bestHourRange = Object.entries(byHour)
    .map(([hr, ers]) => ({ hr, avg: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.hr ?? 'unknown';

  // Best duration bucket — video posts only, exclude 'image'
  const byDuration: Record<string, number[]> = {};
  erPosts.forEach(p => {
    if (p.durationBucket === 'image') return;
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

  // Growth signal — use video posts only
  const sortedByTime = [...erPosts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentPosts = sortedByTime.slice(0, Math.min(5, Math.floor(sortedByTime.length / 2)));
  const olderPosts = sortedByTime.slice(-Math.min(5, Math.floor(sortedByTime.length / 2)));
  const recentAvgER = recentPosts.length > 0 ? recentPosts.reduce((s, p) => s + p.er, 0) / recentPosts.length : 0;
  const olderAvgER = olderPosts.length > 0 ? olderPosts.reduce((s, p) => s + p.er, 0) / olderPosts.length : 0;
  const growthSignal = recentPosts.length < 3 || olderPosts.length < 3
    ? `Not enough posts to determine trend (${erPosts.length} video posts analyzed)`
    : recentAvgER > olderAvgER * 1.1
    ? `Trending UP — recent posts averaging ${recentAvgER.toFixed(2)}% ER vs ${olderAvgER.toFixed(2)}% on older posts`
    : recentAvgER < olderAvgER * 0.9
    ? `Trending DOWN — recent posts averaging ${recentAvgER.toFixed(2)}% ER vs ${olderAvgER.toFixed(2)}% on older posts`
    : `Stable at ~${avgER.toFixed(2)}% ER`;

  // --- Audio pattern aggregation ---
  const reelsWithMusic = posts.filter(p => p.musicName !== null);
  const originalAudioPosts = reelsWithMusic.filter(p => p.isOriginalAudio === true);
  const trendingSoundPosts = reelsWithMusic.filter(p => p.isOriginalAudio === false);
  const soundFreq: Record<string, { count: number; totalER: number }> = {};
  reelsWithMusic.forEach(p => {
    const key = p.musicName || 'Unknown';
    if (!soundFreq[key]) soundFreq[key] = { count: 0, totalER: 0 };
    soundFreq[key].count++;
    soundFreq[key].totalER += p.er;
  });
  const topSounds = Object.entries(soundFreq)
    .map(([name, { count, totalER }]) => ({ name, count, avgER: Math.round((totalER / count) * 100) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const audioPatterns = {
    totalReelsWithMusic: reelsWithMusic.length,
    originalAudioCount: originalAudioPosts.length,
    trendingSoundCount: trendingSoundPosts.length,
    topSounds,
  };

  // --- Hashtag ER correlation ---
  const hashtagER: Record<string, { totalER: number; count: number }> = {};
  let totalHashtagsUsed = 0;
  posts.forEach(p => {
    p.hashtags.forEach(tag => {
      const t = tag.toLowerCase().replace(/^#/, '');
      if (!hashtagER[t]) hashtagER[t] = { totalER: 0, count: 0 };
      hashtagER[t].totalER += p.er;
      hashtagER[t].count++;
    });
    totalHashtagsUsed += p.hashtags.length;
  });
  const topHashtags = Object.entries(hashtagER)
    .filter(([, v]) => v.count >= 2)  // at least 2 uses to be meaningful
    .map(([tag, { totalER, count }]) => ({ tag, avgER: Math.round((totalER / count) * 100) / 100, postCount: count }))
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 10);
  const hashtagEngagement = {
    topHashtags,
    hashtagsUsedCount: Object.keys(hashtagER).length,
    avgHashtagsPerPost: posts.length > 0 ? Math.round((totalHashtagsUsed / posts.length) * 10) / 10 : 0,
  };

  // --- Carousel stats ---
  const carouselPosts = posts.filter(p => p.isCarousel);
  const singlePosts = posts.filter(p => !p.isCarousel && p.isVideo && p.plays > 0);
  const avgCarouselER = carouselPosts.length > 0
    ? Math.round((carouselPosts.reduce((s, p) => s + p.er, 0) / carouselPosts.length) * 100) / 100
    : 0;
  const avgSinglePostER = singlePosts.length > 0
    ? Math.round((singlePosts.reduce((s, p) => s + p.er, 0) / singlePosts.length) * 100) / 100
    : 0;
  const avgSlideCount = carouselPosts.length > 0
    ? Math.round((carouselPosts.reduce((s, p) => s + p.carouselSlideCount, 0) / carouselPosts.length) * 10) / 10
    : 0;
  const carouselStats = {
    carouselCount: carouselPosts.length,
    avgCarouselER,
    avgSinglePostER,
    avgSlideCount,
    carouselOutperforms: carouselPosts.length >= 2 && singlePosts.length >= 2 && avgCarouselER > avgSinglePostER,
  };

  return {
    username, postCount: posts.length, videoPostCount,
    avgER: Math.round(avgER * 100) / 100,
    medianER: Math.round(medianER * 100) / 100,
    avgPlays: Math.round(avgPlays),
    avgLikes: Math.round(avgLikes * 10) / 10,
    avgComments: Math.round(avgComments * 10) / 10,
    bestDayOfWeek, bestHourRange, bestDurationBucket,
    topFormats: [bestDurationBucket + ' duration', bestDayOfWeek + ' posting'],
    captionInsights,
    growthSignal,
    scrapedAt,
    audioPatterns,
    hashtagEngagement,
    carouselStats,
  };
}

function buildTier3Context(posts: AnalyzedPost[], summary: AccountSummary, username: string): string {
  // Only use video posts for top/bottom rankings (image posts have no play data)
  const videoPosts = posts.filter(p => p.isVideo && p.plays > 0);
  const rankingPosts = videoPosts.length >= 3 ? videoPosts : posts;

  const top5 = [...rankingPosts].sort((a, b) => b.er - a.er).slice(0, 5);
  const bottom3 = [...rankingPosts].sort((a, b) => a.er - b.er).slice(0, 3);

  const top5Lines = top5.map((p, i) =>
    `  ${i + 1}. ${p.er.toFixed(2)}% ER | ${p.plays.toLocaleString()} plays | ${p.likes} likes | ${p.comments} comments | ${p.duration}s | ${p.durationBucket} | "${p.caption.slice(0, 80).replace(/\n/g, ' ')}"`
  ).join('\n');

  const bottom3Lines = bottom3.map((p, i) =>
    `  ${i + 1}. ${p.er.toFixed(2)}% ER | ${p.plays.toLocaleString()} plays | ${p.likes} likes | ${p.comments} comments | ${p.duration}s | "${p.caption.slice(0, 60).replace(/\n/g, ' ')}"`
  ).join('\n');

  const captionNotes = summary.captionInsights.length > 0
    ? summary.captionInsights.join('\n')
    : 'Not enough variation in the data to draw caption conclusions yet.';

  // --- NEW: Audio patterns section ---
  const audioSection = summary.audioPatterns && summary.audioPatterns.totalReelsWithMusic > 0
    ? `### Audio & Sound Patterns
- Reels with music: ${summary.audioPatterns.totalReelsWithMusic} (${summary.audioPatterns.originalAudioCount} original audio, ${summary.audioPatterns.trendingSoundCount} trending sounds)
- Top sounds used:
${summary.audioPatterns.topSounds.map((s, i) => `  ${i + 1}. "${s.name}" — used ${s.count}x, avg ${s.avgER}% ER`).join('\n')}
${summary.audioPatterns.originalAudioCount > summary.audioPatterns.trendingSoundCount
  ? '- This artist leans toward original audio — consider whether trending sounds could boost reach'
  : '- This artist uses trending sounds frequently — aligned with platform discovery patterns'}`
    : '';

  // --- NEW: Hashtag performance section ---
  const hashtagSection = summary.hashtagEngagement && summary.hashtagEngagement.topHashtags.length > 0
    ? `### Hashtag Performance
- Unique hashtags used: ${summary.hashtagEngagement.hashtagsUsedCount}
- Average hashtags per post: ${summary.hashtagEngagement.avgHashtagsPerPost}
- Top hashtags by engagement rate:
${summary.hashtagEngagement.topHashtags.slice(0, 5).map((h, i) => `  ${i + 1}. #${h.tag} — ${h.avgER}% ER (${h.postCount} posts)`).join('\n')}`
    : '';

  // --- NEW: Carousel stats section ---
  const carouselSection = summary.carouselStats && summary.carouselStats.carouselCount > 0
    ? `### Carousel vs Single Posts
- Carousel posts: ${summary.carouselStats.carouselCount} (avg ${summary.carouselStats.avgSlideCount} slides)
- Carousel avg ER: ${summary.carouselStats.avgCarouselER}% vs single-post avg ER: ${summary.carouselStats.avgSinglePostER}%
- ${summary.carouselStats.carouselOutperforms ? 'Carousels OUTPERFORM single posts for this account — consider more carousel content' : 'Single posts outperform carousels — this artist does better with focused single-image/video content'}`
    : '';

  // --- NEW: Caption tone breakdown ---
  const tonePosts: Record<string, number[]> = {};
  posts.forEach(p => {
    if (!tonePosts[p.captionTone]) tonePosts[p.captionTone] = [];
    tonePosts[p.captionTone].push(p.er);
  });
  const toneLines = Object.entries(tonePosts)
    .filter(([, ers]) => ers.length >= 2)
    .map(([tone, ers]) => {
      const avg = ers.reduce((a, b) => a + b, 0) / ers.length;
      return { tone, count: ers.length, avgER: Math.round(avg * 100) / 100 };
    })
    .sort((a, b) => b.avgER - a.avgER);
  const captionToneSection = toneLines.length > 0
    ? `### Caption Tone Analysis
${toneLines.map(t => `- ${t.tone}: ${t.count} posts, avg ${t.avgER}% ER`).join('\n')}`
    : '';

  return `## TIER 3: ARTIST-SPECIFIC INTELLIGENCE — @${username}
Scraped: ${new Date(summary.scrapedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}

### Account Overview
- Posts analyzed: ${summary.postCount} total (${summary.videoPostCount} videos with play data)
- Average engagement rate: ${summary.avgER}% (likes + comments / plays)
- Median engagement rate: ${summary.medianER}%
- Average plays per video: ${summary.avgPlays.toLocaleString()}
- Average likes per post: ${summary.avgLikes}
- Average comments per post: ${summary.avgComments}
- Growth signal: ${summary.growthSignal}

### What's Working Best for This Account
- Best day to post: ${summary.bestDayOfWeek}
- Best time of day: ${summary.bestHourRange}
- Best video length: ${summary.bestDurationBucket} videos

### Top 5 Posts (by engagement rate — video posts only)
${top5Lines}

### Bottom 3 Posts (lowest engagement — avoid these patterns)
${bottom3Lines}

### Caption Patterns
${captionNotes}

${audioSection}

${hashtagSection}

${carouselSection}

${captionToneSection}

### Guidance for Mark
Use this data to make advice SPECIFIC to this artist's actual track record. When suggesting formats, reference their best performers. When discussing engagement, anchor to their ${summary.avgER}% baseline (calculated as likes+comments divided by plays). If they're above ${(summary.avgER * 1.5).toFixed(1)}%, that's a strong post for them. If they're below ${(summary.avgER * 0.5).toFixed(1)}%, it underperformed. When discussing audio strategy, reference their original vs trending sound split. When discussing hashtags, reference their top-performing tags. Never give advice that contradicts what's actually working in their data.`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { username, userId } = await req.json() as { username: string; userId?: string };
    if (!username?.trim()) return NextResponse.json({ error: 'username required' }, { status: 400 });
    if (!APIFY_TOKEN) return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });

    const handle = username.replace(/^@/, '').trim();
    console.log(`[artist-analytics/scrape] POST called for @${handle}, userId=${userId}, token set=${!!APIFY_TOKEN}`);
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
        plays: p.plays,
        likes: p.likes,
        comments: p.comments,
        duration: p.duration,
        caption: p.caption.slice(0, 100),
        durationBucket: p.durationBucket,
        dayOfWeek: p.dayOfWeek,
        musicName: p.musicName,
        isOriginalAudio: p.isOriginalAudio,
        isCarousel: p.isCarousel,
        carouselSlideCount: p.carouselSlideCount,
        captionTone: p.captionTone,
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
