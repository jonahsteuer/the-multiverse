---
status: partial
phase: 01-instagram-analytics-improvements
source: [01-VERIFICATION.md]
started: 2026-04-03T00:00:00Z
updated: 2026-04-03T12:00:00Z
---

## Current Test

Test 2 verified. Test 1 deferred to Vercel deploy.

## Tests

### 1. Production OAuth end-to-end
expected: Clicking "Connect Instagram" redirects to Meta consent screen → user authorizes → redirected back to app with ?instagram_oauth=success → Supabase profiles.onboarding_profile.instagramOAuth is populated with accessToken, tokenIssuedAt, igUserId
result: [pending — requires Vercel deploy + production OAuth redirect URI registered in Meta App Dashboard]

### 2. Graph API Insights populating live saves data
expected: After OAuth, re-running scrape for the artist shows the SAVES (GRAPH API) card with real per-post saves and reach data from Graph API. Save rate and avg saves/post reflect actual values.
result: PASSED — OAUTH ✓ badge shown, SAVES (GRAPH API) card shows 0.5 avg saves/post, 0.11% save rate, 9 total saves for @theleontax. Token injected via Supabase PATCH with real OAuth token (igUserId: 27348482328085271). Numbers confirmed as real account data.

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
