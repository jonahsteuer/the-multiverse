---
phase: 02-new-mvp-app-shell
plan: 03
subsystem: api
tags: [anthropic, openai, ffmpeg, apify, tier3-context, supabase, edit-feedback, snapshot-starter]

# Dependency graph
requires:
  - phase: 02-new-mvp-app-shell/02-01
    provides: types/index.ts (EditFeedbackResponse), lib/supabase/server.ts (createServiceClient), bootstrapped v2 repo

provides:
  - Edit Feedback route with Tier 3 context wiring (data-anchored critique per D-17)
  - Snapshot Starter generation route
  - Snapshot Starter ideas route
  - Snapshot/SnapshotStrategy types in v2
  - lib/snapshot-schedule.ts in v2

affects:
  - 02-05 (Edit Feedback UI wiring)
  - 02-07 (Snapshot Starter UI)
  - 03 (Snapshot Starter Tier 3 wiring)

# Tech tracking
tech-stack:
  added: [openai (Whisper), ffmpeg-static, zod v4]
  patterns:
    - "loadTier3Context() async function loads artist data inside handler — no module-level Supabase"
    - "Dynamic import: const { createClient } = await import('@supabase/supabase-js') for service role"
    - "tier3Section conditional — empty string when no userId, preserves graceful degradation"
    - "Anthropic/OpenAI clients instantiated inside route handlers or factory functions, never at module level"

key-files:
  created:
    - the-multiverse-v2/app/api/mark/train/edit-feedback/route.ts
    - the-multiverse-v2/app/api/generate-snapshots/route.ts
    - the-multiverse-v2/app/api/generate-snapshot-ideas/route.ts
    - the-multiverse-v2/lib/snapshot-schedule.ts
  modified:
    - the-multiverse-v2/types/index.ts (added Snapshot, SnapshotStrategy, SnapshotPerformance)

key-decisions:
  - "mark-training-rules.ts filesystem logging omitted in v2 — no training log infrastructure in new repo; session IDs still returned for UI compatibility"
  - "RUFF_MUSIC_KNOWLEDGE inlined in edit-feedback/route.ts — no @/lib/ruff-music-knowledge import path in v2"
  - "Zod v4 ZodError.errors renamed to ZodError.issues — fixed both snapshot routes"
  - "userId passed in request body from client — no auth header extraction in edit-feedback for now (UI will pass it)"
  - "maxDuration = 300 on edit-feedback (Apify + ffmpeg needs full window), 60 on snapshot routes"

patterns-established:
  - "tier3Context loading: await loadTier3Context(userId) before assembling system prompt, empty string when userId missing"
  - "Tier 3 injection label: '## Artist's Own Data (from their Instagram analytics)' — consistent with mark/route.ts"
  - "No-reshoot constraint in system prompt: explicit EDIT CONSTRAINT section before feedback structure"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-04-04
---

# Phase 2 Plan 03: Edit Feedback + Snapshot Starter API Routes Summary

**Edit Feedback route (631 lines) ported with data-anchored Tier 3 context injection making Mark's critique reference the artist's actual ER baseline, plus both Snapshot Starter routes ported with Zod v4 fixes**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-04T20:08:00Z
- **Completed:** 2026-04-04T20:38:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Edit Feedback route ported with full ffmpeg frame extraction, OpenAI Whisper transcription, Apify engagement scraping, and multi-turn conversation support — the same battle-tested 569-line core now enhanced to 631 lines
- Tier 3 context wiring added: `loadTier3Context(userId)` reads `onboarding_profile.instagramAnalytics.tier3Context` from Supabase and injects it into Mark's system prompt so critique is data-anchored ("your 5.35% ER posts started mid-action") per D-17
- D-15 no-reshoot constraint added explicitly to system prompt as `EDIT CONSTRAINT` section
- Both Snapshot Starter routes ported with Zod v4 compatibility fix and proper function-level Anthropic client instantiation
- Snapshot/SnapshotStrategy types and snapshot-schedule.ts helper added to v2 repo

## Task Commits

Each task was committed atomically:

1. **Task 1: Port Edit Feedback route with Tier 3 context wiring** - `ce828bd` (feat)
2. **Task 2: Port Snapshot Starter API routes** - `d8eadf1` (feat)

## Files Created/Modified
- `the-multiverse-v2/app/api/mark/train/edit-feedback/route.ts` — Edit Feedback with Tier 3 context wiring, ffmpeg, Whisper, Apify, multi-turn support (631 lines)
- `the-multiverse-v2/app/api/generate-snapshots/route.ts` — Snapshot generation with Claude, posting date calculation (163 lines)
- `the-multiverse-v2/app/api/generate-snapshot-ideas/route.ts` — Snapshot idea generation with Claude (128 lines)
- `the-multiverse-v2/lib/snapshot-schedule.ts` — calculatePostingDates() and calculateFilmingDates() helpers
- `the-multiverse-v2/types/index.ts` — Added Snapshot, SnapshotStrategy, SnapshotPerformance interfaces

## Decisions Made
- `mark-training-rules.ts` filesystem logging omitted in v2: the source repo had a dev training log for capturing sessions to JSON files, but this is not part of the v2 architecture. Session IDs are still generated and returned in responses for UI compatibility — the log just doesn't write to disk.
- `RUFF_MUSIC_KNOWLEDGE` inlined directly in the edit-feedback route rather than importing from a separate lib file — the v2 lib directory doesn't have this file yet and the content is stable/self-contained.
- `userId` is accepted in the request body from the client. The UI will pass the authenticated user's ID when calling this route. This is consistent with how mark/route.ts handles it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ZodError.errors -> ZodError.issues for Zod v4 compatibility**
- **Found during:** Task 2 (Snapshot routes TypeScript check)
- **Issue:** Both snapshot routes used `error.errors` which doesn't exist in Zod v4 (renamed to `error.issues`). TypeScript compile failed with TS2339.
- **Fix:** Updated both routes to use `error.issues`
- **Files modified:** the-multiverse-v2/app/api/generate-snapshots/route.ts, the-multiverse-v2/app/api/generate-snapshot-ideas/route.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** d8eadf1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: Zod v4 API change)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered
None — all routes compiled cleanly after the Zod v4 fix.

## Known Stubs
None — all routes are fully functional API handlers. No hardcoded empty returns or placeholder data.

## User Setup Required
None beyond existing env vars (ANTHROPIC_API_KEY, OPENAI_API_KEY, APIFY_TOKEN, SUPABASE env vars already required by Plan 01).

## Next Phase Readiness
- Edit Feedback route ready for UI wiring (Plan 05 or 06 in Phase 2)
- Snapshot Starter routes ready for UI wiring (Plan 07 per plan notes)
- All three routes compile cleanly with no TypeScript errors
- The tier3Context injection is in place — once users complete onboarding and have analytics scraped, Mark's edit feedback will be data-anchored automatically

---
*Phase: 02-new-mvp-app-shell*
*Completed: 2026-04-04*
