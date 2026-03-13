import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY || '';
const TIKTOK_HOST   = process.env.RAPIDAPI_TIKTOK_HOST || 'tiktok-api23.p.rapidapi.com';

// ─── Comparable artists by genre ─────────────────────────────────────────────
// Username lists used to find similar creators when fetching real post data
const GENRE_ARTIST_MAP: Record<string, string[]> = {
  'glam rock':        ['yungblud', 'palayeroyale', 'badflowerband', 'missionsband'],
  'alt rock':         ['yungblud', 'badflowerband', 'royalbloodofficial', 'twentyonepilots'],
  'pop rock':         ['oliviarodrigo', 'paramore', 'halsey', 'beabadoobee'],
  'indie pop':        ['clairo', 'beabadoobee', 'phoebebridgers', 'gracie_abrams'],
  'indie rock':       ['arctic_monkeys_official', 'beabadoobee', 'inhaler_band', 'wet_leg'],
  'punk':             ['yungblud', 'badflowerband', 'thewrecks'],
  'metal':            ['spiritbox', 'babymetal_official', 'badomeens'],
  'hip hop':          ['jackharlow', 'cordae', 'smino'],
  'r&b':              ['smino', 'ari_lennox', 'bnxn_official'],
  'pop':              ['sabrinacarpenter', 'oliviarodrigo', 'gracieabrams'],
  'country':          ['noahkahan', 'zach_bryan', 'kaceymusgraves'],
  'folk':             ['noahkahan', 'phoebebridgers', 'boygenius_band'],
  'electronic':       ['flume', 'kaytranada', 'channel_tres'],
  'default':          ['yungblud', 'oliviarodrigo', 'noahkahan', 'beabadoobee'],
};

interface TikTokPost {
  desc: string;
  stats: { playCount: number; likeCount: number; commentCount: number; shareCount: number };
  video?: { duration: number };
}

// ─── Fetch trending posts from a TikTok user ─────────────────────────────────
async function fetchUserPosts(username: string): Promise<TikTokPost[]> {
  try {
    const url = `https://${TIKTOK_HOST}/api/user/posts?uniqueId=${username}&count=10&cursor=0`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': TIKTOK_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Normalise across API response shapes
    const items: any[] = data?.data?.videos || data?.itemList || data?.data?.itemList || [];
    return items.slice(0, 10).map((item: any) => ({
      desc: item.desc || item.title || '',
      stats: {
        playCount:    item.stats?.playCount    || item.statsV2?.playCount    || 0,
        likeCount:    item.stats?.diggCount    || item.statsV2?.diggCount    || 0,
        commentCount: item.stats?.commentCount || item.statsV2?.commentCount || 0,
        shareCount:   item.stats?.shareCount   || item.statsV2?.shareCount   || 0,
      },
      video: { duration: item.video?.duration || 0 },
    }));
  } catch {
    return [];
  }
}

// ─── Search TikTok for genre hashtag posts ───────────────────────────────────
async function searchHashtagPosts(hashtag: string): Promise<TikTokPost[]> {
  try {
    const url = `https://${TIKTOK_HOST}/api/search/general?query=${encodeURIComponent(hashtag)}&count=20&cursor=0`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': TIKTOK_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.data || data?.itemList || [];
    return items.slice(0, 20).map((item: any) => ({
      desc: item.item?.desc || item.desc || '',
      stats: {
        playCount:    item.item?.stats?.playCount    || 0,
        likeCount:    item.item?.stats?.diggCount    || 0,
        commentCount: item.item?.stats?.commentCount || 0,
        shareCount:   item.item?.stats?.shareCount   || 0,
      },
      video: { duration: item.item?.video?.duration || 0 },
    }));
  } catch {
    return [];
  }
}

// ─── Derive TikTok data: top-performing posts from 2 comparable artists ──────
async function getTikTokInsights(genres: string[]): Promise<TikTokPost[]> {
  const genreKey = genres
    .map(g => g.toLowerCase())
    .find(g => GENRE_ARTIST_MAP[g]) || 'default';

  const artists = GENRE_ARTIST_MAP[genreKey].slice(0, 2);
  const primaryGenre = genreKey !== 'default' ? genreKey : (genres[0] || 'indie');

  // Fetch artist posts + hashtag search in parallel
  const [a1Posts, a2Posts, hashtagPosts] = await Promise.all([
    fetchUserPosts(artists[0]),
    fetchUserPosts(artists[1]),
    searchHashtagPosts(`${primaryGenre} music`),
  ]);

  // Combine and sort by play count
  const all = [...a1Posts, ...a2Posts, ...hashtagPosts]
    .filter(p => p.desc.length > 5)
    .sort((a, b) => b.stats.playCount - a.stats.playCount)
    .slice(0, 25);

  return all;
}

// ─── Ask Claude to synthesise TikTok data into content insights ──────────────
async function synthesiseInsights(
  posts: TikTokPost[],
  artistContext: {
    genres: string[];
    songName: string;
    songStory: string;
    artistVibe: string;
    comfortLevel: string;
    releaseDate: string;
    feedback?: string;
    previousIdeas?: ContentIdea[];
    // Stafford: scene-based generation (H, F)
    songEmotion?: string;
    shootLocation?: string;
    listeningContext?: string;
    // Structured per-idea rejection feedback from user
    rejectedWithNotes?: { title: string; hook: string; userNote: string }[];
    // F2: artist pitched their own concept — use as creative direction
    artistPitchedConcept?: string;
    // F8: real weather data for shoot date + location
    weatherContext?: string;
    // F11: crew info for difficulty sorting hint
    crewInfo?: string;
    // L5/L6: lyrics from Whisper transcription — used to ground scene recommendations
    lyricsContext?: string;
  }
): Promise<ContentIdea[]> {
  const postsText = posts.slice(0, 20).map((p, i) =>
    `[${i + 1}] Views:${fmtNum(p.stats.playCount)} Likes:${fmtNum(p.stats.likeCount)} Shares:${fmtNum(p.stats.shareCount)} Duration:${p.video?.duration || '?'}s\nCaption: "${p.desc.slice(0, 120)}"`
  ).join('\n\n');

  const previousIdeasText = artistContext.previousIdeas && artistContext.previousIdeas.length > 0
    ? `\nSCENES ALREADY SHOWN (do NOT repeat these): ${artistContext.previousIdeas.map(i => i.title).join(', ')}`
    : '';

  const feedbackText = artistContext.feedback
    ? `\nARTIST FEEDBACK on previous ideas: "${artistContext.feedback}"\nIncorporate this feedback — lean into what they want, away from what they didn't like.`
    : '';

  // Per-idea rejection feedback with user notes
  const rejectionFeedbackText = artistContext.rejectedWithNotes && artistContext.rejectedWithNotes.length > 0
    ? `\nIDEAS THE ARTIST REJECTED (with their specific reasons — do NOT repeat these concepts):\n${artistContext.rejectedWithNotes.map(r => `- "${r.title}" (${r.hook}) — artist said: "${r.userNote || 'no reason given'}"`)
        .join('\n')}`
    : '';

  // Derive current season/month for weather-appropriate suggestions
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const hemisphere = 'northern'; // could be made dynamic from location later
  const seasonMap: Record<number, string> = { 12: 'winter', 1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'fall' };
  const season = seasonMap[now.getMonth() + 1] || 'spring';

  // Stafford approach: location + emotion context for scene-based ideas
  const staffordContext = [
    artistContext.songEmotion ? `- Song emotion filter: "${artistContext.songEmotion}" — every scene must evoke THIS emotion` : '',
    artistContext.shootLocation
      ? `- Confirmed shoot location: "${artistContext.shootLocation}"\n  ⚠️ HARD CONSTRAINT: Every single scene MUST be physically possible at THIS location. Do NOT suggest anything requiring a different setting (no beach/ocean if inland, no rain/snow unless currently present, no urban architecture if in nature, etc.). Before writing each idea, verify it is achievable at "${artistContext.shootLocation}".`
      : '',
    `- Current season/month: ${monthName} ${year} (${season}, ${hemisphere} hemisphere) — suggest weather/light conditions realistic for this time of year at the location`,
    artistContext.listeningContext ? `- Listening context: someone hears this song while "${artistContext.listeningContext}"` : '',
  ].filter(Boolean).join('\n');

  const pitchedConceptText = artistContext.artistPitchedConcept
    ? `\nARTIST'S OWN IDEA (use as creative direction — build on this energy, don't repeat it exactly):\n"${artistContext.artistPitchedConcept}"\n`
    : '';

  const weatherText = artistContext.weatherContext
    ? `\nACTUAL WEATHER on shoot day: ${artistContext.weatherContext}\nAdapt scene recommendations to these conditions — lean into what works, flag what doesn't.`
    : '';

  // L5/L6: lyrics context for scene grounding and lip sync direction
  const lyricsText = artistContext.lyricsContext
    ? `\nSONG LYRICS (use these to ground every scene — all scenes assume artist is lip syncing to their lyrics):\n"""\n${artistContext.lyricsContext}\n"""\nIMPORTANT: For every scene, reference a SPECIFIC lyric line in the emotionalAngle field (quote it). The action field MUST lead with the lip sync moment — describe what the artist is physically doing while lip syncing that line (angle, framing, body position).`
    : '';

  const prompt = `You are a music content strategist analyzing real TikTok/Instagram Reels data to generate SCENE IDEAS for a music artist's shoot day.

REAL TIKTOK DATA — Top performing posts from comparable ${artistContext.genres.join('/')} artists:
${postsText || '(No TikTok data available — use your knowledge of the genre)'}

ARTIST CONTEXT:
- Genre: ${artistContext.genres.join(', ')}
- Song: "${artistContext.songName}" (releases ${artistContext.releaseDate})
- Story/emotion: ${artistContext.songStory || 'Not provided'}
- Artist vibe/aesthetic: ${artistContext.artistVibe || 'Not specified'}
${staffordContext ? `\nSCENE LOCATION + CONTEXT (FOLLOW STRICTLY):\n${staffordContext}` : ''}
${weatherText}${lyricsText}${pitchedConceptText}${feedbackText}${rejectionFeedbackText}${previousIdeasText}

ALGORITHM CONTEXT (2026):
- DM shares weight 3-5x more than likes
- Watch time + replay rate are the #1 ranking factors
- 7-15 second Reels get highest completion rates
- Saves signal long-term value; shares signal immediate recommendation
- 85% of Reels watched with sound OFF — text overlay is critical
- Use original audio → your song becomes a clickable sound others can use

STAFFORD METHOD: Each output is a SCENE (a specific, shootable setup at the confirmed location) — NOT a post or caption. Think: what spot within ${artistContext.shootLocation || 'the location'}, what the artist is doing, what the viewer sees in the first 3 seconds. One scene = one look on shoot day. Multiple reels come from each scene.${artistContext.shootLocation ? `\n\nFINAL CHECK before responding: scan each idea and confirm it is physically possible at "${artistContext.shootLocation}" in ${monthName}. If any idea fails this check, replace it.` : ''}

Generate exactly 5 FRESH scene ideas. Each must be specific to THIS artist, THIS song, and THIS location.${artistContext.previousIdeas?.length ? ' Make these clearly different from the previous ideas listed above.' : ''}

Respond ONLY with a valid JSON array. No markdown, no code fences, just the raw JSON:
[
  {
    "id": "idea_1",
    "title": "Short evocative scene name (3-5 words, describes the SCENE not a post)",
    "setting": "Specific spot within the confirmed location — name a real sub-location, describe the light, environment, and physical surroundings. Be concrete: 'the rocky overlook near the summit trailhead, open sky behind artist' not just 'hilltop'",
    "action": "Lead with the lip sync moment: which lyric line the artist is delivering, their body position and framing while doing it, then describe any movement or interaction with the environment",
    "emotionalAngle": "Quote a specific lyric line from the song, then explain in one sentence why THIS setting makes that line land — what the visual adds to the word",
    "firstFrame": "What the viewer sees in the exact first 3 seconds — describe the opening image as if narrating a film frame: who is in frame, from what angle, what's in the background, what the artist is doing at that precise moment",
    "timeOfDay": "Best time to shoot this scene for optimal light — be specific: 'golden hour (1hr before sunset)', 'midday shade under canopy', 'overcast morning for flat diffused light'",
    "difficulty": "easy | medium | hard",
    "practicalRequirements": "What the artist actually needs to bring: e.g. 'phone only, no setup' or 'tripod + golden hour timing required' or 'friend to operate camera'",
    "needsCameraOperator": true or false
  }
]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Strip any accidental markdown wrapping
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ContentIdea[];
  } catch {
    console.error('[TikTok Insights] Failed to parse Claude response:', raw.slice(0, 200));
    return getFallbackIdeas(artistContext.songName, artistContext.genres[0] || 'indie');
  }
}

export interface ContentIdea {
  id: string;
  title: string;
  setting: string;        // Where exactly within the location (specific spot, lighting, environment)
  action: string;         // What the artist is physically doing in this scene
  emotionalAngle: string; // Why this scene fits the song's emotion — one short sentence
  firstFrame: string;     // What the viewer sees in the first 3 seconds (Stafford method)
  timeOfDay: string;      // Recommended shoot time, e.g. "golden hour (5:30–7pm)" or "midday shade"
  difficulty: 'easy' | 'medium' | 'hard';
  practicalRequirements: string; // e.g. "phone only, no setup" or "tripod + good light timing"
  needsCameraOperator?: boolean; // True if the scene requires a second person to film
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getFallbackIdeas(songName: string, genre: string): ContentIdea[] {
  return [
    {
      id: 'fallback_1',
      title: 'Solitary Moment on Location',
      setting: 'A quiet corner of the location — bench, step, or natural seat — away from foot traffic',
      action: 'Artist sits still, looking into the distance, letting the environment tell the story',
      emotionalAngle: `Captures the quiet longing at the heart of "${songName}" — stillness says more than movement`,
      firstFrame: 'Wide shot — artist small in frame, surrounded by environment. Back to camera or profile. Song starts on cut.',
      timeOfDay: 'Golden hour (1 hour before sunset) for warm, soft light',
      difficulty: 'easy',
      practicalRequirements: 'phone only, no setup needed',
      needsCameraOperator: false,
    },
    {
      id: 'fallback_2',
      title: 'Walking Through the Scene',
      setting: 'Main pathway or trail at the location — moving through the environment',
      action: 'Artist walks slowly toward or away from camera, pausing mid-step',
      emotionalAngle: `Movement without destination — matches the searching feeling of "${songName}"`,
      firstFrame: 'Artist walking away from camera down the path — environment framing both sides. First beat lands as they stop.',
      timeOfDay: 'Late afternoon for dappled or directional light',
      difficulty: 'easy',
      practicalRequirements: 'phone only, friend holds camera or use a tripod',
      needsCameraOperator: true,
    },
  ];
}

// ─── Evaluate a user-pitched idea ─────────────────────────────────────────────
async function evaluateUserIdea(
  posts: TikTokPost[],
  ctx: { genres: string[]; songName: string; artistVibe: string; comfortLevel: string; releaseDate: string; userIdea: string }
): Promise<{ idea: ContentIdea; markFeedback: string }> {
  const postsText = posts.slice(0, 12).map((p, i) =>
    `[${i + 1}] Views:${fmtNum(p.stats.playCount)} Likes:${fmtNum(p.stats.likeCount)} Shares:${fmtNum(p.stats.shareCount)}\nCaption: "${p.desc.slice(0, 100)}"`
  ).join('\n\n');

  const prompt = `You are Mark, a music content strategist. An artist has pitched their own post idea. Your job is to give honest, specific feedback and refine it into a strong, schedulable post concept.

ARTIST'S IDEA:
"${ctx.userIdea}"

ARTIST CONTEXT:
- Genre: ${ctx.genres.join(', ')}
- Song: "${ctx.songName}" (releases ${ctx.releaseDate})
- Visual vibe: ${ctx.artistVibe || 'not specified'}
- Camera comfort: ${ctx.comfortLevel || 'not specified'}

REAL TIKTOK DATA from comparable artists:
${postsText || '(No live data — use genre knowledge)'}

ALGORITHM CONTEXT (2026):
- DM shares weight 3-5x more than likes
- Watch time + replay rate are the #1 ranking factors  
- 7-15 second Reels get highest completion rates
- 85% watched with sound OFF — text overlay is critical

Evaluate and refine the artist's idea. Be conversational, honest, and specific. Don't be generic.

Return EXACTLY this JSON (no markdown, no code fences):
{
  "markFeedback": "2-3 sentences max. What works about their idea, one specific improvement, then an encouraging close. Conversational tone, like texting a friend who's good at this.",
  "idea": {
    "id": "user_idea_1",
    "title": "Refined scene name (3-5 words, describes the setup not a post)",
    "setting": "Specific spot and environment for this scene",
    "action": "What the artist is physically doing",
    "emotionalAngle": "One sentence on why this scene fits the song's emotion",
    "timeOfDay": "Best time to shoot — be specific",
    "difficulty": "easy",
    "practicalRequirements": "What equipment/setup is needed"
  }
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { idea: parsed.idea as ContentIdea, markFeedback: parsed.markFeedback as string };
  } catch {
    console.error('[TikTok Insights] Failed to parse evaluation response:', raw.slice(0, 200));
    return {
      markFeedback: "I like the direction — let's refine it and get it scheduled.",
      idea: {
        id: 'user_idea_1',
        title: 'Your scene concept',
        setting: ctx.userIdea.slice(0, 80),
        action: 'Artist-defined setup',
        emotionalAngle: 'Authentic, artist-driven concept',
        firstFrame: 'Artist in frame, song starts on first cut',
        timeOfDay: 'Choose based on location light',
        difficulty: 'easy',
        practicalRequirements: 'phone only',
      },
    };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      genres = ['indie'],
      songName = '',
      songStory = '',
      artistVibe = '',
      comfortLevel = '',
      releaseDate = '',
      feedback = '',
      previousIdeas = [],
      userIdea = '',            // "I have an idea" mode — evaluate a user-pitched concept
      // Stafford: scene-based generation (H, F)
      songEmotion = '',
      shootLocation = '',
      listeningContext = '',
      rejectedWithNotes = [],   // per-idea rejection feedback [{title, hook, userNote}]
      artistPitchedConcept = '', // F2: artist's own pitched concept to guide next batch
      weatherContext = '',       // F8: real weather forecast for shoot date
      lyricsContext = '',        // L5/L6: song lyrics from Whisper transcription
    } = body;

    // Fetch TikTok data (used by both modes)
    const posts = await getTikTokInsights(genres);

    // ── User-pitched idea: evaluate + refine ──────────────────────────────────
    if (userIdea) {
      const result = await evaluateUserIdea(posts, {
        genres, songName, artistVibe, comfortLevel, releaseDate, userIdea,
      });
      return NextResponse.json({
        ideas: [result.idea],
        markFeedback: result.markFeedback,
        tiktokPostsAnalyzed: posts.length,
        genreUsed: genres[0],
        mode: 'evaluation',
      });
    }

    // ── Mark generates ideas ──────────────────────────────────────────────────
    const ideas = await synthesiseInsights(posts, {
      genres, songName, songStory, artistVibe, comfortLevel, releaseDate,
      feedback: feedback || undefined,
      previousIdeas: previousIdeas.length > 0 ? previousIdeas : undefined,
      // Stafford: scene context
      songEmotion: songEmotion || undefined,
      shootLocation: shootLocation || undefined,
      listeningContext: listeningContext || undefined,
      rejectedWithNotes: rejectedWithNotes.length > 0 ? rejectedWithNotes : undefined,
      artistPitchedConcept: artistPitchedConcept || undefined,
      weatherContext: weatherContext || undefined,
      lyricsContext: lyricsContext || undefined,
    });

    return NextResponse.json({
      ideas,
      tiktokPostsAnalyzed: posts.length,
      genreUsed: genres[0],
    });
  } catch (err: any) {
    console.error('[TikTok Insights API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
