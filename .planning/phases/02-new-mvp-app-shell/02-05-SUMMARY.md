---
phase: 02-new-mvp-app-shell
plan: 05
subsystem: ui
tags: [onboarding, auth, instagram, supabase, motion, react, nextjs]

# Dependency graph
requires:
  - 02-01 (Supabase browser client, shared TypeScript types)
  - 02-02 (OAuth routes, scrape API endpoint)
provides:
  - StepSignUp component (email/password Supabase auth)
  - StepInstagramConnect component (handle entry + OAuth redirect)
  - StepScrapeLoading component (animated loading, triggers scrape POST)
  - app/onboarding/page.tsx (3-step orchestrator with AnimatePresence transitions)
affects: [onboarding flow, user authentication entry path, Instagram OAuth flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AnimatePresence mode="wait" for step-to-step transitions (fade + slide 200ms ease-out)
    - useReducedMotion hook for accessibility — disables y translation when preference active
    - localStorage for userId + instagramHandle persistence across OAuth redirect
    - searchParams.get('instagram_oauth') for OAuth callback detection on page mount
    - Suspense wrapper required for useSearchParams in Next.js 16 client components

key-files:
  created:
    - the-multiverse-v2/components/onboarding/StepSignUp.tsx
    - the-multiverse-v2/components/onboarding/StepInstagramConnect.tsx
    - the-multiverse-v2/components/onboarding/StepScrapeLoading.tsx
    - the-multiverse-v2/app/onboarding/page.tsx

key-decisions:
  - "Suspense wrapper required around useSearchParams usage in Next.js 16 — OnboardingContent component wrapped in Suspense in the page default export to avoid static generation error"
  - "StepInstagramConnect logic inlined into page as StepInstagramConnectTracked to allow handle capture before OAuth redirect (needed for instagramHandle state in parent)"
  - "localStorage used for userId + instagramHandle across OAuth redirect boundary — no server state needed"

patterns-established:
  - "OAuth redirect recovery: store userId+handle in localStorage before redirect, read on return via searchParams"
  - "Suspense boundary pattern for useSearchParams in Next.js 16 Turbopack client pages"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-04-04
---

# Phase 2 Plan 05: Onboarding Flow Summary

**Three-step onboarding (Sign Up → Instagram Connect → Scrape Loading) built with Supabase auth, Instagram OAuth redirect, and animated transitions — build passes, /onboarding route renders as static**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-04T22:00:00Z
- **Completed:** 2026-04-04T22:25:00Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- StepSignUp: email/password form calling supabase.auth.signUp with underline inputs, cream-gold pill CTA, error/loading states matching UI-SPEC exactly
- StepInstagramConnect: Instagram handle input + OAuth redirect to /api/auth/instagram, saves handle to Supabase profiles table before redirect
- StepScrapeLoading: animated galaxy glow (motion/react, 2s opacity pulse loop), triggers POST /api/mark/artist-analytics/scrape on mount, error/retry state with "Couldn't reach Instagram. Make sure your account is public and try again."
- Onboarding page orchestrator: AnimatePresence with mode="wait", step indicator "THE MULTIVERSE · 01/03" updates per step, OAuth callback detection via searchParams, localStorage bridge across OAuth redirect, routes to "/" on scrape completion

## Task Commits

1. **Task 1: Build onboarding step components** - `a45abe0` (feat)
2. **Task 2: Build onboarding page orchestrator with step transitions** - `f490672` (feat)

## Files Created

- `the-multiverse-v2/components/onboarding/StepSignUp.tsx` — Email/password sign up with supabase.auth.signUp, underline inputs, loading/error states
- `the-multiverse-v2/components/onboarding/StepInstagramConnect.tsx` — Instagram handle input, OAuth redirect to /api/auth/instagram, profile upsert
- `the-multiverse-v2/components/onboarding/StepScrapeLoading.tsx` — Animated glow via motion/react, POST to /api/mark/artist-analytics/scrape, retry on failure
- `the-multiverse-v2/app/onboarding/page.tsx` — 3-step orchestrator with AnimatePresence, step indicator, OAuth callback detection, localStorage bridge

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Suspense wrapper required for useSearchParams in Next.js 16**
- **Found during:** Task 2 (build verification)
- **Issue:** Next.js 16 requires useSearchParams to be wrapped in a Suspense boundary in static pages — without it, the build fails with "useSearchParams() should be wrapped in a suspense boundary"
- **Fix:** Split OnboardingPage into two components: OnboardingContent (with useSearchParams) and a default export OnboardingPage that wraps OnboardingContent in Suspense
- **Files modified:** the-multiverse-v2/app/onboarding/page.tsx
- **Verification:** pnpm build exits 0, /onboarding renders as ○ (Static)
- **Committed in:** f490672 (Task 2 commit)

**2. [Rule 3 - Blocking] StepInstagramConnect handle capture required inline implementation**
- **Found during:** Task 2 (implementation)
- **Issue:** The parent page needs to capture the instagramHandle value before the OAuth redirect for localStorage persistence. The standalone StepInstagramConnect component doesn't expose handle state to parent.
- **Fix:** Added StepInstagramConnectTracked inline in page.tsx with an onHandleChange callback, allowing the page to track handle state and persist it to localStorage before OAuth redirect
- **Files modified:** the-multiverse-v2/app/onboarding/page.tsx
- **Verification:** localStorage.setItem('onboarding_instagram_handle', handle) present and handle is available on OAuth return

---

**Total deviations:** 2 auto-fixed (Rule 3 - Blocking)
**Impact:** Both deviations required for correct functionality. No scope creep. All plan goals achieved.

## Issues Encountered

None — build passes clean.

## Next Phase Readiness

- /onboarding route fully functional as the entry path into the app
- Sign up → OAuth → Scrape → Galaxy Home flow complete
- All copy matches UI-SPEC copywriting contract
- All inputs use underline style, all CTAs use cream-gold pill style
- Reduced motion respected throughout

## Self-Check: PASSED

All created files verified present:
- FOUND: the-multiverse-v2/components/onboarding/StepSignUp.tsx
- FOUND: the-multiverse-v2/components/onboarding/StepInstagramConnect.tsx
- FOUND: the-multiverse-v2/components/onboarding/StepScrapeLoading.tsx
- FOUND: the-multiverse-v2/app/onboarding/page.tsx

Commits verified:
- FOUND: a45abe0 (Task 1 — step components)
- FOUND: f490672 (Task 2 — page orchestrator)

Build: pnpm build exits 0. /onboarding route listed as ○ (Static).

---
*Phase: 02-new-mvp-app-shell*
*Completed: 2026-04-04*
