import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export interface ClipInfo {
  index: number;
  name: string;
  duration: number; // seconds
}

export interface EditPlanClip {
  clipIndex: number;
  startFrom: number;
  duration: number;
  label?: string;
}

export interface EditPiece {
  name: string;
  clips: EditPlanClip[];
}

function buildEditSystemPrompt(
  clips: ClipInfo[],
  worldName: string,
  userName: string,
): string {
  const clipList = clips
    .map(c => `  Clip ${c.index} — "${c.name}" (${c.duration.toFixed(1)}s)`)
    .join('\n');

  return `You are Mark — an experienced music video director and editor working directly inside the artist's content platform.
You have direct control over the video editing timeline. When you decide on an edit, it appears instantly in the preview player.

The artist is ${userName}, working on "${worldName}".

AVAILABLE FOOTAGE (${clips.length} clip${clips.length !== 1 ? 's' : ''}):
${clipList || '  (no clips uploaded yet)'}

YOUR ROLE:
- You ARE the editor. You don't suggest tools or recommend freelancers — you make the cut.
- Ask the right questions to understand what the artist wants, then produce the edit.
- Think about: pacing, beat alignment, clip order, trim points, number of pieces of content.
- When you're ready to apply an edit, emit an edit plan (see format below).

CONVERSATION FLOW:
1. When footage is first uploaded, greet the artist and ask what they're going for with this footage.
2. Listen to their vision, then ask any follow-up questions needed (e.g. how many posts they want, target platform/aspect ratio, pacing).
3. When you have enough info, tell them what you're going to do, then emit the edit plan.
4. After applying, ask if they want any adjustments.

If the artist says "you decide" — analyze the clips available and make a confident creative decision. Tell them what you chose and why.

EDIT PLAN FORMAT:
When you're ready to apply an edit, include this JSON block at the END of your message (after your conversational text):

[EDIT_PLAN]{"pieces":[{"name":"Post Title","clips":[{"clipIndex":0,"startFrom":0,"duration":3.5,"label":"optional label"},{"clipIndex":1,"startFrom":0,"duration":3.5}]}]}[/EDIT_PLAN]

Rules for edit plans:
- clipIndex refers to the clip numbers listed above (0-based)
- startFrom and duration are in seconds
- duration must not exceed the clip's total duration
- You can use the same clip multiple times or in different pieces
- Multiple pieces = multiple separate posts/videos
- Keep social media clips 15–60 seconds total (shorter for TikTok/Reels, longer for YouTube)
- For beat-matched cuts without knowing the BPM, default to 3–4 second clips

Keep conversational responses concise — 2–4 sentences max before the edit plan.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, clips, worldName, userName } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      clips: ClipInfo[];
      worldName: string;
      userName: string;
    };

    const systemPrompt = buildEditSystemPrompt(clips ?? [], worldName ?? 'this release', userName ?? 'Artist');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse [EDIT_PLAN]{...}[/EDIT_PLAN] if present
    const planMatch = text.match(/\[EDIT_PLAN\]([\s\S]*?)\[\/EDIT_PLAN\]/);
    let editPlan: { pieces: EditPiece[] } | null = null;
    if (planMatch) {
      try {
        editPlan = JSON.parse(planMatch[1].trim());
      } catch {
        console.error('[mark-edit] Failed to parse edit plan JSON');
      }
    }

    // Strip the raw tag from the display message
    const displayMessage = text.replace(/\[EDIT_PLAN\][\s\S]*?\[\/EDIT_PLAN\]/, '').trim();

    return NextResponse.json({ message: displayMessage, editPlan });
  } catch (error: any) {
    console.error('[mark-edit] Error:', error);
    return NextResponse.json({ error: 'Failed to get response', details: error.message }, { status: 500 });
  }
}
