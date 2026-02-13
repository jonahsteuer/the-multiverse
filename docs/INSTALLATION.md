# Installation Guide

Complete setup instructions for getting the Artist Content Platform running locally.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18+** installed
  - Check: `node --version`
  - Download: https://nodejs.org/
  
- ✅ **npm** (comes with Node.js)
  - Check: `npm --version`

- ✅ **Git** (for cloning the repository)
  - Check: `git --version`

- ✅ **Claude API Key**
  - Get from: https://console.anthropic.com/ → Settings → API Keys
  - You'll need this to generate content

## Step-by-Step Installation

### Step 1: Clone or Navigate to the Repository

If you're cloning:
```bash
git clone https://github.com/nwdavesteuer/comeup_nextjs.git
cd comeup_nextjs
```

If you already have the repo:
```bash
cd /path/to/comeup_nextjs
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`. This may take a few minutes.

**Expected output:**
- You should see packages being installed
- No errors (warnings are okay)
- A `node_modules/` directory will be created
- A `package-lock.json` file will be created

**If you get errors:**
- Make sure Node.js 18+ is installed
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again
- Check that you have internet connection

### Step 3: Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
# Option 1: Copy the example file (if it exists)
cp .env.local.example .env.local

# Option 2: Create it manually
touch .env.local
```

Edit `.env.local` and add your Claude API key:

```bash
# Claude AI API Key (REQUIRED)
ANTHROPIC_API_KEY=your_claude_api_key_here

# Supabase (optional for MVP - leave empty for now)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:**
- Replace `your_claude_api_key_here` with your actual API key
- The `.env.local` file is in `.gitignore` - it won't be committed to git
- Never share your API key publicly

### Step 4: Verify Installation

Check that everything is set up correctly:

```bash
# Check Node version
node --version  # Should be 18 or higher

# Check npm version
npm --version

# Check that dependencies are installed
ls node_modules | head -5  # Should show directories like @anthropic-ai, next, react
```

### Step 5: Start the Development Server

```bash
npm run dev
```

**Expected output:**
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

### Step 6: Open the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You should see:
- The "Artist Content Platform" homepage
- An onboarding form

## Testing the Application

### Test the Complete Flow

1. **Fill out the onboarding form:**
   - Artist Name: "Test Artist"
   - Single Title: "Test Single"
   - Release Date: (pick a future date)
   - Genre: (select from dropdown)
   - Vibe/Tone: "energetic and upbeat"
   - Target Audience: (optional)

2. **Submit the form:**
   - Click "Generate Content Calendar"
   - You should see a loading state
   - Wait for content generation (may take 10-30 seconds)

3. **View results:**
   - You should see 15-20 generated posts
   - Posts grouped by week (Week -2 through Week +2)
   - Each post shows platform, content type, timing, and caption

4. **Test features:**
   - Click "Copy" on any post to copy the caption
   - Click "Download JSON" to download all posts as JSON
   - Click "Download CSV" to download as CSV
   - Click "Generate Another" to start over


## Troubleshooting

### "Module not found" errors

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "ANTHROPIC_API_KEY is not configured" error

- Make sure `.env.local` exists in the project root
- Check that `ANTHROPIC_API_KEY` is set in `.env.local`
- Restart the dev server after creating/editing `.env.local`

### Port 3000 already in use

```bash
# Option 1: Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use a different port
PORT=3001 npm run dev
```

### TypeScript errors

```bash
# Restart TypeScript server in your IDE
# VS Code/Cursor: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Build errors

```bash
# Test the build locally
npm run build

# If it fails, check the error messages
# Common issues: missing dependencies, TypeScript errors
```

## Next Steps

Once everything is working:

1. **Test with real artist data** - Try generating content for an actual upcoming release
2. **Review generated content** - Check if the posts match the artist's voice
3. **Iterate on prompts** - Adjust prompts in `lib/claude.ts` based on results
4. **Improve UI/UX** - Make adjustments based on your testing

## Getting Help

If you encounter issues:

1. Check the error message in the terminal
2. Review the [Troubleshooting](#troubleshooting) section above
3. Check that all prerequisites are met
4. Verify your API key is correct and has credits

## Production Deployment

When ready to deploy:

1. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

2. **Add environment variables in Vercel:**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add `ANTHROPIC_API_KEY` with your API key
   - Redeploy

See [docs/DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

