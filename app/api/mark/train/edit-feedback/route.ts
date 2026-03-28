/**
 * POST /api/mark/train/edit-feedback
 *
 * Phase 2 — Edit Feedback
 * Accepts either an Instagram URL or video frames (client-extracted).
 * Mark analyzes the content and gives specific, actionable edit feedback.
 * Supports multi-turn conversation — each response stored in training log.
 *
 * Modes:
 *   url      — scrape post → download video → extract real frames → Mark feedback
 *   video    — frames + metadata → edit feedback via vision
 *   continue — continue the conversation with user's follow-up
 *
 * Frame extraction (url mode):
 *   Uses ffmpeg-static (bundled binary, no system dep) to extract 4 evenly-spaced
 *   frames from the Instagram video. Falls back to thumbnail if video unavailable.
 *   Requires: npm install ffmpeg-static
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/messages';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { RUFF_MUSIC_KNOWLEDGE } from '@/lib/ruff-music-knowledge';
import { loadAllSessions, logSession } from '@/lib/mark-training-rules';
import type { TrainingSession } from '@/lib/mark-training-rules';
import OpenAI from 'openai';

export const maxDuration = 180;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedPost {
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  videoDuration?: number;
  displayUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  latestComments?: Array<{ text: string }>;
  timestamp?: string;
}

interface FeedbackTurn {
  role: 'mark' | 'user';
  content: string;
}

// ─── Apify scraper ────────────────────────────────────────────────────────────

async function scrapeInstagramPost(url: string): Promise<ScrapedPost | null> {
  try {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directUrls: [url], resultsType: 'posts', resultsLimit: 1 }),
      },
    );
    const { data } = await startRes.json();
    if (!data?.id) return null;

    const deadline = Date.now() + 50_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3500));
      const { data: run } = await fetch(
        `https://api.apify.com/v2/actor-runs/${data.id}?token=${APIFY_TOKEN}`,
      ).then(r => r.json());
      if (run.status === 'SUCCEEDED') {
        const items = await fetch(
          `https://api.apify.com/v2/actor-runs/${data.id}/dataset/items?token=${APIFY_TOKEN}&limit=1`,
        ).then(r => r.json());
        return items[0] ?? null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) return null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Video download ───────────────────────────────────────────────────────────

async function downloadVideo(videoUrl: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok || !res.body) return false;
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

// ─── Frame extraction with ffmpeg-static ─────────────────────────────────────

async function extractFrames(
  videoPath: string,
  durationSec: number,
  frameCount = 4,
): Promise<string[]> {
  // Dynamically require ffmpeg-static so the route still compiles
  // if the package hasn't been installed yet (falls back to thumbnail)
  let ffmpegPath: string;
  try {
    ffmpegPath = require('ffmpeg-static') as string;
  } catch {
    console.warn('[edit-feedback] ffmpeg-static not found — run: npm install ffmpeg-static');
    return [];
  }

  const tmpDir = os.tmpdir();
  const frameBase = path.join(tmpDir, `mark-frame-${Date.now()}`);
  const frames: string[] = [];

  // Extract frames at evenly-spaced timestamps
  const timestamps = Array.from({ length: frameCount }, (_, i) => {
    const pct = i / Math.max(frameCount - 1, 1);
    // Clamp: avoid the very last frame which may be black on some encodings
    return Math.min(pct * durationSec, Math.max(durationSec - 0.5, 0));
  });

  for (let i = 0; i < timestamps.length; i++) {
    const outPath = `${frameBase}-${i}.jpg`;
    const ts = timestamps[i].toFixed(3);

    await new Promise<void>((resolve) => {
      const proc = spawn(ffmpegPath, [
        '-ss', ts,
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '3',
        '-vf', 'scale=640:-1',
        '-y',
        outPath,
      ]);
      proc.on('close', resolve);
      proc.on('error', resolve); // resolve even on error — we'll check file existence below
    });

    if (fs.existsSync(outPath)) {
      const buf = fs.readFileSync(outPath);
      frames.push(buf.toString('base64'));
      fs.unlinkSync(outPath); // clean up immediately
    }
  }

  return frames;
}

// ─── Image fetch (thumbnail fallback) ────────────────────────────────────────

async function fetchThumbnail(
  url: string,
): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(ct)) return null;
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mediaType: ct as 'image/jpeg' };
  } catch {
    return null;
  }
}

// ─── Audio extraction + transcription ────────────────────────────────────────

async function extractAndTranscribeAudio(videoPath: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[edit-feedback] no OPENAI_API_KEY — skipping audio transcription');
    return null;
  }

  let ffmpegPath: string;
  try {
    ffmpegPath = require('ffmpeg-static') as string;
  } catch {
    return null;
  }

  const audioPath = path.join(os.tmpdir(), `mark-audio-${Date.now()}.mp3`);

  // Extract audio to mp3 (mono, 16kHz is optimal for Whisper)
  await new Promise<void>((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-i', videoPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '64k',
      '-y',
      audioPath,
    ]);
    proc.on('close', resolve);
    proc.on('error', resolve);
  });

  if (!fs.existsSync(audioPath)) return null;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'text',
    });
    fs.unlinkSync(audioPath);
    const text = (transcription as unknown as string).trim();
    return text.length > 20 ? text : null;
  } catch (e) {
    console.warn('[edit-feedback] Whisper transcription failed:', e);
    try { fs.unlinkSync(audioPath); } catch {}
    return null;
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildFeedbackSystemPrompt(frameSource: 'video' | 'thumbnail' | 'none'): string {
  const frameContext = frameSource === 'video'
    ? `FRAMES: You have real frames extracted from the actual video at labeled timestamps (e.g. "Frame at ~0s", "Frame at ~8s"). Reference these directly and specifically by their timestamp label. You CAN comment on camera movement between frames, visual progression, edit pacing across frames, framing choices, and aesthetic consistency.`
    : frameSource === 'thumbnail'
    ? `FRAMES: You have ONE cover thumbnail — this is NOT a video frame, it is a static preview image.
HARD RULES FOR THUMBNAIL MODE — NO EXCEPTIONS:
- You CANNOT describe camera movement. You have not seen it.
- You CANNOT describe edit pacing, cut frequency, or transitions. You have not seen them.
- You CANNOT describe audio or sound. You have not heard it.
- You CANNOT describe what happens after the first frame. You have not seen it.
- You MUST open your visual feedback with: "I only have the cover thumbnail, so I can only speak to what's visible in this single frame."
- Describe ONLY what is literally visible in the thumbnail. No speculation on what the rest of the video looks like.`
    : `FRAMES: No visual data available. Do not describe visuals at all.`;

  return `You are Mark — an experienced music video director and content strategist with 200M+ views. You're giving edit feedback on a post.

YOUR FRAMEWORK:
${RUFF_MUSIC_KNOWLEDGE}

YOUR VOICE:
- Director giving notes on a cut — direct, specific, no fluff
- Acknowledge what's working as much as what needs fixing
- Feedback should feel like it comes from someone who's watched 10,000 music videos

${frameContext}

METRICS WARNING:
View counts pulled from Instagram scraping are often cached and can be significantly lower than the real count. When referencing views or engagement rate, always note: "(scraped view count — may be understated)". Never state engagement rate as fact — frame it as approximate.

FEEDBACK STRUCTURE — follow this order exactly:

**EDIT FEEDBACK**
Break this into:
1. "What I can see" — observations based ONLY on frames you actually have. No inference, no speculation.
2. "What I'm reading from context" — insights from caption, hashtags, comments, engagement data, duration.
3. What's genuinely working
4. Top 3 edit changes ranked by impact

**HOOK FEEDBACK** (always its own section — be explicit and actionable)
- Describe exactly what the opening frame communicates in the first second. Be specific: what's on screen, where you are in the song, what emotion it telegraphs.
- State clearly: does this stop a scroll or not, and why.
- Give at least 2 concrete alternative hook options, for example:
  - "Start at [timestamp]s instead — [reason why that moment is stronger]"
  - "Add text overlay in the first 1.5s — if lyrics are available, something like '[specific lyric line]' would work here"
  - "Lead with [specific visual element from a later frame] — it's the most arresting image in the video"
- If lyrics/transcript are provided in the context, use them directly — quote specific lines and say where they'd land as an opening hook.

**FOR YOUR NEXT SHOOT** (separate from edit feedback — these can't be fixed in post)
- Only include things that are genuinely shoot-level problems: sight lines, lighting setup, camera position, background elements, performance direction.
- Keep it to 2-3 max. Don't pad.
- Format: "[Observation] — [What to do differently next time]"

RULES:
- Be specific. "In the opening frame (~0s), your face is half out of frame and the background is blown out" is useful. "The hook is weak" is not.
- Never describe something you cannot see. If you can't determine cut frequency from 4 frames, say so explicitly.
- Don't pad. Speak conversationally — this is a feedback session.
- When the user responds — engage directly with what they said. Don't re-explain things they already understood.`;
}

// ─── URL mode: scrape + extract frames ───────────────────────────────────────

async function buildUrlContext(url: string): Promise<{
  contextText: string;
  frames: string[];
  frameSource: 'video' | 'thumbnail' | 'none';
  rawMetrics: { views: number; likes: number; comments: number; durationSec: number; caption: string } | null;
  engagementRate: number;
}> {
  const post = await scrapeInstagramPost(url);

  if (!post) {
    return { contextText: `Instagram URL: ${url}\n(Post could not be scraped.)`, frames: [], frameSource: 'none', rawMetrics: null, engagementRate: 0 };
  }

  const views = post.videoViewCount ?? post.videoPlayCount ?? 0;
  const likes = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;
  const duration = post.videoDuration ?? 0;
  const er = views > 0 ? ((likes + comments) / views) * 100 : 0;

  const rawMetrics = { views, likes, comments, durationSec: duration, caption: post.caption ?? '' };

  const topComments = (post.latestComments ?? [])
    .slice(0, 5)
    .map(c => `"${c.text}"`)
    .join('\n');

  const contextText = `POST DATA:
URL: ${url}
Views: ${views.toLocaleString()} | Likes: ${likes.toLocaleString()} | Comments: ${comments.toLocaleString()}
Engagement rate: ${er.toFixed(2)}% (note: view count from scrape may be cached — treat with caution)
Duration: ${duration}s
Caption: ${(post.caption ?? '(none)').slice(0, 400)}
Hashtags: ${(post.hashtags ?? []).join(' ') || 'none'}
${topComments ? `\nTop comments:\n${topComments}` : ''}`;

  // Attempt to extract real frames + audio from video
  let frames: string[] = [];
  let frameSource: 'video' | 'thumbnail' | 'none' = 'none';
  let transcript: string | null = null;

  if (post.videoUrl && duration > 0) {
    console.log('[edit-feedback] downloading video for frame extraction...');
    const tmpVideo = path.join(os.tmpdir(), `mark-video-${Date.now()}.mp4`);
    const downloaded = await downloadVideo(post.videoUrl, tmpVideo);

    if (downloaded) {
      console.log('[edit-feedback] extracting frames + transcribing audio...');
      const [extractedFrames, audioTranscript] = await Promise.all([
        extractFrames(tmpVideo, duration, 4),
        extractAndTranscribeAudio(tmpVideo),
      ]);
      fs.unlink(tmpVideo, () => {}); // async cleanup

      frames = extractedFrames;
      transcript = audioTranscript;

      if (frames.length > 0) {
        frameSource = 'video';
        console.log(`[edit-feedback] extracted ${frames.length} real frames`);
      }
      if (transcript) {
        console.log('[edit-feedback] audio transcribed successfully');
      }
    }
  }

  // Fallback: use thumbnail
  if (frames.length === 0 && post.displayUrl) {
    console.log('[edit-feedback] falling back to thumbnail');
    const thumb = await fetchThumbnail(post.displayUrl);
    if (thumb) {
      frames = [thumb.data];
      frameSource = 'thumbnail';
    }
  }

  // Append transcript to context if available
  const fullContextText = transcript
    ? `${contextText}\n\nAUDIO TRANSCRIPT (Whisper):\n${transcript}`
    : contextText;

  return { contextText: fullContextText, frames, frameSource, rawMetrics, engagementRate: er };
}

// ─── Build video context text ─────────────────────────────────────────────────

function buildVideoContextText(videoMeta: { name: string; durationSec: number; sizeMb: number }): string {
  return `VIDEO FILE:
Name: ${videoMeta.name}
Duration: ${videoMeta.durationSec}s
Size: ${videoMeta.sizeMb.toFixed(1)}MB

Frames extracted from the video at evenly-spaced timestamps are attached below.`;
}

// ─── Assemble message content with frames ────────────────────────────────────

function buildMessageContent(
  contextText: string,
  frames: string[],
  frameSource: 'video' | 'thumbnail' | 'none',
  durationSec: number,
  promptText: string,
): (ImageBlockParam | TextBlockParam)[] {
  const content: (ImageBlockParam | TextBlockParam)[] = [];

  content.push({ type: 'text', text: contextText });

  if (frames.length > 0) {
    if (frameSource === 'video') {
      const timestamps = frames.map((_, i) => {
        const pct = i / Math.max(frames.length - 1, 1);
        return Math.round(Math.min(pct * durationSec, durationSec));
      });
      content.push({ type: 'text', text: `\n${frames.length} frames extracted from the actual video:` });
      frames.forEach((frameB64, i) => {
        content.push({ type: 'text', text: `Frame at ~${timestamps[i]}s:` });
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameB64 } });
      });
    } else if (frameSource === 'thumbnail') {
      content.push({ type: 'text', text: '\nCover frame (video file unavailable — this is the thumbnail only):' });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frames[0] } });
    }
  }

  content.push({ type: 'text', text: promptText });
  return content;
}

// ─── Mark call ────────────────────────────────────────────────────────────────

async function callMark(messages: MessageParam[], frameSource: 'video' | 'thumbnail' | 'none' = 'none'): Promise<string> {
  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: buildFeedbackSystemPrompt(frameSource),
    messages,
  });
  return res.content[0].type === 'text' ? res.content[0].text.trim() : 'No response generated.';
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, url, frames, videoMeta, sessionId, userMessage, feedbackHistory, frameSource: continueFrameSource } = body as {
      mode: 'url' | 'video' | 'continue';
      url?: string;
      frames?: string[];
      videoMeta?: { name: string; durationSec: number; sizeMb: number };
      sessionId?: string;
      userMessage?: string;
      feedbackHistory?: FeedbackTurn[];
      frameSource?: 'video' | 'thumbnail' | 'none';
    };

    // ── Continue mode ────────────────────────────────────────────────────────
    if (mode === 'continue') {
      if (!userMessage || !feedbackHistory?.length) {
        return NextResponse.json({ error: 'userMessage and feedbackHistory required' }, { status: 400 });
      }

      const messages: MessageParam[] = feedbackHistory.map(turn => ({
        role: turn.role === 'mark' ? 'assistant' : 'user',
        content: turn.content,
      }));
      messages.push({ role: 'user', content: userMessage });

      const reply = await callMark(messages, continueFrameSource ?? 'video');

      if (sessionId) {
        const sessions = loadAllSessions();
        const session = sessions.find((s: TrainingSession) => s.id === sessionId);
        if (session) {
          session.feedbackRounds.push({
            feedback: userMessage,
            revisedAnalysis: reply,
            savedRule: null,
            timestamp: new Date().toISOString(),
          });
          logSession(session);
        }
      }

      return NextResponse.json({ reply });
    }

    // ── URL mode ─────────────────────────────────────────────────────────────
    if (mode === 'url') {
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

      const { contextText, frames: extractedFrames, frameSource, rawMetrics, engagementRate } =
        await buildUrlContext(url);

      const durationSec = rawMetrics?.durationSec ?? 0;

      const promptText = frameSource === 'video'
        ? 'Please give me your edit feedback on this post. You have real frames from the actual video above.'
        : frameSource === 'thumbnail'
          ? 'Please give me your edit feedback. Note: I only have the cover thumbnail — I cannot see cuts, pacing, or camera movement. Be explicit about what you can and cannot assess from a single frame.'
          : 'Please give me your edit feedback based on the metadata available. The video could not be retrieved.';

      const userContent = buildMessageContent(contextText, extractedFrames, frameSource, durationSec, promptText);
      const feedback = await callMark([{ role: 'user', content: userContent }], frameSource);

      const newSessionId = `p2-${Date.now()}`;
      logSession({
        id: newSessionId,
        url,
        timestamp: new Date().toISOString(),
        rawMetrics: rawMetrics ?? null,
        markAnalysis: null,
        markSummary: feedback,
        phase2Analysis: null,
        feedbackRounds: [],
        rawMarkResponse: feedback,
      });

      return NextResponse.json({
        sessionId: newSessionId,
        feedback,
        rawMetrics,
        engagementRate,
        frameSource,
        frameCount: extractedFrames.length,
        frames: extractedFrames,
        frameDurationSec: durationSec,
      });
    }

    // ── Video mode ───────────────────────────────────────────────────────────
    if (mode === 'video') {
      if (!frames?.length || !videoMeta) {
        return NextResponse.json({ error: 'frames and videoMeta required' }, { status: 400 });
      }

      const contextText = buildVideoContextText(videoMeta);
      const userContent = buildMessageContent(
        contextText, frames, 'video', videoMeta.durationSec,
        'Please give me your edit feedback on this video.',
      );

      const feedback = await callMark([{ role: 'user', content: userContent }], 'video');

      const newSessionId = `p2-video-${Date.now()}`;
      logSession({
        id: newSessionId,
        url: `video:${videoMeta.name}`,
        timestamp: new Date().toISOString(),
        rawMetrics: { durationSec: videoMeta.durationSec, views: 0, likes: 0, comments: 0, caption: '' },
        markAnalysis: null,
        markSummary: feedback,
        phase2Analysis: null,
        feedbackRounds: [],
        rawMarkResponse: feedback,
      });

      return NextResponse.json({
        sessionId: newSessionId,
        feedback,
        rawMetrics: { durationSec: videoMeta.durationSec },
        frameSource: 'video',
        frameCount: frames.length,
        frames,
        frameDurationSec: videoMeta.durationSec,
      });
    }

    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });

  } catch (e: any) {
    console.error('[edit-feedback]', e);
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 });
  }
}
