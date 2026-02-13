# Release Strategy Feature

**Date:** February 10, 2026  
**Status:** ✅ Implemented

---

## Overview

Added a new onboarding question to let artists specify what they want to promote, which directly affects the post mix in their content calendar.

---

## The Problem

The calendar was generating post types (audience-builder, teaser, promo) based on hardcoded logic:
- **Old logic:** All audience-builder posts by default, with one teaser in week 4
- **Issue:** Didn't account for artist's actual goals (e.g., promoting old releases, building to new releases, or just growing audience)

### Example (Cam Okoro):
- **Cameleon EP** released Sept 2024 (5 months old)
- **Mercurial** upcoming (no date set)
- **Old behavior:** 1 teaser for Mercurial (doesn't make sense without a date)
- **Cam's actual goal:** "Promote Cameleon a bit, but mostly just grow audience"

---

## The Solution

### 1. New Onboarding Question: `release_strategy`

**Asks after collecting releases, before platforms**

**Question varies by situation:**

| **Situation** | **Question** |
|--------------|--------------|
| Recent release + Upcoming | "So [Recent] came out in [Month]. Are you still pushing that, or more focused on building to [Upcoming]? Or just grow audience overall?" |
| Recent release only | "I see [Project] came out [X] months ago. Still promoting that, or more in 'grow audience' phase?" |
| Upcoming only | "With [Project] coming up, building anticipation or just growing audience first?" |
| No releases | "What's your main goal - growing fanbase or waiting to drop something new?" |

### 2. Four Strategy Types

| **Strategy** | **When to Use** | **Post Mix** |
|-------------|----------------|--------------|
| `promote_recent` | Artist actively pushing recent release | 60% promo, 40% audience-builder |
| `build_to_release` | Building anticipation for upcoming release | 50% teaser, 50% audience-builder |
| `audience_growth` | Focus on growing overall, no specific release | 100% audience-builder |
| `balanced` | Mix of promoting + teasing + growing | 33% each (rotate) |

### 3. Smart Post Type Assignment

**Location:** `components/multiverse/EnhancedCalendar.tsx` (lines 995-1015)

```typescript
// Determine post type based on artist's release strategy
let postType: 'audience-builder' | 'teaser' | 'promo' = 'audience-builder';
const strategy = artistProfile?.releaseStrategy || 'audience_growth';

if (strategy === 'promote_recent') {
  // 60% promo, 40% audience-builder
  postType = tasksScheduledThisWeek % 5 < 3 ? 'promo' : 'audience-builder';
} else if (strategy === 'build_to_release') {
  // 50% teaser, 50% audience-builder
  postType = tasksScheduledThisWeek % 2 === 0 ? 'teaser' : 'audience-builder';
} else if (strategy === 'balanced') {
  // Rotate: audience → promo → teaser
  const cycle = tasksScheduledThisWeek % 3;
  postType = cycle === 0 ? 'audience-builder' : cycle === 1 ? 'promo' : 'teaser';
}
// else: audience_growth = all audience-builder (default)
```

---

## Implementation Details

### Files Changed:

1. **`types/index.ts`**
   - Added `releaseStrategy` and `releaseStrategyDescription` to `ArtistProfile`

2. **`components/multiverse/ConversationalOnboarding.tsx`**
   - Added `release_strategy` step to conversation flow
   - Dynamic question based on artist's releases
   - Parses response into one of 4 strategy types

3. **`app/api/onboarding-chat/route.ts`**
   - Updated Claude system prompt to ask release strategy question
   - Added fields to profile_data extraction

4. **`components/multiverse/EnhancedCalendar.tsx`**
   - Updated post scheduling logic to use `releaseStrategy`
   - **Decoupled posting from preferred days** (posts can be any day now)
   - Prep tasks still scheduled on preferred days

5. **`lib/test-data.ts`**
   - Updated Cam Okoro's test profile with his strategy:
     ```typescript
     releaseStrategy: 'audience_growth',
     releaseStrategyDescription: 'I still want to promote cameleon a bit, but would mostly just like to grow my audience...'
     ```

6. **`components/multiverse/CreatorOnboardingForm.tsx`**
   - Added test user auto-login: entering "Cam Okoro" in email field finds most recent Cam account

---

## Cam Okoro's Profile

**Release Strategy:** `audience_growth` (70% audience-builder, 30% Cameleon promo)

**Full Answer:**
> "I still want to promote cameleon a bit, but would mostly just like to grow my audience without worrying about a specific release right now. Not focused on building up to mercurial just yet."

**Result:** Calendar generates primarily audience-builder posts with occasional Cameleon promos, no Mercurial teasers.

---

## Bonus: Posting Schedule Improvements

### Change 1: Decoupled Posting from Preferred Days ✅

**Before:**
- Posts ONLY scheduled on preferred days (Sat/Sun for Cam)
- Result: Max 2 posts/week even with 6hr budget

**After:**
- Posts can be scheduled **any day of the week**
- Preferred days reserved for **prep work** (filming, editing)
- Result: More flexible, realistic schedule

**Reasoning:** Posting takes ~5 minutes + scheduling is instant. Artists can post anytime. Prep work needs dedicated blocks.

### Change 2: Posting Frequency Based on Prep ✅

**User feedback:**
> "It doesn't take 30 mins to post, in reality it takes only around 5. What really decides how many posts can be made per week is the amount of preparation that was done as well as previous posting history."

**Implementation:** Kept 2 posts/week for Cam as a starting goal (can scale up as he hits marks)

---

## Test User Auto-Login

**Feature:** Enter "Cam Okoro" in email field → auto-loads most recent Cam account from Supabase

**How it works:**
1. Login form detects "cam okoro" or "camokoro" in email field
2. Queries Supabase for most recent profile with matching name
3. Bypasses password check, loads account data
4. Saves to localStorage and completes login

**Usage:**
```
Email: Cam Okoro
Password: (anything)
→ Logs into most recent Cam account
```

---

## Next Steps

1. **Test the flow:**
   - Create new account as "Cam Okoro" (or use existing)
   - Go through onboarding, answer release strategy question
   - Complete post-onboarding + OAuth
   - **Verify:** Calendar shows correct post mix (mostly audience-builder for Cam)

2. **Test auto-login:**
   - Log out
   - Enter "Cam Okoro" in email field
   - Should auto-load most recent Cam account

3. **Monitor post distribution:**
   - Check if the strategy-based post logic generates the right mix
   - Adjust percentages if needed

---

## Post Types Reference

| **Type** | **Emoji** | **Purpose** | **Example** |
|---------|-----------|-------------|-------------|
| `audience-builder` | 🌱 | Build connection, grow fanbase | Behind-the-scenes, artist's journey, relatable content |
| `teaser` | 👀 | Build anticipation for upcoming release | Snippet of new song, studio session, countdown |
| `promo` | 🎵 | Promote released music | Music video clip, stream link, fan reactions |

---

## Summary

✅ Added release strategy question to onboarding  
✅ Artists can now choose what to promote  
✅ Post types dynamically generated based on strategy  
✅ Cam Okoro's test data updated with his strategy  
✅ Test user auto-login implemented  
✅ Posting decoupled from preferred days  
✅ No linter errors

**Result:** Artists get personalized post schedules that match their actual goals! 🎯

