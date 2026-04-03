# Requirements — Milestone 1: Instagram Analytics Foundation

## Phase 1 Requirements

### REQ-01: Instagram OAuth Integration
The platform must support Instagram OAuth (Instagram Graph API) requiring a Business or Creator account. OAuth must be initiated during the onboarding flow — not lazily.

### REQ-02: Saves Data via Graph API
Post-OAuth, the system must retrieve `saved_count` (saves/bookmarks) per post via the Instagram Graph API Insights endpoint. Saves are not available via public scraping.

### REQ-03: Additional Graph API Insights
Post-OAuth, capture per-post Insights: impressions, reach, follower vs non-follower reach breakdown, profile visits from post.

### REQ-04: Additional Apify Public Fields
The Apify scrape must extract additional public fields beyond current (plays, likes, comments, ER):
- Audio/music used (`musicInfo` or equivalent)
- Hashtags with per-post performance correlation
- Caption tone/sentiment analysis
- Carousel-specific engagement (for multi-image posts)

### REQ-05: Claude Gap Analysis at Scrape Time [COMPLETE — 01-02]
After Apify scrape (and Graph API call if OAuth-connected), a Claude API call must:
- Compare the artist's top patterns against `lib/mark/universal-truths.md` (T1a)
- Compare against Stafford's playbook content (T1b)
- Compare against `lib/mark/live-intelligence.md` (T2)
- Output: which Universal Truths their best content aligns with, which Stafford/Ruffalo formats they're missing, how patterns compare to live trends, 3-5 specific actionable recommendations

### REQ-06: Synchronous Pipeline with 300s Timeout
The enriched scrape pipeline (Apify + optional Graph API + Claude analysis) must run synchronously in a single Vercel function call. `maxDuration` must be set to 300.

### REQ-07: Enriched Tier 3 Context Stored in Supabase [COMPLETE — 01-02]
The final output — both raw stats AND Claude-generated insights — must be stored in `onboarding_profile.instagramAnalytics.tier3Context` in Supabase. Mark's chat route reads this field on every message.

### REQ-08: Updated UI [COMPLETE — 01-02]
`ArtistAnalyticsPanel.tsx` must surface the new signals: saves (when available), audio patterns, hashtag performance, and the gap analysis insights section.
