# Phase 2: New MVP — App Shell & Foundation — Research

**Researched:** 2026-04-04
**Domain:** Next.js 15 (App Router), React Three Fiber, Supabase SSR, shadcn/ui, 21st.dev, Stitch MCP, API porting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create a new standalone repo: `the-multiverse-v2`. Do not branch the existing repo.
- **D-02:** Deploy target: `themultiverse2.vercel.app` (new Vercel project).
- **D-03:** Same Supabase DB as the current app — no migration needed. Artist data (instagramOAuth, instagramAnalytics, onboarding_profile) is already stored per-user.
- **D-04:** Same core stack: Next.js 15 (App Router), TypeScript, Tailwind CSS.
- **D-05:** The MVP is single-artist focused. One user = one artist (themselves). The app IS their personal dashboard. No roster/manager concept in Phase 2.
- **D-06:** Architecture should be structurally expandable to multi-artist in future (keep userId patterns, don't hardcode single-user assumptions), but Phase 2 UI does not expose multi-artist management.
- **D-07:** Keep the galaxy visual as the core aesthetic and primary screen. The planet/world spinning around the sun remains the central metaphor.
- **D-08:** Posts as stars is an approved concept — explore this in design. ER as star brightness, post frequency as star density, best-performing post as brightest star/closest to sun. Design exploration in Stitch — not a fixed requirement.
- **D-09:** The galaxy view is ambient and aesthetic-first, not just navigation. In single-artist mode, it's the home screen atmosphere.
- **D-10:** Auth-first. User signs up via Supabase auth, then connects Instagram (handle entry → OAuth), then scrape runs. No anonymous preview mode.
- **D-11:** Minimum path: Sign up → Enter Instagram handle → Connect Instagram (OAuth) → Scrape → Talk to Mark. No steps beyond what's necessary.
- **D-12:** Edit Feedback and Simulate Posts are one combined feature. Name: "Edit Feedback" or similar — no "Simulate" branding.
- **D-13:** Input: artist pastes an Instagram URL or uploads a video. Both options supported.
- **D-14:** Output style: conversational. Mark gives notes like a director — not a score/meter UI.
- **D-15:** CRITICAL CONSTRAINT — Improvement recommendations must be achievable with footage the artist already has. No reshoots. Focus on: cuts, pacing, hook (first 1.5s), caption, audio choice, text overlays.
- **D-16:** If artist used Snapshot Starter, Mark has context on what footage was intended/captured.
- **D-17:** The "simulation" element: data-anchored improvement projection, not a generic score.
- **D-18:** Design precedes code. Use Stitch MCP to generate screen mockups before writing any component code.
- **D-19:** Design tools: Stitch MCP (mockups), UI UX Pro Max Claude skill (design intelligence during build), 21st.dev component library (3D and reactive components), Nano Banana 2 (motion/animation).
- **D-20:** Stitch MCP is configured in Claude Code (`~/.claude/settings.json`) with API key. Restart Claude Code to activate.
- **D-21:** Create a DESIGN.md file in the new repo to define design system rules so all Stitch screens are consistent.
- **D-22:** Port these routes/files directly from current app (minimal changes needed):
  - `lib/mark/` — universal-truths.md, stafford-knowledge.ts, live-intelligence.md (T1a, T1b, T2)
  - `app/api/mark/route.ts` — Mark chat (with Tier 3 context assembly)
  - `app/api/mark/artist-analytics/scrape/route.ts` — full enriched scrape pipeline
  - `app/api/auth/instagram/route.ts` + `callback/route.ts` — OAuth routes
  - `app/api/mark/train/edit-feedback/route.ts` — Edit Feedback core
  - `app/api/generate-snapshots/route.ts` + `generate-snapshot-ideas/route.ts` — Snapshot Starter API
  - Supabase client patterns (no module-level instantiation)
- **D-23:** Do NOT port: any UI components, WorldDetailView, ArtistAnalyticsPanel, SnapshotStarter components, SnapshotCalendar, SnapshotTimeline, any old layout/shell components. Full UI rebuild.
- **D-22a:** Snapshot Starter: reference-URL first approach. Artists paste URLs of content they love as visual/style references. Mark analyzes them then generates shoot/content ideas.
- **D-22b:** References come FIRST — before generating any content plan.
- **D-22c:** Key differentiator: references define vision, artist's real data defines what will actually work.
- **D-22d:** Edit Feedback "always watching" direction — feel like ongoing relationship, not a one-time tool.
- **D-22e:** In Phase 2, Edit Feedback is manually triggered (paste URL or upload video). UX language should feel like ongoing relationship.

### Claude's Discretion
- App router structure, file organization, component naming conventions
- Whether to use server components vs client components for specific pages
- Exact 21st.dev components to use for the galaxy view
- DESIGN.md initial content and structure
- How to handle the Supabase client in the new repo (follow same non-negotiable: no module-level instantiation)

### Deferred Ideas (OUT OF SCOPE)
- Multi-artist roster management — Future phase. Architecture is expandable but UI is single-artist for MVP.
- Snapshot Starter + Tier 3 wiring — Phase 3. Port Snapshot Starter in Phase 2, wire analytics into idea generation in Phase 3.
- Additional Graph API signals (ig_reels_avg_watch_time, follows per post, follower demographics) — Phase 3 or later.
- Shoot plan as separate feature — Replaced by Snapshot Starter.
- Google Calendar sync — Decide in Phase 4 whether to port it.
</user_constraints>

---

## Summary

Phase 2 creates a net-new repo (`the-multiverse-v2`) that is the Multiverse MVP. The work has two distinct tracks running in sequence: (1) design-first via Stitch MCP — generating screen mockups before any component code is written — and (2) implementation, which has two sub-tracks: porting the mature API layer from the current app and building the new UI from scratch using the approved design system (Celestial Interface / Orbital Drift, already specified in `02-UI-SPEC.md`).

The API layer port is well-understood with minimal risk — the existing routes are battle-tested and the patterns are locked. The main complexity is in the UI build: integrating 21st.dev components for the 3D galaxy view, wiring up Supabase auth with SSR patterns in a fresh Next.js 15 repo, and implementing the Celestial Interface design system (dark-mode-only, glassmorphism surfaces, Space Grotesk + Manrope typography, cream-gold accent).

One important clarification emerged from research: "Nano Banana 2" referenced in the UI-SPEC is Google's Imagen 3 Fast AI image generation tool used as a Claude Code skill for generating visual assets and animation frames — it is NOT a JavaScript/npm animation library. CSS animations and the `motion` package (Framer Motion, v12.38.0) should be used for the code-side animation contracts defined in the UI-SPEC.

**Primary recommendation:** Bootstrap the repo with `create-next-app@latest`, install shadcn/ui (new-york, slate, CSS variables), override CSS variables with the Celestial Interface token set from `02-UI-SPEC.md`, then port API routes before building any UI. Three.js/R3F must use `dynamic` import with `ssr: false` — the same pattern already proven in the current app's `Galaxy3DView.tsx`.

---

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists in the project root. Constraints are drawn from `PROJECT.md` non-negotiables and `02-CONTEXT.md` locked decisions:

1. **No module-level Supabase client instantiation** — instantiate inside route handlers / server functions only. The current `lib/supabase.ts` uses a Proxy pattern; the new repo must use `@supabase/ssr` with per-request server clients instead.
2. **Use `videoPlayCount` for plays, not `videoViewCount`** — already correct in the scrape route being ported.
3. **Tier 3 context is assembled as a single string** stored in `onboarding_profile.instagramAnalytics.tier3Context` — Mark's chat route reads this on every message.
4. **Vercel Pro tier** — `maxDuration: 300` for the scrape and edit-feedback routes.
5. **Dark-mode only** — no light mode variant. `02-UI-SPEC.md` is authoritative.
6. **TypeScript errors are checked post-edit** via a PostToolUse hook — keep types clean.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.2 (create-next-app) | Framework, routing, API routes | Locked decision D-04 |
| react / react-dom | 19.x | UI runtime | Locked with Next.js 15 |
| typescript | 5.x | Type safety | Locked decision D-04 |
| tailwindcss | 4.x | Utility CSS | Locked decision D-04 |
| @supabase/supabase-js | 2.101.1 | DB + auth client | Locked decision D-03 |
| @supabase/ssr | 0.10.0 | SSR-safe Supabase auth for Next.js App Router | Required for server components |
| @anthropic-ai/sdk | ^0.32.x | Claude API for Mark + Edit Feedback | Same as current app |
| openai | ^6.x | Whisper transcription in Edit Feedback route | Same as current app |
| apify-client | ^2.22.x | Instagram scraping | Same as current app |
| ffmpeg-static | ^5.3.0 | Bundled ffmpeg binary for frame extraction | No system dep — same as current app |

### UI / Design System
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn (CLI) | 4.1.2 | Component scaffolding (Button, Input, Card, Dialog, etc.) | Radix primitive layer — all interactive components |
| lucide-react | latest | Icons | All icon-only and icon+label buttons |
| @react-three/fiber | 9.5.0 | React renderer for Three.js — galaxy view | Galaxy/planet/stars 3D scene |
| @react-three/drei | 10.7.7 | R3F helpers (Stars, OrbitControls, Text) | Galaxy background stars, orbit controls |
| three | 0.183.2 | 3D engine | Via R3F — never directly imported in server components |
| motion | 12.38.0 | CSS + JS animations for screen transitions, card entry, loading states | All UI animation contracts from UI-SPEC |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2.x | Conditional className | Everywhere shadcn uses it |
| tailwind-merge | ^2.x | Merge Tailwind class conflicts | Required alongside shadcn |
| class-variance-authority | ^0.7.x | Variant components | shadcn variant system |
| zod | ^3.x | Input validation | API route request bodies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion (Framer Motion) | GSAP | Motion has first-class React/RSC support, `prefers-reduced-motion` built-in. GSAP is more powerful but heavier and requires imperative code. Motion is correct for the animation contracts in UI-SPEC. |
| @react-three/fiber | Three.js directly | R3F is the declarative React-native approach — proven in current app's Galaxy3DView.tsx. |
| @supabase/ssr | Custom Proxy pattern (current app) | @supabase/ssr is Supabase's official pattern for Next.js App Router — createServerClient per request. The current app's Proxy workaround should NOT be ported to the new repo. |

**Installation:**
```bash
# Bootstrap
npx create-next-app@latest the-multiverse-v2 --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# shadcn
npx shadcn@latest init  # choose new-york, slate, CSS variables

# 3D / Galaxy
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three

# Animation
npm install motion

# API layer dependencies
npm install @anthropic-ai/sdk openai apify-client ffmpeg-static zod

# Utils
npm install clsx tailwind-merge class-variance-authority lucide-react
```

**Version verification (confirmed 2026-04-04):**
- `next`: 16.2.2 (via `create-next-app`)
- `@supabase/supabase-js`: 2.101.1
- `@supabase/ssr`: 0.10.0
- `@react-three/fiber`: 9.5.0
- `@react-three/drei`: 10.7.7
- `three`: 0.183.2
- `motion` (Framer Motion): 12.38.0
- `shadcn` CLI: 4.1.2

---

## Architecture Patterns

### Recommended Project Structure
```
the-multiverse-v2/
├── app/
│   ├── layout.tsx              # Root layout — fonts (next/font/google), globals.css
│   ├── page.tsx                # Home screen (Galaxy view) — client component
│   ├── onboarding/
│   │   └── page.tsx            # 3-step onboarding flow
│   ├── mark/
│   │   └── page.tsx            # Mark Chat screen
│   ├── edit-feedback/
│   │   └── page.tsx            # Edit Feedback screen
│   ├── snapshot-starter/
│   │   └── page.tsx            # Snapshot Starter screen
│   └── api/
│       ├── auth/
│       │   └── instagram/
│       │       ├── route.ts    # OAuth authorize (ported)
│       │       └── callback/
│       │           └── route.ts # OAuth callback (ported)
│       ├── mark/
│       │   ├── route.ts        # Mark chat (ported + Edit Feedback Tier 3 enhancement)
│       │   └── artist-analytics/
│       │       └── scrape/
│       │           └── route.ts # Enriched scrape pipeline (ported)
│       ├── generate-snapshots/
│       │   └── route.ts        # Snapshot Starter generation (ported)
│       └── generate-snapshot-ideas/
│           └── route.ts        # Snapshot Starter ideas (ported)
├── components/
│   ├── galaxy/
│   │   ├── GalaxyScene.tsx     # R3F Canvas — 'use client', dynamic import wrapper
│   │   ├── Planet.tsx          # Central planet sphere + rotation
│   │   ├── PostStars.tsx       # Posts as stars (ER = brightness)
│   │   └── GalaxyBackground.tsx # Deep void + ambient glow
│   ├── onboarding/
│   │   ├── StepSignUp.tsx
│   │   ├── StepInstagramConnect.tsx
│   │   └── StepScrapeLoading.tsx
│   ├── mark/
│   │   ├── MarkChatPanel.tsx
│   │   └── MarkMessage.tsx
│   ├── edit-feedback/
│   │   └── EditFeedbackPanel.tsx
│   ├── snapshot-starter/
│   │   └── SnapshotStarterPanel.tsx
│   └── ui/                     # shadcn components (auto-generated)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # createBrowserClient (client components)
│   │   └── server.ts           # createServerClient (server components, route handlers)
│   ├── mark/
│   │   ├── universal-truths.md  # T1a (ported)
│   │   ├── live-intelligence.md # T2 (ported)
│   │   └── intelligence-loader.ts # (ported)
│   ├── stafford-knowledge.ts   # T1b (ported)
│   └── utils.ts                # clsx + tailwind-merge cn() utility
├── types/
│   └── index.ts                # Shared types (UserProfile, InstagramAnalytics, etc.)
├── DESIGN.md                   # Design system doc (colors, fonts, component style)
├── next.config.ts              # outputFileTracingIncludes for lib/mark/**, serverExternalPackages for three
└── middleware.ts               # Supabase auth session refresh middleware
```

### Pattern 1: Three.js / R3F with Dynamic Imports (Critical)
**What:** Three.js cannot run in Next.js server-side — must be dynamically imported with `ssr: false`.
**When to use:** Every component that imports from `three`, `@react-three/fiber`, or `@react-three/drei`.
**Example:**
```typescript
// app/page.tsx — Galaxy home screen
'use client';
import dynamic from 'next/dynamic';

const GalaxyScene = dynamic(
  () => import('@/components/galaxy/GalaxyScene'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-screen bg-[#11131a]">
        <span className="text-[#8892a0] font-manrope text-xs uppercase tracking-[0.08em]">
          Loading galaxy...
        </span>
      </div>
    ),
  }
);
```
Also add to `next.config.ts`:
```typescript
serverExternalPackages: ['three', '@react-three/fiber', '@react-three/drei'],
```
And in the webpack config:
```typescript
if (isServer) {
  config.externals.push('three', '@react-three/fiber', '@react-three/drei');
}
```
**Source:** Proven pattern in current app's `GalaxyViewWrapper.tsx` + `Galaxy3DView.tsx`.

### Pattern 2: Supabase SSR — Per-Request Server Clients (Non-Negotiable)
**What:** Use `@supabase/ssr` with `createServerClient` inside route handlers and server components. Never a module-level singleton.
**When to use:** Any server component, API route, or middleware touching Supabase.
**Example:**
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// In route handlers — same pattern:
// const supabase = createClient(supabaseUrl, serviceKey); // for service role
// const supabase = await createClient(); // for user session
```
**Source:** Supabase official docs — https://supabase.com/docs/guides/auth/server-side/nextjs

### Pattern 3: CSS Variable Override for Celestial Interface Tokens
**What:** After `npx shadcn@latest init`, override the generated CSS variables in `globals.css` with the Celestial Interface token set defined in `02-UI-SPEC.md`.
**When to use:** Wave 0 — must be done before any component is built.
**Example (from UI-SPEC):**
```css
/* app/globals.css */
:root {
  --background: 228 22% 8%;         /* #11131a */
  --foreground: 41 33% 91%;          /* #f0ece0 */
  --card: 228 20% 12%;               /* #1a1d26 */
  --primary: 41 57% 78%;             /* #E8D5A3 cream-gold */
  --primary-foreground: 228 22% 8%;  /* #11131a — high contrast on gold */
  --secondary: 207 20% 27%;          /* #374956 */
  --muted: 228 8% 21%;               /* #33353c */
  --accent: 41 57% 78%;              /* #E8D5A3 */
  --destructive: 0 84% 60%;          /* #ef4444 */
  /* Mark purple */
  --mark-purple: 258 65% 71%;        /* #9b7fe8 */
}
```

### Pattern 4: Motion (Framer Motion) for UI Animations
**What:** Use `motion` package (v12, React-first) for all animation contracts from `02-UI-SPEC.md`.
**When to use:** Screen transitions, card entry, loading states, planet rotation CSS fallback, star twinkle.
**Example:**
```typescript
// Glass card entry — 180ms ease-out scale from 0.97
import { motion } from 'motion/react';

<motion.div
  initial={{ opacity: 0, scale: 0.97 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.18, ease: 'easeOut' }}
  className="glass-card"
>
  {children}
</motion.div>
```
Reduced motion must be respected:
```typescript
import { useReducedMotion } from 'motion/react';
const shouldReduce = useReducedMotion();
// If shouldReduce, use opacity-only transition, no scale/translate
```

### Pattern 5: Edit Feedback — Tier 3 Context Wiring (Enhancement)
**What:** The ported Edit Feedback route must be enhanced to inject the artist's `tier3Context` into the Mark prompt — this is the key "simulate" improvement not in the current app.
**When to use:** When assembling the system prompt in the edit-feedback route.
```typescript
// Load tier3Context alongside RUFF_MUSIC_KNOWLEDGE
const tier3Context = await loadTier3Context(userId);
const systemPrompt = buildEditFeedbackPrompt({
  ruffKnowledge: RUFF_MUSIC_KNOWLEDGE,
  tier3Context,  // NOW added — data-anchored critique
});
```

### Pattern 6: outputFileTracingIncludes for Markdown Files
**What:** Next.js/Vercel does not bundle `.md` files by default. The intelligence loader reads them at runtime via `fs.readFileSync`.
**When to use:** Required in `next.config.ts` for any API route that reads markdown files.
```typescript
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/mark': ['./lib/mark/**'],
  },
};
```
**Source:** Proven pattern in current app's `next.config.ts`.

### Anti-Patterns to Avoid
- **Module-level `createClient()` at import time:** The current app's `lib/supabase.ts` Proxy pattern was a workaround. In the new repo, always create the client inside the function body. NEVER at module scope.
- **Importing Three.js in server components:** Any import of `three`, `@react-three/fiber`, or `@react-three/drei` in a server-rendered context will break the build. Always wrap in `dynamic(..., { ssr: false })`.
- **Skipping `outputFileTracingIncludes`:** Without this, the Vercel build silently omits `.md` files and Mark's intelligence is empty in production.
- **Using `videoViewCount` for plays:** Already fixed in the scrape route being ported. Ensure this field name is preserved (`videoPlayCount`).
- **Showing tier numbers (T1/T2/T3) in UI copy:** Explicitly banned by `02-UI-SPEC.md` copywriting contract.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase auth session management in App Router | Custom cookie/session logic | `@supabase/ssr` createServerClient + middleware | Edge cases around token refresh, cookie serialization, SSR hydration mismatch |
| 3D galaxy scene | Custom WebGL canvas | `@react-three/fiber` + `@react-three/drei` | R3F handles React reconciliation, performance, resize, pointer events for 3D |
| UI animations with reduced-motion support | CSS keyframes only | `motion` package | `useReducedMotion()` hook, layout animations, gesture support |
| Form validation in onboarding | Custom validation | `zod` schemas + native form validation | Type-safe, reusable, consistent error messages |
| shadcn component primitives | Custom modal, dialog, select | `shadcn` CLI (Radix UI under the hood) | Accessibility, keyboard nav, ARIA out of the box |
| Frame extraction from video | Custom ffmpeg spawn logic | Port existing `edit-feedback/route.ts` as-is | 570 lines battle-tested: frame extraction, Whisper, Apify scraping |
| Mark intelligence assembly | Rewrite the system prompt builder | Port `lib/mark/intelligence-loader.ts` + `mark-knowledge.ts` as-is | Tier system is complete and mature |

**Key insight:** The API layer is the most mature part of the codebase. Porting it verbatim is safer and faster than rewriting. All complexity already solved: ffmpeg frame extraction, multi-turn conversation, Apify scraping, Whisper transcription, gap analysis.

---

## Critical Clarification: "Nano Banana 2"

The `02-UI-SPEC.md` lists "Nano Banana 2" under the Motion/Animation tool. Research reveals this is **Google's Imagen 3 Fast AI image generation model** (a Claude Code skill), NOT a JavaScript/npm animation package. It is used to generate visual design frames and assets during the design process.

**For implementation**, the animation contracts in `02-UI-SPEC.md` (screen transitions, card entry, star twinkle, planet rotation, loading pulse) must be implemented using:
1. **`motion` package** (Framer Motion v12) — for JavaScript-driven animations
2. **CSS `animation` property** — for pure CSS animations (planet rotation at 120s loop is a good candidate)
3. **Tailwind CSS `animate-` utilities** — for simple transitions (hover states, opacity)

The `nano-banana-2` package on npm (version `1767173.744.66`) is an unrelated squatted package for supermaker.ai — do NOT install it.

---

## Common Pitfalls

### Pitfall 1: Three.js Breaking the Build
**What goes wrong:** `TypeError: Cannot read properties of undefined` or `Module not found: Can't resolve 'three'` during Vercel build.
**Why it happens:** Three.js uses Node.js APIs (WebGL, canvas) that don't exist in the Next.js server-side build environment. Even a transitive import causes the build to fail.
**How to avoid:** Every file that imports from `three`, `@react-three/fiber`, or `@react-three/drei` must be either (a) a `'use client'` component wrapped in `dynamic(..., { ssr: false })` or (b) listed in `serverExternalPackages` in `next.config.ts`.
**Warning signs:** Build succeeds locally (Node.js has enough polyfills) but fails on Vercel.

### Pitfall 2: Supabase Module-Level Instantiation
**What goes wrong:** Vercel build fails with cryptic `createClient` errors, or session state leaks between requests.
**Why it happens:** Next.js precompiles modules — if `createClient()` runs at import time, it captures the build-time environment, not the request environment.
**How to avoid:** In the new repo, use `@supabase/ssr` pattern exclusively. Create the client inside async functions. Never export a singleton from `lib/supabase.ts`.
**Warning signs:** `NEXT_PUBLIC_SUPABASE_URL not configured` logs even when env vars are set.

### Pitfall 3: Missing `outputFileTracingIncludes` for Markdown Files
**What goes wrong:** Mark gives empty or nonsensical responses in production. T1/T2 intelligence is silently empty.
**Why it happens:** Vercel's output file tracing only follows JavaScript `import/require` chains. `fs.readFileSync('./lib/mark/universal-truths.md')` isn't traced.
**How to avoid:** Add `outputFileTracingIncludes: { '/api/mark': ['./lib/mark/**'] }` to `next.config.ts` before first deploy.
**Warning signs:** Mark works in local dev (`fs` reads the file), fails in production.

### Pitfall 4: shadcn CSS Variable Conflict with Tailwind v4
**What goes wrong:** shadcn components render with wrong colors; CSS variables aren't applying.
**Why it happens:** Tailwind v4 changes how CSS variables are defined and resolved. The `shadcn init` may generate Tailwind v3-style config that conflicts.
**How to avoid:** With Tailwind v4, define custom tokens inline in `globals.css` (no `tailwind.config.ts` needed). The shadcn `components.json` should specify `cssVariables: true`. Override vars in `:root` and `.dark` selectors as documented in `02-UI-SPEC.md`.
**Warning signs:** Buttons appear white/wrong color, `bg-primary` doesn't use cream-gold.

### Pitfall 5: Edit Feedback Tier 3 Context Not Wired
**What goes wrong:** Mark's edit feedback is generic — doesn't reference the artist's actual ER data or top-performing post patterns.
**Why it happens:** The current `edit-feedback/route.ts` (570 lines) does NOT read `tier3Context` — this is documented as a gap in `02-CONTEXT.md` under "Gap for Phase 2 Edit Feedback Enhancement."
**How to avoid:** When porting the route, explicitly add `tier3Context` loading (using the same `loadTier3Context` pattern from `app/api/mark/route.ts`) and inject it into the system prompt.
**Warning signs:** Mark's feedback says things like "great hook" without any reference to the artist's average ER or their top format patterns.

### Pitfall 6: Stitch Mockup Consistency — DESIGN.md Required First
**What goes wrong:** Stitch generates screens with inconsistent colors, fonts, or spacing between sessions.
**Why it happens:** Stitch uses a `design.md` file to maintain consistency across generation sessions. Without it, each Stitch session starts fresh.
**How to avoid:** Create `DESIGN.md` in the new repo before any Stitch generation. It must include: color tokens (Celestial Interface), typography (Space Grotesk / Manrope), spacing scale, and component style rules. The Stitch project ID from the `02-UI-SPEC.md` session is `4134691627773722705` — use it to continue from the established system.
**Warning signs:** Stitch outputs use wrong background color or default blue primary button instead of cream-gold.

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Mark Chat Route — Tier 3 Context Loading (from current `app/api/mark/route.ts`)
```typescript
// Pattern proven in production — port verbatim
async function loadTier3Context(userId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey || !userId) return '';
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();
    return prof?.onboarding_profile?.instagramAnalytics?.tier3Context || '';
  } catch {
    return '';
  }
}
```

### Intelligence Loader — fs.readFileSync Pattern
```typescript
// lib/mark/intelligence-loader.ts (port as-is)
export function loadUniversalTruths(): string {
  try {
    const filePath = path.join(process.cwd(), 'lib', 'mark', 'universal-truths.md');
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}
```

### Galaxy Scene — Dynamic Import Wrapper (from current `GalaxyViewWrapper.tsx` pattern)
```typescript
// components/galaxy/GalaxySceneWrapper.tsx
'use client';
import dynamic from 'next/dynamic';

const GalaxyScene = dynamic(
  () => import('./GalaxyScene'),
  { ssr: false, loading: () => <GalaxyLoadingState /> }
);

export function GalaxySceneWrapper(props: GalaxySceneProps) {
  return <GalaxyScene {...props} />;
}
```

### Supabase SSR — Middleware (required for auth refresh)
```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getClaims(); // refresh session
  return supabaseResponse;
}
```

### Instagram OAuth Route — Port Pattern
The current `app/api/auth/instagram/route.ts` uses `NEXT_PUBLIC_APP_URL || req.nextUrl.origin` to build the redirect URI — this pattern must be preserved exactly. The Meta App Dashboard OAuth redirect URI must match.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createClientComponentClient` (Auth Helpers) | `createBrowserClient` + `createServerClient` (@supabase/ssr) | Supabase v2 / late 2023 | Auth Helpers deprecated — use @supabase/ssr exclusively |
| `framer-motion` package | `motion` package (same library, renamed) | 2024 | Import from `motion/react`, not `framer-motion` |
| `tailwind.config.ts` for theming | Inline CSS in `globals.css` (Tailwind v4) | Tailwind v4 (2025) | No tailwind.config.ts needed for theming in v4 |
| `@react-three/fiber` v8 alpha | `@react-three/fiber` v9.5.0 | 2025 | Stable v9 — use this, not the alpha version in current app |
| `getSession()` (Supabase) | `getClaims()` (Supabase) | Supabase v2.101+ | `getClaims()` validates JWT signature — safer for server-side protection |

**Deprecated/outdated:**
- `shadcn-ui` npm package: Deprecated — use `shadcn` CLI (v4.1.2). Install with `npx shadcn@latest init`.
- `@supabase/auth-helpers-nextjs`: Fully deprecated in favor of `@supabase/ssr`.
- `framer-motion` import path: Renamed to `motion` — `import { motion } from 'motion/react'`.

---

## Open Questions

1. **Nano Banana 2 as animation tool in UI-SPEC**
   - What we know: `02-UI-SPEC.md` lists "Nano Banana 2" under Motion/Animation. Research confirms Nano Banana 2 is Google's Imagen 3 Fast image generator (a Claude Code skill for generating design frames), not a JavaScript animation package.
   - What's unclear: Does the project author intend Nano Banana 2 to be used only for the design/asset generation phase (generating frames for Stitch mockups), with `motion` used for implementation? Or is there a custom/private animation tool named this way?
   - Recommendation: Implement all animation contracts from `02-UI-SPEC.md` using `motion` package (Framer Motion v12). Flag this to the user before implementation begins.

2. **Vercel CLI not installed**
   - What we know: `vercel` CLI is not in the PATH. Deploying via CLI would require installing it or using the Vercel dashboard.
   - What's unclear: Whether the user plans to deploy via CLI or Vercel dashboard GitHub integration.
   - Recommendation: Plan Wave 0 to include `npm install -g vercel` or document dashboard-based deploy setup.

3. **Phase 01 OAuth not verified end-to-end**
   - What we know: STATE.md notes "Instagram OAuth routes exist but not yet tested end-to-end — requires Meta App credentials." The OAuth routes being ported to v2 have the same dependency.
   - What's unclear: Whether `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` will be available at test time, and whether the Meta App needs to register a new redirect URI for `themultiverse2.vercel.app`.
   - Recommendation: Plan a checkpoint requiring the user to add `https://themultiverse2.vercel.app/api/auth/instagram/callback` to the Meta App Dashboard OAuth redirect URIs before testing OAuth in the new repo.

4. **`@react-three/fiber` version for Next.js 15 / React 19**
   - What we know: The current app uses `^9.0.0-alpha.8` — an alpha. Latest stable is 9.5.0. React 19 support in R3F v9 needs verification.
   - What's unclear: Full React 19 compatibility story for R3F 9.x.
   - Recommendation: Use R3F 9.5.0 (latest stable). The current app's patterns (dynamic import, no server-side R3F) are the safest approach regardless of version.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Everything | Yes | v24.12.0 | — |
| git | New repo creation | Yes | 2.50.1 | — |
| npm | Package installation | Yes | (bundled with Node) | — |
| ffmpeg-static (npm) | Edit Feedback frame extraction | Yes (in current project) | 5.3.0 | No system ffmpeg needed — uses bundled binary |
| System ffmpeg | Edit Feedback fallback | Not found in PATH | — | ffmpeg-static npm package handles this |
| Stitch MCP | Design-first workflow | Yes | Configured in ~/.claude/settings.json with API key | — |
| Vercel CLI | Deployment | Not installed | — | Use Vercel dashboard + GitHub integration |
| GitHub CLI (gh) | Optional | Not installed | — | Standard git push via HTTPS/SSH |

**Missing dependencies with no fallback:**
- None that block implementation. All critical dependencies are available.

**Missing dependencies with fallback:**
- Vercel CLI: deploy via Vercel dashboard GitHub integration (standard workflow)
- System ffmpeg: the `ffmpeg-static` npm package provides a bundled binary — no system install required

---

## Validation Architecture

No `.planning/config.json` exists — treat `nyquist_validation` as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No framework detected for new repo (the-multiverse-v2 not yet created). Current app uses vitest + playwright. |
| Config file | None — see Wave 0 |
| Quick run command | `npm run lint` (available from create-next-app) + TypeScript check |
| Full suite command | To be established in Wave 0 |

### Phase Requirements → Test Map

No formal REQ-IDs are mapped to Phase 2 yet. Based on deliverables:

| Deliverable | Behavior | Test Type | Automated Command | File Exists? |
|------------|----------|-----------|-------------------|-------------|
| New repo scaffold | `create-next-app` outputs valid project | smoke | `npm run build` | ❌ Wave 0 |
| Design system | CSS variables apply, shadcn components render | visual/manual | Manual inspection in browser | N/A |
| Supabase auth | User can sign up, session persists across refresh | e2e / manual | Manual OAuth flow test | ❌ Wave 0 |
| Mark chat | POST /api/mark returns non-empty response | smoke | `curl -X POST .../api/mark` with test body | ❌ Wave 0 |
| Edit Feedback | Route accepts URL + returns feedback string | smoke | `curl -X POST .../api/mark/train/edit-feedback` | ❌ Wave 0 |
| Scrape pipeline | POST /api/mark/artist-analytics/scrape returns analytics | smoke | Manual scrape trigger via UI | ❌ Wave 0 |
| Galaxy scene | 3D canvas renders without errors in browser | visual/manual | Browser console check | N/A |

### Wave 0 Gaps
- [ ] No test infrastructure exists (new repo). Wave 0 should add TypeScript strict mode check: `tsc --noEmit`.
- [ ] Linting: `next lint` from create-next-app covers basic quality gate.
- [ ] No automated e2e framework configured — recommend Playwright (same as current app) added in a later wave.

---

## Sources

### Primary (HIGH confidence)
- Current app source: `app/api/mark/route.ts`, `app/api/mark/train/edit-feedback/route.ts`, `components/multiverse/Galaxy3DView.tsx`, `next.config.ts` — direct code inspection
- `.planning/phases/02-new-mvp-app-shell/02-UI-SPEC.md` — approved design contract (authoritative for all UI decisions)
- `package.json` in current app — verified all dependency versions
- npm registry (live 2026-04-04): `next`, `@supabase/supabase-js`, `@supabase/ssr`, `@react-three/fiber`, `three`, `motion` versions
- Supabase SSR docs (https://supabase.com/docs/guides/auth/server-side/nextjs) — createServerClient patterns

### Secondary (MEDIUM confidence)
- WebSearch: 21st.dev component registry — confirmed as React/Next.js/Tailwind component marketplace with 3D components
- WebSearch: Stitch MCP — confirmed as Google Stitch + Claude Code integration via MCP; design.md pattern verified
- WebSearch: UI UX Pro Max skill — confirmed as Claude Code skill (GitHub: nextlevelbuilder/ui-ux-pro-max-skill), 50+ styles, 161 color palettes
- WebSearch: Nano Banana 2 — confirmed as Google Imagen 3 Fast image generation Claude Code skill (NOT a JavaScript animation library)

### Tertiary (LOW confidence)
- `@react-three/fiber` v9 / React 19 compatibility: not fully verified via official R3F docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live against npm registry
- Architecture: HIGH — patterns proven in existing codebase, design contract in 02-UI-SPEC.md
- Pitfalls: HIGH — Three.js/SSR pitfalls are directly observed in current app's workarounds
- Nano Banana 2 clarification: MEDIUM — confirmed via web research, but project-specific intent unclear

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable stack; 21st.dev component selection may shift)
