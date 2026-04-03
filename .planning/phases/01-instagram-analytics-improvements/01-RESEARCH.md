# Phase 01: Instagram Analytics Improvements — Research

**Researched:** 2026-04-02
**Domain:** Instagram Graph API OAuth, Apify field extraction, Claude gap analysis at scrape time
**Confidence:** MEDIUM — Instagram API behaviors verified via Meta docs; Apify field names cross-referenced but some fields require live validation at run time

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Instagram OAuth is required (not optional). Users must connect a Business or Creator account.
- **D-02:** OAuth happens during onboarding, not lazily on first analytics view. Mark must have full analytics context from the first conversation.
- **D-03:** OAuth unlocks Instagram Graph API Insights: saves, reach breakdown, follower vs non-follower split, story insights, profile visits. These are unavailable from public scraping.
- **D-04:** OAuth replaces or augments Apify for the authenticated user's own account. Apify scraping of other accounts (competitors, Tier 1 seed accounts) remains unchanged.
- **D-05:** Add all available Apify public fields beyond current set: audio/music used, hashtag performance, caption sentiment & tone, carousel-specific metrics.
- **D-06:** When OAuth-connected, additionally capture: saves count, impressions, reach by follower/non-follower, story view data, profile visits from post.
- **D-07:** Additional fields must fit within the existing 50-post resultsLimit and Apify token budget. No increase in scrape scope.
- **D-08:** Tier 3 context string is enriched with both raw stats AND a Claude-generated gap analysis.
- **D-09:** Gap analysis runs at scrape time via Claude API call after Apify returns data. Receives: artist's raw post analytics, universal-truths.md (T1a), stafford-knowledge.ts content (T1b), live-intelligence.md (T2).
- **D-10:** Gap analysis output: which Universal Truths their best content aligns with, which formats/approaches they are NOT using, how patterns compare to current live trends, 3-5 specific actionable recommendations.
- **D-11:** Analysis is synchronous — scrape + Claude analysis happen in one request. No background jobs.
- **D-12:** Extend maxDuration from 120s to 300s (Vercel Pro max).
- **D-13:** Enriched Tier 3 string stored in Supabase `onboarding_profile.instagramAnalytics.tier3Context`.

### Claude's Discretion

- Format of the gap analysis section within the Tier 3 string — structure and length are Claude's call, optimized for how Mark will use it in chat.
- Whether to cache the Claude analysis separately from raw stats in Supabase for re-analysis without re-scraping.
- How to handle accounts with very few posts (< 10) where pattern analysis is unreliable.

### Deferred Ideas (OUT OF SCOPE)

- Phase 2 — Simulate Posts (user uploads draft post, Mark predicts performance)
- Competitor scraping UI
- Story analytics (Instagram Stories Insights via Graph API)
</user_constraints>

---

## Summary

This phase has three distinct technical tracks that must be sequenced correctly. Track 1 (Apify enrichment) is the lowest-risk change — it extracts additional fields already present in existing Apify dataset items with no new API credentials required. Track 2 (Claude gap analysis) is a moderate-complexity addition that follows the proven `refresh-intelligence` pattern already in the codebase — Apify results feed a Claude API call that writes structured text into the Tier 3 context string. Track 3 (Instagram OAuth) is the most complex and has the highest risk surface: it requires a new Meta App, new OAuth callback routes, token storage in Supabase, and a new Graph API call sequence that runs after Apify. The phase is gated on Meta App Review for the `instagram_manage_insights` permission if the app is being used by anyone other than the app developer.

The existing `refresh-intelligence/route.ts` is the canonical reference pattern. The new scrape route closely mirrors it: Apify run → poll → fetch items → Claude analysis → Supabase write. The key differences are (1) the target is a single artist's profile not a seed list, (2) the Claude prompt compares the artist to Mark's intelligence stack, and (3) optionally a Graph API call runs in parallel (after Apify) to enrich with Insights data.

**Primary recommendation:** Implement in wave order — (1) Apify field enrichment + Claude gap analysis first to de-risk the core value add, (2) Instagram OAuth + Graph API Insights second since it requires external setup (Meta App). This allows Phase 1 to ship partial value quickly even if OAuth app review is delayed.

---

## Technical Findings

### Track 1: Apify Field Enrichment

The current scrape route sends `resultsType: 'posts', resultsLimit: 50` to `apify~instagram-scraper`. The returned `RawPost` interface currently maps only: `caption`, `hashtags`, `likesCount`, `commentsCount`, `videoViewCount`, `videoPlayCount`, `videoDuration`, `timestamp`, `type`, `productType`, `displayUrl`, `url`.

**Available but unmapped Apify fields (MEDIUM confidence — requires live run to confirm exact names):**

| Field Name | Content | Notes |
|-----------|---------|-------|
| `musicInfo` | Object: `musicName`, `musicArtist`, `musicUrl`, `isOriginalAudio` | Reels only; null for image posts |
| `hashtags` | Already mapped as string[] | Currently extracted but not analyzed per-post |
| `type` | Already mapped | Values: `'Video'`, `'Image'`, `'Sidecar'` (carousel) |
| `productType` | Already mapped | Values: `'feed'`, `'clips'` (Reel), `'igtv'` |
| `images` | Array of image URLs for carousel/sidecar posts | Count = number of slides |
| `childPosts` | Array of child media objects for Sidecar | Contains per-slide engagement data if available |

**Caption tone analysis** is not a native Apify field — it must be computed by Claude (either in the gap analysis prompt or as a pre-processing step) from the raw caption text. There is no `captionTone` field in the dataset.

**Hashtag ER correlation** requires computing: for each unique hashtag, average ER of posts containing it. This is computed from the already-available `hashtags[]` array and `er` values during the `buildAccountSummary` step — no new Apify data needed.

**Carousel detection** uses the existing `type === 'Sidecar'` or `productType` check. Carousel-specific slide count comes from `images.length`. Per-slide engagement is generally NOT available from public scraping — only total post-level engagement. The implementation can only report "X slides" and whether carousel posts outperform single-image posts by ER.

**Confidence:** MEDIUM — field names `musicInfo`, `childPosts`, `images` are cross-referenced with Apify documentation and community reports but must be validated against a live dataset run. The `hashtags` array is already mapped and confirmed present.

### Track 2: Claude Gap Analysis

**Pattern source:** `app/api/mark/refresh-intelligence/route.ts` — already proven in production.

Key implementation facts:
- Anthropic SDK import: `import Anthropic from '@anthropic-ai/sdk'` — already in the project at `^0.32.1`
- Model in use across the codebase: `claude-sonnet-4-20250514`
- `loadUniversalTruths()` and `loadLiveIntelligence()` are exported from `lib/mark/intelligence-loader.ts` and can be imported directly into the scrape route
- `STAFFORD_KNOWLEDGE` is exported from `lib/stafford-knowledge.ts` — same import pattern as `mark/route.ts`
- The analysis call should use `max_tokens: 1500–2000` (comparable to `refresh-intelligence` which uses 2000)

**Token budget concern (MEDIUM confidence):** The gap analysis prompt will include: artist's top 20-30 post summaries (~1,500 chars), `universal-truths.md` (size unknown), `live-intelligence.md` (size unknown), `STAFFORD_KNOWLEDGE` (confirmed large — multiple KB). The combined input may approach Claude's context limit or produce high latency. Mitigation: pass only top/bottom 10 posts rather than all 50, and truncate each intelligence source to its most relevant section using existing string-slice patterns.

**Timing budget:** With `maxDuration: 300`, the budget is roughly:
- Apify run: 45–90s (current observed range)
- Claude gap analysis: 10–30s (typical for 1500-token output)
- Graph API Insights (optional): 3–10s
- Supabase write: <1s
- Total estimated: 60–130s — comfortably within 300s

### Track 3: Instagram OAuth + Graph API Insights

**OAuth flow — two choices (MEDIUM confidence):**

Option A — Instagram API with Instagram Login (newer, simpler):
- OAuth authorize URL: `https://api.instagram.com/oauth/authorize`
- Scopes needed: `instagram_business_basic`, `instagram_business_manage_insights`
- Token exchange: POST to `https://api.instagram.com/oauth/access_token`
- Insights endpoint: `GET https://graph.instagram.com/v25.0/{media-id}/insights`
- Constraint: Requires the user's Instagram account to be a Business or Creator account

Option B — Instagram API with Facebook Login (older, more complex):
- Requires user to connect Facebook Page linked to the Instagram account
- Scopes: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
- More friction in the OAuth consent flow for users who don't have a linked Facebook page
- **Recommendation: Use Option A (Instagram Login) — lower user friction, aligns with D-01's Business/Creator requirement**

**Per-media Insights endpoint (HIGH confidence — verified via Meta docs):**
```
GET https://graph.instagram.com/v25.0/{ig-media-id}/insights
  ?metric=saved,reach,impressions
  &access_token={access_token}
```

Available per-post metrics:
- `saved` — number of times the post was saved (bookmarked) [confirmed available]
- `reach` — unique accounts who saw the post [confirmed available]
- `impressions` — total times post was shown [DEPRECATED in v22+ as of April 21, 2025]

**Follower vs non-follower reach breakdown:** NOT available as a per-post metric breakdown as of current API (v25.0). The `follow_type` breakdown exists at the account-level insights endpoint, not per-media. CONTEXT.md decision D-03 and D-06 reference it but it is not currently queryable per-post. Implementation should capture what IS available (saves, reach per post) and note the follower breakdown is account-level only. Confidence: HIGH (verified against Meta's reference documentation).

**Getting media IDs:** After OAuth, fetch the user's media list:
```
GET https://graph.instagram.com/v25.0/me/media
  ?fields=id,timestamp,media_type
  &access_token={access_token}
```
Then join with Apify results by timestamp to attach Insights to analyzed posts. This join-by-timestamp approach avoids needing to re-scrape with authenticated requests.

**Token storage:** The OAuth access token (long-lived, valid 60 days, refreshable) must be stored encrypted in Supabase. Current `onboarding_profile` JSONB column is the natural location: `onboarding_profile.instagramOAuth.accessToken`. The service role key is already used in the scrape route for DB writes.

**App Review requirement (HIGH confidence — critical risk):**
`instagram_business_manage_insights` requires Meta App Review before non-developer users can grant it. During development, only users listed as testers or developers in the Meta App Dashboard can use OAuth. This means:
- OAuth feature can be built and tested immediately with developer accounts
- Production rollout to regular users requires App Review (timeline: days to weeks)
- Planning must account for this external dependency

**No existing Meta App detected** (no `INSTAGRAM_*` or `META_*` or `FACEBOOK_*` env vars found in `.env.local`). The Meta App setup (create App, configure OAuth redirect URIs, add `instagram_business_manage_insights` to permissions) is a prerequisite task before any OAuth code can be tested.

---

## Existing Patterns & Assets

### Direct Reuse

| Asset | Location | How Used |
|-------|----------|---------|
| Apify REST polling pattern | `scrape/route.ts` lines 75–122 | Extend RawPost interface, map new fields |
| `createClient` + Supabase update | `scrape/route.ts` lines 361–394 | Already handles `instagramAnalytics` JSONB write |
| `loadUniversalTruths()` | `lib/mark/intelligence-loader.ts` | Import directly into scrape route |
| `loadLiveIntelligence()` | `lib/mark/intelligence-loader.ts` | Import directly into scrape route |
| `STAFFORD_KNOWLEDGE` export | `lib/stafford-knowledge.ts` | Import directly into scrape route |
| `Anthropic` client pattern | `refresh-intelligence/route.ts` | Same SDK, same model, same message pattern |
| `maxDuration` export | `scrape/route.ts` line 14 | Change from 120 to 300 |
| `buildTier3Context()` | `scrape/route.ts` lines 277–325 | Extend to accept gapAnalysis string parameter |

### Onboarding Integration Point

The onboarding flow is **conversational** (not a form). The completion signal is `[ONBOARDING_COMPLETE]` in the Claude response from `/api/onboarding-chat/route.ts`. The handler in `app/page.tsx` is `handleEnhancedOnboardingComplete()` (line 677).

Currently, after onboarding completes, the code creates universes/galaxies but does NOT trigger an Instagram analytics scrape. The Instagram handle is collected in `onboarding-chat` as `instagramHandle` in the `profile_data` JSON.

**Where OAuth must be inserted:** Either:
1. As a new step inside `ConversationalOnboarding.tsx` after the handle is collected (before `onComplete` fires), or
2. As a post-onboarding action triggered from `handleEnhancedOnboardingComplete` after the universe is created

Option 2 (post-completion) is lower risk — it does not require restructuring the conversational onboarding flow. The existing scrape is already non-blocking (see Supabase write pattern). OAuth can be a modal/redirect that fires immediately after onboarding completes, before entering the Galaxy view.

### UI Extension Points

`ArtistAnalyticsPanel.tsx` currently displays: avgER, avgPlays, bestDayOfWeek, bestHourRange, bestDurationBucket, growthSignal, captionInsights, topPosts. New fields to surface:
- `saves` (when available via Graph API)
- Audio patterns (top music/sound used, original vs trending)
- Hashtag ER correlation (top 3 hashtags by ER lift)
- Gap analysis insights section (collapsible, sourced from Claude output in tier3Context)

The panel is a `'use client'` React component that loads data via `fetch('/api/mark/artist-analytics/load')`. The panel reads `analytics.accountSummary` — adding new optional fields to `AccountSummary` is backward-compatible as long as they default to undefined/empty.

---

## Integration Points & Risks

### Risk 1: Meta App Review Blocks Production OAuth (HIGH risk)
**What:** `instagram_business_manage_insights` requires App Review. Cannot ship OAuth to real users without approval.
**Mitigation:** Build OAuth infrastructure in Week 1, submit for App Review immediately. Plan to ship Apify enrichment + Claude gap analysis first (no Meta dependency). OAuth becomes a fast-follow.

### Risk 2: Apify Field Names Differ from Expected (MEDIUM risk)
**What:** Field names like `musicInfo`, `childPosts` are documented in community sources but not pinned to a specific Actor version. A live test run is required to confirm exact field structure.
**Mitigation:** Wave 0 or first task should include a logging/inspection step that dumps raw Apify output to console to confirm field availability before building extraction logic.

### Risk 3: Claude Prompt Too Large / Slow (MEDIUM risk)
**What:** If `STAFFORD_KNOWLEDGE` + `universal-truths.md` + `live-intelligence.md` + 50 post summaries exceeds ~15k tokens input, the Claude call may be slow or expensive.
**Mitigation:** Cap post summaries at top 10 + bottom 5 (15 posts). Truncate each knowledge source to 3000 chars for the analysis prompt (enough for pattern matching, not full content). Model `claude-sonnet-4-20250514` handles this well within 300s.

### Risk 4: OAuth Token Expiry in Supabase (LOW risk)
**What:** Instagram access tokens expire after 60 days. If not refreshed, Graph API calls will return 401.
**Mitigation:** Long-lived tokens can be refreshed any time after 24h. Implement refresh-on-read: if the stored token was issued > 30 days ago, refresh it at scrape time before calling Insights.

### Risk 5: Join-by-Timestamp Fragility (LOW risk)
**What:** Matching Apify posts to Graph API Insights by timestamp requires exact ISO timestamp match. Clock drift or timezone inconsistencies could cause mismatches.
**Mitigation:** Use a 60-second window for timestamp matching, not exact equality. Fall back to no-Insights for unmatched posts.

### Risk 6: Few-Post Accounts Break Pattern Analysis (LOW risk, Claude's discretion)
**What:** < 10 posts make ER comparisons, best-day analysis, and trend detection unreliable.
**Mitigation:** In gap analysis prompt, instruct Claude to note "insufficient data" for specific analyses when post count < 10. In `buildAccountSummary`, existing `postCount < 3` guards already handle some edge cases.

---

## Implementation Approach

### Sequencing

**Wave 0 (Setup):** Inspect live Apify output fields; update `RawPost` and `AnalyzedPost` interfaces; create Meta App in developer dashboard with OAuth redirect URIs configured.

**Wave 1 (Core enrichment — no OAuth dependency):**
- Extend `RawPost` to capture `musicInfo`, `hashtags` (already present), `type` (already present for carousel detection)
- Extend `AnalyzedPost` with: `music`, `hashtags`, `isCarousel`, `carouselSlideCount`
- Update `analyzePost()` to extract these fields
- Update `buildAccountSummary()` to compute: top audio/sound names (frequency count), hashtag ER correlation, carousel vs single-image ER comparison
- Add Claude gap analysis call after `buildAccountSummary()` in the POST handler
  - Import `loadUniversalTruths`, `loadLiveIntelligence`, `STAFFORD_KNOWLEDGE`
  - Construct gap analysis prompt with artist data + truncated knowledge sources
  - Call `anthropic.messages.create()` — same pattern as `refresh-intelligence`
  - Append gap analysis result to `buildTier3Context()` output
- Change `export const maxDuration = 300`
- Update `ArtistAnalyticsPanel.tsx` UI for audio patterns, hashtag ER, gap insights section

**Wave 2 (OAuth + Graph API):**
- Create `/api/auth/instagram/` route (authorize redirect) and `/api/auth/instagram/callback/` route (code exchange + token storage)
- Store access token in `onboarding_profile.instagramOAuth` in Supabase
- Create `fetchInsightsForPosts()` function in scrape route: fetches `/me/media`, builds timestamp→mediaId map, calls `/insights` per post (or in batch), returns `Map<timestamp, InsightsData>`
- Augment `AnalyzedPost` with optional `saves`, `insightReach` fields
- Add OAuth connect button/redirect to `ArtistAnalyticsPanel` and/or post-onboarding flow
- Update `buildTier3Context()` to include saves data when present
- Update `ArtistAnalyticsPanel` to show saves card

### Key Functions to Modify

| Function | File | Change |
|---------|------|--------|
| `scrapeProfile()` | scrape/route.ts | No change needed |
| `analyzePost()` | scrape/route.ts | Add music, hashtag, carousel extraction from raw |
| `buildAccountSummary()` | scrape/route.ts | Add audioPatterns, hashtagERMap, carouselStats |
| `buildTier3Context()` | scrape/route.ts | Accept optional `gapAnalysis` + optional `insightsMap` params |
| POST handler | scrape/route.ts | Add Claude call + optional Graph API call; bump maxDuration |
| `AccountSummary` interface | scrape/route.ts | Add optional new fields |
| `ArtistAnalyticsPanel` | components/ | Add new cards for saves, audio, hashtags, gap insights |

### Supabase Schema

No schema migration needed. The `onboarding_profile` column is JSONB — adding new nested keys is additive and backward-compatible. New keys being added:
- `onboarding_profile.instagramOAuth.accessToken` (string)
- `onboarding_profile.instagramOAuth.tokenIssuedAt` (ISO string)
- `onboarding_profile.instagramAnalytics.accountSummary.audioPatterns` (object)
- `onboarding_profile.instagramAnalytics.accountSummary.hashtagERMap` (object)
- `onboarding_profile.instagramAnalytics.accountSummary.carouselStats` (object)
- `onboarding_profile.instagramAnalytics.accountSummary.saves` (optional number, per-account aggregate)

---

## Validation Architecture

The project uses Playwright for E2E testing (`tests/e2e/`) — no Jest/Vitest unit test infrastructure exists (the `app/page.test.tsx` is a fallback UI stub, not a test file). No `playwright.config.ts` references unit test patterns.

Given the architecture (Next.js API routes, no business logic in pure functions), most validation for this phase should be:

1. **Integration-style E2E tests** against the running app (Playwright pattern already in use)
2. **Manual smoke tests** via the dev-only page at `app/mark-training/analytics/page.tsx` — this page exercises the scrape endpoint without auth and is the primary development/verification surface

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (existing) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test` (against `https://the-multiverse.vercel.app`) |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| REQ-01 | Instagram OAuth connect button visible during onboarding | E2E / manual | OAuth flow requires Meta App live — integration test needs staging env |
| REQ-02 | `saves` appears in scrape response when OAuth-connected | Integration / manual smoke | Test via `mark-training/analytics` page with connected account |
| REQ-03 | Additional Graph API Insights fields captured | Integration / manual smoke | Verify via Supabase `onboarding_profile.instagramAnalytics` record |
| REQ-04 | Apify fields `musicInfo`, `hashtags`, `carousel` present in analyzed output | Integration / manual smoke | Log raw Apify output on first run; inspect `accountSummary.audioPatterns` |
| REQ-05 | Claude gap analysis appended to tier3Context | Integration / manual smoke | Check `tier3Context` string in Supabase or scrape response JSON |
| REQ-06 | `maxDuration = 300` set; full pipeline completes < 300s | Observable / manual | Time scrape runs in dev logs |
| REQ-07 | `tier3Context` stored in Supabase `instagramAnalytics` | Integration / manual smoke | Query Supabase `profiles.onboarding_profile` after scrape |
| REQ-08 | New UI cards render in `ArtistAnalyticsPanel` | E2E / visual | Playwright can assert element presence after re-scrape |

### Wave 0 Gaps

- [ ] No unit tests for `analyzePost()` or `buildAccountSummary()` — these are testable pure functions. If wave validation is desired, add a `tests/unit/artist-analytics.test.ts` using Playwright component testing or a lightweight test runner. Not strictly required given manual smoke test path exists.
- [ ] `mark-training/analytics/page.tsx` must remain accessible during development for smoke testing the enriched pipeline. Verify it passes `userId` to the scrape endpoint to exercise the Supabase write path.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| APIFY_TOKEN | Apify scraping (existing) | Assumed present (existing feature works) | — | None — existing scrape already requires it |
| ANTHROPIC_API_KEY | Claude gap analysis | Assumed present (mark/route.ts in production) | — | Skip gap analysis, log warning |
| SUPABASE_SERVICE_ROLE_KEY | DB writes | Confirmed present (existing scrape writes to Supabase) | — | None |
| Meta App (Instagram OAuth) | REQ-01, REQ-02, REQ-03 | NOT present — no INSTAGRAM_* env vars found | — | Build without OAuth first; OAuth as wave 2 |
| INSTAGRAM_APP_ID | OAuth flow | Not set | — | Must create Meta App; set before wave 2 |
| INSTAGRAM_APP_SECRET | OAuth token exchange | Not set | — | Must create Meta App; set before wave 2 |

**Missing dependencies with no fallback:**
- Meta App credentials (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`) — required for REQ-01/02/03. Must be created in Meta Developer Dashboard before wave 2 can begin. Wave 1 work (Apify enrichment + Claude analysis) has no dependency on these.

**Missing dependencies with fallback:**
- None additional beyond Meta App credentials.

---

## Common Pitfalls

### Pitfall 1: `impressions` Metric Deprecated in v22+
**What goes wrong:** Requesting `metric=impressions` for posts via Graph API v22+ (current: v25.0) returns an error or empty data.
**Why it happens:** Meta deprecated `impressions` per media in April 2025 for newer API versions.
**How to avoid:** Use only `saved` and `reach` in the per-media Insights call. Do not include `impressions`.
**Warning signs:** 400 error from Graph API with "metric not supported" message.

### Pitfall 2: Follower/Non-Follower Split is Account-Level Only
**What goes wrong:** Attempting `GET /{media-id}/insights?metric=reach&breakdown=follow_type` returns an error — this breakdown only exists at the account level.
**Why it happens:** Per-post `follow_type` breakdown was referenced in the CONTEXT.md decisions but is not available in the per-media Insights API.
**How to avoid:** Capture `reach` at the per-post level (no breakdown). If follower split is desired, query account-level insights separately.
**Warning signs:** API error "unsupported breakdown for this metric."

### Pitfall 3: Apify `musicInfo` is Null for Image/Sidecar Posts
**What goes wrong:** Code throws on `rawPost.musicInfo.musicName` for image posts where `musicInfo` is null.
**Why it happens:** Music metadata only exists for Reels/Video posts. Image posts have no music field.
**How to avoid:** Always null-check: `rawPost.musicInfo?.musicName ?? null`. Skip audio analysis for non-video posts.

### Pitfall 4: Claude Prompt Token Overflow Slows/Fails the Request
**What goes wrong:** Including full `STAFFORD_KNOWLEDGE` + `universal-truths.md` + `live-intelligence.md` in a single prompt may produce very large input, causing slow responses or cost spikes.
**Why it happens:** These knowledge files are large (STAFFORD_KNOWLEDGE is multiple KB of dense text).
**How to avoid:** Truncate each knowledge source to 2000–3000 chars for the gap analysis prompt. The goal is pattern recognition, not exhaustive knowledge transfer.
**Warning signs:** Claude responses taking > 60s for the analysis step; requests timing out before the 300s limit.

### Pitfall 5: OAuth Redirect URI Mismatch
**What goes wrong:** Instagram OAuth returns "Redirect URI mismatch" error.
**Why it happens:** The callback URL registered in the Meta App must exactly match the URL the app sends in the authorization request.
**How to avoid:** Register both `http://localhost:3000/api/auth/instagram/callback` and the production URL in the Meta App Dashboard. Use `NEXT_PUBLIC_APP_URL` env var to construct the redirect URI consistently.

### Pitfall 6: Timestamp Join Mismatches Between Apify and Graph API
**What goes wrong:** Apify returns post timestamps in one format, Graph API in another; posts don't join correctly when merging Insights data.
**Why it happens:** Apify may return timestamps as Unix seconds or ISO strings; Graph API returns ISO 8601 with timezone.
**How to avoid:** Normalize all timestamps to Unix milliseconds before joining. Use a 60-second tolerance window rather than exact equality.

---

## Code Examples

### Gap Analysis Claude Call Pattern (from refresh-intelligence reference)
```typescript
// Source: app/api/mark/refresh-intelligence/route.ts (adapted)
import Anthropic from '@anthropic-ai/sdk';
import { loadUniversalTruths, loadLiveIntelligence } from '@/lib/mark/intelligence-loader';
import { STAFFORD_KNOWLEDGE } from '@/lib/stafford-knowledge';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

async function buildGapAnalysis(posts: AnalyzedPost[], summary: AccountSummary): Promise<string> {
  const universalTruths = loadUniversalTruths().slice(0, 3000);
  const liveIntelligence = loadLiveIntelligence().slice(0, 2000);
  const staffordSummary = STAFFORD_KNOWLEDGE.slice(0, 3000);

  const top10 = [...posts].sort((a, b) => b.er - a.er).slice(0, 10);
  const bottom5 = [...posts].sort((a, b) => a.er - b.er).slice(0, 5);

  const analysis = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `[gap analysis prompt with artist data + knowledge sources]`,
    }],
  });
  return analysis.content[0].type === 'text' ? analysis.content[0].text : '';
}
```

### Graph API Insights Fetch Pattern
```typescript
// Verified against Meta docs v25.0
async function fetchPostInsights(
  mediaId: string,
  accessToken: string
): Promise<{ saves: number; reach: number } | null> {
  const url = `https://graph.instagram.com/v25.0/${mediaId}/insights` +
    `?metric=saved,reach&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const { data } = await res.json();
  const saves = data.find((d: any) => d.name === 'saved')?.values?.[0]?.value ?? 0;
  const reach = data.find((d: any) => d.name === 'reach')?.values?.[0]?.value ?? 0;
  return { saves, reach };
}
```

### Extending RawPost Interface
```typescript
// Extension of existing interface in scrape/route.ts
interface RawPost {
  // ... existing fields ...
  musicInfo?: {
    musicName?: string;
    musicArtist?: string;
    isOriginalAudio?: boolean;
    audioType?: string;
  } | null;
  images?: string[];          // carousel slide URLs
  childPosts?: RawPost[];     // carousel child media (may be sparse)
  // type and productType already mapped — use for carousel detection
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Instagram Basic Display API | Instagram API with Instagram Login (Business/Creator) | Meta deprecated Basic Display API June 2024 | Use `graph.instagram.com` host and `instagram_business_*` scopes, not legacy `instagram_basic` from old Display API |
| `impressions` per-media metric | Deprecated — use `reach` only | April 21, 2025 (v22+) | Do not include impressions in media Insights requests |
| Long polling Apify via raw REST | ApifyClient SDK also available | Existing | `refresh-intelligence` uses `ApifyClient` SDK; `scrape/route.ts` uses raw REST fetch. Either works; stay consistent with scrape route's existing pattern |

---

## Open Questions

1. **`musicInfo` exact field structure in live Apify output**
   - What we know: Community reports confirm a `musicInfo` field exists for Reel posts
   - What's unclear: Exact property names (`musicName` vs `music_name` vs nested object shape)
   - Recommendation: First task in Wave 1 should dump raw Apify output for a known Reel-heavy account and log the full field structure before building extraction

2. **Gap analysis prompt format for Mark's optimal consumption**
   - What we know: Claude's discretion per D-10. Mark's system prompt currently receives tier3Context as a raw markdown string.
   - What's unclear: Should the gap analysis be a separate named section or woven into the existing tier3 structure? Should recommendations be numbered or bulleted?
   - Recommendation: Add a clearly delimited `### Mark's Gap Analysis` section at the end of the tier3Context string with H4 subsections for Strengths, Gaps, and Recommendations. This preserves backward compatibility with the existing Tier 3 format Mark already reads.

3. **Meta App Review timeline for production OAuth**
   - What we know: Required before non-developer users can grant `instagram_business_manage_insights`
   - What's unclear: Meta's current review turnaround (historically 1–7 days for basic permissions, up to weeks for sensitive permissions)
   - Recommendation: Submit App Review as soon as the OAuth callback routes are built and functional with a developer test account. Do not hold Wave 1 for this.

---

## Sources

### Primary (HIGH confidence)
- Meta for Developers — Instagram Media Insights reference: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/ — confirmed `saved`, `reach` metric names; confirmed `impressions` deprecation timeline
- Meta for Developers — Instagram Insights overview: https://developers.facebook.com/docs/instagram-platform/insights/ — confirmed OAuth scope requirements (`instagram_business_basic`, `instagram_business_manage_insights`)
- Codebase direct inspection — `scrape/route.ts`, `refresh-intelligence/route.ts`, `mark/route.ts`, `intelligence-loader.ts`, `onboarding-chat/route.ts`, `page.tsx`, `ConversationalOnboarding.tsx`, `ArtistAnalyticsPanel.tsx`

### Secondary (MEDIUM confidence)
- Apify Instagram Scraper actor page: https://apify.com/apify/instagram-scraper — confirms music metadata available in dataset; exact field names require live validation
- Apify community issue (music data): https://apify.com/apify/instagram-scraper/issues/scraping-music-data-Kc4u5vOg5SfEWWwZv — confirms `musicInfo` presence for Reel posts
- elfsight.com Instagram Graph API 2026 guide: https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/ — confirms per-post saves/reach availability

### Tertiary (LOW confidence)
- Multiple WebSearch results confirming `follow_type` breakdown is account-level only, not per-media — requires official Meta docs confirmation before finalizing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all key packages (Anthropic SDK, Supabase, Next.js 15, Apify REST) are already in use in the codebase; no new dependencies needed for Wave 1
- Architecture: HIGH — all patterns (Apify polling, Claude call, Supabase JSONB write) are proven in existing routes
- Instagram Graph API metrics: HIGH — verified via Meta's official reference docs
- Apify field names: MEDIUM — cross-referenced but require live run validation
- OAuth flow: MEDIUM — pattern is well-documented; Meta App setup is an untested external dependency for this project

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — Meta API docs relatively stable; Apify actor schema can change with actor updates)

---

## RESEARCH COMPLETE
