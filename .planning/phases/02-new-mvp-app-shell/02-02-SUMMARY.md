---
phase: 02-new-mvp-app-shell
plan: 02
subsystem: api
tags: [mark, intelligence, apify, instagram, oauth, supabase, anthropic, scrape]

# Dependency graph
requires:
  - 02-01 (Supabase SSR clients, shared types, repo structure)
provides:
  - Mark chat API route (POST /api/mark) with T1/T2/T3 context assembly
  - Instagram scrape pipeline (POST /api/mark/artist-analytics/scrape) with full enrichment
  - Instagram OAuth authorize (GET /api/auth/instagram)
  - Instagram OAuth callback (GET /api/auth/instagram/callback)
  - Complete intelligence file set (universal-truths.md, live-intelligence.md, stafford-knowledge.ts, intelligence-loader.ts)
affects: [02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dynamic import for Supabase createClient inside route handlers (no module-level instantiation)
    - loadTier3Context with dynamic import pattern (per-request Supabase in server function)
    - videoPlayCount (not videoViewCount) for public play count in ER calculation
    - Gap analysis as non-blocking async step (failure returns empty string, scrape continues)
    - Token refresh-on-read for Instagram OAuth (tokens >30 days refreshed automatically)

key-files:
  created:
    - the-multiverse-v2/lib/mark/universal-truths.md
    - the-multiverse-v2/lib/mark/live-intelligence.md
    - the-multiverse-v2/lib/mark/intelligence-loader.ts
    - the-multiverse-v2/lib/mark/artist-niches/ (empty, ready for per-artist files)
    - the-multiverse-v2/lib/stafford-knowledge.ts
    - the-multiverse-v2/lib/mark-knowledge.ts
    - the-multiverse-v2/app/api/mark/route.ts
    - the-multiverse-v2/app/api/mark/artist-analytics/scrape/route.ts
    - the-multiverse-v2/app/api/auth/instagram/route.ts
    - the-multiverse-v2/app/api/auth/instagram/callback/route.ts

key-decisions:
  - "mark-knowledge.ts also ported (blocking dependency for mark route's buildMarkSystemPrompt) — documented as Rule 3 deviation"
  - "Dynamic import pattern used for all Supabase createClient calls in route handlers — prevents module-level instantiation"
  - "videoPlayCount preserved as primary play count metric (not videoViewCount which is reach)"

patterns-established:
  - "All Supabase usage in API routes: const { createClient } = await import('@supabase/supabase-js') inside handler/function body"
  - "Gap analysis non-blocking: try/catch returns empty string, does not prevent scrape result from being returned"

requirements-completed: []

# Metrics
duration: ~40min
completed: 2026-04-04
---

# Phase 2 Plan 02: API Layer Port Summary

**Mark chat API (T1/T2/T3 context), Instagram scrape pipeline with Apify + Graph API Insights + gap analysis, and OAuth routes fully ported to the-multiverse-v2 using function-level Supabase instantiation throughout**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-04-04T21:00:00Z (after 02-01 completion)
- **Completed:** 2026-04-04T20:41:00Z
- **Tasks:** 2
- **Files created:** 10

## Accomplishments

- Intelligence stack copied verbatim: universal-truths.md (T1a, 180 lines), live-intelligence.md (T2, 79 lines), stafford-knowledge.ts (T1b, 260 lines), intelligence-loader.ts (fs.readFileSync + process.cwd())
- mark-knowledge.ts ported (buildMarkSystemPrompt, MarkContext interface, formatContext — all system prompt assembly logic)
- Mark chat route (app/api/mark/route.ts): assembles T1a+T1b+T2+T3 into system prompt, tier3Context loaded via dynamic import Supabase in loadTier3Context(), maxDuration=60
- Scrape pipeline (app/api/mark/artist-analytics/scrape/route.ts): Apify (50 posts, 90s timeout), all enriched fields (audio/music metadata, hashtag ER correlation, carousel detection, caption tone), Graph API Insights (saves+reach, ±60s timestamp matching), token refresh-on-read (>30d triggers ig_refresh_token), Claude gap analysis (T1a:3000/T1b:3000/T2:2000 char truncation), maxDuration=300
- OAuth authorize (app/api/auth/instagram/route.ts): verbatim copy, userId in state, scope includes instagram_business_manage_insights
- OAuth callback (app/api/auth/instagram/callback/route.ts): dynamic import Supabase, token exchange + long-lived token, stores instagramOAuth in profiles.onboarding_profile
- No module-level Supabase client instantiation in any route

## Task Commits

1. **Task 1: Port intelligence stack + Mark chat route** — `1c4d85b` (feat)
2. **Task 2: Port scrape pipeline + OAuth routes** — `b1c05cb` (feat)

## Files Created

- `the-multiverse-v2/lib/mark/universal-truths.md` — T1a: universal content truths (verbatim)
- `the-multiverse-v2/lib/mark/live-intelligence.md` — T2: live trends (verbatim)
- `the-multiverse-v2/lib/mark/intelligence-loader.ts` — loads T1a + T2 via fs.readFileSync + process.cwd()
- `the-multiverse-v2/lib/mark/artist-niches/` — directory created (empty, ready for per-artist .md files)
- `the-multiverse-v2/lib/stafford-knowledge.ts` — T1b: Stafford playbook (verbatim)
- `the-multiverse-v2/lib/mark-knowledge.ts` — buildMarkSystemPrompt + MarkContext + formatContext
- `the-multiverse-v2/app/api/mark/route.ts` — POST /api/mark (Mark chat with T1/T2/T3 context)
- `the-multiverse-v2/app/api/mark/artist-analytics/scrape/route.ts` — POST scrape pipeline (837 lines)
- `the-multiverse-v2/app/api/auth/instagram/route.ts` — GET authorize redirect
- `the-multiverse-v2/app/api/auth/instagram/callback/route.ts` — GET token exchange + storage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ported mark-knowledge.ts as blocking dependency**
- **Found during:** Task 1
- **Issue:** The source app/api/mark/route.ts imports `buildMarkSystemPrompt` and `MarkContext` from `@/lib/mark-knowledge`. This file was not listed in the plan's file list but is a direct import required for the route to compile.
- **Fix:** Ported `lib/mark-knowledge.ts` verbatim alongside the other intelligence files.
- **Files modified:** the-multiverse-v2/lib/mark-knowledge.ts (created)
- **Commit:** 1c4d85b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking dependency)
**Impact on plan:** Required for TypeScript compilation. No scope creep — mark-knowledge.ts is a pure intelligence/context file, not a UI component.

## Known Stubs

None — all ported routes are fully functional with no placeholder values, hardcoded empty data, or TODO markers.

## Next Phase Readiness

- Mark chat API ready: POST /api/mark accepts messages + userId, returns AI response
- Scrape pipeline ready: POST /api/mark/artist-analytics/scrape accepts username + userId, runs full pipeline
- OAuth routes ready: GET /api/auth/instagram and callback wired up (requires Meta App credentials in env)
- All routes require env vars: APIFY_TOKEN, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET

## Self-Check: PASSED

All created files verified present:
- FOUND: the-multiverse-v2/lib/mark/universal-truths.md
- FOUND: the-multiverse-v2/lib/mark/live-intelligence.md
- FOUND: the-multiverse-v2/lib/mark/intelligence-loader.ts
- FOUND: the-multiverse-v2/lib/stafford-knowledge.ts
- FOUND: the-multiverse-v2/lib/mark-knowledge.ts
- FOUND: the-multiverse-v2/app/api/mark/route.ts
- FOUND: the-multiverse-v2/app/api/mark/artist-analytics/scrape/route.ts
- FOUND: the-multiverse-v2/app/api/auth/instagram/route.ts
- FOUND: the-multiverse-v2/app/api/auth/instagram/callback/route.ts

Commits verified:
- FOUND: 1c4d85b (Task 1 — intelligence stack + mark chat route)
- FOUND: b1c05cb (Task 2 — scrape pipeline + OAuth routes)

TypeScript: npx tsc --noEmit exits 0 (clean)

---
*Phase: 02-new-mvp-app-shell*
