/**
 * POST /api/mark/train/intelligence/chat
 *
 * Mark chat powered by all three intelligence tiers.
 * Tier 1: universal truths + Nick Ruffalo + Stafford frameworks
 * Tier 2: live-intelligence.md (current trends)
 * Tier 3: artist-specific context (from scrape route, or empty if not yet scraped)
 *
 * Input:  { messages: MessageParam[], tier3Context: string, sessionId: string }
 * Output: { reply: string, tiersActive: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import fs from 'fs';
import path from 'path';
import { RUFF_MUSIC_KNOWLEDGE } from '@/lib/ruff-music-knowledge';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export const maxDuration = 60;

// ─── Load Tier 1 and Tier 2 from files ───────────────────────────────────────

function loadUniversalTruths(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'lib', 'mark', 'universal-truths.md'), 'utf-8');
  } catch { return ''; }
}

function loadLiveIntelligence(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'lib', 'mark', 'live-intelligence.md'), 'utf-8');
  } catch { return ''; }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(tier3Context: string): { prompt: string; tiersActive: string[] } {
  const universalTruths = loadUniversalTruths();
  const liveIntelligence = loadLiveIntelligence();
  const tiersActive: string[] = ['Tier 1'];

  const tier1 = `## TIER 1: UNIVERSAL TRUTHS & PROVEN FRAMEWORKS

### Nick Ruffalo's Framework (@ruffmusicofficial, 200M+ views)
${RUFF_MUSIC_KNOWLEDGE}

### Stafford's Artist Development Framework (@staffordsworld)
Core principles:
- Views ≠ success. 1,000 right-audience views outperform 100,000 wrong-audience views.
- Consistency is the only strategy that compounds. One post per day, no exceptions.
- Content over algorithm. Great content overpowers any algorithm.
- The 6 formats: Performance, Lazy B-Roll, Skits, Strangers, Distraction, Aesthetics.
- Text hooks are functional, not aesthetic. 85% of video is watched mute.
- Emotional connection creates fans. Views create nothing.
- Caption: don't put the song name. Wait for someone to ask in comments.

### Hook Psychology & Platform Science
${universalTruths}`;

  let tier2 = '';
  if (liveIntelligence) {
    tiersActive.push('Tier 2');
    tier2 = `## TIER 2: LIVE INTELLIGENCE — WHAT'S WORKING RIGHT NOW
${liveIntelligence}`;
  }

  let tier3 = '';
  if (tier3Context.trim()) {
    tiersActive.push('Tier 3');
    tier3 = tier3Context;
  }

  const prompt = `You are Mark — a chill, direct, experienced music content strategist. You are running on a three-tier intelligence system. Here's how to use each tier:

- TIER 1 gives you timeless principles. Apply these by default.
- TIER 2 tells you what's working RIGHT NOW. Layer this on top of Tier 1 — if the current meta contradicts a universal truth, flag it explicitly.
- TIER 3 is THIS SPECIFIC ARTIST's data. When Tier 3 is active, ALWAYS anchor advice to their actual track record. "Your best-performing posts have been X" is more valuable than "best practice is Y."

When giving advice, tell the user which tier is informing it — briefly, naturally. E.g., "Based on your data (Tier 3), your Thursday posts outperform..." or "The current meta (Tier 2) is running hard on distraction hooks..."

---

${tier1}

---

${tier2 ? tier2 + '\n\n---\n\n' : ''}${tier3 || '## TIER 3: ARTIST-SPECIFIC DATA\nNot yet active — no account has been scraped for this session. Give general advice from Tier 1 and Tier 2 only. Tell the user they can connect their Instagram account to unlock personalized analysis.'}

---

YOUR VOICE:
- Direct. No fluff. Not corporate.
- Specific. Cite data when you have it.
- Brief unless asked for detail.
- When Tier 3 is active, this should feel like you've been their strategist for months.
- When it's not, be clear about what you don't know yet.`;

  return { prompt, tiersActive };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, tier3Context = '' } = await req.json() as {
      messages: MessageParam[];
      tier3Context: string;
      sessionId?: string;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const { prompt, tiersActive } = buildSystemPrompt(tier3Context);

    const res = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      system: prompt,
      messages,
    });

    const reply = res.content[0].type === 'text' ? res.content[0].text.trim() : 'No response generated.';
    return NextResponse.json({ reply, tiersActive });

  } catch (e: any) {
    console.error('[intelligence/chat]', e);
    return NextResponse.json({ error: e.message ?? 'Chat failed' }, { status: 500 });
  }
}
