# Setup Instructions for Jonah

**Quick reference guide to get the project running locally.**

## Prerequisites

- ✅ Node.js 18+ installed (`node --version`)
- ✅ npm (comes with Node.js)
- ✅ Claude API key (get from https://console.anthropic.com/)

## Setup Steps

### 1. Navigate to Project

```bash
cd /Users/davidsteuer/Documents/GitHub/comeup_nextjs
```

### 2. Install Dependencies

```bash
npm install
```

This installs all packages. Takes 1-2 minutes.

### 3. Create Environment File

```bash
# Create .env.local
touch .env.local
```

Then edit `.env.local` and add:

```bash
ANTHROPIC_API_KEY=your_claude_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get your API key:** https://console.anthropic.com/ → Settings → API Keys

### 4. Start the Server

```bash
npm run dev
```

### 5. Open in Browser

```
http://localhost:3000
```

## What You'll See

1. **Homepage** with onboarding form
2. Fill out the form with your release details
3. Generate content calendar
4. View results with copy/download options

## If Something Doesn't Work

1. **Check Node version:** `node --version` (should be 18+)
2. **Reinstall dependencies:** `rm -rf node_modules package-lock.json && npm install`
3. **Check API key:** Make sure `.env.local` has your Claude API key
4. **Restart server:** Stop (Ctrl+C) and run `npm run dev` again

## That's It!

Once `npm run dev` is running and you can see the homepage, you're all set. The app is ready to generate content calendars!

For more details, see [INSTALLATION.md](./INSTALLATION.md)

