---
phase: 01-instagram-analytics-improvements
plan: 02
type: execute
wave: 1
depends_on: ["01-01"]
files_modified:
  - app/api/mark/artist-analytics/scrape/route.ts
  - components/multiverse/ArtistAnalyticsPanel.tsx
autonomous: true
requirements:
  - REQ-05
  - REQ-07
  - REQ-08
must_haves:
  truths:
    - "Claude gap analysis runs after Apify scrape and compares artist data against Universal Truths, Stafford playbook, and Live Intelligence"
    - "Gap analysis output is appended as a ### Mark's Gap Analysis section in the tier3Context string"
    - "Enriched tier3Context (stats + gap analysis) is stored in Supabase onboarding_profile.instagramAnalytics.tier3Context"
    - "ArtistAnalyticsPanel shows audio patterns, hashtag ER, carousel stats, and gap analysis insights"
  artifacts:
    - path: "app/api/mark/artist-analytics/scrape/route.ts"
      provides: "Claude gap analysis call via Anthropic SDK"
      contains: "buildGapAnalysis"
    - path: "app/api/mark/artist-analytics/scrape/route.ts"
      provides: "Intelligence loader imports"
      contains: "loadUniversalTruths"
    - path: "components/multiverse/ArtistAnalyticsPanel.tsx"
      provides: "UI cards for audio patterns, hashtag ER, gap insights"
      contains: "audioPatterns"
  key_links:
    - from: "app/api/mark/artist-analytics/scrape/route.ts"
      to: "lib/mark/intelligence-loader.ts"
      via: "import { loadUniversalTruths, loadLiveIntelligence }"
      pattern: "loadUniversalTruths|loadLiveIntelligence"
    - from: "app/api/mark/artist-analytics/scrape/route.ts"
      to: "lib/stafford-knowledge.ts"
      via: "import { STAFFORD_KNOWLEDGE }"
      pattern: "STAFFORD_KNOWLEDGE"
    - from: "app/api/mark/artist-analytics/scrape/route.ts"
      to: "anthropic.messages.create"
      via: "Claude API call for gap analysis"
      pattern: "anthropic\\.messages\\.create"
    - from: "components/multiverse/ArtistAnalyticsPanel.tsx"
      to: "/api/mark/artist-analytics/load"
      via: "fetch for enriched analytics data"
      pattern: "audioPatterns|hashtagEngagement|carouselStats"
---

<objective>
Add Claude gap analysis to the scrape pipeline and update the ArtistAnalyticsPanel UI to surface all new enriched signals (audio, hashtags, carousels, gap insights).

Purpose: The gap analysis is the core intelligence upgrade — it cross-references the artist's data against Mark's full knowledge stack (Universal Truths, Stafford playbook, Live Intelligence) and produces actionable recommendations. The UI update surfaces all enriched data to the artist.

Output: Modified `scrape/route.ts` with gap analysis call, modified `ArtistAnalyticsPanel.tsx` with new UI sections.
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
@.planning/phases/01-instagram-analytics-improvements/01-01-SUMMARY.md

<interfaces>
<!-- Intelligence loader exports needed for gap analysis -->
From lib/mark/intelligence-loader.ts:
```typescript
export function loadUniversalTruths(): string;   // reads lib/mark/universal-truths.md
export function loadLiveIntelligence(): string;   // reads lib/mark/live-intelligence.md
```

From lib/stafford-knowledge.ts:
```typescript
export const STAFFORD_KNOWLEDGE: string;  // large multi-KB template literal
```

<!-- Anthropic SDK pattern from refresh-intelligence -->
From app/api/mark/refresh-intelligence/route.ts (reference pattern):
```typescript
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
// Uses anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, ... })
```

<!-- Current ArtistAnalyticsPanel interfaces -->
From components/multiverse/ArtistAnalyticsPanel.tsx:
```typescript
interface TopPost {
  er: number; plays: number; likes: number; comments: number;
  duration: number; caption: string; durationBucket: string; dayOfWeek: string;
}
interface AccountSummary {
  username: string; postCount: number; avgER: number; medianER: number;
  avgPlays: number; bestDayOfWeek: string; bestHourRange: string;
  bestDurationBucket: string; topFormats: string[]; captionInsights: string[];
  growthSignal: string; scrapedAt: string;
}
interface AnalyticsData {
  accountSummary: AccountSummary; tier3Context: string;
  topPosts: TopPost[]; rawPostCount: number; scrapedAt: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Claude gap analysis call to scrape route</name>
  <files>app/api/mark/artist-analytics/scrape/route.ts</files>
  <read_first>
    - app/api/mark/artist-analytics/scrape/route.ts (current state after Plan 01 modifications)
    - app/api/mark/refresh-intelligence/route.ts (reference pattern for Anthropic SDK usage)
    - lib/mark/intelligence-loader.ts (loadUniversalTruths, loadLiveIntelligence exports)
    - lib/stafford-knowledge.ts (first 30 lines — confirm STAFFORD_KNOWLEDGE export name)
  </read_first>
  <action>
In `app/api/mark/artist-analytics/scrape/route.ts`, make these changes:

**1. Add imports at the top of the file (after existing imports):**
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { loadUniversalTruths, loadLiveIntelligence } from '@/lib/mark/intelligence-loader';
import { STAFFORD_KNOWLEDGE } from '@/lib/stafford-knowledge';
```

**2. Add Anthropic client initialization (after the APIFY_TOKEN constant):**
```typescript
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
```

**3. Add the `buildGapAnalysis` async function (after `buildTier3Context`, before the POST handler):**

```typescript
async function buildGapAnalysis(posts: AnalyzedPost[], summary: AccountSummary): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[artist-analytics/scrape] ANTHROPIC_API_KEY not set — skipping gap analysis');
    return '';
  }

  // Truncate knowledge sources to keep prompt within reasonable token budget
  const universalTruths = loadUniversalTruths().slice(0, 3000);
  const liveIntelligence = loadLiveIntelligence().slice(0, 2000);
  const staffordSummary = STAFFORD_KNOWLEDGE.slice(0, 3000);

  // Top 10 by ER + bottom 5 for contrast
  const top10 = [...posts].filter(p => p.isVideo && p.plays > 0).sort((a, b) => b.er - a.er).slice(0, 10);
  const bottom5 = [...posts].filter(p => p.isVideo && p.plays > 0).sort((a, b) => a.er - b.er).slice(0, 5);

  const postSummaries = [...top10, ...bottom5].map(p =>
    `ER:${p.er.toFixed(2)}% | ${p.plays} plays | ${p.likes}L ${p.comments}C | ${p.duration}s ${p.durationBucket} | tone:${p.captionTone} | music:${p.musicName ?? 'none'} | carousel:${p.isCarousel} | "${p.caption.slice(0, 80)}"`
  ).join('\n');

  const prompt = `You are analyzing an Instagram artist's posting patterns. Compare their data to proven music marketing frameworks and current trends.

## Artist Data (@${summary.username})
- ${summary.postCount} posts analyzed (${summary.videoPostCount} videos)
- Average ER: ${summary.avgER}% | Median ER: ${summary.medianER}%
- Average plays: ${summary.avgPlays.toLocaleString()}
- Growth: ${summary.growthSignal}
- Best day: ${summary.bestDayOfWeek} | Best time: ${summary.bestHourRange} | Best length: ${summary.bestDurationBucket}
${summary.audioPatterns ? `- Audio: ${summary.audioPatterns.originalAudioCount} original, ${summary.audioPatterns.trendingSoundCount} trending sounds` : ''}
${summary.carouselStats ? `- Carousels: ${summary.carouselStats.carouselCount} posts, ${summary.carouselStats.carouselOutperforms ? 'outperform' : 'underperform'} singles` : ''}

## Top & Bottom Posts
${postSummaries}

## Universal Truths (proven engagement principles)
${universalTruths}

## Stafford's Playbook (music marketing formats & mindset)
${staffordSummary}

## Current Live Trends
${liveIntelligence}

---

Produce a gap analysis with these exact sections:

#### Strengths (What's Already Working)
List 2-3 patterns where this artist's best content aligns with Universal Truths or Stafford formats. Reference specific post data.

#### Gaps (What's Missing)
List 2-4 formats, approaches, or content types from Stafford's playbook or Universal Truths that this artist is NOT using but should try. Be specific about which format and why it fits their niche.

#### Trend Alignment
Compare their posting patterns (timing, duration, audio usage) to current live trends. Note any mismatches.

#### Recommendations
3-5 specific, actionable recommendations anchored to their actual data. Each recommendation must reference a specific metric or pattern from their posts.

Keep it concise — this text will be embedded in Mark's system prompt. Total output under 800 words.`;

  try {
    console.log(`[artist-analytics/scrape] Starting Claude gap analysis for @${summary.username}`);
    const startTime = Date.now();

    const analysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = analysis.content[0].type === 'text' ? analysis.content[0].text : '';
    console.log(`[artist-analytics/scrape] Gap analysis complete in ${Date.now() - startTime}ms (${text.length} chars)`);
    return text;
  } catch (err: any) {
    console.error('[artist-analytics/scrape] Gap analysis failed:', err.message);
    return '';  // Non-blocking — scrape still succeeds without gap analysis
  }
}
```

**4. Update the `buildTier3Context` function signature to accept an optional gapAnalysis parameter:**

Change the function signature:
```typescript
function buildTier3Context(posts: AnalyzedPost[], summary: AccountSummary, username: string, gapAnalysis?: string): string {
```

Add the gap analysis section at the end of the template string, right before the closing backtick:
```typescript
${gapAnalysis ? `\n### Mark's Gap Analysis\n${gapAnalysis}` : ''}
```

This goes AFTER the `### Guidance for Mark` section.

**5. Update the POST handler to call gap analysis and pass it to buildTier3Context:**

In the POST handler, after `const summary = buildAccountSummary(analyzed, handle);` and before `const tier3Context = buildTier3Context(...)`, add:

```typescript
// Claude gap analysis — compares artist patterns to Mark's intelligence stack (per D-09, D-10)
const gapAnalysis = await buildGapAnalysis(analyzed, summary);
```

Then update the `buildTier3Context` call:
```typescript
const tier3Context = buildTier3Context(analyzed, summary, handle, gapAnalysis);
```

Per D-08 (tier3Context enriched with stats AND gap analysis).
Per D-09 (gap analysis receives artist data + T1a + T1b + T2).
Per D-10 (output includes strengths, gaps, trend alignment, recommendations).
Per D-11 (synchronous — runs in same request).
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && grep -c "import Anthropic" app/api/mark/artist-analytics/scrape/route.ts && grep -c "loadUniversalTruths" app/api/mark/artist-analytics/scrape/route.ts && grep -c "STAFFORD_KNOWLEDGE" app/api/mark/artist-analytics/scrape/route.ts && grep -c "buildGapAnalysis" app/api/mark/artist-analytics/scrape/route.ts && grep -c "Mark's Gap Analysis" app/api/mark/artist-analytics/scrape/route.ts && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `scrape/route.ts` imports `Anthropic from '@anthropic-ai/sdk'`
    - `scrape/route.ts` imports `loadUniversalTruths, loadLiveIntelligence` from `@/lib/mark/intelligence-loader`
    - `scrape/route.ts` imports `STAFFORD_KNOWLEDGE` from `@/lib/stafford-knowledge`
    - `scrape/route.ts` contains `async function buildGapAnalysis(posts: AnalyzedPost[], summary: AccountSummary): Promise<string>`
    - `buildGapAnalysis` truncates each knowledge source: `loadUniversalTruths().slice(0, 3000)`, `loadLiveIntelligence().slice(0, 2000)`, `STAFFORD_KNOWLEDGE.slice(0, 3000)`
    - `buildGapAnalysis` uses `anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, ... })`
    - `buildGapAnalysis` prompt includes sections: "Universal Truths", "Stafford's Playbook", "Current Live Trends"
    - `buildGapAnalysis` prompt requests: "Strengths", "Gaps", "Trend Alignment", "Recommendations"
    - `buildTier3Context` signature includes `gapAnalysis?: string` parameter
    - `buildTier3Context` output contains `### Mark's Gap Analysis` section when gapAnalysis is non-empty
    - POST handler calls `await buildGapAnalysis(analyzed, summary)` before `buildTier3Context`
    - POST handler passes `gapAnalysis` to `buildTier3Context`
    - `npx tsc --noEmit` produces zero errors
  </acceptance_criteria>
  <done>
    - Claude gap analysis runs synchronously after Apify scrape, comparing artist data against truncated T1a, T1b, T2
    - Gap analysis output includes Strengths, Gaps, Trend Alignment, and 3-5 Recommendations
    - Gap analysis is appended as `### Mark's Gap Analysis` section in tier3Context
    - Non-blocking on failure (logs error, returns empty string)
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Update ArtistAnalyticsPanel UI with enriched data sections</name>
  <files>components/multiverse/ArtistAnalyticsPanel.tsx</files>
  <read_first>
    - components/multiverse/ArtistAnalyticsPanel.tsx (current full implementation)
    - app/api/mark/artist-analytics/load/route.ts (understand what data shape the panel receives)
  </read_first>
  <action>
Update `components/multiverse/ArtistAnalyticsPanel.tsx` to surface the new enriched signals.

**1. Extend the `TopPost` interface:**
```typescript
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
```

**2. Extend the `AccountSummary` interface:**
```typescript
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
```

**3. Add new state for gap insights toggle:**
```typescript
const [showGapInsights, setShowGapInsights] = useState(false);
```

**4. Add new UI sections inside the `{analytics && !isLoading && (<>...</>)}` block, AFTER the existing Caption Insights section and BEFORE the Top Posts toggle button:**

```tsx
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
```

**5. Update the top post cards** to show music/carousel badges. In the `analytics.topPosts.map` section, after the existing flex gap badges div, add:

```tsx
{/* Add inside each top post card, after the existing duration/day badges */}
{post.musicName && (
  <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 rounded text-purple-400 truncate max-w-[120px]">
    {post.isOriginalAudio ? '🎵 Original' : `🎶 ${post.musicName}`}
  </span>
)}
{post.isCarousel && (
  <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 rounded text-blue-400">
    📷 {post.carouselSlideCount} slides
  </span>
)}
```

**6. Update the scraping message** to reflect the longer pipeline:
Change `Scraping last 50 posts via Apify… this takes ~60s` to:
```
Analyzing last 50 posts via Apify + Claude… this takes ~90-120s
```

Per D-08 (tier3Context enriched with stats AND insights — UI must surface them).
Per REQ-08 (ArtistAnalyticsPanel must surface saves when available, audio patterns, hashtag performance, gap analysis insights).
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && grep -c "audioPatterns" components/multiverse/ArtistAnalyticsPanel.tsx && grep -c "hashtagEngagement" components/multiverse/ArtistAnalyticsPanel.tsx && grep -c "carouselStats" components/multiverse/ArtistAnalyticsPanel.tsx && grep -c "Gap Analysis" components/multiverse/ArtistAnalyticsPanel.tsx && grep -c "showGapInsights" components/multiverse/ArtistAnalyticsPanel.tsx && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `ArtistAnalyticsPanel.tsx` `AccountSummary` interface contains `audioPatterns?:` with `totalReelsWithMusic`, `originalAudioCount`, `trendingSoundCount`, `topSounds`
    - `ArtistAnalyticsPanel.tsx` `AccountSummary` interface contains `hashtagEngagement?:` with `topHashtags`, `hashtagsUsedCount`, `avgHashtagsPerPost`
    - `ArtistAnalyticsPanel.tsx` `AccountSummary` interface contains `carouselStats?:` with `carouselCount`, `avgCarouselER`, `avgSinglePostER`, `carouselOutperforms`
    - `ArtistAnalyticsPanel.tsx` contains `showGapInsights` state variable
    - `ArtistAnalyticsPanel.tsx` renders "Audio Patterns" section conditionally on `audioPatterns.totalReelsWithMusic > 0`
    - `ArtistAnalyticsPanel.tsx` renders "Top Hashtags by ER" section conditionally on `hashtagEngagement.topHashtags.length > 0`
    - `ArtistAnalyticsPanel.tsx` renders "Carousel vs Single" section conditionally on `carouselStats.carouselCount > 0`
    - `ArtistAnalyticsPanel.tsx` renders "Gap Analysis Insights" section conditionally on `tier3Context.includes("Mark's Gap Analysis")`
    - `ArtistAnalyticsPanel.tsx` gap analysis section extracts content between `### Mark's Gap Analysis` and `### Guidance for Mark` from tier3Context
    - `TopPost` interface contains `musicName`, `isOriginalAudio`, `isCarousel`, `carouselSlideCount`, `captionTone` (all optional)
    - `npx tsc --noEmit` produces zero errors
  </acceptance_criteria>
  <done>
    - ArtistAnalyticsPanel shows Audio Patterns card (original vs trending, top sounds)
    - ArtistAnalyticsPanel shows Top Hashtags by ER card (top 5 with ER and post count)
    - ArtistAnalyticsPanel shows Carousel vs Single comparison card
    - ArtistAnalyticsPanel shows collapsible Gap Analysis Insights section (from Claude output in tier3Context)
    - Top post cards show music and carousel badges
    - All new sections are backward-compatible (conditionally rendered, handle missing data)
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes (zero errors in both modified files)
2. `grep "buildGapAnalysis" app/api/mark/artist-analytics/scrape/route.ts` returns matches
3. `grep "loadUniversalTruths" app/api/mark/artist-analytics/scrape/route.ts` returns matches
4. `grep "audioPatterns" components/multiverse/ArtistAnalyticsPanel.tsx` returns matches
5. `grep "Gap Analysis" components/multiverse/ArtistAnalyticsPanel.tsx` returns matches
</verification>

<success_criteria>
- Gap analysis runs synchronously at scrape time using Claude API, comparing against T1a, T1b, T2 (truncated)
- Gap analysis output appended to tier3Context as `### Mark's Gap Analysis` section
- ArtistAnalyticsPanel surfaces audio patterns, hashtag ER, carousel stats, and gap insights
- All new UI sections are backward-compatible (conditionally rendered)
- Pipeline completes within 300s timeout
</success_criteria>

<output>
After completion, create `.planning/phases/01-instagram-analytics-improvements/01-02-SUMMARY.md`
</output>
