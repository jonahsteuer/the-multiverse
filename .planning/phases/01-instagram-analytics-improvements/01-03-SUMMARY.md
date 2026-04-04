---
phase: 01-instagram-analytics-improvements
plan: 03
subsystem: auth
tags: [instagram, oauth, graph-api, supabase, next.js, typescript]

requires:
  - phase: 01-01
    provides: enriched Apify scrape pipeline with analytics fields
  - phase: 01-02
    provides: ArtistAnalyticsPanel UI with new analytics cards

provides:
  - Instagram OAuth authorize + callback routes
  - Graph API Insights fetch (saves, reach) per post
  - Token refresh-on-read (>30 days triggers refresh)
  - ArtistAnalyticsPanel saves card and Connect Instagram CTA
  - Supabase token storage in onboarding_profile.instagramOAuth

affects: [future onboarding phase, any phase touching ArtistAnalyticsPanel or scrape pipeline]

tech-stack:
  added: []
  patterns:
    - OAuth state param encodes userId via base64url for callback association
    - Short-lived token exchanged for long-lived token (ig_exchange_token) immediately
    - Graph API media matched to Apify posts by timestamp with 60s tolerance window
    - Token refresh-on-read pattern — no cron job needed

key-files:
  created:
    - app/api/auth/instagram/route.ts
    - app/api/auth/instagram/callback/route.ts
  modified:
    - app/api/mark/artist-analytics/scrape/route.ts
    - components/multiverse/ArtistAnalyticsPanel.tsx

key-decisions:
  - "Only request 'saved' and 'reach' metrics — impressions deprecated in Graph API v22+"
  - "Match Apify posts to Graph API media by timestamp (60s tolerance) — no shared ID available"
  - "Token refresh-on-read (>30 days) rather than scheduled refresh job"
  - "OAuth flow requires HTTPS redirect URI — localhost testing done via SQL token injection bypass; production OAuth to be verified post-Vercel deploy"
  - "Long-lived token (60 days) stored immediately after short-lived exchange"

patterns-established:
  - "OAuth state pattern: base64url-encode {userId} JSON in state param for stateless callback"
  - "Graph API pagination: fetch media list then insights per-media in batches of 10"

requirements-completed: [REQ-01, REQ-02, REQ-03]

duration: ~2h
completed: 2026-04-03
---

# Phase 01-03: Instagram OAuth + Graph API Insights Summary

**OAuth authorize/callback routes + Graph API saves/reach per post, token refresh-on-read, and saves card in ArtistAnalyticsPanel**

## Performance

- **Duration:** ~2h
- **Completed:** 2026-04-03
- **Tasks:** 2/3 automated tasks complete + human-verify checkpoint approved
- **Files created:** 2 | **Files modified:** 2

## Accomplishments
- `GET /api/auth/instagram` — redirects to Instagram OAuth consent with correct scopes and userId in state
- `GET /api/auth/instagram/callback` — exchanges code for long-lived token, stores in `profiles.onboarding_profile.instagramOAuth`
- `scrape/route.ts` — reads OAuth token from Supabase at scrape time, fetches Graph API saves+reach per post, merges into AnalyzedPost
- Token refresh-on-read: tokens > 30 days trigger `ig_refresh_token` grant before use
- `AccountSummary` extended with `totalSaves`, `avgSavesPerPost`, `saveRate`
- `ArtistAnalyticsPanel` shows "Connect Instagram" CTA when no OAuth, shows Saves card (avg/post + save rate) when connected

## Files Created/Modified
- `app/api/auth/instagram/route.ts` — OAuth authorize redirect (new)
- `app/api/auth/instagram/callback/route.ts` — code exchange + token storage (new)
- `app/api/mark/artist-analytics/scrape/route.ts` — fetchInsightsForPosts, token refresh, summary aggregates
- `components/multiverse/ArtistAnalyticsPanel.tsx` — Connect Instagram CTA, Saves card, saves on top posts

## Decisions Made
- Only `saved` and `reach` metrics requested — `impressions` is deprecated in v22+
- Posts matched to Graph API media by timestamp with 60-second tolerance (Apify and Graph API have no shared post ID)
- Token refresh-on-read pattern chosen over cron job for simplicity
- OAuth redirect requires HTTPS — Meta won't accept localhost. Local dev tested via SQL token injection; full OAuth flow deferred to Vercel production testing

## Deviations from Plan
None — plan followed as specified. Human-verify checkpoint (Task 3) approved by user with note that OAuth end-to-end will be verified post-Vercel deploy.

## Local Verification Results (SQL bypass)
- SAVES (GRAPH API) card: 0.5 avg saves/post, 0.11% save rate, 9 total saves for @theleontax ✓
- Gap analysis in Tier 3 context ✓
- Hashtag performance: 4 unique tags ✓
- Carousel detection: 1 carousel post ✓

## Issues Encountered
- Meta requires HTTPS for OAuth redirect URIs — localhost OAuth flow blocked. Workaround: SQL token injection for local dev. Production OAuth flow to be tested on Vercel deploy.

## Next Phase Readiness
- Phase 01 complete — all analytics enrichment shipped
- Next: deploy to Vercel and register production OAuth redirect URI in Meta App Dashboard
- Then: Phase 02 (Simulate Posts) or next milestone phase

---
*Phase: 01-instagram-analytics-improvements*
*Completed: 2026-04-03*
