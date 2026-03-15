import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmtSec(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const { scenes, location, soundbytes, genre } = await req.json() as {
      scenes: Array<{ id: string; title: string; action?: string; setting?: string; references?: string[] }>;
      location?: string;
      soundbytes?: Array<{ label: string; startSec: number; endSec: number }>;
      genre?: string;
    };

    if (!scenes?.length) {
      return NextResponse.json({ error: 'No scenes provided' }, { status: 400 });
    }

    const soundbyteText = soundbytes?.length
      ? soundbytes.map(sb => `  - ${sb.label}: ${fmtSec(sb.startSec)}–${fmtSec(sb.endSec)}`).join('\n')
      : '  (no soundbytes defined)';

    const sceneText = scenes.map((s, i) => [
      `Scene ${i + 1}: ${s.title}`,
      s.setting ? `  Setting: ${s.setting}` : '',
      s.action ? `  Artist action: ${s.action}` : '',
      s.references?.length ? `  References: ${s.references.join(', ')}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');

    const prompt = `You are creating a shoot day schedule for a music video.

Location: ${location || 'unspecified'}
Genre/vibe: ${genre || 'unspecified'}
Soundbytes to use on shoot day:
${soundbyteText}

For each scene below, generate exactly 4–5 look options. Each look is a single concise sentence describing:
1. Camera framing (e.g. "medium close-up", "wide", "extreme close-up")
2. Camera position/movement (e.g. "static low angle", "handheld tracking alongside subject at waist height", "overhead from high ground")
3. Subject's specific action in that scene (e.g. "subject walks away from camera", "subject kneels at water's edge lip-syncing")

Rules:
- Be specific to the scene's setting and action — no generic descriptions
- Reference the actual environment (trail, creek, ferns, etc.) where relevant
- Keep each look to one sentence, about 12–20 words
- Do NOT repeat the same framing across all looks — vary angles meaningfully

Examples of good look descriptions:
- "medium close-up, static low angle on the creek bank, subject kneels lip-syncing to own reflection"
- "wide, handheld tracking alongside subject at waist height, subject walks away through fern corridor"
- "overhead from high ground above trail, static, subject approaches below camera toward lens"
- "side profile, level with subject, slow push-in, subject stops walking and looks left into ferns"

${sceneText}

Return ONLY valid JSON. No markdown. No explanation. Just the JSON object:
{
  "sceneLooks": [
    {
      "sceneId": "scene-0",
      "sceneTitle": "Scene title here",
      "looks": [
        { "id": "look-0-0", "description": "look description here" },
        { "id": "look-0-1", "description": "look description here" },
        { "id": "look-0-2", "description": "look description here" },
        { "id": "look-0-3", "description": "look description here" }
      ]
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Claude response');

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[generate-shoot-looks] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
