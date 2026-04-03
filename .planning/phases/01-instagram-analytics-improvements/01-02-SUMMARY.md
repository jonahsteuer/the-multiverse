---
phase: 01-instagram-analytics-improvements
plan: 02
subsystem: instagram-analytics
tags: [anthropic, claude, gap-analysis, tier3-context, analytics, ui, react, typescript]

dependency_graph:
  requires:
    - phase: 01-instagram-analytics-improvements
      plan: 01
      provides: enriched-scrape-pipeline with audioPatterns, hashtagEngagement, carouselStats, captionTone fields
  provides:
    - claude-gap-analysis-in-scrape-pipeline
    - tier3-context-with-gap-analysis-section
    - artist-analytics-panel-enriched-ui
  affects:
    - mark-intelligence-tier3
    - artist-analytics-ui

tech-stack:
  added:
    - "@anthropic-ai/sdk (already in project, now used in scrape route)"
  patterns:
    - "Knowledge source truncation pattern: slice(0, 3000/2000) for prompt token budget management"
    - "Non-blocking Claude call: error caught, returns empty string, scrape continues"
    - "Gap analysis injected into tier3Context as dedicated ### Mark's Gap Analysis section"
    - "Conditional UI sections: all new panels guard on optional field existence"

key-files:
  created: []
  modified:
    - app/api/mark/artist-analytics/scrape/route.ts
    - components/multiverse/ArtistAnalyticsPanel.tsx

key-decisions:
  - "Gap analysis is synchronous within the scrape request — runs after Apify, before Supabase save"
  - "Knowledge sources are truncated (T1a: 3000, T1b: 3000, T2: 2000 chars) to manage token budget"
  - "Gap analysis failure is non-blocking: logs error, returns empty string, scrape result unaffected"
  - "Gap analysis extracts from tier3Context by splitting on ### Mark's Gap Analysis marker"
  - "Music badges in top posts omit emoji per project conventions, use plain text labels"

patterns-established:
  - "Anthropic SDK client singleton at module level: const anthropic = new Anthropic({ apiKey: ... })"
  - "Intelligence knowledge loading: loadUniversalTruths, loadLiveIntelligence, STAFFORD_KNOWLEDGE all truncated for prompts"
  - "Gap analysis prompt structure: Artist Data -> Top/Bottom Posts -> Knowledge Sources -> Output sections"

requirements-completed:
  - REQ-05
  - REQ-07
  - REQ-08

duration: 4min
completed: 2026-04-03
---

# Phase 01 Plan 02: Claude Gap Analysis + ArtistAnalyticsPanel Enriched UI Summary

**Claude gap analysis added to Apify scrape pipeline — compares artist data against T1a/T1b/T2 knowledge stack and appends Strengths, Gaps, Trend Alignment, and Recommendations to tier3Context; ArtistAnalyticsPanel surfaces audio patterns, hashtag ER, carousel stats, and collapsible gap insights.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-03T08:15:58Z
- **Completed:** 2026-04-03T08:19:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `buildGapAnalysis` async function to scrape route using Anthropic SDK — cross-references artist data against Universal Truths, Stafford's Playbook, and Live Intelligence (each truncated for token budget)
- Gap analysis appended to `tier3Context` as `### Mark's Gap Analysis` section — stored in Supabase `instagramAnalytics.tier3Context`
- ArtistAnalyticsPanel extended with 4 new data sections: Audio Patterns, Top Hashtags by ER, Carousel vs Single, and collapsible Gap Analysis Insights
- Top post cards now show music and carousel badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Claude gap analysis call to scrape route** - `257db1f` (feat)
2. **Task 2: Update ArtistAnalyticsPanel UI with enriched data sections** - `efd0386` (feat)

## Files Created/Modified

- `app/api/mark/artist-analytics/scrape/route.ts` - Added imports (Anthropic SDK, intelligence-loader, stafford-knowledge), anthropic client singleton, buildGapAnalysis async function, updated buildTier3Context signature with optional gapAnalysis param, updated POST handler to call gap analysis
- `components/multiverse/ArtistAnalyticsPanel.tsx` - Extended TopPost and AccountSummary interfaces, added showGapInsights state, added Audio Patterns/Hashtag ER/Carousel Stats/Gap Insights UI sections, updated top post badges, updated scraping message

## Decisions Made

- Gap analysis runs synchronously within the 300s scrape request window — not a background job
- Each knowledge source truncated independently (T1a: 3000, T1b: 3000, T2: 2000) rather than a single budget, for predictable size
- Gap analysis failure is non-blocking: `catch` returns `''`, entire scrape still succeeds and returns data
- Gap insights UI extracts content from tier3Context by string splitting on `### Mark's Gap Analysis` — decoupled from backend schema changes
- Removed emoji from music/carousel badges per CLAUDE.md convention (no emojis unless explicitly requested)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed emoji from music/carousel post badges**
- **Found during:** Task 2 (ArtistAnalyticsPanel UI)
- **Issue:** Plan spec included emoji in badge labels (`🎵 Original`, `🎶 ${post.musicName}`, `📷 ${post.carouselSlideCount} slides`). CLAUDE.md forbids emojis unless explicitly requested.
- **Fix:** Replaced `🎵 Original` with `Original`, `🎶 ${post.musicName}` with `${post.musicName}`, `📷 ${post.carouselSlideCount} slides` with `${post.carouselSlideCount} slides`
- **Files modified:** components/multiverse/ArtistAnalyticsPanel.tsx
- **Verification:** No emoji characters in badge spans
- **Committed in:** efd0386 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (CLAUDE.md compliance — emoji removal)
**Impact on plan:** No functional impact. UI labels remain clear without emoji.

## Issues Encountered

- `.next/types/` directory contains duplicate generated type files (`cache-life.d 2.ts`, `routes.d 2.ts`) causing TypeScript errors when running `tsc --noEmit`. These are pre-existing, out of scope, and not caused by our changes. All errors filtered to `.next/` path — zero errors in source files.

## User Setup Required

None — `ANTHROPIC_API_KEY` is already in the environment for this project (referenced in existing `refresh-intelligence/route.ts`). The gap analysis will silently skip with a console warning if the key is missing.

## Next Phase Readiness

- Gap analysis is live: next scrape of any artist will produce a `### Mark's Gap Analysis` section in tier3Context
- Mark's system prompt assembler (`app/api/mark/route.ts`) already reads full tier3Context — gap analysis is automatically included in Mark's context on next scrape
- ArtistAnalyticsPanel UI is backward-compatible: old analytics data (without gap analysis) renders cleanly without the new sections
- Phase 01 Plan 03 can proceed (if exists) — enriched pipeline is complete

## Known Stubs

None. All new fields flow end-to-end: Anthropic API call -> gap analysis string -> appended to tier3Context string -> stored in Supabase -> loaded by ArtistAnalyticsPanel -> rendered in UI. The gap analysis section is conditionally shown only when `tier3Context.includes("Mark's Gap Analysis")` — no placeholder text will appear for old analytics data.

---
*Phase: 01-instagram-analytics-improvements*
*Completed: 2026-04-03*
