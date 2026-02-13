# Implementation Plan - January 25, 2026

Based on Julian Kenji User Journey conversation.

---

## Overview

We're redesigning the onboarding and Snapshot Starter to be:
1. **Conversational** (voice-first, text fallback)
2. **Context-aware** (time budget, assets, what's worked)
3. **Batch-oriented** (2 weeks at a time, not one post at a time)
4. **Accountable** (task breakdown, calendar sync, check-ins)

---

## Implementation Phases

### Phase 1: Conversational Onboarding

**Goal:** Replace form-based onboarding with a conversation.

**Components to build:**

1. **`ConversationalOnboarding.tsx`** - New component
   - Voice input (default) with text fallback toggle
   - Chat interface showing conversation history
   - Platform asks questions, processes responses
   - Extracts structured data from conversation

2. **Voice input integration**
   - Web Speech API for browser-native speech recognition (free, works in Chrome/Edge)
   - Fallback to text input for unsupported browsers
   - Visual feedback when listening

3. **Conversation flow logic**
   - Scripted questions with branching based on responses
   - Natural language processing to extract key info
   - Progress indicator ("We're about halfway through")

4. **New data fields to collect:**
   - `timebudgetHoursPerWeek`: number
   - `preferredDays`: string[] (which days work best)
   - `existingAssets`: { musicVideos: string[], footage: string[], photos: string[] }
   - `teamMembers`: { role: string, availability: string }[]
   - `songStatus`: 'released' | 'upcoming'

**Questions to ask you:**
- Should we keep the existing form as a "skip conversation" option for users who prefer it?
- For voice input, is Web Speech API (free, browser-native) acceptable, or do you want Whisper API (more accurate, costs money)?

---

### Phase 2: Snapshot Starter Redesign

**Goal:** Calendar view + conversational brainstorming + batch creation.

**Components to modify/build:**

1. **`SnapshotStarter.tsx`** - Major rewrite
   - Calendar view showing 2 weeks at a time
   - Visual distinction between filled/empty slots
   - Click to brainstorm for specific day or batch

2. **`BrainstormMode.tsx`** - New component
   - Conversational interface (reuse voice/text from onboarding)
   - "Want suggestions first?" flow
   - Suggestions with "why it works" explanations
   - Back-and-forth refinement
   - "Fill 2 weeks with variations" option

3. **`SnapshotBlock.tsx`** - New component
   - Display a 2-week block of related snapshots
   - Show variations and how they connect
   - Edit individual or edit block

4. **Calendar improvements:**
   - Support "now" as reference point (post-release)
   - Support future release date (pre-release)
   - Show task deadlines (film by X, edit by Y)

**AI prompt updates:**
   - Include artist's time budget in suggestions
   - Include available assets (can repurpose MV, has leftover footage)
   - Include what's worked before
   - Generate "why it works" explanations
   - Generate 2-week blocks, not individual posts

---

### Phase 3: Task Breakdown & Accountability

**Goal:** Turn each snapshot into actionable tasks with calendar sync.

**Components to build:**

1. **`TaskBreakdown.tsx`** - New component
   - Simple mode: Concept → Film → Edit → Post
   - Detailed mode: Treatment → Shot list → Film → Edit → Caption → Schedule
   - Time estimates for each task
   - Assign tasks to team members (if applicable)

2. **`AccountabilityCheckIn.tsx`** - New component
   - "Did you complete [task]?" prompt
   - Yes: Mark complete, celebrate
   - No: Reschedule options

3. **Google Calendar enhancements:**
   - Create events for each task (not just posting date)
   - Include task description and time estimate
   - Reminder notifications

4. **Task state management:**
   - Track completion status
   - Auto-reschedule missed tasks
   - Show streak/consistency metrics

---

### Phase 4: Smart Suggestions Engine

**Goal:** Platform learns and gives personalized recommendations.

**This phase is more complex and can come later. Initial version:**

1. **Context-aware prompts** - Include all artist context in AI prompts
2. **"Why it works" generation** - AI explains reasoning
3. **Manual performance tracking** - Artist inputs how posts did
4. **Basic pattern recognition** - "Posts like X perform better"

**Future (requires API integrations):**
- Instagram/TikTok API for automatic performance data
- Subgenre benchmarking
- Trend awareness

---

## Suggested Build Order

### Week 1: Foundation
- [ ] Voice/text input component (reusable)
- [ ] Conversation state management
- [ ] Basic conversational onboarding flow

### Week 2: Onboarding Complete
- [ ] All onboarding questions in conversation
- [ ] Data extraction from conversation
- [ ] Asset inventory collection
- [ ] Time budget collection

### Week 3: Snapshot Starter v2
- [ ] Calendar view (2 weeks, relative to release or "now")
- [ ] Brainstorm mode conversation UI
- [ ] Suggestions with explanations

### Week 4: Batch Creation
- [ ] 2-week block generation
- [ ] Variations logic
- [ ] Block editing interface

### Week 5: Accountability
- [ ] Task breakdown system
- [ ] Enhanced Google Calendar sync
- [ ] Check-in prompts
- [ ] Auto-reschedule

---

## Technical Decisions Needed

1. **Voice recognition:**
   - Option A: Web Speech API (free, Chrome/Edge only, decent accuracy)
   - Option B: Whisper API (costs ~$0.006/min, all browsers, excellent accuracy)
   - **Recommendation:** Start with Web Speech API, upgrade if needed

2. **Conversation state:**
   - Store in component state during onboarding
   - Save to database on completion
   - Allow resuming if user leaves mid-conversation?

3. **AI for conversation processing:**
   - Use Claude to extract structured data from free-form responses
   - Use Claude to generate contextual follow-up questions
   - Use Claude for suggestion generation with reasoning

4. **Calendar task granularity:**
   - One event per task (Concept, Film, Edit, Post = 4 events)?
   - Or grouped events with task list in description?
   - **Recommendation:** Separate events for major tasks (Film, Edit, Post)

---

## Questions Before We Start

1. **Voice input:** Web Speech API (free) or Whisper API (paid but better)?

2. **Keep old forms?** Should there be a "skip conversation" button that shows the old form, or fully replace?

3. **Calendar events:** Separate event per task, or grouped?

4. **First component to build:** Should I start with the conversational onboarding, or fix the Snapshot Starter first since that's what's most broken for you right now?

5. **Testing approach:** Do you want to test each phase as we go, or build it all and then test?

---

## Files That Will Be Modified/Created

### New Files:
- `components/multiverse/ConversationalOnboarding.tsx`
- `components/multiverse/VoiceInput.tsx`
- `components/multiverse/BrainstormMode.tsx`
- `components/multiverse/SnapshotBlock.tsx`
- `components/multiverse/TaskBreakdown.tsx`
- `components/multiverse/AccountabilityCheckIn.tsx`

### Modified Files:
- `components/multiverse/SnapshotStarter.tsx` (major rewrite)
- `components/multiverse/WorldCreationForm.tsx` (add "already released?" question)
- `types/index.ts` (new fields for time budget, assets, etc.)
- `app/page.tsx` (swap form for conversation)
- `app/api/generate-snapshot-ideas/route.ts` (enhanced prompts)

---

**Please answer the questions above and confirm the build order, then we can start implementing!**

