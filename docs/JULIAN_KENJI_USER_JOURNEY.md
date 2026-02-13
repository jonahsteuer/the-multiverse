# Julian Kenji User Journey - Platform Redesign Spec

**Date:** January 25, 2026  
**Status:** Ready for Implementation  
**Based on:** Conversation with Julian Kenji (artist persona)

---

## The User: Julian Kenji

Julian is an artist who:
- Has been making music for years but struggles to promote it on social media
- Recently released a song called "Cliche" with a music video (performance + slightly narrative)
- Has done minimal promo for it
- Has about **6 hours/week** to dedicate to content creation
- Has had some success with a story-based post (near-death experience voiceover with personal footage)
- Has tons of leftover footage from random shoots
- Can occasionally work with videographers but not consistently
- Wants a **low barrier to entry**, simple method to post consistent and optimal content

---

## Core Problems with Current Platform

1. **Assumes pre-release planning** - Doesn't handle "song already dropped, need to promote now"
2. **Generic suggestions** - Ideas don't feel connected to artist's situation, assets, or what's worked
3. **No asset inventory** - Doesn't ask what the artist already has to work with
4. **No time budget awareness** - Doesn't factor in realistic time constraints
5. **One snapshot at a time** - Tedious; doesn't think in batches or content "blocks"
6. **Form-based onboarding** - Artists don't have time for surveys; conversation would be better
7. **No "why it works" reasoning** - Suggestions feel arbitrary with no guarantee of success
8. **No accountability system** - No task breakdown, no reminders, no follow-through

---

## Solution: Platform Redesign

### 1. Conversational Onboarding (Voice-First)

**Replace forms entirely with a conversation.**

- **Voice input is default** - Artist speaks to the platform
- **Text chat fallback** - Click to switch if preferred
- **Feels like talking to a manager** - Not filling out a survey

**Key information to gather through conversation:**

1. **Basic info:** Name, artist name, genre, musical inspirations
2. **Visual aesthetic:** What visual style matches their music?
3. **Best performing posts:** What's worked? Why do they think it worked?
4. **Platforms & frequency:** Where do they post? How often now vs. desired?
5. **Content preferences:** What do they actually enjoy making?
6. **Equipment & team:** What do they have? Who can help?
7. **Time budget:** How many hours/week? Which days work best?
8. **Asset inventory:** What do they already have? (Music videos, footage, photos)

**Example conversation flow:**
```
Platform: "Hey! I'm here to help you promote your music. What's your artist name?"
Julian: "Julian Kenji"
Platform: "Nice to meet you, Julian. What kind of music do you make?"
Julian: "I make alternative R&B"
Platform: "Love it. Do you have any songs out right now that you want to promote?"
Julian: "Yeah, I just released a song called Cliche. I made a music video for it but haven't really done much promo."
Platform: "Got it - so the song is already out. What kind of music video is it? Performance, narrative, abstract?"
Julian: "It's performance with some narrative elements"
Platform: "Perfect. Have you had any posts that performed really well before? I'd love to understand what works for you."
...
```

---

### 2. Asset Inventory System

**Ask what the artist already has to work with:**

- Existing music video(s) - can be repurposed/chopped up
- Leftover footage from shoots
- Behind-the-scenes footage
- Studio session footage
- Photos from shoots
- Life footage / vlogs

**Platform should factor this into strategy:**
- Repurposing existing assets = less time required
- Same footage, different narrative angle = efficient variations
- Platform calculates: "Based on your MV and leftover footage, you could create 8 posts without filming anything new"

---

### 3. Time Budget Awareness

**Proactive suggestions factor in realistic time constraints:**

- "Based on your 6 hrs/week, you should film X this weekend"
- "This snapshot idea takes ~2 hours to execute"
- Don't suggest 10-hour projects to someone with 6 hours/week

**Task breakdown based on complexity:**

**Simple snapshots (solo, phone content):**
```
Concept → Film → Edit → Post
```

**Complex snapshots (with team):**
```
Treatment → Shot list → Film → Edit → Caption → Schedule
```

**Important:** Don't assume artists know how to make treatments and shot lists. If they have a team, team members can log in and complete these tasks. Most artists shouldn't do this alone unless they want to.

---

### 4. Post-Release Promo Support

**Handle songs that already dropped:**

- When creating a World, ask: "Is this song already released or upcoming?"
- If already released:
  - Calendar shows "now" as the reference point, not a future release date
  - Posting schedule starts immediately
  - Different strategy focus (sustain momentum vs. build anticipation)
- If upcoming:
  - Calendar shows weeks before/after release date
  - Traditional pre-release strategy

---

### 5. Redesigned Snapshot Starter ("Brainstorm Mode")

**Calendar View:**
- Shows posting schedule relative to release date (or "now" for post-release)
- Clear visual of what's filled vs. empty
- Click on a day to brainstorm content for that slot

**"Brainstorm Snapshots" Flow:**

1. Artist clicks "Brainstorm Snapshots"
2. Platform asks: "Would you like me to suggest some ideas first, or do you have something in mind?"

**If artist wants suggestions:**
- Platform generates ideas WITH explanations of why they'd work
- Explanations factor in:
  - What's worked for the artist before
  - What works in their subgenre
  - Their available assets
  - Their time budget
- Example: "Based on your near-death story post doing well, I think a personal story connecting your life to Cliche's meaning would resonate. You already have footage from the MV and your leftover shoots - you could create this in ~2 hours with just editing."

**If artist has their own idea:**
- Platform asks them to explain
- Offers feedback/adjustments
- Helps refine the concept

**Once idea is agreed upon:**
- Platform offers to fill out multiple snapshots (2 weeks at a time)
- Creates "blocks" of similar content with variations:
  - Same footage, different narrative angle
  - Related themes with different execution
  - 1-2 slots for different formats (BTS, fan reactions, etc.)

---

### 6. Multi-Snapshot "Blocks" System

**Think in batches, not individual posts.**

A "block" is a 2-week period where the artist tries variations of a concept that works.

**Example block for Julian (near-death story worked):**

| Day | Snapshot Idea | Variation Type |
|-----|---------------|----------------|
| Mon | Personal story about Cliche's meaning | Core concept |
| Wed | Same footage, different angle (focus on recovery) | Same footage, new narrative |
| Fri | Clip from MV with story continuation | Repurposed asset |
| Mon | Behind-the-scenes of making Cliche | Different format (BTS) |
| Wed | Another personal moment that inspired a lyric | Core concept variation |
| Fri | Fan reaction/comment compilation | Easy win format |

**Platform continuously adjusts:**
- Based on artist's feedback during brainstorming
- Based on actual post performance over time
- Learns what resonates and suggests more of that

---

### 7. Accountability System

**Task breakdown synced to Google Calendar:**

Each snapshot becomes a series of small tasks:
- Concept review (5 min)
- Film (30 min - 2 hrs depending on complexity)
- Edit (1-2 hrs)
- Post (5 min)

**Each task is a calendar event with:**
- Clear description of what to do
- Time estimate
- Due date

**Accountability check-ins:**
- Platform asks: "Did you complete [task]?"
- If yes: Mark complete, move on
- If no: Gentle reminder + auto-reschedule
- No judgment, just keep the artist on track

---

### 8. Smart Suggestions Engine ("The Brain")

**Platform should act like an intelligent manager that:**

1. **Proactively suggests** - "Based on your 6 hrs/week, you should film X this weekend"
2. **Explains why** - "This format works because [reason based on your data]"
3. **Learns over time** - Adjusts based on actual post performance
4. **Factors in context:**
   - Time budget
   - Available assets
   - What's worked for this artist
   - What works in their subgenre
   - Current trends (optional/future)

**Not just generic AI suggestions - personalized strategic thinking.**

---

### 9. Why Julian's Near-Death Story Worked

**Analysis for the platform to learn from:**

1. **Vulnerability creates connection** - Personal, emotional story
2. **Story structure** - Beginning, middle, end (what happened → how it connects)
3. **Authenticity** - Real footage from that time, not staged
4. **Context for the music** - Gave people a reason to care about the upcoming project
5. **Audio preview** - Built anticipation with similar sound

**Platform should identify these patterns:**
- "Your story-based posts with personal footage outperform your other content by 3x"
- "Posts where you explain the meaning behind your music get 2x more saves"
- "Suggestion: Create more posts that connect your personal experiences to your songs"

---

## Implementation Priority

### Phase 1: Core Experience Fixes
1. **Conversational onboarding** (voice-first, text fallback)
2. **Asset inventory** in onboarding
3. **Time budget** question in onboarding
4. **Post-release support** - "Is this song already out?"

### Phase 2: Snapshot Starter Redesign
1. **Calendar view** relative to release date or "now"
2. **Brainstorm mode** with conversational interface
3. **Suggestions with reasoning** ("why this would work")
4. **Batch creation** (2 weeks at a time)

### Phase 3: Accountability & Intelligence
1. **Task breakdown** (simple vs. detailed)
2. **Google Calendar sync** for tasks
3. **Check-in system** with gentle reminders
4. **Auto-reschedule** on missed tasks

### Phase 4: Learning & Optimization
1. **Performance tracking** integration
2. **Pattern recognition** ("posts like X perform 3x better")
3. **Strategy adjustment** based on actual results
4. **Subgenre benchmarking** (what works for similar artists)

---

## Open Questions

1. **Voice transcription tech** - What service for voice input? (Whisper API, Web Speech API, etc.)
2. **Calendar sync granularity** - How detailed should calendar events be?
3. **Performance data source** - How do we get post performance data? (Manual input first, then API integration?)
4. **Subgenre data** - How do we know what works in an artist's subgenre? (Research needed)

---

## Success Metrics

For Julian Kenji, success looks like:
- Posts 2-3x per week consistently (up from sporadic)
- Creates content in 6 hours/week or less
- Snapshots feel connected to his story and what's worked
- Doesn't feel like a chore - actually enjoys the process
- Sees growth in engagement and potentially streams

---

**This spec should be used to guide all implementation decisions. When in doubt, ask: "Would this help Julian post consistently and enjoy the process?"**

