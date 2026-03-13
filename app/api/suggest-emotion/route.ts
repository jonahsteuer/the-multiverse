import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// L4: Derive emotion filter + listening context from lyrics so the artist
// doesn't have to type them manually.

export async function POST(req: NextRequest) {
  try {
    const { lyrics, songName } = await req.json();
    if (!lyrics) {
      return NextResponse.json({ emotion: null, listeningContext: null });
    }

    const prompt = `You are analyzing song lyrics to derive two things for a content brainstorm:

SONG: "${songName || 'Untitled'}"
LYRICS:
"""
${lyrics.slice(0, 3000)}
"""

Return ONLY valid JSON — no markdown, no code fences:
{
  "emotion": "<1-2 word emotion filter, e.g. longing, heartbreak, confidence, nostalgia, rage, joy, defiance>",
  "listeningContext": "<where someone most likely listens to this — one short phrase, e.g. 'late-night drive', 'bedroom at 2am', 'gym', 'walking alone', 'nature walk'>",
  "emotionRationale": "<one sentence explaining why you chose this emotion based on the lyrics — quote one lyric line>"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      emotion: parsed.emotion || null,
      listeningContext: parsed.listeningContext || null,
      emotionRationale: parsed.emotionRationale || null,
    });
  } catch (err: any) {
    console.error('[Suggest Emotion] Error:', err);
    return NextResponse.json({ emotion: null, listeningContext: null });
  }
}
