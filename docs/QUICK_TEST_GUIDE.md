# Quick Test Guide - The Multiverse

**Last Updated:** January 8, 2026

---

## 🚀 Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
cd /Users/jonahsteuer/Documents/GitHub/comeup_nextjs
npm install
```

This will install all packages including the new Three.js dependencies.

### Step 2: Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
touch .env.local
```

Add your Claude API key (required for snapshot generation):

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

**Note:** You can test without the API key, but snapshot generation won't work.

### Step 3: Start the Dev Server

```bash
npm run dev
```

You should see:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

### Step 4: Open in Browser

Navigate to:
```
http://localhost:3000
```

---

## 🧪 Testing the Complete Flow

### 1. **Onboarding (Account Creation)**

You'll see:
- Black background with yellow "The Multiverse" title
- Star Wars-style form (Orbitron font)

**Fill out:**
- Creator Name: `Leon Tax` (or any name)
- Email: `test@example.com`
- Creator Encryption (Password): `password123`
- Creator Type: Select `Artist`
- (Optional) Check Spotify/Instagram links

**Click:** "Enter The Multiverse"

**Expected:** Form submits, creates universe named "The Leon Taxverse" (or your name)

---

### 2. **Empty Universe View**

You'll see:
- Black 3D space with stars
- Universe title at top: "The [Your Name]verse"
- 3D canvas with navigation controls

**Interact:**
- **Pan:** Click and drag
- **Zoom:** Scroll wheel
- **Rotate:** Right-click and drag (or two-finger drag on trackpad)

**Hover over empty space:**
- You should see a "+" symbol appear
- Text: "create a galaxy"

**Click the "+" symbol**

**Expected:** Galaxy creation form appears

---

### 3. **Create Your First Galaxy**

**Fill out the form:**

- **Galaxy Name:** `My First Album`
- **Number of Worlds:** `3` (or any number 1-20)
- **Visual Landscape:**
  - Click on some images (they'll show a checkmark)
  - Images are mock Pinterest images (Unsplash placeholders)
  - As you select, similar images appear
- **Color Palette:**
  - Click on colors you like
  - Selected colors will have a yellow ring
- **Galaxy Release Date:** Pick a future date (e.g., `2024-07-20`)

**Click:** "Create Galaxy"

**Expected:** 
- Loading screen appears: "Building out your galaxy..."
- After 2 seconds, galaxy view appears

---

### 4. **Galaxy View (3D)**

You'll see:
- **3D Scene:**
  - Glowing yellow sun in center (rotating)
  - Worlds orbiting around the sun
  - Stars background
  - Galaxy title at top
  - Countdown timer (if release date is in future)

**Interact:**
- **Pan/Zoom/Rotate:** Same controls as before
- **Click a world:** Opens world creation form
- **Hover over world:** World scales up

**Note:** Worlds start greyed out (transparent) until you build them

**Click:** "+ Create World" button at bottom

---

### 5. **Create Your First World**

**Fill out the form:**

- **World Name (Song Title):** `Will I Find You`
- **World Color:**
  - Click on a color from the palette
  - Selected color will have a yellow ring
- **Visual References:**
  - Select images (or use galaxy defaults)
- **World Release Date:** Pick a date (e.g., `2024-06-08`)
  - Can be different from galaxy release date (indicates it's a single)

**Click:** "Build Snapshot Schedule with AI"

**Expected:**
- Button shows "Generating Snapshots..."
- After a few seconds, snapshot strategy appears

---

### 6. **Snapshot Strategy View**

You'll see:
- List of snapshots with:
  - Visual descriptions (imagery-rich)
  - Platform (Instagram, TikTok, Twitter)
  - Content type (Reel, Story, etc.)
  - Suggested filming date
  - Timing (day + time)
  - Optional captions

**Review the snapshots**

**Click:** "Complete World"

**Expected:**
- World is created
- Returns to galaxy view
- New world appears orbiting the sun (in its color)
- World is no longer greyed out

---

### 7. **Explore Your Galaxy**

**In the galaxy view:**

- **See your world:**
  - Orbiting around the sun
  - Spinning on its axis
  - In its selected color
  - With its name visible

- **Create more worlds:**
  - Click "+ Create World" again
  - Repeat the process

- **3D Navigation:**
  - Pan around to see different angles
  - Zoom in/out
  - Watch worlds orbit

---

## 🎨 Visual Features to Test

### 3D Navigation
- ✅ Pan (drag)
- ✅ Zoom (scroll)
- ✅ Rotate (right-click drag)
- ✅ Smooth camera movement

### Visual Effects
- ✅ Glowing sun (rotating)
- ✅ Orbiting worlds
- ✅ Spinning worlds
- ✅ Stars background
- ✅ Hover effects (worlds scale up)
- ✅ Color-coded worlds
- ✅ Greyed out worlds (transparent)

### UI Elements
- ✅ Star Wars font (Orbitron)
- ✅ Yellow/black color scheme
- ✅ Form modals
- ✅ Loading screens
- ✅ Countdown timers

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Three.js not loading

```bash
# Make sure Three.js packages are installed
npm list three @react-three/fiber @react-three/drei
```

### API errors (snapshot generation)

- Check that `ANTHROPIC_API_KEY` is set in `.env.local`
- Restart dev server after adding API key
- Check API key has credits

### 3D scene not rendering

- Check browser console for errors
- Try a different browser (Chrome/Firefox recommended)
- Make sure WebGL is enabled

### Forms not submitting

- Check browser console for validation errors
- Make sure all required fields are filled
- Check network tab for API errors

---

## 📝 What to Test

### ✅ Core Flow
- [ ] Onboarding form works
- [ ] Empty universe appears
- [ ] Can create galaxy
- [ ] Galaxy view shows in 3D
- [ ] Can create world
- [ ] Snapshot generation works
- [ ] World appears in galaxy

### ✅ 3D Navigation
- [ ] Can pan around
- [ ] Can zoom in/out
- [ ] Can rotate view
- [ ] Worlds orbit smoothly
- [ ] Worlds spin on axis

### ✅ Visual Features
- [ ] Sun glows and rotates
- [ ] Worlds have correct colors
- [ ] Greyed out worlds are transparent
- [ ] Hover effects work
- [ ] Stars background visible

### ✅ Forms
- [ ] All forms validate correctly
- [ ] Image selection works
- [ ] Color selection works
- [ ] Date pickers work
- [ ] Submit buttons work

---

## 🎯 Expected Behavior

### Onboarding → Empty Universe
- Form submits → Universe created → 3D empty space appears

### Empty Universe → Galaxy Creation
- Hover shows "+" → Click → Form appears → Submit → Loading → Galaxy view

### Galaxy View → World Creation
- Click world or "+ Create World" → Form appears → Fill out → Generate snapshots → Complete → World appears

### World in Galaxy
- World orbits around sun
- World spins on axis
- World is color-coded
- World name visible
- Can click to edit

---

## 💡 Tips

1. **Start Simple:** Create 1 galaxy with 1 world first
2. **Test Navigation:** Spend time exploring the 3D space
3. **Try Different Colors:** See how worlds look with different colors
4. **Test Snapshot Generation:** Make sure AI is generating good descriptions
5. **Check Mobile:** Test on mobile device if possible (may need adjustments)

---

## 🚨 Known Issues

- **No Data Persistence:** Refresh loses all data (expected - no database yet)
- **Mock Pinterest Images:** Using Unsplash placeholders (expected)
- **Text Rendering:** Some 3D text may not render perfectly (drei Text component)
- **Performance:** May be slow with many worlds (optimization needed)

---

**Ready to test!** 🎉

If you encounter any issues, check the browser console for errors and let me know what you see.


