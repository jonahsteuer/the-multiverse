# Snapshot Data Collection & Feature Brainstorming

**Date:** January 12, 2026  
**Status:** Brainstorming Phase

---

## Core Philosophy: Backwards Planning

**Start with the vision, work backwards to actionable steps.**

Each snapshot should be thought of as:
1. **What do we want this to look/feel like?** (Final vision)
2. **How do we get there?** (Actionable steps with deadlines)

---

## Two-Phase Data Collection

### Phase 1: Onboarding (General Artist Profile)

**Goal:** Build a foundation for the artist's visual universe

**Data to Collect:**
- Genre(s)
- Musical inspiration (artists, songs, albums)
- Visual inspiration (artists, aesthetics, eras, styles)
- Current social media presence (Instagram/TikTok handles)
- Posting frequency (current vs. desired)
- Best-performing content (if they know it)
- Visual style preferences (color palettes, moods, aesthetics)
- Content types they prefer (video, photo, carousel, etc.)
- Platforms they use (Instagram, TikTok, YouTube, Twitter)

**Output:** Artist profile that informs all future snapshot generation

---

### Phase 2: World Creation (Specific Snapshot Vision)

**Goal:** Understand exactly what snapshots should look/feel like for THIS world

**Data to Collect:**
- **Visual Direction:**
  - What should snapshots look like? (mood, aesthetic, color palette)
  - What should snapshots feel like? (emotion, energy, vibe)
  - Visual references (images, Pinterest boards, existing content)
  
- **Content Strategy:**
  - How many snapshots? (based on release timeline)
  - What's the story arc? (pre-release tease → release → post-release)
  - Key moments to capture? (lyrics, hooks, visual moments)
  
- **Performance Goals:**
  - What do you want these snapshots to achieve? (streams, new fans, engagement)
  - What's worked before? (reference successful past content)
  
- **Creative Direction:**
  - Any specific ideas or concepts?
  - Locations, props, styling preferences?
  - Shot types (close-ups, wide shots, movement, etc.)

**Output:** Detailed snapshot strategy with visual direction for each snapshot

---

## Snapshot Object Structure

Each snapshot is an object with:

### Core Information
- **ID** - Unique identifier
- **World ID** - Which world it belongs to
- **Memory ID** - Which "memory" (master video) it came from (if applicable)

### Visual/Creative Direction
- **Visual Description** - What it should look like
- **Mood/Feel** - What it should feel like
- **Visual References** - Images, Pinterest pins, inspiration
- **Color Palette** - Colors to use
- **Aesthetic** - Style (80s synth-pop, dreamy, energetic, etc.)

### Content
- **Caption(s)** - One or multiple captions for different platforms
- **Video Length** - Duration in seconds
- **Content Type** - Video, photo, carousel, reel, story
- **Platform(s)** - Instagram, TikTok, YouTube, Twitter

### Dates & Deadlines (Backwards Planning)
- **Post Date(s)** - When to post (primary date + platform-specific dates)
- **Edit Deadline** - When edit must be finished (typically 1-2 days before post)
- **Shot List Deadline** - When shot list must be finalized (typically 3-5 days before shoot)
- **Treatment Deadline** - When treatment must be ready (typically 7 days before shoot)
- **Shoot Date** - When filming happens (typically 1 week before post)

### Performance Data (Collected Over Time)
- **Views** - Total views
- **Likes** - Total likes
- **Comments** - Total comments
- **Shares** - Total shares
- **Saves** - Total saves
- **Streams Attributed** - Streams driven (if trackable)
- **New Fans Reached** - New followers/engagements
- **Engagement Rate** - Calculated metric
- **Performance Score** - Overall performance rating
- **Performance Insights** - Why it performed well/poorly

### Workflow
- **Status** - Draft, Treatment Ready, Shot List Ready, Filmed, Edited, Approved, Posted
- **Treatment** - Treatment document/script
- **Shot List** - List of shots to capture
- **Edits** - Uploaded video files (versions)
- **Approval Status** - Pending, Approved, Needs Revision

---

## Key Features to Build

### 1. Instagram/TikTok Import & Analysis

**Goal:** Use existing successful content as a starting point

**How it works:**
- Connect Instagram/TikTok account (OAuth)
- Import existing posts (last 30-90 days)
- Analyze performance metrics
- Identify best-performing posts
- Extract patterns: What worked? (visual style, posting time, content type, caption style)
- Create "Snapshot DNA" from successful posts

**Output:**
- Performance dashboard showing best posts
- "Why this worked" analysis for each top post
- Visual style patterns extracted
- Optimal posting times identified
- Content type preferences (what performs best)

**UI:**
- "Import Your Best Posts" button in onboarding
- Performance analysis view
- "Use this as inspiration" button on top posts

**Technical:**
- Instagram Graph API / TikTok API
- Performance analysis algorithm
- Pattern recognition (AI-powered)

---

### 2. Snapshot DNA Extraction

**Goal:** Understand what makes an artist's successful content work

**How it works:**
- Analyze imported posts OR ask questions about best posts
- Extract:
  - Visual style (colors, aesthetics, moods)
  - Content structure (length, pacing, editing style)
  - Caption style (tone, length, hashtags)
  - Posting patterns (times, days, frequency)
  - Performance drivers (what correlates with success)
- Create "Snapshot DNA" profile

**Output:**
- Visual style guide
- Content formula (what works for this artist)
- Performance insights ("Your posts with X perform 3x better")

**UI:**
- "Your Snapshot DNA" view
- Visual style breakdown
- Performance patterns chart

---

### 3. Memory-to-Snapshots Workflow

**Goal:** Help artists create a "memory" (master video) and cut it into multiple snapshots

**How it works:**
- Artist creates a "Memory" (master video concept)
- Memory has:
  - Visual direction
  - Treatment/script
  - Shot list
  - Filming plan
- After filming, memory is cut into multiple snapshots:
  - Different clips/angles
  - Different lengths (10s, 15s, 20s)
  - Different platforms (Instagram, TikTok)
  - Different captions
- Each snapshot inherits visual direction from memory

**UI:**
- "Create Memory" button in world view
- Memory detail view (treatment, shot list, filming plan)
- "Cut into Snapshots" workflow after filming
- Snapshot editor (select clips, set lengths, add captions)

**Workflow:**
1. Create Memory (visual direction, treatment, shot list)
2. Film Memory (one shoot day)
3. Upload raw footage
4. Cut into Snapshots (AI-assisted or manual)
5. Each snapshot gets post date, caption, platform

---

### 4. Visual Direction Builder

**Goal:** Step-by-step process to define what a snapshot should look/feel like

**How it works:**
- Guided questionnaire for each snapshot (or memory)
- Questions:
  - "What should this snapshot look like?" (mood, aesthetic, colors)
  - "What should this snapshot feel like?" (emotion, energy, vibe)
  - "What's the story?" (narrative, concept, message)
  - "Visual references?" (upload images, Pinterest pins)
  - "Where will this be filmed?" (location, setting)
  - "What's the energy?" (high, low, building, etc.)
- AI suggests improvements based on:
  - Snapshot DNA (what works for this artist)
  - Successful past posts
  - World visual landscape

**Output:**
- Detailed visual direction document
- Visual references collection
- Treatment suggestions

**UI:**
- Step-by-step wizard
- Visual reference uploader
- AI suggestions sidebar
- Preview of direction

---

### 5. Treatment/Script Assistant

**Goal:** Help artists create treatments and scripts with AI guidance

**How it works:**
- Artist writes treatment/script (or starts with AI-generated)
- AI provides suggestions based on:
  - Snapshot DNA (what works)
  - Successful past posts
  - World visual landscape
  - Best practices
- Real-time feedback:
  - "This matches your best-performing snapshot style"
  - "Consider adding [X] based on what works for you"
  - "This visual direction aligns with your 80s synth-pop aesthetic"

**Output:**
- Treatment document
- Script (if applicable)
- Shot suggestions
- Visual reference links

**UI:**
- Rich text editor for treatment
- AI suggestions panel
- Visual reference sidebar
- Preview mode

---

### 6. Replication Engine

**Goal:** Help artists replicate successful snapshots

**How it works:**
- Identify best-performing snapshot (Julian's example)
- Analyze why it worked:
  - Visual style
  - Content structure
  - Posting time
  - Caption style
  - Platform
- Generate replication suggestions:
  - "Create 3 more snapshots like this"
  - "This snapshot worked because [reason]"
  - "Here's how to adapt this for your new world"
- Create variations:
  - Same visual style, different concept
  - Same structure, different content
  - Same energy, different mood

**Output:**
- Replication suggestions
- Variation ideas
- "Create Similar" button

**UI:**
- "Replicate This" button on successful snapshots
- Variation generator
- Side-by-side comparison (original vs. new)

---

### 7. Snapshot Idea Generator

**Goal:** Generate new snapshot ideas based on successful posts

**How it works:**
- Input: World data (name, visual landscape, release date, genre)
- Input: Snapshot DNA (what works for this artist)
- Input: Successful past posts
- AI generates snapshot ideas:
  - Visual descriptions
  - Concepts
  - Variations on successful posts
  - New ideas that match style
- Artist can:
  - Accept ideas
  - Modify ideas
  - Combine ideas
  - Get more suggestions

**Output:**
- List of snapshot ideas
- Visual descriptions
- Concept outlines
- "Build on this" workflow

**UI:**
- "Generate Ideas" button
- Idea cards with descriptions
- "Use This Idea" button
- "Modify" button

---

### 8. Backwards Planning Calculator

**Goal:** Automatically calculate all deadlines based on post date

**How it works:**
- Artist sets post date for snapshot
- Platform calculates backwards:
  - Post Date → Edit Deadline (1-2 days before)
  - Edit Deadline → Shoot Date (1 week before)
  - Shoot Date → Shot List Deadline (3-5 days before shoot)
  - Shot List Deadline → Treatment Deadline (7 days before shoot)
- Adjustable buffer times (user preferences)
- Calendar integration (adds all dates)

**Output:**
- Timeline view
- Calendar events
- Deadline reminders

**UI:**
- Timeline visualization
- Calendar view
- Deadline checklist
- Reminder settings

---

### 9. Performance-Based Snapshot Suggestions

**Goal:** Continuously improve snapshot strategy based on performance

**How it works:**
- Track performance of posted snapshots
- Identify patterns:
  - "Snapshots with [X] perform 3x better"
  - "Posting at [Y time] reaches more new fans"
  - "[Z] visual style drives more streams"
- Suggest improvements for future snapshots:
  - "Your next snapshot should use [X] because it works"
  - "Post at [Y time] for better reach"
  - "Try [Z] visual style based on your best posts"

**Output:**
- Performance insights
- Improvement suggestions
- Strategy adjustments

**UI:**
- Performance dashboard
- Insights panel
- "Apply to Next Snapshot" button

---

### 10. Snapshot Template Library

**Goal:** Save successful snapshots as templates for future use

**How it works:**
- Artist marks snapshot as "template"
- Template includes:
  - Visual direction
  - Structure (length, pacing, editing style)
  - Caption style
  - Performance data (why it worked)
- Use template for new snapshots:
  - Adapt visual direction to new world
  - Keep structure that worked
  - Modify for new context

**Output:**
- Template library
- "Use Template" workflow
- Template variations

**UI:**
- Template gallery
- Template detail view
- "Create from Template" button

---

## Feature Priority (Manager Perspective)

### Phase 1: Foundation (Start Here)
1. **Instagram/TikTok Import** - Get starting point (what works)
2. **Snapshot DNA Extraction** - Understand what makes content work
3. **Enhanced Onboarding** - Collect general artist profile
4. **World Creation Questionnaire** - Collect specific snapshot vision

### Phase 2: Creation Tools
5. **Visual Direction Builder** - Define what snapshots should look/feel like
6. **Memory-to-Snapshots Workflow** - Create memories, cut into snapshots
7. **Treatment/Script Assistant** - Help create treatments with guidance
8. **Backwards Planning Calculator** - Automatically calculate deadlines

### Phase 3: Optimization
9. **Replication Engine** - Replicate successful snapshots
10. **Snapshot Idea Generator** - Generate new ideas based on success
11. **Performance-Based Suggestions** - Continuously improve strategy
12. **Snapshot Template Library** - Save and reuse successful formats

---

## Implementation Notes

### Data Collection Strategy

**Option A: Instagram/TikTok API (Preferred)**
- Pros: Automatic, accurate, comprehensive
- Cons: API access, rate limits, setup complexity
- Best for: Performance data, visual analysis

**Option B: Manual Questions (Fallback)**
- Pros: Simple, no API needed, works immediately
- Cons: Less accurate, requires user input
- Best for: Visual direction, creative input

**Option C: Hybrid (Recommended)**
- Use API when available (performance data)
- Use questions for creative direction
- Combine both for comprehensive profile

### Starting Place Strategy

**For New Artists (No History):**
- Onboarding questionnaire (genre, inspiration, style)
- Visual reference collection (Pinterest, images)
- Build Snapshot DNA from preferences

**For Artists with History:**
- Import Instagram/TikTok posts
- Analyze performance
- Extract Snapshot DNA
- Use as foundation for all future content

**For Artists with One Great Post (Julian's Case):**
- Deep dive into that one post
- Extract everything: visual style, structure, timing, caption
- Use as template for all future snapshots
- Generate variations and adaptations

---

## Example Workflow: Julian's Case

### Step 1: Import Best Post
- Julian connects Instagram
- Platform identifies best-performing post
- Analyzes: Why did this work?
  - Visual style: 80s synth-pop aesthetic
  - Structure: 15-second loop, strong vignette
  - Timing: Posted Tuesday 2pm
  - Caption: Short, energetic, includes song title
  - Performance: 3x more views, 5x more streams than average

### Step 2: Extract Snapshot DNA
- Platform creates "Julian's Snapshot DNA":
  - Visual: 80s synth-pop, neon colors, retro aesthetic
  - Structure: 15-second loops, strong vignettes
  - Timing: Tuesday/Thursday 2pm optimal
  - Caption: Short, energetic, includes song title
  - Content: Lip sync, energetic movement, visual storytelling

### Step 3: Create New Snapshot Ideas
- Julian creates new world
- Platform suggests snapshots based on:
  - Snapshot DNA (what works)
  - New world visual landscape
  - Release timeline
- Julian can:
  - Use AI-generated ideas
  - Create his own ideas
  - Get suggestions to improve his ideas

### Step 4: Build on Existing Ideas
- Julian has an idea for a snapshot
- Platform helps him develop it:
  - "This matches your best-performing style"
  - "Consider adding [X] based on what works"
  - "This visual direction aligns with your 80s aesthetic"
- Julian creates treatment/script
- Platform provides guidance throughout

### Step 5: Replicate Success
- Platform suggests: "Create 3 more like your best post"
- Generates variations:
  - Same visual style, different concept
  - Same structure, different content
  - Same energy, different mood
- Julian adapts for new world

---

## Questions to Answer

1. **Instagram/TikTok API Access:**
   - Do we have access? What are the limitations?
   - Should we start with manual questions and add API later?
   - What data can we get vs. what we need?

2. **Performance Analysis:**
   - How do we identify "best" posts? (views, engagement, streams?)
   - What patterns should we look for?
   - How do we extract visual style from posts?

3. **Memory Workflow:**
   - How many snapshots per memory? (3-5 typical?)
   - How do we help artists cut memories into snapshots?
   - Should we provide AI-assisted cutting?

4. **Visual Direction:**
   - How detailed should visual direction be?
   - Should we use AI to generate visual descriptions?
   - How do we connect visual direction to actual filming?

5. **Replication:**
   - How similar should replications be?
   - How do we avoid making everything the same?
   - How do we adapt successful posts to new contexts?

---

## Next Steps

1. **Decide on data collection method** (API vs. questions vs. hybrid)
2. **Design onboarding questionnaire** (Phase 1)
3. **Design world creation questionnaire** (Phase 2)
4. **Build Instagram/TikTok import** (if API available)
5. **Build Snapshot DNA extraction**
6. **Build Visual Direction Builder**
7. **Build Memory-to-Snapshots workflow**

---

**Remember: Everything should help artists post consistently and build their fanbase. Start with what works, build from there.**


