import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export interface ClipInfo {
  index: number;
  name: string;
  duration: number; // seconds
}

export interface ClipFrames {
  clipIndex: number;
  frames: string[]; // base64 JPEG data URIs
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
  hasFrames: boolean,
): string {
  const clipList = clips
    .map(c => `  Clip ${c.index} — "${c.name}" (${c.duration.toFixed(1)}s)`)
    .join('\n');

  const visionNote = hasFrames
    ? `You have been shown keyframes from each clip — use what you see (action, lighting, composition, movement, facial expressions) to make informed creative decisions about pacing, clip order, and cut points.`
    : `No visual previews were captured for these clips yet.`;

  return `You are Mark — an experienced music video director and editor working directly inside the artist's content platform.
You have direct control over the video editing timeline. When you decide on an edit, it appears instantly in the preview player.

The artist is ${userName}, working on "${worldName}".

AVAILABLE FOOTAGE (${clips.length} clip${clips.length !== 1 ? 's' : ''}):
${clipList || '  (no clips uploaded yet)'}

VISUAL CONTEXT: ${visionNote}

YOUR ROLE:
- You ARE the editor. You don't suggest tools or recommend freelancers — you make the cut.
- Use what you see in the frames to make creative decisions — match movement, lighting, energy.
- Think about: pacing, beat alignment, clip order, trim points, number of pieces of content.
- When you're ready to apply an edit, emit an edit plan (see format below).

CONVERSATION FLOW:
1. When footage is first uploaded, briefly describe what you see in the clips, then ask what they're going for.
2. Listen to their vision, then ask any follow-up questions needed (e.g. how many posts, pacing, platform).
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

// Build a Claude message array that injects clip frames into the first user turn
function buildMessagesWithVision(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  clipFrames: ClipFrames[],
  clips: ClipInfo[],
): Anthropic.MessageParam[] {
  if (clipFrames.length === 0 || messages.length === 0) {
    return messages as Anthropic.MessageParam[];
  }

  // Attach frames to the first user message only (the initial greeting trigger or first real message)
  const [first, ...rest] = messages;
  if (first.role !== 'user') return messages as Anthropic.MessageParam[];

  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  for (const cf of clipFrames) {
    const clipInfo = clips[cf.clipIndex];
    const label = clipInfo ? `Clip ${cf.clipIndex} — "${clipInfo.name}" (${clipInfo.duration.toFixed(1)}s)` : `Clip ${cf.clipIndex}`;
    // Add a text label before each clip's frames
    for (const dataUri of cf.frames) {
      const base64 = dataUri.replace(/^data:image\/\w+;base64,/, '');
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      } as Anthropic.ImageBlockParam);
    }
    // We'll add clip labels in the text block
    void label;
  }

  // Build a text label listing what frames belong to which clip
  const frameLabels = clipFrames
    .map(cf => {
      const info = clips[cf.clipIndex];
      return `Clip ${cf.clipIndex} ("${info?.name ?? cf.clipIndex}"): ${cf.frames.length} frame${cf.frames.length !== 1 ? 's' : ''} shown`;
    })
    .join(', ');

  const firstWithVision: Anthropic.MessageParam = {
    role: 'user',
    content: [
      ...imageBlocks,
      {
        type: 'text',
        text: `[Keyframes attached above — ${frameLabels}]\n\n${first.content}`,
      },
    ],
  };

  return [firstWithVision, ...(rest as Anthropic.MessageParam[])];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, clips, clipFrames, worldName, userName } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      clips: ClipInfo[];
      clipFrames?: ClipFrames[];
      worldName: string;
      userName: string;
    };

    const hasFrames = (clipFrames?.length ?? 0) > 0;
    const systemPrompt = buildEditSystemPrompt(clips ?? [], worldName ?? 'this release', userName ?? 'Artist', hasFrames);

    // Only send frames on the first call (when there's exactly 1 user message — the greeting trigger)
    // Subsequent turns are text-only to avoid re-sending large payloads
    const isFirstCall = messages.filter(m => m.role === 'user').length <= 1;
    const claudeMessages = isFirstCall && hasFrames
      ? buildMessagesWithVision(messages, clipFrames!, clips ?? [])
      : (messages as Anthropic.MessageParam[]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      system: systemPrompt,
      messages: claudeMessages,
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

    const displayMessage = text.replace(/\[EDIT_PLAN\][\s\S]*?\[\/EDIT_PLAN\]/, '').trim();

    return NextResponse.json({ message: displayMessage, editPlan });
  } catch (error: any) {
    console.error('[mark-edit] Error:', error);
    return NextResponse.json({ error: 'Failed to get response', details: error.message }, { status: 500 });
  }
}
