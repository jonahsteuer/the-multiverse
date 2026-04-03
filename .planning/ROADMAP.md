# The Multiverse — Roadmap

## Milestone 1: Instagram Analytics Foundation

### Phase 1: Instagram Analytics Improvements
**Goal:** Enrich the Instagram analytics pipeline with OAuth-gated Insights data (saves, reach breakdown), additional Apify public signals (audio, hashtags, caption tone, carousels), and a Claude-generated gap analysis that cross-references artist data against Mark's full intelligence stack (T1/T2). Store the enriched Tier 3 context in Supabase for Mark to consume in every chat.

**Plans:** 3 plans

Plans:
- [x] 01-PLAN.md — Apify field enrichment: extend types, analyzePost, buildAccountSummary with audio/music, hashtag ER, carousel detection, caption tone; bump maxDuration to 300s
- [ ] 02-PLAN.md — Claude gap analysis + UI update: add gap analysis call comparing artist data to T1a/T1b/T2; update buildTier3Context with enriched sections; update ArtistAnalyticsPanel with audio, hashtag, carousel, gap insights UI
- [ ] 03-PLAN.md — Instagram OAuth + Graph API Insights: OAuth authorize/callback routes, Graph API saves+reach fetch, token storage, Connect Instagram UI, saves display

**Deliverables:**
- Instagram OAuth flow added to onboarding (Business/Creator account required)
- `saves` and Graph API Insights captured post-OAuth
- Additional Apify fields extracted: audio/music used, hashtag ER correlation, caption tone, carousel metrics
- Claude gap analysis runs at scrape time (sync, maxDuration 300s): compares artist patterns to Universal Truths, Stafford playbook, Live Intelligence
- Enriched Tier 3 context string (stats + insights) stored in Supabase and consumed by Mark

**Canonical refs:**
- `.planning/phases/01-instagram-analytics-improvements/01-CONTEXT.md`
- `app/api/mark/artist-analytics/scrape/route.ts`
- `app/api/mark/artist-analytics/load/route.ts`
- `components/multiverse/ArtistAnalyticsPanel.tsx`
- `lib/mark/intelligence-loader.ts`
- `app/api/mark/route.ts`

---

### Phase 2: Simulate Posts (Deferred)
**Goal:** Allow artists to upload a draft post (video/image/caption) and receive predicted performance feedback from Mark, anchored to their own analytics baseline. Reference: Jens.heitmann's simulate posts implementation.

*Not in current milestone — depends on Phase 1 analytics foundation being stable.*
