import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { STAFFORD_KNOWLEDGE } from '@/lib/stafford-knowledge';
import { RUFF_MUSIC_KNOWLEDGE } from '@/lib/ruff-music-knowledge';
import { loadUniversalTruths, loadLiveIntelligence } from '@/lib/mark/intelligence-loader';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// Mark can parse requests for post slot creation
function tryParsePostSlotRequest(message: string, chatHistory: string, releaseDate?: string): {
  action: 'create_post_slots';
  slots: Array<{ date: string; type: string; title?: string }>;
} | null {
  const text = (chatHistory + ' ' + message).toLowerCase();
  const slotMatch = text.match(/(\d+)\s*(empty|post|teaser|promo|story)\s*(post\s*)?slot/);
  if (!slotMatch) return null;

  const count = parseInt(slotMatch[1]);
  if (!count || count > 30) return null;

  const typeMap: Record<string, string> = {
    teaser: 'teaser', promo: 'promo', story: 'post', post: 'post',
  };
  const typeHint = Object.keys(typeMap).find(k => text.includes(k)) || 'post';
  const slotType = typeMap[typeHint];

  // Try to determine start date from context
  let startDate = new Date();
  if (releaseDate) {
    const rd = new Date(releaseDate);
    if (!isNaN(rd.getTime())) {
      // "week before release" = 7 days before
      if (text.includes('before release') || text.includes('week before')) {
        rd.setDate(rd.getDate() - 7);
        startDate = rd;
      } else if (text.includes('release week')) {
        rd.setDate(rd.getDate() - 3);
        startDate = rd;
      }
    }
  }

  const slots: Array<{ date: string; type: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + Math.floor(i * (7 / count)));
    slots.push({
      date: d.toISOString().split('T')[0],
      type: slotType,
    });
  }
  return { action: 'create_post_slots', slots };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context } = body as {
      message: string;
      context: {
        galaxyName?: string;
        releaseDate?: string;
        chatHistory?: string;
        teamMembers?: Array<{ name?: string; role?: string }>;
        isTeamChat?: boolean;
      };
    };

    const { galaxyName, releaseDate, chatHistory = '', teamMembers = [] } = context;

    // Check if this is a post slot request
    const slotRequest = tryParsePostSlotRequest(message, chatHistory, releaseDate);

    const teamInfo = teamMembers.length > 0
      ? `Team members: ${teamMembers.map(m => `${m.name || 'Unknown'} (${m.role || 'member'})`).join(', ')}.`
      : '';
    const releaseDateInfo = releaseDate ? `Release date: ${releaseDate}.` : '';

    const universalTruths = loadUniversalTruths();
    const liveIntelligence = loadLiveIntelligence();

    const systemPrompt = `You are Mark, an AI music marketing strategist embedded in The Multiverse platform.
You are responding in the team's group chat for "${galaxyName || 'this project'}".
${releaseDateInfo} ${teamInfo}

Keep responses focused, practical, and under 100 words unless asked for detail.
You can add empty post slots to the calendar — if asked, confirm the details and tell the user you'll add them.
If the chat history mentions a specific request, address it directly.
Be conversational but sharp. No fluff.

---

## STAFFORD'S CONTENT FRAMEWORK
${STAFFORD_KNOWLEDGE}

## NICK RUFFALO'S FRAMEWORK
${RUFF_MUSIC_KNOWLEDGE}

${universalTruths ? `## UNIVERSAL TRUTHS\n${universalTruths}` : ''}
${liveIntelligence ? `## LIVE INTELLIGENCE — CURRENT META\n${liveIntelligence}` : ''}

When content or strategy questions come up, draw on the above frameworks. Always attribute: "Stafford's approach here is..." or "Nick Ruffalo teaches..." so the team understands the reasoning.`;

    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (chatHistory) {
      historyMessages.push({ role: 'user', content: `Recent chat:\n${chatHistory}` });
      historyMessages.push({ role: 'assistant', content: 'Got it, I can see the conversation.' });
    }
    historyMessages.push({ role: 'user', content: message || 'What should we be working on?' });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 200,
      system: systemPrompt,
      messages: historyMessages,
    });

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : "I'm here — what do you need?";

    if (slotRequest) {
      return NextResponse.json({
        reply: `Sure — I'll add ${slotRequest.slots.length} ${slotRequest.slots[0]?.type || 'post'} slot${slotRequest.slots.length !== 1 ? 's' : ''} to your calendar. Confirm below and they'll be added.`,
        action: 'create_post_slots',
        slots: slotRequest.slots,
      });
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[mark-chat] error:', err);
    return NextResponse.json({ reply: "Something went wrong on my end — try again." }, { status: 500 });
  }
}
