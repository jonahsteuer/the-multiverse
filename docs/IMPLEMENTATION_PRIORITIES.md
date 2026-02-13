# Implementation Priorities - Consistency First

**Date:** January 12, 2026  
**Status:** Refining Approach Before Implementation

---

## Core Principle

**Consistency is #1. Performance analysis comes later.**

Before we can analyze what works, artists need to:
1. **Know what to post** (visual direction)
2. **Know when to post** (schedule)
3. **Know how to create it** (workflow)

---

## Most Important Features to Implement Now

### Priority 1: Snapshot Schedule Creation (THE FOUNDATION)

**Goal:** Help artists create a posting schedule they can actually stick to

**What we need:**
- Release date
- How many snapshots? (based on timeline)
- When to post each snapshot? (optimal dates)
- Backwards planning: Calculate all deadlines (treatment, shot list, shoot, edit, post)

**Key Questions:**
1. How do we determine how many snapshots? (Based on timeline? Artist preference? Both?)
2. How do we space them out? (Daily? Every other day? Weekly?)
3. What's the optimal posting schedule? (2 weeks before release, release week, 8 weeks after?)
4. How do we make the schedule "sticky" - something artists will actually follow?

**Features:**
- **Timeline Calculator:** Based on release date, calculate snapshot schedule
- **Backwards Planning:** Automatically calculate all deadlines
- **Calendar Integration:** Add to Google Calendar (already have this)
- **Reminders:** Proactive reminders (already have this)
- **Schedule Visualization:** Clear calendar view showing all dates

**UI Flow:**
1. Artist creates world with release date
2. Platform suggests: "Based on your release date, here's a snapshot schedule"
3. Artist can adjust (add/remove snapshots, change dates)
4. Platform calculates all deadlines automatically
5. Schedule is locked in, reminders are set

---

### Priority 2: Enhanced Onboarding (Phase 1 Data Collection)

**Goal:** Collect general artist profile to inform snapshot creation

**What we need:**
- Genre
- Musical inspiration
- Visual inspiration
- Current posting frequency (if any)
- Visual style preferences
- Platforms they use

**Key Questions:**
1. How detailed should this be? (Quick 5 questions? Deep dive 20 questions?)
2. Should we ask about best-performing posts? (Even if we can't import yet)
3. What visual style questions help us most? (Colors? Aesthetics? Moods?)
4. Should this be optional or required? (Can artists skip and fill in later?)

**Features:**
- **Onboarding Questionnaire:** Step-by-step form
- **Visual Style Preferences:** Color palettes, aesthetics, moods
- **Inspiration Collection:** Artists, songs, visual references
- **Platform Selection:** Instagram, TikTok, YouTube, Twitter
- **Posting Goals:** Current frequency vs. desired frequency

**UI Flow:**
1. Artist signs up
2. "Tell us about your art" questionnaire (5-10 questions)
3. Optional: "Share your best posts" (manual entry for now)
4. Profile is created
5. Artist can update anytime

---

### Priority 3: World Creation Questionnaire (Phase 2 Data Collection)

**Goal:** Understand what snapshots should look/feel like for THIS specific world

**What we need:**
- Visual direction (what should snapshots look like?)
- Mood/feel (what should snapshots feel like?)
- Visual references (images, inspiration)
- Story/concept (what's the narrative?)
- Any specific ideas artist has

**Key Questions:**
1. How detailed should visual direction be? (High-level mood? Specific shots?)
2. Should we ask about each snapshot individually, or overall direction?
3. How do we balance: artist creativity vs. our assistance?
4. Should we generate snapshot ideas, or only if artist asks?

**Features:**
- **Visual Direction Builder:** Guided questions about look/feel
- **Visual Reference Upload:** Images, Pinterest links
- **Story/Concept Input:** What's the narrative?
- **Optional AI Suggestions:** Only if artist asks
- **Snapshot Schedule:** Generated based on release date

**UI Flow:**
1. Artist creates world
2. "Tell us about this world" questionnaire:
   - Visual direction (look/feel)
   - Visual references
   - Story/concept
   - Any specific ideas
3. Platform generates snapshot schedule
4. Optional: "Want snapshot ideas?" (only if they ask)
5. Artist reviews and adjusts

---

### Priority 4: Memory-to-Snapshots Workflow

**Goal:** Help artists create a "memory" and cut it into 2-4 snapshots

**What we need:**
- Memory creation (visual direction, treatment, shot list)
- Filming workflow
- Cutting workflow (how to split memory into snapshots)
- Each snapshot gets: post date, caption, platform, length

**Key Questions:**
1. How do we help artists create memories? (Template? Guided form?)
2. How do we help them cut memories into snapshots? (Manual selection? AI-assisted?)
3. What's the minimum workflow? (Can they skip treatment? Skip shot list?)
4. How do we make this flexible? (Some artists want full control, others want guidance)

**Features:**
- **Memory Creator:** Visual direction, treatment, shot list (as needed)
- **Filming Guide:** What to capture
- **Snapshot Cutter:** Select clips, set lengths, assign to snapshots
- **Caption Generator:** AI-generated captions (optional)
- **Platform Optimization:** Different versions for Instagram vs. TikTok

**UI Flow:**
1. Artist creates memory (or uses existing visual direction)
2. Optional: Create treatment/shot list (if they want)
3. Film memory (artist does this)
4. Upload raw footage
5. Cut into 2-4 snapshots:
   - Select clips
   - Set lengths (10s, 15s, 20s)
   - Assign to snapshots
   - Add captions
   - Set post dates
6. Snapshots are ready to post

---

### Priority 5: Visual Direction Builder (Assistive, Not Prescriptive)

**Goal:** Help artists define what snapshots should look/feel like (only if they need help)

**What we need:**
- Questions about visual direction
- Visual reference collection
- AI suggestions (only if asked)
- Connection to world visual landscape

**Key Questions:**
1. When should we show this? (Always? Only if artist asks?)
2. How detailed should questions be? (Quick mood? Deep dive?)
3. How do we balance assistance vs. letting them be creative?
4. Should we pre-fill based on world visual landscape?

**Features:**
- **Guided Questions:** Step-by-step (only if needed)
- **Visual Reference Upload:** Images, Pinterest
- **AI Suggestions:** Only if artist asks
- **World Integration:** Pre-fill from world visual landscape

**UI Flow:**
1. Artist creates world
2. Optional: "Need help with visual direction?" button
3. If yes: Guided questions
4. If no: They write their own
5. Platform assists only when asked

---

## Refined Feature Set (MVP)

### Must Have (Week 1-2)
1. **Enhanced Onboarding** - Collect general artist profile
2. **World Creation Questionnaire** - Collect specific snapshot vision
3. **Snapshot Schedule Creation** - Generate posting schedule with backwards planning
4. **Calendar Integration** - Add schedule to Google Calendar (already have)

### Should Have (Week 3-4)
5. **Memory Creator** - Basic memory creation workflow
6. **Snapshot Cutter** - Cut memory into 2-4 snapshots
7. **Visual Direction Builder** - Assistive tool (only if needed)
8. **Reminders** - Proactive reminders (already have)

### Nice to Have (Later)
9. **AI Snapshot Ideas** - Only if artist asks
10. **Performance Analysis** - After consistency is achieved
11. **Replication Engine** - After we have performance data

---

## Key Questions to Answer

### 1. Snapshot Schedule
- **Q:** How many snapshots per world? (Based on timeline? Artist preference?)
- **Q:** How do we space them? (Daily? Every other day? Weekly?)
- **Q:** What's the optimal timeline? (2 weeks before, release week, 8 weeks after?)
- **Q:** How do we make it "sticky" - something artists will follow?

**Recommendation:**
- Default: 6-8 snapshots (2 weeks before, release week, 6 weeks after)
- Spacing: 2-3 per week (Tuesday, Thursday, Friday optimal)
- Artist can adjust (add/remove, change dates)
- Make it visual and clear (calendar view)

### 2. Onboarding Depth
- **Q:** How detailed? (Quick 5 questions? Deep dive 20 questions?)
- **Q:** Required or optional? (Can they skip and fill later?)
- **Q:** What questions are most important?

**Recommendation:**
- Quick 5-7 questions (required):
  1. Genre
  2. Musical inspiration (3 artists)
  3. Visual style (colors, aesthetics)
  4. Platforms (Instagram, TikTok, etc.)
  5. Current posting frequency
- Optional deep dive (can fill later):
  - Visual references
  - Best posts (manual entry)
  - Detailed style preferences

### 3. World Creation Questionnaire
- **Q:** How detailed? (High-level mood? Specific shots?)
- **Q:** Per snapshot or overall direction?
- **Q:** Required or optional?

**Recommendation:**
- Required (quick):
  1. Visual direction (look/feel) - 2-3 sentences
  2. Visual references (optional but encouraged)
  3. Story/concept (optional)
- Optional (if they want help):
  - Detailed visual direction
  - Snapshot ideas
  - Treatment suggestions

### 4. Memory Workflow
- **Q:** How detailed should memory creation be? (Can they skip treatment?)
- **Q:** How do we help them cut memories? (Manual? AI-assisted?)
- **Q:** What's the minimum viable workflow?

**Recommendation:**
- Flexible workflow:
  - Minimum: Visual direction + film + cut
  - Optional: Treatment, shot list
- Manual cutting (artist selects clips)
- AI assistance only if asked (suggest clip selections)

### 5. Assistance vs. Creativity
- **Q:** When do we assist? (Always? Only if asked?)
- **Q:** How do we balance guidance vs. freedom?

**Recommendation:**
- **Assistive, not prescriptive:**
  - Provide tools and suggestions
  - Artist decides what to use
  - AI ideas only if they ask
  - Pre-fill from world data, but allow full editing

---

## Implementation Plan

### Week 1: Foundation
1. Enhanced Onboarding (5-7 questions)
2. World Creation Questionnaire (visual direction)
3. Snapshot Schedule Calculator (based on release date)
4. Backwards Planning (calculate all deadlines)

### Week 2: Schedule & Calendar
5. Schedule Visualization (calendar view)
6. Calendar Integration (Google Calendar sync - already have)
7. Reminders (proactive - already have)
8. Schedule Adjustments (add/remove snapshots, change dates)

### Week 3: Memory Workflow
9. Memory Creator (basic: visual direction, optional treatment)
10. Snapshot Cutter (manual: select clips, set lengths)
11. Caption Generator (optional AI)
12. Platform Optimization (different versions)

### Week 4: Polish & Refinement
13. Visual Direction Builder (assistive tool - only if needed)
14. AI Snapshot Ideas (only if artist asks)
15. Workflow Improvements
16. Testing & Refinement

---

## Questions for You

1. **Snapshot Schedule:**
   - How many snapshots per world? (6-8 default? More? Less?)
   - How should we space them? (2-3 per week? Daily? Weekly?)
   - What's the optimal timeline? (2 weeks before, release week, 6-8 weeks after?)

2. **Onboarding:**
   - How detailed should it be? (Quick 5 questions? More?)
   - Should we ask about best posts? (Even if manual entry?)
   - What questions are most important for snapshot creation?

3. **World Creation:**
   - How detailed should visual direction be? (High-level mood? Specific?)
   - Should we ask per snapshot or overall direction?
   - When should we offer AI suggestions? (Always? Only if asked?)

4. **Memory Workflow:**
   - What's the minimum viable workflow? (Can they skip treatment?)
   - How do we help them cut memories? (Manual selection? AI-assisted?)
   - How flexible should it be? (Some artists want full control, others want guidance)

5. **Assistance Level:**
   - When should we assist? (Always? Only if asked?)
   - How do we balance guidance vs. letting them be creative?
   - Should AI ideas be opt-in or always shown?

---

## Next Steps

1. **Answer questions above** - Refine approach
2. **Design onboarding questionnaire** - 5-7 key questions
3. **Design world creation questionnaire** - Visual direction focus
4. **Build snapshot schedule calculator** - Based on release date
5. **Build backwards planning** - Calculate all deadlines
6. **Test with real artist** - Get feedback

---

**Remember: Consistency is #1. Everything else supports that goal.**


