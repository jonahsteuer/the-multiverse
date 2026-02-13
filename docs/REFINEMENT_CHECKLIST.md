# Refinement Checklist

**Date:** January 12, 2026  
**Status:** Reviewing Current Implementation

---

## What We Have Built

### 1. Enhanced Onboarding Form
- **File:** `components/multiverse/EnhancedOnboardingForm.tsx`
- **Status:** Just updated with content creation experience questions
- **Questions:**
  - Q1: Genre & Musical Style
  - Q2: Visual Aesthetic (with Pinterest placeholder)
  - Q3: Best Performing Posts (post format)
  - Q4: Platforms & Frequency
  - Q5: Content Creation Experience (NEW)
  - Q6: Visual Themes

### 2. Snapshot Schedule Calculator
- **File:** `lib/snapshot-schedule-calculator.ts`
- **Status:** Built with adaptive frequency
- **Features:**
  - Dynamic calculation based on hours/week, platforms, release timeline
  - Adaptive frequency (adjusts based on posting performance)
  - Stops 2 weeks before next release

### 3. Type System
- **File:** `types/index.ts`
- **Status:** Updated with new types
- **New Types:**
  - `ArtistProfile` (onboarding data)
  - `BestPost` (best performing posts)
  - `SnapshotScheduleConfig` (schedule configuration)
  - `Memory` (master video workflow)
  - Enhanced `Snapshot` (with performance data)

### 4. Documentation
- **Files:**
  - `docs/SNAPSHOT_TYPES_STRATEGY.md` - Snapshot type categories
  - `docs/IMPLEMENTATION_EXAMPLES.md` - Implementation examples
  - `docs/CURRENT_WORK.md` - Current work status

---

## Areas to Refine

### 1. Enhanced Onboarding Form

**Potential Issues:**
- [ ] Q5 (Content Creation Experience) - Are the questions clear?
- [ ] Q5 - Do we need to ask about time availability here? (We ask in schedule calculator)
- [ ] Q5 - Should we ask about team/collaborators?
- [ ] Q6 (Visual Themes) - Is this the right place? Should it be in world creation?
- [ ] Form validation - Are all required fields properly validated?
- [ ] User experience - Is the 6-step flow too long?
- [ ] Data collection - Are we collecting everything we need for snapshot type recommendations?

**Questions to Answer:**
- Should Q5 include time availability, or is that separate?
- Should we ask about team/collaborators in onboarding?
- Is Q6 (Visual Themes) needed in onboarding, or should it be in world creation?
- Should onboarding be optional or required?

---

### 2. Snapshot Schedule Calculator

**Potential Issues:**
- [ ] Adaptive frequency logic - Is the 90%/70% threshold correct?
- [ ] Platform frequency defaults - Are TikTok=5, Instagram=2.5, YouTube=1.5 correct?
- [ ] Hours-to-capacity mapping - Is the mapping accurate?
- [ ] Timeline calculation - Is 2 weeks before to 8 weeks after correct?
- [ ] Posting day optimization - Are Tuesday/Thursday/Friday the best days?
- [ ] Next release handling - Is stopping 2 weeks before correct?

**Questions to Answer:**
- Should adaptive frequency be more aggressive or conservative?
- Should platform frequencies be adjustable by user?
- Should timeline be adjustable (not just 2 weeks before, 8 weeks after)?
- Should posting days be customizable?

---

### 3. Snapshot Types Strategy

**Potential Issues:**
- [ ] Category definitions - Are low-barrier/medium/high-production clearly defined?
- [ ] Examples - Are the examples accurate and helpful?
- [ ] Progression - How do artists move from one level to another?
- [ ] Mixing types - Can artists mix types, or must they stick to one?
- [ ] "Raw" content - How do we encourage authentic, unpolished content?
- [ ] Recommendation logic - How do we determine which types to recommend?

**Questions to Answer:**
- Should we allow mixing snapshot types?
- How do we help artists progress from beginner to advanced?
- How do we balance "raw" content with artistic quality?
- What's the recommendation algorithm based on onboarding answers?

---

### 4. Type System

**Potential Issues:**
- [ ] `ArtistProfile` - Are all fields needed? Any missing?
- [ ] `BestPost` - Is the structure correct? Do we need more fields?
- [ ] `SnapshotScheduleConfig` - Is the structure complete?
- [ ] `Memory` - Is this structure correct for the workflow?
- [ ] `Snapshot` - Are all the new fields (performance, backwards planning) correct?

**Questions to Answer:**
- Are there any missing fields in `ArtistProfile`?
- Should `BestPost` include more performance metrics?
- Is `SnapshotScheduleConfig` complete for adaptive frequency?
- Do we need additional types for snapshot type recommendations?

---

### 5. Integration & Flow

**Potential Issues:**
- [ ] When is onboarding shown? (After signup? Optional?)
- [ ] How does onboarding data connect to world creation?
- [ ] How does snapshot type recommendation work?
- [ ] How does schedule calculator use onboarding data?
- [ ] What happens if user skips onboarding?

**Questions to Answer:**
- Should onboarding be required or optional?
- How do we use onboarding data to recommend snapshot types?
- How do we use onboarding data in schedule calculation?
- What's the flow: Onboarding → World Creation → Schedule Generation?

---

## Specific Refinement Questions

### For You to Answer:

1. **Onboarding Form:**
   - Is Q5 (Content Creation Experience) complete? Any questions missing?
   - Should we ask about time availability in onboarding or separately?
   - Should we ask about team/collaborators?
   - Is Q6 (Visual Themes) needed in onboarding, or should it be in world creation?
   - Should onboarding be optional or required?

2. **Schedule Calculator:**
   - Are the frequency defaults correct? (TikTok=5, Instagram=2.5, YouTube=1.5)
   - Is the adaptive frequency logic correct? (90%/70% thresholds)
   - Should timeline be adjustable? (Not just 2 weeks before, 8 weeks after)
   - Should posting days be customizable?

3. **Snapshot Types:**
   - Should we allow mixing snapshot types? (Beginner doing some medium?)
   - How do we help artists progress from beginner to advanced?
   - How do we balance "raw" content with artistic quality?
   - What's the recommendation algorithm? (Based on which onboarding answers?)

4. **Integration:**
   - When should onboarding be shown? (After signup? Optional?)
   - How does onboarding data connect to world creation?
   - What happens if user skips onboarding?

---

## Next Steps

1. **Review current implementation** - Check for bugs, inconsistencies
2. **Get your feedback** - Answer refinement questions above
3. **Make improvements** - Based on feedback
4. **Test flow** - Ensure everything works together
5. **Document decisions** - Update docs with final decisions

---

**What would you like to refine first?**


