---
phase: 01-instagram-analytics-improvements
plan: 01
subsystem: instagram-analytics
tags: [apify, scraping, tier3-context, analytics, typescript]
dependency_graph:
  requires: []
  provides: [enriched-scrape-pipeline, audio-analysis, hashtag-er-correlation, carousel-stats, caption-tone]
  affects: [mark-intelligence-tier3, artist-analytics-ui]
tech_stack:
  added: []
  patterns: [null-safe-optional-chaining, record-aggregation, frequency-map-with-er]
key_files:
  created: []
  modified:
    - app/api/mark/artist-analytics/scrape/route.ts
decisions:
  - "maxDuration bumped to 300 to support extended Apify pipeline within Vercel Pro limits"
  - "isOriginalAudio uses boolean | null (not boolean) — null means no music data (image post or missing field)"
  - "carouselOutperforms requires >= 2 of each type for statistical validity"
  - "Hashtag ER correlation filters tags used < 2 times to avoid single-use noise"
metrics:
  duration: "3 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 01 Plan 01: Enrich Apify Scrape Pipeline with Audio, Hashtag, Carousel, and Caption Tone Fields

One-liner: Extended Apify scrape pipeline with musicInfo, carousel detection, hashtag ER correlation, and caption tone heuristics — maxDuration bumped to 300s.

## What Was Built

Both tasks executed cleanly against `app/api/mark/artist-analytics/scrape/route.ts` with no deviations from the plan.

### Task 1: Extend types and analyzePost

- `maxDuration` changed from 120 to 300
- `RawPost` extended with `musicInfo` (musicName, musicArtist, musicUrl, isOriginalAudio), `images`, and `childPosts`
- `AnalyzedPost` extended with `musicName`, `musicArtist`, `isOriginalAudio`, `hashtags`, `isCarousel`, `carouselSlideCount`, `captionTone`
- `AccountSummary` extended with optional `audioPatterns`, `hashtagEngagement`, and `carouselStats`
- `analyzePost` extracts all new fields with null-safe access (`p.musicInfo?.musicName ?? null`)
- `buildAccountSummary` aggregates audio patterns (top 5 sounds by frequency with avg ER), hashtag ER correlation (top 10 by ER, filtered to >= 2 uses), and carousel stats (ER comparison, slide count avg)

### Task 2: Extend buildTier3Context

- Added `### Audio & Sound Patterns` section (original vs trending count, top sounds with ER)
- Added `### Hashtag Performance` section (top 5 hashtags by ER from top-10 computed set)
- Added `### Carousel vs Single Posts` section (ER comparison with carouselOutperforms flag)
- Added `### Caption Tone Analysis` section (tone distribution by ER, filtered to >= 2 posts)
- Updated Guidance for Mark paragraph to reference audio strategy and hashtag data
- Extended `topPosts` response mapping with `musicName`, `isOriginalAudio`, `isCarousel`, `carouselSlideCount`, `captionTone`

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1    | b2c9a28 | feat(01-instagram-analytics-improvements-01): extend types and analyzePost with audio, hashtag, carousel, caption tone fields |
| 2    | 06751a8 | feat(01-instagram-analytics-improvements-01): extend buildTier3Context with audio, hashtag, carousel, and caption tone sections |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All new fields flow through the full pipeline: raw Apify data -> analyzePost -> buildAccountSummary -> buildTier3Context -> Tier 3 context string. The `topPosts` response includes new fields for UI consumption. No placeholder values or hardcoded empty states exist in the modified code.

Note: In practice, `musicInfo` fields will be null for image posts and carousel posts (Apify only returns music data for Reels). This is handled correctly with `?? null` fallbacks. The sections in the Tier 3 context string are conditionally rendered — they only appear if actual music/hashtag/carousel data exists.

## Self-Check: PASSED
