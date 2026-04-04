# Phase 2: New MVP — App Shell & Foundation — Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a new repo (`the-multiverse-v2`) as the Multiverse MVP. Design UI first (Stitch MCP → mockups), then build. Port the core API/intelligence layer from the current app. Rebuild all UI from scratch. Deliver: simplified onboarding (Instagram handle → OAuth → scrape → Mark), reimagined galaxy/world view, Mark chat wired to Tier 3 context, Edit Feedback with Simulate integration.

**Not in Phase 2:** Snapshot Starter Tier 3 wiring (Phase 3). Multi-artist support (future). Shoot plan feature (replaced by Snapshot Starter in Phase 4).

</domain>

<decisions>
## Implementation Decisions

### New Repo
- **D-01:** Create a new standalone repo: `the-multiverse-v2`. Do not branch the existing repo.
- **D-02:** Deploy target: `themultiverse2.vercel.app` (new Vercel project).
- **D-03:** Same Supabase DB as the current app — no migration needed. Artist data (instagramOAuth, instagramAnalytics, onboarding_profile) is already stored per-user.
- **D-04:** Same core stack: Next.js 15 (App Router), TypeScript, Tailwind CSS.

### Artist Model — Single-Artist Focus
- **D-05:** The MVP is single-artist focused. One user = one artist (themselves). The app IS their personal dashboard. No roster/manager concept in Phase 2.
- **D-06:** Architecture should be structurally expandable to multi-artist in future (keep userId patterns, don't hardcode single-user assumptions), but Phase 2 UI does not expose multi-artist management.

### Galaxy / World View
- **D-07:** Keep the galaxy visual as the core aesthetic and primary screen. The planet/world spinning around the sun remains the central metaphor — the world represents the artist's content universe they're building.
- **D-08:** Posts as stars is an approved concept — explore this in design. Similar visual metaphors are encouraged (e.g., ER as star brightness, post frequency as star density, best-performing post as the brightest star/closest to the sun). This is a design exploration for Stitch mockups — not a fixed requirement.
- **D-09:** The galaxy view is ambient and aesthetic-first, not just navigation. In single-artist mode, it's the home screen atmosphere — not a list of worlds to click into.

### Onboarding
- **D-10:** Auth-first. User signs up via Supabase auth, then connects Instagram (handle entry → OAuth), then scrape runs. No anonymous preview mode.
- **D-11:** Minimum path: Sign up → Enter Instagram handle → Connect Instagram (OAuth) → Scrape → Talk to Mark. No steps beyond what's necessary.

### Edit Feedback + Simulate (Combined Feature)
- **D-12:** Edit Feedback and Simulate Posts are one combined feature. The name is still "Edit Feedback" or similar — no "Simulate" branding needed.
- **D-13:** Input: artist pastes an Instagram URL or uploads a video. Both options should be supported (as currently implemented in the existing Edit Feedback route).
- **D-14:** Output style: conversational. Mark gives notes like a director — what's wrong, what's working, and specific improvements. NOT a score/meter UI or side-by-side comparison.
- **D-15:** CRITICAL CONSTRAINT — Improvement recommendations must be achievable with the footage the artist already has. Mark should not suggest reshoots. Recommendations focus on: cuts, pacing, hook (first 1.5s), caption, audio choice, text overlays — things achievable in edit.
- **D-16:** If the artist used Snapshot Starter to plan the shoot being edited, Mark has context on what footage was intended/captured. In that case, recommendations can reference the original plan ("you planned a mid-action open — did you capture that?"). Otherwise, Mark works only from what's visible in the submitted video.
- **D-17:** The "simulation" element: Mark can say "if you cut to 16s and started mid-action, based on your account data (3.63% avg ER, your motion-start posts hit 4.8%+), this would likely perform meaningfully better." Data-anchored improvement projection, not a generic score.

### Design-First Workflow
- **D-18:** Design precedes code. Use Stitch MCP to generate screen mockups before writing any component code. Key screens to design first: home/galaxy view, onboarding flow, Mark chat, Edit Feedback.
- **D-19:** Design tools: Stitch MCP (mockups), UI UX Pro Max Claude skill (design intelligence during build), 21st.dev component library (3D and reactive components), Nano Banana 2 (motion/animation).
- **D-20:** Stitch MCP is configured in Claude Code (`~/.claude/settings.json`) with API key. Restart Claude Code to activate.
- **D-21:** Create a DESIGN.md file in the new repo to define design system rules (colors, typography, component style) so all Stitch screens are consistent.

### What to Port (API Layer Only)
- **D-22:** Port these routes/files directly from current app (minimal changes needed):
  - `lib/mark/` — universal-truths.md, stafford-knowledge.ts, live-intelligence.md (T1a, T1b, T2)
  - `app/api/mark/route.ts` — Mark chat (with Tier 3 context assembly)
  - `app/api/mark/artist-analytics/scrape/route.ts` — full enriched scrape pipeline
  - `app/api/auth/instagram/route.ts` + `callback/route.ts` — OAuth routes
  - `app/api/mark/train/edit-feedback/route.ts` — Edit Feedback core (570 lines, includes frame extraction, Whisper transcription, engagement scraping)
  - `app/api/generate-snapshots/route.ts` + `generate-snapshot-ideas/route.ts` — Snapshot Starter API (port now, UI phase later)
  - Supabase client patterns (no module-level instantiation — existing non-negotiable)
- **D-23:** Do NOT port: any UI components, WorldDetailView, ArtistAnalyticsPanel, SnapshotStarter components, SnapshotCalendar, SnapshotTimeline, any old layout/shell components. Full UI rebuild.

### Snapshot Starter — Reference-URL First Approach
- **D-22a:** Snapshot Starter in Phase 2 (port only) and Phase 4 (redesign) should be built around a reference-URL gathering flow. Artists browse Instagram/TikTok, paste URLs of content they love as visual/style references. Mark analyzes those reference posts (using the existing edit-feedback scraping capability: Apify + frame extraction) to understand the aesthetic, format, pacing, and audio the artist is aiming for — then uses that as the guide for generating shoot/content ideas.
- **D-22b:** References come FIRST — before generating any content plan. The artist shows Mark what they're aiming for, then Mark generates ideas in that direction anchored to what's actually achievable based on the artist's own analytics.
- **D-22c:** This is the key differentiator vs. generic content planning tools: references define the vision, the artist's real data defines what will actually work for their account. Both inputs together produce the plan.

### Edit Feedback — "Always Watching" Direction
- **D-22d:** Inspired by Jens Heitmann's framing ("studies your channels, audits your posts, improves content automatically") — Edit Feedback should feel like Mark is always paying attention, not a one-time tool. The analytics scrape already runs automatically; Edit Feedback should feel like the natural extension of that ("Mark noticed something about your last post").
- **D-22e:** In Phase 2, the feature is still manually triggered (paste URL or upload video). But the UX language and framing should feel like an ongoing relationship, not a one-off audit button.

### Claude's Discretion
- App router structure, file organization, component naming conventions
- Whether to use server components vs client components for specific pages
- Exact 21st.dev components to use for the galaxy view
- DESIGN.md initial content and structure
- How to handle the Supabase client in the new repo (follow same non-negotiable: no module-level instantiation)

</decisions>

<specifics>
## Specific Ideas

- **Posts as stars in galaxy:** ER as brightness, best post = brightest star closest to sun. Post frequency = star density. This is a design concept to explore in Stitch, not a hard requirement.
- **Jens Heitmann reference:** The Edit Feedback feature was inspired by his "simulate posts" concept — the combined Edit Feedback + Simulate feature should feel like having a seasoned music video director give you specific, achievable notes.
- **Mark's voice in Edit Feedback:** Direct, specific, aware of the artist's actual data. "Your 5.35% ER posts started mid-action. This one starts static. Cut the first 2 seconds."
- **Galaxy as atmosphere:** The world/planet should feel alive — subtly animated, responsive to interaction, not a static logo. The artist's content performance should be reflected in the visual state of their world.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Intelligence Stack (T1/T2) — Port As-Is
- `lib/mark/universal-truths.md` — T1a: universal content truths Mark references
- `lib/mark/stafford-knowledge.ts` — T1b: Stafford/Ruffalo playbook
- `lib/mark/live-intelligence.md` — T2: current live trends
- `lib/mark/intelligence-loader.ts` — how tiers are assembled

### Existing API Routes to Port
- `app/api/mark/route.ts` — Mark chat route (Tier 3 context assembly pattern)
- `app/api/mark/artist-analytics/scrape/route.ts` — full scrape pipeline (Apify + Graph API + gap analysis)
- `app/api/auth/instagram/route.ts` — OAuth authorize
- `app/api/auth/instagram/callback/route.ts` — OAuth callback + token storage
- `app/api/mark/train/edit-feedback/route.ts` — Edit Feedback (frame extraction, Whisper, Apify metrics)
- `app/api/generate-snapshots/route.ts` — Snapshot Starter generation
- `app/api/generate-snapshot-ideas/route.ts` — Snapshot Starter idea generation

### Phase 01 Decisions (Already Locked)
- `.planning/phases/01-instagram-analytics-improvements/01-CONTEXT.md` — all analytics pipeline decisions
- `.planning/phases/01-instagram-analytics-improvements/01-03-SUMMARY.md` — OAuth + Graph API implementation details

### Supabase Schema Reference
- `profiles.onboarding_profile` JSONB — stores instagramOAuth, instagramAnalytics, instagramHandle, genre, etc.
- No schema migration needed — same DB, same table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (API Layer)
- `app/api/mark/train/edit-feedback/route.ts` — 570 lines, battle-tested. Includes ffmpeg frame extraction, OpenAI Whisper transcription, Apify engagement scraping, multi-turn conversation support. Port with minimal changes.
- `app/api/mark/artist-analytics/scrape/route.ts` — Full Phase 01 pipeline. Includes all enriched fields, Graph API Insights, gap analysis. Port as-is.
- `lib/mark/` — Intelligence stack is mature and ready. No changes needed for Phase 2.

### Patterns to Preserve
- No module-level Supabase client (Vercel build breaks) — instantiate inside route handlers only
- `videoPlayCount` for plays (not `videoViewCount`) — already correct in scrape route
- Tier 3 context assembled as a single string stored in `onboarding_profile.instagramAnalytics.tier3Context`

### What the Edit Feedback Route Already Does
- Accepts: Instagram URL (scrapes video) OR video frames (base64) OR "continue" mode for multi-turn
- Extracts 4 evenly-spaced frames via ffmpeg
- Transcribes audio via OpenAI Whisper
- Scrapes engagement metrics (views, likes, comments) via Apify
- Returns: feedback string, sessionId, rawMetrics, engagementRate, frames

### Gap for Phase 2 Edit Feedback Enhancement
- Current Edit Feedback does NOT read the artist's Tier 3 context — it gives generic Mark advice
- Phase 2 should wire the artist's `instagramAnalytics.tier3Context` into the Edit Feedback prompt so Mark's critique is anchored to their actual ER baseline and top format patterns
- This is the "simulate" enhancement: "based on your data (avg 3.63% ER, motion-start posts hit 4.8%+)..."

</code_context>

<deferred_ideas>
## Reference Material

### Jens Heitmann — "Turn Claude Code into your Social Media Manager"
- URL: https://www.instagram.com/jens.heitmann/reel/DVmw74XEbk7/
- Caption: "You can make Claude Code your Social Media Manager that studies your channels, audit your posts, and improves your content automatically."
- 26.9K likes, 438 comments — strong signal that this problem resonates
- **Key insight:** Jens built this as a raw Claude Code workflow (terminal, prompts). The Multiverse is the polished product version of exactly this — no terminal required, built specifically for independent artists.
- **Design implication:** The Multiverse's value prop is "Jens's Claude Code workflow, as a beautiful product made for artists who don't know code."

## Deferred Ideas (Noted, Not In Phase 2)

- **Multi-artist roster management** — Future phase. Architecture is expandable but UI is single-artist for MVP.
- **Snapshot Starter + Tier 3 wiring** — Phase 3. Port Snapshot Starter in Phase 2, wire analytics into idea generation in Phase 3.
- **Additional Graph API signals** (ig_reels_avg_watch_time, follows per post, follower demographics) — Phase 3 or later.
- **Shoot plan as separate feature** — Replaced by Snapshot Starter. Not building a standalone "shoot plan" UI.
- **Google Calendar sync** — Snapshot Starter has this in current app; decide in Phase 4 whether to port it.

</deferred_ideas>
