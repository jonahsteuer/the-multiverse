---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Plan 03, Task 3 — human-verify checkpoint (OAuth end-to-end test)
last_updated: "2026-04-04T01:43:32.068Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Current Status

- **Active Milestone:** Milestone 1 — Instagram Analytics Foundation
- **Active Phase:** Phase 1 — Instagram Analytics Improvements
- **Phase Status:** Plan 03 partially complete — awaiting human verification of Instagram OAuth flow
- **Last Completed Plan:** 01-03 tasks 1+2 (OAuth routes created, Graph API Insights integrated)
- **Next Plan:** 01-03 Task 3 (human-verify checkpoint — needs Meta App credentials + OAuth test)
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

- Instagram OAuth routes exist but not yet tested end-to-end — requires Meta App credentials (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET)
- Tier 3 context now includes audio patterns, hashtag ER correlation, carousel stats, caption tone, gap analysis (Plans 01+02 complete)
- `videoPlayCount` (public plays) correctly used after bug fix in this session
- Vercel maxDuration bumped to 300s (completed in Plan 01)

### Pending Checkpoint (Plan 03, Task 3)

Human must set up Meta App and verify OAuth flow end-to-end:

1. Set INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET in .env.local
2. Configure OAuth redirect URI in Meta App Dashboard: http://localhost:3000/api/auth/instagram/callback
3. Start dev server, run scrape, click "Connect Instagram", verify ?instagram_oauth=success
4. Re-run scrape, verify Saves card appears

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
- Instagram OAuth routes: GET /api/auth/instagram?userId= (authorize) + GET /api/auth/instagram/callback (token exchange + storage)
- Graph API Insights: fetches saved + reach per post (NOT impressions — deprecated v22+); matched by timestamp ±60s
- Token refresh-on-read: tokens > 30 days old are refreshed automatically via ig_refresh_token grant
- Saves aggregates stored in AccountSummary: totalSaves, avgSavesPerPost, saveRate
- ArtistAnalyticsPanel: "Connect Instagram" CTA shown when no OAuth; Saves card shown when totalSaves present

## Session Continuity

Last session: 2026-04-03 (scheduled task run)
Stopped at: Plan 03, Task 3 — human-verify checkpoint (OAuth end-to-end test)
Resume: When user sets INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET and tests OAuth flow, confirm checkpoint "approved" to complete Plan 03 and trigger phase verification
