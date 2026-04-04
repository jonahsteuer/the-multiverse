---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 02
stopped_at: Completed 02-03-PLAN.md — Edit Feedback + Snapshot Starter API routes ported to the-multiverse-v2 with Tier 3 context wiring
last_updated: "2026-04-04T20:40:06.632Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
---

# Project State

## Current Status

- **Active Milestone:** Milestone 1 — Instagram Analytics Foundation
- **Active Phase:** Phase 2 — New MVP App Shell
- **Phase Status:** Plan 01 complete — the-multiverse-v2 repo bootstrapped
- **Last Completed Plan:** 02-01 (repo bootstrap, design system, Supabase SSR, shared types)
- **Next Plan:** 02-02 (API layer port)
- **Last Session:** 2026-04-04T20:40:06.628Z

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
- [Phase 02-new-mvp-app-shell]: Next.js 16.2.2 uses Turbopack by default — replaced webpack config with turbopack: {} + serverExternalPackages for Three.js
- [Phase 02-new-mvp-app-shell]: mark-training-rules.ts filesystem logging omitted in v2 — no training log infrastructure; session IDs still returned for UI compatibility
- [Phase 02-new-mvp-app-shell]: RUFF_MUSIC_KNOWLEDGE inlined in edit-feedback/route.ts — no lib import path in v2
- [Phase 02-new-mvp-app-shell]: userId passed in request body from client — UI passes authenticated user ID when calling edit-feedback route

## Session Continuity

Last session: 2026-04-04
Stopped at: Completed 02-03-PLAN.md — Edit Feedback + Snapshot Starter API routes ported to the-multiverse-v2 with Tier 3 context wiring
Resume: Run `/gsd:execute-phase 2` plan 02 to port the API layer. Phase 1 Plan 03 checkpoint still pending (needs INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET to test OAuth flow).
