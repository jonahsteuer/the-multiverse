# Artist Content Platform

AI-powered content generation for music artists. Generate 15-20 promotional social media posts tailored to your release cycle.

## Quick Start

**For complete setup instructions, see [docs/INSTALLATION.md](./docs/INSTALLATION.md)**

### Quick Setup (3 Steps)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Create .env.local file
   touch .env.local
   
   # Add your Claude API key (get from https://console.anthropic.com/)
   # Edit .env.local and add:
   ANTHROPIC_API_KEY=your_api_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

That's it! You're ready to generate content calendars.

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn UI
- **AI:** Claude API (Anthropic)
- **Database:** Supabase (optional for MVP)
- **Deployment:** Vercel

## Project Structure

```
comeup_nextjs/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── artist/           # Artist-specific components
│   ├── shared/           # Shared components
│   └── ui/               # Shadcn UI components
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
├── docs/                  # Documentation
└── public/                # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Run production build locally
- `npm run lint` - Run ESLint

## Documentation

All documentation is in the `docs/` folder:

- **[Quick Setup](./docs/JONAH_SETUP.md)** - Quick reference for getting started
- **[Installation Guide](./docs/INSTALLATION.md)** - Complete setup instructions
- **[Documentation Index](./docs/README.md)** - Full documentation overview
- [Product Specification](./docs/comeup_spec_revised.md) - Product spec and roadmap
- [Project Status](./docs/PROJECT_STATUS.md) - Current project status
- [Migration Notes](./docs/MIGRATION_NOTES.md) - Migration from FastAPI

## License

Private project - All rights reserved
