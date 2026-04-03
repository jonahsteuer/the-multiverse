# Phase 1: Instagram Analytics Improvements — Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the existing Instagram analytics scrape pipeline (`/api/mark/artist-analytics/scrape`) to:
1. Capture richer data signals (OAuth-gated Insights + additional public Apify fields)
2. Enrich Tier 3 context with Claude-generated gap analysis against Mark's full intelligence stack
3. Integrate Instagram OAuth into onboarding so Mark has complete analytics from day one

This phase does NOT build the simulate-posts feature — that is explicitly deferred to Phase 2.
</domain>

<decisions>
## Implementation Decisions

### Instagram OAuth

- **D-01:** Instagram OAuth is **required** (not optional). Users must connect a Business or Creator account.
- **D-02:** OAuth happens **during onboarding**, not lazily on first analytics view. Mark must have full analytics context from the first conversation.
- **D-03:** OAuth unlocks Instagram Graph API Insights: **saves**, reach breakdown, follower vs non-follower split, story insights, profile visits. These are unavailable from public scraping.
- **D-04:** OAuth replaces or augments Apify for the authenticated user's own account. Apify scraping of *other* accounts (competitors, Tier 1 seed accounts) remains unchanged.

### Analytics Data Signals

- **D-05:** Add all available Apify public fields beyond current set:
  - **Audio/music used** — which song/original audio per Reel; distinguish original music vs trending sounds
  - **Hashtag performance** — which specific hashtags correlate with higher ER
  - **Caption sentiment & tone** — emotional tone analysis (hype, vulnerable, storytelling) of top vs bottom performers
  - **Carousel-specific metrics** — for multi-image posts: swipe patterns, engagement by position
- **D-06:** When OAuth-connected, additionally capture: saves count, impressions, reach by follower/non-follower, story view data, profile visits from post.
- **D-07:** Constraint: additional fields must fit within the existing 50-post `resultsLimit` and Apify token budget. No increase in scrape scope.

### Mark's Intelligence Integration

- **D-08:** Tier 3 context string is enriched with **both** raw stats AND a Claude-generated gap analysis — not just stats.
- **D-09:** The gap analysis runs at scrape time via a Claude API call after Apify returns data. It receives:
  - The artist's raw post analytics
  - `lib/mark/universal-truths.md` (Tier 1a)
  - `stafford-knowledge.ts` content (Tier 1b)
  - `lib/mark/live-intelligence.md` (Tier 2)
- **D-10:** Gap analysis output should include:
  - Which Universal Truths their best content already aligns with (validation)
  - Which formats/approaches from Stafford or Ruffalo they are NOT using (gaps)
  - How their patterns compare to current live trends (timing, format)
  - 3-5 specific, actionable recommendations anchored to their own data

### Architecture & Timing

- **D-11:** Analysis is **synchronous** — scrape + Claude analysis happen in one request. No background jobs.
- **D-12:** Extend `maxDuration` from 120s to **300s** (Vercel Pro max). This accommodates 45-90s Apify scrape + Claude analysis call.
- **D-13:** The enriched Tier 3 string is stored in Supabase `onboarding_profile.instagramAnalytics.tier3Context` (same field, richer content).

### Claude's Discretion

- Format of the gap analysis section within the Tier 3 string — structure and length are Claude's call, optimized for how Mark will use it in chat.
- Whether to cache the Claude analysis separately from the raw stats in Supabase for re-analysis without re-scraping.
- How to handle accounts with very few posts (< 10) where pattern analysis is unreliable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Analytics Pipeline
- `app/api/mark/artist-analytics/scrape/route.ts` — Current scrape implementation; all modifications happen here
- `app/api/mark/artist-analytics/load/route.ts` — Loads saved analytics from Supabase
- `components/multiverse/ArtistAnalyticsPanel.tsx` — Production UI component inside Galaxy view
- `app/mark-training/analytics/page.tsx` — Dev-only test page for the scrape endpoint

### Mark's Intelligence Architecture
- `app/api/mark/route.ts` — How all tiers are assembled and passed to Claude; shows how tier3Context is currently consumed
- `lib/mark/intelligence-loader.ts` — Tier loading functions; understand before modifying Tier 3 structure
- `lib/mark/universal-truths.md` — Tier 1a content that gap analysis should reference
- `lib/mark-knowledge.ts` — `buildMarkSystemPrompt` and `MarkContext` — how tiers are assembled into the system prompt

### Intelligence Refresh (for reference pattern)
- `app/api/mark/refresh-intelligence/route.ts` — Example of Apify + Claude analysis in a single route; mirrors the pattern we need for the enriched scrape

### Supabase Schema
- `onboarding_profile.instagramAnalytics` in the `profiles` table — where analytics are stored and read back

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ApifyClient` pattern in `refresh-intelligence/route.ts` — already wraps Apify actor runs with status polling; can reference for the OAuth Insights flow
- `createClient` (Supabase) — already used inline in the scrape route for the userId save path
- `lib/mark/intelligence-loader.ts` — `loadUniversalTruths()`, `loadLiveIntelligence()` — these can be imported directly into the scrape route for the Claude analysis step
- `Anthropic` client — already imported in `mark/route.ts` and `refresh-intelligence`; same pattern for the analysis call

### Established Patterns
- All Apify scraping uses the REST polling pattern (start run → poll status → fetch dataset items)
- Tier 3 context is a raw markdown/text string — no structured schema enforcement; the scrape route owns the format
- `maxDuration` is set at the top of each route file as a named export constant

### Integration Points
- Onboarding flow needs an Instagram OAuth step added — need to find the onboarding route/component to understand where OAuth connects
- The `ArtistAnalyticsPanel` will need UI updates to surface the new signals (saves, audio, gap insights) — currently shows avgPlays, bestDay, bestDuration, growth signal, captionInsights, top 5 posts

</code_context>

<deferred>
## Deferred Ideas

These came up during discussion but belong in separate phases:

- **Phase 2 — Simulate Posts:** User uploads a draft post (video, image, or caption+concept), Mark predicts performance anchored to the artist's own analytics baseline + Universal Truths. Jens.heitmann's `simulate` feature is the reference implementation. Explicitly deferred until Phase 1 analytics improvements are stable.
- **Competitor scraping UI:** Scraping competitor accounts to benchmark against (current Apify can do this) — deferred, not in scope for Phase 1.
- **Story analytics:** Instagram Stories Insights via Graph API — noted, but lower priority than post analytics. Can be added in a later iteration.

</deferred>
