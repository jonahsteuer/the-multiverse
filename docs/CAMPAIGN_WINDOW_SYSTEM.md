# Campaign Window System

## Overview
The Campaign Window System automatically schedules content based on **release timing windows**, ensuring all posts align with promotional campaigns.

---

## 🎯 Priority Logic

### **Priority 1: 🚨 TEASER PHASE (2 weeks before release)**
- **Trigger:** Release date is 1-14 days in the future
- **Content:** **100% Teaser posts** 👀
- **Purpose:** Build anticipation and excitement
- **Example:** Kiss Bang's "Now You Got It" drops March 5
  - Feb 19-Mar 4: All posts are teasers

### **Priority 2: 🎵 PROMO PHASE (1 month after release)**
- **Trigger:** Release date is 1-30 days in the past
- **Content:** **100% Promo posts** 🎵
- **Purpose:** Maximize reach and engagement for fresh release
- **Example:** Kiss Bang's "Now You Got It" drops March 5
  - Mar 6-Apr 4: All posts are promos

### **Priority 3: 💭 MANUAL OVERRIDE (Old releases)**
- **Trigger:** `releaseStrategyDescription` includes "promote [X] a bit"
- **Content:** **25% Promo + 75% Audience-builders**
- **Purpose:** Soft-promote old releases without dominating feed
- **Example:** Cam Okoro's "Cameleon" (released Sept 2024)
  - Strategy: "I still want to promote Cameleon a bit..."
  - Result: 1 Cameleon promo every 4 posts, rest are audience-builders

### **Priority 4: 🌱 DEFAULT (No active campaign)**
- **Trigger:** No releases within campaign windows
- **Content:** **100% Audience-builder posts**
- **Purpose:** Grow organic following and engagement
- **Example:** Artist with no upcoming/recent releases
  - All posts focus on audience growth content

---

## 🔄 Transition Rules

### **Multiple Releases Overlap:**
If Release A is in promo phase (post-release) and Release B is coming within 2 weeks:
- **Action:** Immediately switch to teasers for Release B
- **Logic:** Priority 1 (Teaser Phase) overrides Priority 2 (Promo Phase)

**Example Timeline:**
```
Mar 5:  Release "Now You Got It"
Mar 5-Apr 4: Promo phase for "Now You Got It"
Mar 18: Announce "Next Single" dropping April 1 (14 days out)
Mar 18-Mar 31: Switch to teasers for "Next Single" (overrides promo phase)
Apr 1: Release "Next Single"
Apr 2-May 1: Promo phase for "Next Single"
```

---

## 📊 Implementation Details

### **Date Calculations:**
```typescript
// TEASER PHASE: 2 weeks before
const daysUntilRelease = Math.floor((releaseDate - postDate) / (1000 * 60 * 60 * 24));
if (daysUntilRelease > 0 && daysUntilRelease <= 14) {
  postType = 'teaser';
}

// PROMO PHASE: 1 month after
const daysSinceRelease = Math.floor((postDate - releaseDate) / (1000 * 60 * 60 * 24));
if (daysSinceRelease > 0 && daysSinceRelease <= 30) {
  postType = 'promo';
}
```

### **Manual Override Detection:**
```typescript
const strategyDesc = releaseStrategyDescription.toLowerCase();
if (strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
  // 25% promo mix
  postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
}
```

---

## 🎨 Post Types

### 👀 **Teaser**
- Color: Purple (`bg-purple-500/30`)
- Icon: 👀
- Description: "Build hype for upcoming release"
- Examples:
  - Behind-the-scenes studio clips
  - Lyric snippets
  - Countdown posts
  - Artwork reveals

### 🎵 **Promo**
- Color: Yellow (`bg-yellow-500/30`)
- Icon: 🎵
- Description: "Promote your latest release"
- Examples:
  - "Out now" announcements
  - Streaming link shares
  - Performance videos
  - Fan reaction reposts

### 🌱 **Audience-builder**
- Color: Green (`bg-green-500/30`)
- Icon: 🌱
- Description: "Grow your audience organically"
- Examples:
  - Personal stories
  - Music production tips
  - Q&A content
  - Lifestyle/personality posts

---

## 🧪 Test Cases

### **Test Case 1: Kiss Bang (Build to Release)**
**Profile:**
- Release: "Now You Got It" - March 5, 2026
- Strategy: `build_to_release`
- Today: Feb 10, 2026

**Expected Calendar:**
- **Week 1-2 (Feb 10-23):** Prep tasks only
- **Week 3 (Feb 24-Mar 2):** 100% Teasers (within 2-week window)
- **Week 4 (Mar 3-9):** 
  - Mar 5: Release day
  - Mar 6-9: 100% Promos (within 1-month window)

### **Test Case 2: Cam Okoro (Audience Growth + Soft Promo)**
**Profile:**
- Past Release: "Cameleon" - Sept 2024 (5+ months ago)
- Upcoming Release: "Mercurial" - TBD
- Strategy: `audience_growth`
- Description: "promote Cameleon a bit, just grow audience"
- Today: Feb 10, 2026

**Expected Calendar:**
- **Week 1-2:** Prep tasks only
- **Week 3-4:** 25% Cameleon promos + 75% Audience-builders
  - Pattern: Post 1 = Promo, Posts 2-4 = Audience-builders, repeat

### **Test Case 3: Artist with No Releases**
**Profile:**
- No releases defined
- Strategy: `audience_growth`
- Today: Feb 10, 2026

**Expected Calendar:**
- **Week 1-2:** Prep tasks only
- **Week 3-4:** 100% Audience-builders

---

## 📁 Files Modified

1. **`components/multiverse/EnhancedCalendar.tsx`**
   - Lines 1013-1071: Campaign window logic implementation
   
2. **`components/multiverse/ScheduleWalkthrough.tsx`**
   - Lines 5-11: Added `releaseStrategyDescription` and `releases` props
   - Lines 75-145: Campaign window logic for post-onboarding demo
   
3. **`components/multiverse/PostOnboardingConversation.tsx`**
   - Lines 907-908: Pass new props to `ScheduleWalkthrough`

---

## 🚀 Future Enhancements

1. **Custom Campaign Windows:** Allow artists to customize teaser/promo durations
2. **Multi-Release Scheduling:** Better handling of album releases with multiple singles
3. **Platform-Specific Content:** Different post types for different platforms
4. **A/B Testing:** Track which post types perform best for each artist
5. **Automatic Reminders:** Notify artists when entering new campaign phases

---

**Last Updated:** Feb 10, 2026
**Version:** 2.0
**Authors:** Jonah Steuer, AI Assistant

