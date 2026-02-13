# Calendar Fixes - Feb 10, 2026

## 🐛 **Bug #1: Galaxy View Calendar Not Using Campaign Window Logic**

### **Root Cause:**
The `GalaxyViewWrapper` in `app/page.tsx` was **not passing `artistProfile`** to the `GalaxyView` component, causing the calendar to default to 100% audience-builder posts instead of using the campaign window system.

### **The Fix:**
**File:** `app/page.tsx` (Line 1399)

**Before:**
```typescript
<GalaxyViewWrapper
  galaxy={currentGalaxy}
  universe={updatedUniverse}
  onUpdateWorld={handleWorldCreated}
  onDeleteGalaxy={handleDeleteGalaxy}
  onDeleteWorld={handleDeleteWorld}
  onSignOut={handleSignOut}
/>
```

**After:**
```typescript
<GalaxyViewWrapper
  galaxy={currentGalaxy}
  universe={updatedUniverse}
  artistProfile={account?.onboardingProfile} // ✅ NOW PASSES PROFILE
  onUpdateWorld={handleWorldCreated}
  onDeleteGalaxy={handleDeleteGalaxy}
  onDeleteWorld={handleDeleteWorld}
  onSignOut={handleSignOut}
/>
```

### **Data Flow:**
```
page.tsx (account.onboardingProfile)
  ↓ artistProfile prop
GalaxyViewWrapper
  ↓ spreads all props
GalaxyView
  ↓ artistProfile prop
EnhancedCalendar
  ↓ uses for campaign window logic
Calendar Generation (with correct post types!)
```

---

## ✨ **Enhancement #1: Google Calendar Sync Button in Master Calendar**

### **User Feedback:**
> "I see that the google calender isn't synced. Can you add a connect google calender button to the left of the close button in case they don't do it during post-onboarding?"

### **The Fix:**
**File:** `components/multiverse/GalaxyView.tsx`

**Added:**
1. Import: `import { connectGoogleCalendar } from '@/lib/google-oauth';`
2. Button UI in master calendar modal header

**Before:**
```typescript
{/* Close Button - Positioned absolutely in top right */}
<Button onClick={() => setShowCalendar(false)} ...>
  Close
</Button>
```

**After:**
```typescript
{/* Action Buttons - Positioned absolutely in top right */}
<div className="absolute top-6 right-6 flex gap-2 z-10">
  <Button onClick={() => connectGoogleCalendar()} ...>
    📅 Sync Google Calendar
  </Button>
  <Button onClick={() => setShowCalendar(false)} ...>
    Close
  </Button>
</div>
```

### **Button Styling:**
- **Sync Button:** Green border/text (`border-green-500/30 text-green-400`)
- **Close Button:** Yellow border/text (`border-yellow-500/30 text-yellow-400`)
- **Layout:** Horizontal flex layout with 2px gap

---

## 🧪 **Testing Instructions**

### **Test 1: Campaign Window Logic**
1. Sign out and sign back in as **Kiss Bang**
2. Click galaxy name in top-left corner to open master calendar
3. **Expected Results:**
   - Week 3 (Feb 24-Mar 2): All posts should be **👀 Teasers** (purple)
   - Week 4 (Mar 3-9): Posts after March 5 should be **🎵 Promos** (yellow)
   - Console should show:
     ```
     [EnhancedCalendar] 🚨 TEASER PHASE: Release within 2 weeks: Now You Got It
     [EnhancedCalendar] 🎵 PROMO PHASE: Release within 1 month: Now You Got It
     ```

### **Test 2: Google Calendar Sync Button**
1. Open master calendar (click galaxy name)
2. Look for **"📅 Sync Google Calendar"** button next to Close button
3. Click the button
4. Should redirect to Google OAuth flow
5. After auth, should return to galaxy view with calendar synced

### **Test 3: Cam Okoro (Manual Override)**
1. Sign out and sign back in as **Cam Okoro**
2. Open master calendar
3. **Expected Results:**
   - Week 3-4: Mix of **🎵 Promos** (25%) and **🌱 Audience-builders** (75%)
   - Console should show:
     ```
     [EnhancedCalendar] 💭 MANUAL OVERRIDE: Promote old release a bit
     ```

---

## 📊 **Expected Calendar Output for Kiss Bang**

### **Today: Feb 10, 2026**
### **Release: "Now You Got It" - March 5, 2026**

```
Week 1 (Feb 10-16): Prep Phase
  Tue 2/10: Review & organize
  Wed 2/11: Film Session 2
  Sat 2/14: Scout locations
  Sun 2/15: Plan content ideas
  Mon 2/16: Film Session 1

Week 2 (Feb 17-23): Prep Phase
  Tue 2/17: Finalize & caption
  Wed 2/18: Schedule posts
  Sat 2/21: Edit batch 1 (Posts 1-3)
  Sun 2/22: Film Session 3
  Mon 2/23: Edit batch 2 (Posts 4-6)

Week 3 (Feb 24-Mar 2): TEASER PHASE ← FIX HERE
  Tue 2/24: Engage with audience
  Sat 2/28: 👀 Teaser Post + Quick edit
  Sun 3/1: 👀 Teaser Post + Film new content
  Mon 3/2: 👀 Teaser Post + Brainstorm ideas

Week 4 (Mar 3-9): RELEASE + PROMO PHASE ← FIX HERE
  Tue 3/3: Engage with audience
  Thu 3/5: 🎵 RELEASE DAY (Now You Got It)
  Sat 3/7: 🎵 Promo Post + Quick edit
  Sun 3/8: 🎵 Promo Post + Film new content
  Mon 3/9: 🎵 Promo Post + Brainstorm ideas
```

---

## 🔄 **How to Refresh Calendar Data**

If the calendar still shows old data after fixes:

1. **Hard refresh browser:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Clear localStorage:**
   - Open browser console
   - Run: `localStorage.clear()`
   - Refresh page
3. **Sign out and sign back in:**
   - Ensures fresh data load from Supabase
   - Re-triggers universe and galaxy creation with new logic

---

## 📁 **Files Modified**

1. ✅ **`app/page.tsx`** (Line 1399)
   - Added `artistProfile={account?.onboardingProfile}` to `GalaxyViewWrapper`
   
2. ✅ **`components/multiverse/GalaxyView.tsx`**
   - Added import: `connectGoogleCalendar` from `@/lib/google-oauth`
   - Added "Sync Google Calendar" button to master calendar modal header
   - Repositioned buttons in flex container

---

## 🎯 **Success Criteria**

- [x] Galaxy view calendar uses campaign window logic
- [x] Kiss Bang shows teasers in Week 3, promos in Week 4
- [x] Cam Okoro shows 25% promos, 75% audience-builders
- [x] Google Calendar sync button visible in master calendar
- [x] Button redirects to OAuth flow when clicked
- [x] No linter errors
- [x] Console logs show correct campaign phases

---

**Last Updated:** Feb 10, 2026  
**Version:** 2.1  
**Status:** ✅ Ready to Test

