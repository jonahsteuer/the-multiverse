import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RUFF_MUSIC_KNOWLEDGE } from '@/lib/ruff-music-knowledge';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ClipInfo {
  index: number;
  name: string;
  duration: number; // seconds
}

export interface ClipFrames {
  clipIndex: number;
  frames: Array<{ dataUri: string; timeSec: number; label: string }>;
}

export interface SoundbyteSummary {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
}

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export interface EditPlanClip {
  clipIndex: number;
  startFrom: number;
  duration: number;
  label?: string;
}

export interface EditPiece {
  name: string;
  aspectRatio: AspectRatio;
  clips: EditPlanClip[];
  audioStartSec?: number;   // where to start the soundbyte
  audioDurationSec?: number;
  soundbyteId?: string;
  captionSuggestion?: string;
  hookNotes?: string;       // Mark's note on the hook
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildEditSystemPrompt(
  clips: ClipInfo[],
  worldName: string,
  userName: string,
  hasFrames: boolean,
  soundbytes: SoundbyteSummary[],
  trackUrl: string | null,
  trendSummary?: string,
): string {
  const clipList = clips
    .map(c => `  Clip ${c.index} — "${c.name}" (${c.duration.toFixed(1)}s)`)
    .join('\n') || '  (no clips)';

  const soundbyteList = soundbytes.length
    ? soundbytes.map(s => `  "${s.label}": ${s.startSec.toFixed(1)}s–${s.endSec.toFixed(1)}s (${(s.endSec - s.startSec).toFixed(1)}s)`).join('\n')
    : '  none saved yet';

  const audioNote = trackUrl
    ? `Song audio is available (track_url on file). Use soundbyte timings to guide cut length and pacing.`
    : `No track audio on file. If the edit needs audio, ask the artist to upload their audio file.`;

  const visionNote = hasFrames
    ? `You have keyframes from each clip (shown above with timestamps). Use what you see — action, movement direction, facial expressions, lighting, setting — to make creative decisions about clip order, cut points, and aspect ratio.`
    : `No frames available yet.`;

  return `You are Mark — an experienced music video director and editor with a track record of 200M+ views across music artist content. You work directly inside the artist's platform and have full control of the editing timeline. Your edits appear instantly in the preview player.

The artist is ${userName}, working on "${worldName}".

AVAILABLE FOOTAGE (${clips.length} clip${clips.length !== 1 ? 's' : ''}):
${clipList}

VISUAL CONTEXT: ${visionNote}

SAVED SOUNDBYTES (song sections available for audio sync):
${soundbyteList}
${audioNote}

YOUR EDITING PHILOSOPHY — Stafford's Framework:
You were trained on Stafford's content strategy (@ruffmusicofficial, 200M+ views). Every editing and creative decision you make is grounded in his framework. When explaining a decision, reference Stafford by name — e.g. "Stafford's approach here is...", "Following Stafford's framework...", "Stafford would say...". This gives the artist context for why you're making the choices you are.

${RUFF_MUSIC_KNOWLEDGE}
${trendSummary ? `\nCURRENT TREND DATA:\n${trendSummary}` : ''}

YOUR ROLE:
- You ARE the editor — not an advisor. You make the cut. No suggesting CapCut. No recommending freelancers.
- Analyze what you see in the frames to understand the footage before deciding.
- Choose aspect ratio based on content: 9:16 for TikTok/Reels (performance, walking shots, close-up moments), 16:9 for YouTube/wide establishing shots.
- Use soundbyte timings to set edit length and cut points when available.
- When the artist describes a lip sync video, reference the soundbyte timing and align clip start points to match the vocal entry.
- You can produce MULTIPLE pieces from one set of footage (e.g. a 15s hook cut + a 45s story version).
- Always include a captionSuggestion (first 2 lines of on-screen text) and hookNotes (what the hook is and why it works).

CONVERSATION FLOW:
1. After footage is uploaded: briefly describe what you see in each clip (action, energy, setting), then ask the artist what they're going for.
2. Ask only what you need: platform target, vibe/pacing preference, whether they want lip sync, how many posts.
3. If told "you decide" — decide confidently. State your rationale.
4. When ready: tell them your plan in 1-2 sentences, then emit the edit plan.
5. After applying: ask if they want iterations.

EDIT PLAN FORMAT — emit at the END of your message when ready:
[EDIT_PLAN]{"pieces":[{"name":"Post Title","aspectRatio":"9:16","clips":[{"clipIndex":0,"startFrom":0,"duration":3.5,"label":"walking level 1"}],"audioStartSec":28.0,"audioDurationSec":15.0,"soundbyteId":"chorus","captionSuggestion":"line 1 of caption\\nline 2","hookNotes":"Opens mid-walk, motion creates immediate visual hook"}]}[/EDIT_PLAN]

Rules:
- clipIndex = 0-based index from the footage list above
- startFrom + duration must not exceed clip's total duration
- aspectRatio: "9:16" (Reels/TikTok), "16:9" (YouTube/wide), "1:1" (feed), "4:5" (portrait feed)
- audioStartSec refers to position in the source track (use soundbyte start times when available)
- Keep pieces 15–60s for Reels/TikTok, up to 90s for YouTube
- Multiple pieces = multiple separate posts

Keep conversational responses to 3–5 sentences. Be direct and confident.`;
}

// ─── Vision message builder ───────────────────────────────────────────────────

function buildMessagesWithVision(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  clipFrames: ClipFrames[],
  clips: ClipInfo[],
): Anthropic.MessageParam[] {
  if (!clipFrames.length || !messages.length) return messages as Anthropic.MessageParam[];

  const [first, ...rest] = messages;
  if (first.role !== 'user') return messages as Anthropic.MessageParam[];

  const imageBlocks: Anthropic.ImageBlockParam[] = [];
  const frameLabels: string[] = [];

  for (const cf of clipFrames) {
    const info = clips[cf.clipIndex];
    const clipLabel = info ? `"${info.name}" (${info.duration.toFixed(1)}s)` : `Clip ${cf.clipIndex}`;
    frameLabels.push(`Clip ${cf.clipIndex} ${clipLabel}: ${cf.frames.length} frames`);

    for (const frame of cf.frames) {
      const base64 = frame.dataUri.replace(/^data:image\/\w+;base64,/, '');
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      } as Anthropic.ImageBlockParam);
    }
  }

  return [
    {
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `[Keyframes from uploaded footage — ${frameLabels.join(', ')}. Each frame is labeled with its timestamp in the conversation context.]\n\n${first.content}`,
        },
      ],
    } as Anthropic.MessageParam,
    ...(rest as Anthropic.MessageParam[]),
  ];
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      clips,
      clipFrames,
      soundbytes,
      trackUrl,
      worldName,
      userName,
      genre,
    } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      clips: ClipInfo[];
      clipFrames?: ClipFrames[];
      soundbytes?: SoundbyteSummary[];
      trackUrl?: string | null;
      worldName: string;
      userName: string;
      genre?: string;
    };

    // Optionally fetch live trend data (non-blocking — use cached static if slow)
    let trendSummary: string | undefined;
    try {
      const trendRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/trend-insights?genre=${genre || 'music'}&platform=instagram`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (trendRes.ok) {
        const td = await trendRes.json();
        trendSummary = td.summary;
      }
    } catch {
      // Trend data is bonus context — don't fail if unavailable
    }

    const hasFrames = (clipFrames?.length ?? 0) > 0;
    const systemPrompt = buildEditSystemPrompt(
      clips ?? [],
      worldName ?? 'this release',
      userName ?? 'Artist',
      hasFrames,
      soundbytes ?? [],
      trackUrl ?? null,
      trendSummary,
    );

    const isFirstCall = messages.filter(m => m.role === 'user').length <= 1;
    const claudeMessages =
      isFirstCall && hasFrames
        ? buildMessagesWithVision(messages, clipFrames!, clips ?? [])
        : (messages as Anthropic.MessageParam[]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const planMatch = text.match(/\[EDIT_PLAN\]([\s\S]*?)\[\/EDIT_PLAN\]/);
    let editPlan: { pieces: EditPiece[] } | null = null;
    if (planMatch) {
      try { editPlan = JSON.parse(planMatch[1].trim()); }
      catch { console.error('[mark-edit] Failed to parse edit plan JSON'); }
    }

    const displayMessage = text.replace(/\[EDIT_PLAN\][\s\S]*?\[\/EDIT_PLAN\]/, '').trim();
    return NextResponse.json({ message: displayMessage, editPlan });
  } catch (error: any) {
    console.error('[mark-edit] Error:', error);
    return NextResponse.json({ error: 'Failed to get response', details: error.message }, { status: 500 });
  }
}
