# Project State

## Current Status
- **Active Milestone:** Milestone 1 — Instagram Analytics Foundation
- **Active Phase:** Phase 1 — Instagram Analytics Improvements
- **Phase Status:** Plan 02 complete — Claude gap analysis pipeline + ArtistAnalyticsPanel enriched UI
- **Last Completed Plan:** 01-02 (Claude gap analysis + UI update)
- **Next Plan:** 01-03 (if exists)
- **Last Session:** 2026-04-03

## What Exists Today

### Analytics Pipeline (Current State)
- `/api/mark/artist-analytics/scrape/route.ts` — Apify scrape of artist's own Instagram (50 posts). Captures: plays (videoPlayCount), likes, comments, ER, duration, day/time, caption features. 120s maxDuration.
- `/api/mark/artist-analytics/load/route.ts` — Loads saved analytics from Supabase
- `components/multiverse/ArtistAnalyticsPanel.tsx` — Production UI in Galaxy view
- `app/mark-training/analytics/page.tsx` — Dev-only test page (no auth)

### Mark's Intelligence Stack (Current State)
- `lib/mark/intelligence-loader.ts` — Loads T1a (universal-truths.md), T2 (live-intelligence.md), T3 (artist-niches/[slug].md)
- `app/api/mark/route.ts` — Assembles all tiers + instagramAnalytics.tier3Context from Supabase into Mark's system prompt
- `app/api/mark/refresh-intelligence/route.ts` — Weekly Apify + Claude pipeline for T2 Live Intelligence (reference pattern for new scrape enrichment)

### Known Issues / Context
- No Instagram OAuth yet — all data is from public Apify scraping
- Tier 3 context now includes audio patterns, hashtag ER correlation, carousel stats, caption tone (Plan 01 complete)
- `videoPlayCount` (public plays) correctly used after bug fix in this session
- Vercel maxDuration bumped to 300s (completed in Plan 01)

## Decisions Made
- Instagram OAuth required during onboarding (not optional, not lazy)
- Business/Creator account required for Graph API Insights
- All additional Apify fields to be added: audio, hashtags, caption tone, carousels
- Claude gap analysis runs synchronously at scrape time
- Stats + insights both stored in Tier 3 context string
- isOriginalAudio uses boolean | null (null = no music data, e.g. image posts)
- Hashtag ER correlation filters tags used < 2 times to avoid single-use noise
- carouselOutperforms requires >= 2 carousel posts and >= 2 single posts for validity
- maxDuration set to 300 (Vercel Pro limit)
- Gap analysis knowledge sources truncated (T1a: 3000, T1b: 3000, T2: 2000 chars) for token budget
- Gap analysis failure is non-blocking — logs error, returns empty string, scrape continues
- Gap insights UI extracts from tier3Context by string split on ### Mark's Gap Analysis marker
