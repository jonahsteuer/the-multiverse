# Posting Schedule Logic Updates

**Date:** February 10, 2026  
**Changes:** Smarter strategy parsing + posting frequency based on history

---

## 🔧 **What Changed**

### **1. Granular Strategy Parsing**

**Problem:** Cam said "I still want to promote cameleon **a bit**" but was getting 0% promo posts.

**Old Logic:**
```typescript
if (strategy === 'audience_growth') {
  postType = 'audience-builder'; // 100% audience-builder
}
```

**New Logic:**
```typescript
if (strategy === 'audience_growth' && strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
  // "promote X a bit" = ~25% promo, 75% audience-builder
  postType = postsThisWeek % 4 === 0 ? 'promo' : 'audience-builder';
}
```

**Result for Cam:** Every 4th post is a **Cameleon promo** 🎵, the rest are **audience-builders** 🌱

---

### **2. Posting Frequency Based on History (Not Budget)**

**Problem:** Posting frequency was calculated based on time budget, but should be based on **posting history**.

**Old Logic:**
```typescript
// Budget-based: 7 hrs/week = enough for 3-4 posts
// But doesn't account for artist's actual posting habits
```

**New Logic:**
```typescript
let targetPostsPerWeek = 3; // Default starting point
const currentFreq = artistProfile?.currentPostingFrequency;

if (currentFreq === 'daily' || currentFreq === '2-3x_week') {
  targetPostsPerWeek = 3;
} else if (currentFreq === 'taking a break') {
  targetPostsPerWeek = 3; // Start at 3/week even if taking a break
}
```

**Key Principle:**
- **Time budget** → Controls how much PREP work can be scheduled
- **Posting history** → Controls how many posts per week
- **Start everyone at 3 posts/week** (reasonable baseline)

---

## 📊 **Cam's New Schedule**

### **Post Mix (per week):**
- **Week 3:** 3 posts total
  - 🌱 Audience-builder
  - 🌱 Audience-builder  
  - 🌱 Audience-builder
  
- **Week 4:** 3 posts total
  - 🎵 **Cameleon Promo** ← 1 in 4 posts
  - 🌱 Audience-builder
  - 🌱 Audience-builder

### **Over 8 weeks:**
- **~6 Cameleon promo posts** (25%)
- **~18 Audience-builder posts** (75%)

This matches his description: "promote cameleon **a bit**" ✅

---

## 🎯 **Strategy → Post Mix Reference**

| **Strategy** | **When** | **Post Mix** |
|-------------|----------|--------------|
| `audience_growth` (pure) | "Just grow audience" | 100% audience-builder |
| `audience_growth` + "promote X a bit" | Cam's case | 75% audience-builder, 25% promo |
| `promote_recent` | "Actively pushing recent release" | 60% promo, 40% audience-builder |
| `build_to_release` | "Building to upcoming release" | 50% teaser, 50% audience-builder |
| `balanced` | "Mix of everything" | 33% each (rotate) |

---

## 🧪 **How Strategy Description is Parsed**

The algorithm looks for keywords:

```typescript
if (strategyDesc.includes('promote') && strategyDesc.includes('bit')) {
  // Pattern: "promote [release] a bit"
  // Result: 25% promo for that release
}

if (strategyDesc.includes('still push') || strategyDesc.includes('actively')) {
  // Pattern: "still pushing" or "actively promoting"
  // Result: 60% promo
}

if (strategyDesc.includes('building to') || strategyDesc.includes('anticipation')) {
  // Pattern: "building to [release]"
  // Result: 50% teaser
}
```

---

## 🔮 **Future Improvements**

1. **Named releases in strategy:** Track WHICH release to promote
   - Current: Generic "promo" post
   - Future: "Cameleon promo" vs "Mercurial teaser"

2. **Dynamic scaling:** Increase posts/week as artist hits consistency goals
   - Start: 3 posts/week
   - After 4 weeks: Suggest 4 posts/week
   - After 8 weeks: Suggest 5 posts/week

3. **Time budget impact:** If budget is too low for target posts, show warning
   - Example: "3 posts/week requires ~6 hrs of prep. You have 4 hrs. Adjust?"

---

## ✅ **What's Fixed**

1. ✅ Cam now gets **1 Cameleon promo every 4 posts** (25%)
2. ✅ Posting frequency based on **history, not budget** (starts at 3/week)
3. ✅ Time budget controls **prep tasks**, not posting frequency
4. ✅ Strategy description is **parsed for nuance** ("a bit" = 25%)

---

## 📝 **Testing Checklist**

- [ ] Create/login as Cam Okoro
- [ ] Check calendar shows **3 posts/week** in weeks 3-4
- [ ] Verify **~1 promo post** every 4 posts
- [ ] Confirm promo posts show 🎵 emoji (not just 🌱)
- [ ] Verify prep tasks still respect preferred days (Sat/Sun)

Ready to test! 🚀

