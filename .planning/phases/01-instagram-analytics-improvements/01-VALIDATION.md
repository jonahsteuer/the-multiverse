---
phase: 1
slug: instagram-analytics-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --grep "analytics"` (or manual smoke via dev page)
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | Apify field inspection | manual smoke | `curl .../scrape` + inspect logs | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | maxDuration=300 set | grep | `grep "maxDuration" app/api/mark/artist-analytics/scrape/route.ts` | ✅ | ⬜ pending |
| 01-01-03 | 01 | 1 | Audio/music fields extracted | manual smoke | Inspect `accountSummary.audioPatterns` in scrape response | ✅ | ⬜ pending |
| 01-01-04 | 01 | 1 | Hashtag ER computed | grep | `grep "hashtagEngagement" app/api/mark/artist-analytics/scrape/route.ts` | ✅ | ⬜ pending |
| 01-01-05 | 01 | 1 | Caption tone analysis | grep | `grep "captionTone" app/api/mark/artist-analytics/scrape/route.ts` | ✅ | ⬜ pending |
| 01-01-06 | 01 | 1 | Carousel metrics extracted | grep | `grep "carousel" app/api/mark/artist-analytics/scrape/route.ts` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | Claude gap analysis call | grep | `grep "gap analysis" app/api/mark/artist-analytics/scrape/route.ts` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | tier3Context enriched | manual smoke | Inspect Supabase `profiles.onboarding_profile.instagramAnalytics.tier3Context` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 2 | Instagram OAuth route created | grep | `ls app/api/auth/instagram/` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | OAuth onboarding step visible | E2E | `npx playwright test --grep "instagram-oauth"` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | Graph API Insights captured | manual smoke | Inspect `saves` in scrape response for OAuth-connected account | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Playwright test stub: `tests/e2e/analytics.spec.ts` — for REQ-01 OAuth button visibility
- [ ] Playwright test stub: `tests/e2e/analytics-panel.spec.ts` — for REQ-08 new UI cards

*Existing infrastructure (dev smoke page at `app/mark-training/analytics/page.tsx`) covers Wave 1 manual verification without Wave 0 setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apify `musicInfo` field names confirmed | REQ-04 | Requires live Apify run to inspect raw output | Run scrape via dev page, log raw post object, confirm `musicInfo.musicName` or equivalent |
| OAuth token exchange succeeds | REQ-01/02 | Requires Meta App credentials (not in CI) | Test manually in staging env after Meta App created |
| Graph API `saves` + `reach` per-post | REQ-02/03 | Requires OAuth-connected Business account | Test manually post-OAuth with test artist account |
| Gap analysis quality | REQ-05 | Subjective quality check | Read gap analysis output in tier3Context, verify references Universal Truths and Stafford playbook |
| Full pipeline completes < 300s | REQ-06 | End-to-end timing | Time full scrape run via dev page, check logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
