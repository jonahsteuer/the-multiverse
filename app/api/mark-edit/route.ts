import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RUFF_MUSIC_KNOWLEDGE } from '@/lib/ruff-music-knowledge';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ClipInfo {
  index: number;
  name: string;
  duration: number; // seconds
  rotation?: number; // degrees (90 = portrait phone video stored landscape)
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
  rotation?: 0 | 90 | 180 | 270; // Mark-specified: makes subject right-side-up
  scale?: number;                  // 1.0 = fill frame naturally, >1 = zoom in
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
  currentTimeline?: Array<{ clipIndex: number; startFrom: number; duration: number; label?: string }>,
  lipSyncResults?: Array<{ clipIndex: number; offsetSec: number; confidence: number }>,
): string {
  const clipList = clips
    .map(c => `  Clip ${c.index} — "${c.name}" (${c.duration.toFixed(1)}s)`)
    .join('\n') || '  (no clips)';

  const soundbyteList = soundbytes.length
    ? soundbytes.map(s => `  id="${s.id}" label="${s.label}": ${s.startSec.toFixed(1)}s–${s.endSec.toFixed(1)}s (${(s.endSec - s.startSec).toFixed(1)}s)`).join('\n')
    : '  none saved yet';

  const audioNote = trackUrl
    ? `Song audio is available. Use soundbyte timings to guide cut length and pacing.`
    : `No track audio on file. Ask the artist to upload an audio file if they want audio.`;

  const visionNote = hasFrames
    ? `You have 3 keyframes per clip (first, middle, last). Use what you see — action, movement direction, facial expressions, lighting, lip movements, orientation — to make creative decisions.`
    : `No frames available yet.`;

  const currentEditState = currentTimeline?.length
    ? `\nCURRENT EDIT STATE (user's manual adjustments — you can see this but do not comment unless asked):\n${currentTimeline.map((c, i) => `  ${i + 1}. Clip #${c.clipIndex} "${clips[c.clipIndex]?.name ?? ''}" (${c.duration.toFixed(1)}s from ${c.startFrom.toFixed(1)}s)`).join('\n')}`
    : '';

  const lipSyncContext = lipSyncResults?.length
    ? `\nLIP SYNC ALIGNMENT DATA:\n${lipSyncResults.map(r => `  Clip #${r.clipIndex}: best startFrom = ${r.offsetSec.toFixed(2)}s (confidence ${Math.round(r.confidence * 100)}%)`).join('\n')}\nUse these startFrom values for lip sync clips in your edit plan.`
    : '';

  return `You are Mark — an experienced music video director and editor with 200M+ views. You work inside the artist's platform with full control of the editing timeline.

The artist is ${userName}, working on "${worldName}".

AVAILABLE FOOTAGE (${clips.length} clip${clips.length !== 1 ? 's' : ''}):
${clipList}

VISUAL CONTEXT: ${visionNote}

SAVED SOUNDBYTES:
${soundbyteList}
${audioNote}
${currentEditState}
${lipSyncContext}

YOUR EDITING PHILOSOPHY — Stafford's Framework:
You were trained on Stafford's content strategy (@ruffmusicofficial, 200M+ views). Reference Stafford by name when explaining decisions.

${RUFF_MUSIC_KNOWLEDGE}
${trendSummary ? `\nCURRENT TREND DATA:\n${trendSummary}` : ''}

YOUR ROLE:
- You ARE the editor. You make the cut. No suggesting CapCut or freelancers.
- Choose aspect ratio based on content: 9:16 for Reels/TikTok, 16:9 for YouTube.
- You can produce MULTIPLE pieces from one set of footage.
- Always include captionSuggestion and hookNotes.

TWO-PASS WORKFLOW:

PASS 1 — runs automatically when footage is first uploaded:
1. Look at all keyframes carefully. Identify what's in each clip: action, energy, setting, and — critically — whether the subject appears to be lip syncing (mouth moving in sync, words forming).
2. Check SAVED SOUNDBYTES. If soundbytes exist, ask which one to build the edit around. If none exist, ask the artist for the section name and time range (e.g., "Hook, 0:28–0:43").
3. Emit PASS1 JSON with the clip indices that contain lip sync content.
4. Keep your Pass 1 message to 3 sentences max.

Pass 1 format — emit at the END of your Pass 1 message:
[PASS1]{"lipsyncClips":[0,2]}[/PASS1]

If lipsyncClips is empty: [PASS1]{"lipsyncClips":[]}[/PASS1]

PASS 2 — after soundbyte is confirmed and lip sync data is provided:
1. Generate the full edit plan using [EDIT_PLAN] format below.
2. For lip sync clips, use the startFrom values from LIP SYNC ALIGNMENT DATA above.
3. Announce the plan in 1–2 sentences, then emit it.

ROTATION & FRAMING (critical — specify per clip):
- Look at each clip's keyframes. If the subject appears sideways or upside-down, specify the rotation that makes them right-side-up (0, 90, 180, or 270 degrees).
- Use scale (1.0–2.0) to fill the frame. 1.0 is standard fill. Never leave black bars in the output.
- Example: iPhone portrait video shot sideways → rotation: 270 (or 90, depending on which way they tilted the phone — use the keyframes to judge).

SOUNDBYTE HANDLING:
- Match artist language to labels exactly: "verse 1" → id/label for "Verse 1".
- If the artist confirms a NEW soundbyte not in the saved list, emit:
  [NEW_SOUNDBYTE]{"label":"Chorus","startSec":28.0,"endSec":43.0}[/NEW_SOUNDBYTE]

AUDIO CONTINUITY:
- Audio plays as one unbroken track. Set audioDurationSec = sum of all clip durations.

MOTION-AWARE CUTTING:
- Cut when motion completes, not mid-gesture.
- Sequence clips for directional flow: left-moving → right-moving = kinetic energy.
- Mute all footage audio — only the song plays.

TIMELINE OBSERVATION:
- You can see the CURRENT EDIT STATE when the user makes manual timeline adjustments.
- Do NOT comment on manual changes unless the user asks you about them.

EDIT PLAN FORMAT — emit at the END of your Pass 2 message:
[EDIT_PLAN]{"pieces":[{"name":"Post Title","aspectRatio":"9:16","clips":[{"clipIndex":0,"startFrom":0,"duration":3.5,"label":"walking","rotation":270,"scale":1.0}],"audioStartSec":28.0,"audioDurationSec":15.0,"soundbyteId":"sb-123","captionSuggestion":"line 1\\nline 2","hookNotes":"Opens mid-walk — immediate energy"}]}[/EDIT_PLAN]

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
      lipSyncResults,
      currentTimeline,
    } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      clips: ClipInfo[];
      clipFrames?: ClipFrames[];
      soundbytes?: SoundbyteSummary[];
      trackUrl?: string | null;
      worldName: string;
      userName: string;
      genre?: string;
      lipSyncResults?: Array<{ clipIndex: number; offsetSec: number; confidence: number }>;
      currentTimeline?: Array<{ clipIndex: number; startFrom: number; duration: number; label?: string }>;
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
      currentTimeline,
      lipSyncResults,
    );

    const isFirstCall = messages.filter(m => m.role === 'user').length <= 1;
    const claudeMessages =
      isFirstCall && hasFrames
        ? buildMessagesWithVision(messages, clipFrames!, clips ?? [])
        : (messages as Anthropic.MessageParam[]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
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

    const pass1Match = text.match(/\[PASS1\]([\s\S]*?)\[\/PASS1\]/);
    let pass1: { lipsyncClips: number[] } | null = null;
    if (pass1Match) {
      try { pass1 = JSON.parse(pass1Match[1].trim()); }
      catch { /* ignore */ }
    }

    const sbMatch = text.match(/\[NEW_SOUNDBYTE\]([\s\S]*?)\[\/NEW_SOUNDBYTE\]/);
    let newSoundbyte: { label: string; startSec: number; endSec: number } | null = null;
    if (sbMatch) {
      try { newSoundbyte = JSON.parse(sbMatch[1].trim()); }
      catch { /* ignore */ }
    }

    const displayMessage = text
      .replace(/\[EDIT_PLAN\][\s\S]*?\[\/EDIT_PLAN\]/, '')
      .replace(/\[PASS1\][\s\S]*?\[\/PASS1\]/, '')
      .replace(/\[NEW_SOUNDBYTE\][\s\S]*?\[\/NEW_SOUNDBYTE\]/, '')
      .trim();

    return NextResponse.json({ message: displayMessage, editPlan, pass1, newSoundbyte });
  } catch (error: any) {
    console.error('[mark-edit] Error:', error);
    return NextResponse.json({ error: 'Failed to get response', details: error.message }, { status: 500 });
  }
}
