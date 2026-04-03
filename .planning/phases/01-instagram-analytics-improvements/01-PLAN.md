---
phase: 01-instagram-analytics-improvements
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/mark/artist-analytics/scrape/route.ts
autonomous: true
requirements:
  - REQ-04
  - REQ-06
must_haves:
  truths:
    - "Apify scrape extracts musicInfo for Reel posts (music name, artist, original vs trending)"
    - "Hashtag ER correlation is computed per unique hashtag across analyzed posts"
    - "Carousel posts are detected and slide count is recorded"
    - "maxDuration is 300 (not 120)"
  artifacts:
    - path: "app/api/mark/artist-analytics/scrape/route.ts"
      provides: "Extended RawPost, AnalyzedPost, AccountSummary with audio, hashtag, carousel fields"
      contains: "musicInfo"
    - path: "app/api/mark/artist-analytics/scrape/route.ts"
      provides: "maxDuration 300"
      contains: "maxDuration = 300"
  key_links:
    - from: "RawPost interface"
      to: "analyzePost function"
      via: "musicInfo, images, childPosts field extraction"
      pattern: "musicInfo\\?"
    - from: "analyzePost"
      to: "buildAccountSummary"
      via: "new AnalyzedPost fields feed summary aggregation"
      pattern: "audioPatterns|hashtagEngagement|carouselStats"
---

<objective>
Enrich the Apify scrape pipeline with additional public fields: audio/music metadata, hashtag ER correlation, caption tone markers, and carousel detection. Bump maxDuration from 120 to 300 for the expanded pipeline.

Purpose: Captures richer signals from existing public data (no OAuth needed) so Mark's Tier 3 context includes audio patterns, hashtag performance, and carousel metrics. This is the foundation that the gap analysis (Plan 02) and OAuth Insights (Plan 03) build on.

Output: Modified `scrape/route.ts` with extended types, enriched analysis functions, and 300s timeout.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-instagram-analytics-improvements/01-CONTEXT.md
@.planning/phases/01-instagram-analytics-improvements/01-RESEARCH.md

<interfaces>
<!-- Key types and contracts from the scrape route that will be modified -->

From app/api/mark/artist-analytics/scrape/route.ts:
```typescript
// Current RawPost — will be extended
interface RawPost {
  caption?: string;
  hashtags?: string[];
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number;
  timestamp?: string;
  type?: string;         // 'Video' | 'Image' | 'Sidecar'
  productType?: string;  // 'feed' | 'clips' | 'igtv'
  displayUrl?: string;
  url?: string;
}

// Current AnalyzedPost — will be extended
interface AnalyzedPost {
  caption: string; likes: number; comments: number; plays: number;
  reach: number; er: number; duration: number; timestamp: string;
  dayOfWeek: string; hour: number; type: string; isVideo: boolean;
  captionLength: number; hasQuestion: boolean; hasEmoji: boolean;
  hasLyricQuote: boolean; durationBucket: 'short' | 'medium' | 'long' | 'image';
}

// Current AccountSummary — will be extended
interface AccountSummary {
  username: string; postCount: number; videoPostCount: number;
  avgER: number; medianER: number; avgPlays: number; avgLikes: number;
  avgComments: number; bestDayOfWeek: string; bestHourRange: string;
  bestDurationBucket: string; topFormats: string[]; captionInsights: string[];
  growthSignal: string; scrapedAt: string;
}

// Current maxDuration
export const maxDuration = 120;

// Functions: analyzePost(p: RawPost): AnalyzedPost
// Functions: buildAccountSummary(posts: AnalyzedPost[], username: string): AccountSummary
// Functions: buildTier3Context(posts: AnalyzedPost[], summary: AccountSummary, username: string): string
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend types and analyzePost with audio, hashtag, carousel, caption tone fields</name>
  <files>app/api/mark/artist-analytics/scrape/route.ts</files>
  <read_first>
    - app/api/mark/artist-analytics/scrape/route.ts (current full implementation — understand all existing types and functions before modifying)
  </read_first>
  <action>
In `app/api/mark/artist-analytics/scrape/route.ts`, make these changes:

**1. Change maxDuration (line 14):**
```typescript
export const maxDuration = 300;
```

**2. Extend `RawPost` interface — add these optional fields after `url`:**
```typescript
interface RawPost {
  // ... existing fields unchanged ...
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
```

**3. Extend `AnalyzedPost` interface — add these fields after `durationBucket`:**
```typescript
interface AnalyzedPost {
  // ... existing fields unchanged ...
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
```

**4. Extend `AccountSummary` interface — add these optional fields after `scrapedAt`:**
```typescript
interface AccountSummary {
  // ... existing fields unchanged ...
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
```

**5. Update `analyzePost` function — add extraction after the existing `return` block replaces with:**

After the existing field assignments (plays, reach, likes, etc.) and before the `return` statement, add:

```typescript
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
```

Then add these new fields to the return object:
```typescript
return {
  // ... all existing fields stay exactly as they are ...
  musicName,
  musicArtist,
  isOriginalAudio,
  hashtags,
  isCarousel,
  carouselSlideCount,
  captionTone,
};
```

**6. Update `buildAccountSummary` function — add aggregation before the final `return`:**

After the existing `growthSignal` computation and before `return {`, add:

```typescript
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
```

Then add these three fields to the return object:
```typescript
return {
  // ... all existing fields stay exactly as they are ...
  audioPatterns,
  hashtagEngagement,
  carouselStats,
};
```

Per D-05 (add all available Apify public fields) and D-07 (must fit within existing 50-post resultsLimit).
Per D-12 (extend maxDuration to 300s).
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && grep -c "maxDuration = 300" app/api/mark/artist-analytics/scrape/route.ts && grep -c "musicInfo" app/api/mark/artist-analytics/scrape/route.ts && grep -c "isCarousel" app/api/mark/artist-analytics/scrape/route.ts && grep -c "hashtagEngagement" app/api/mark/artist-analytics/scrape/route.ts && grep -c "captionTone" app/api/mark/artist-analytics/scrape/route.ts && grep -c "audioPatterns" app/api/mark/artist-analytics/scrape/route.ts && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `scrape/route.ts` contains `export const maxDuration = 300` (not 120)
    - `RawPost` interface contains `musicInfo?: {` with `musicName`, `musicArtist`, `isOriginalAudio` properties
    - `RawPost` interface contains `images?: string[]` and `childPosts?: any[]`
    - `AnalyzedPost` interface contains `musicName: string | null`, `musicArtist: string | null`, `isOriginalAudio: boolean | null`
    - `AnalyzedPost` interface contains `hashtags: string[]`, `isCarousel: boolean`, `carouselSlideCount: number`, `captionTone: string`
    - `AccountSummary` interface contains `audioPatterns?:`, `hashtagEngagement?:`, `carouselStats?:`
    - `analyzePost` function extracts `p.musicInfo?.musicName` with null-safe access
    - `buildAccountSummary` computes `audioPatterns`, `hashtagEngagement`, `carouselStats` and returns them
    - `npx tsc --noEmit` produces zero errors related to `scrape/route.ts`
  </acceptance_criteria>
  <done>
    - RawPost, AnalyzedPost, and AccountSummary interfaces extended with all new fields
    - analyzePost extracts music, hashtags, carousel, and caption tone from raw Apify data
    - buildAccountSummary aggregates audioPatterns (top sounds, original vs trending), hashtagEngagement (top 10 by ER), and carouselStats (ER comparison)
    - maxDuration is 300
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend buildTier3Context to include enriched data sections</name>
  <files>app/api/mark/artist-analytics/scrape/route.ts</files>
  <read_first>
    - app/api/mark/artist-analytics/scrape/route.ts (re-read after Task 1 modifications to see current state)
  </read_first>
  <action>
Update the `buildTier3Context` function to include the new enriched data in the Tier 3 context string that Mark reads.

**Modify the `buildTier3Context` function** to add these sections after the existing `### Caption Patterns` section and before `### Guidance for Mark`:

```typescript
function buildTier3Context(posts: AnalyzedPost[], summary: AccountSummary, username: string): string {
  // ... existing code for top5, bottom3, top5Lines, bottom3Lines, captionNotes stays exactly as-is ...

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
  const toneFreq: Record<string, number> = {};
  posts.forEach(p => { toneFreq[p.captionTone] = (toneFreq[p.captionTone] || 0) + 1; });
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
```

Also update the `topPosts` mapping in the POST handler to include new fields:
```typescript
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
```

Per D-08 (Tier 3 context enriched with both raw stats AND insights).
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && grep -c "Audio & Sound Patterns" app/api/mark/artist-analytics/scrape/route.ts && grep -c "Hashtag Performance" app/api/mark/artist-analytics/scrape/route.ts && grep -c "Carousel vs Single Posts" app/api/mark/artist-analytics/scrape/route.ts && grep -c "Caption Tone Analysis" app/api/mark/artist-analytics/scrape/route.ts && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `buildTier3Context` output string contains `### Audio & Sound Patterns` section
    - `buildTier3Context` output string contains `### Hashtag Performance` section
    - `buildTier3Context` output string contains `### Carousel vs Single Posts` section
    - `buildTier3Context` output string contains `### Caption Tone Analysis` section
    - `buildTier3Context` guidance section references audio strategy and hashtags
    - `topPosts` mapping includes `musicName`, `isOriginalAudio`, `isCarousel`, `carouselSlideCount`, `captionTone`
    - `npx tsc --noEmit` produces zero errors
  </acceptance_criteria>
  <done>
    - buildTier3Context generates enriched markdown with audio patterns, hashtag ER, carousel comparison, and caption tone breakdown
    - Tier 3 guidance section updated to reference audio strategy and hashtag data
    - topPosts response includes new fields for UI consumption
    - TypeScript compiles clean
  </done>
</task>

</tasks>

<verification>
1. `grep "maxDuration = 300" app/api/mark/artist-analytics/scrape/route.ts` returns a match
2. `npx tsc --noEmit` passes (zero errors in scrape/route.ts)
3. The scrape route still compiles and the POST handler structure is intact
4. All new interfaces (RawPost, AnalyzedPost, AccountSummary) have the documented fields
</verification>

<success_criteria>
- scrape/route.ts has maxDuration=300, extended types, enriched analysis functions, and enriched Tier 3 context string
- No regressions to existing fields or analysis logic
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/phases/01-instagram-analytics-improvements/01-01-SUMMARY.md`
</output>
