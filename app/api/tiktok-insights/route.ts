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
  }
): Promise<ContentIdea[]> {
  const postsText = posts.slice(0, 20).map((p, i) =>
    `[${i + 1}] Views:${fmtNum(p.stats.playCount)} Likes:${fmtNum(p.stats.likeCount)} Shares:${fmtNum(p.stats.shareCount)} Duration:${p.video?.duration || '?'}s\nCaption: "${p.desc.slice(0, 120)}"`
  ).join('\n\n');

  const prompt = `You are a music content strategist analyzing real TikTok/Instagram Reels data to generate content ideas for a music artist.

REAL TIKTOK DATA — Top performing posts from comparable ${artistContext.genres.join('/')} artists:
${postsText || '(No TikTok data available — use your knowledge of the genre)'}

ARTIST CONTEXT:
- Genre: ${artistContext.genres.join(', ')}
- Song: "${artistContext.songName}" (releases ${artistContext.releaseDate})
- Story behind the song: ${artistContext.songStory || 'Not provided'}
- Artist vibe/aesthetic: ${artistContext.artistVibe || 'Not specified'}
- Comfort on camera: ${artistContext.comfortLevel || 'Not specified'}

ALGORITHM CONTEXT (2026):
- DM shares weight 3-5x more than likes
- Watch time + replay rate are the #1 ranking factors
- 7-15 second Reels get highest completion rates
- Saves signal long-term value; shares signal immediate recommendation
- 85% of Reels watched with sound OFF — text overlay is critical
- Use original audio → your song becomes a clickable sound others can use

Generate exactly 5 content ideas. Each must be specific to THIS artist and THIS song.

Respond ONLY with a valid JSON array. No markdown, no code fences, just the raw JSON:
[
  {
    "id": "idea_1",
    "format": "Performance clip | Talking head | GRWM | Reaction | BTS | Duet prompt | Day-in-life",
    "title": "Short punchy title (4-6 words)",
    "hook": "Exact first 3 seconds — what the viewer sees and hears",
    "captionFormula": "The caption structure/formula (not a full caption — a pattern they can fill in)",
    "exampleCaption": "One specific example caption using the song's actual story",
    "whyItWorks": "One sentence: which metric this drives (saves/shares/comments) and why",
    "difficulty": "easy | medium | hard",
    "equipment": "phone only | phone + basic lighting | professional setup",
    "tiktokSignal": "Which pattern from the real data above inspired this (or 'genre knowledge' if no data)"
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
  format: string;
  title: string;
  hook: string;
  captionFormula: string;
  exampleCaption: string;
  whyItWorks: string;
  difficulty: 'easy' | 'medium' | 'hard';
  equipment: string;
  tiktokSignal: string;
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
      format: 'Talking head',
      title: 'The story behind the song',
      hook: 'You filming yourself saying "I almost didn\'t release this song" — then silence',
      captionFormula: 'I wrote this when [specific emotional moment]. If you\'ve ever [relatable situation], this one\'s for you.',
      exampleCaption: `I wrote "${songName}" when I needed to believe things could change. If you've ever felt stuck — turn this up.`,
      whyItWorks: 'Drives saves and comments — emotional specificity makes people stop scrolling',
      difficulty: 'easy',
      equipment: 'phone only',
      tiktokSignal: 'genre knowledge',
    },
    {
      id: 'fallback_2',
      format: 'Performance clip',
      title: 'Drop-in on the best part',
      hook: 'Start mid-song at the catchiest hook, full energy, no buildup',
      captionFormula: 'No context. Just [adjective] music. [Save prompt].',
      exampleCaption: 'No context. Just the song. Save it for later.',
      whyItWorks: 'Short + high completion rate = algorithmic push to new audiences',
      difficulty: 'easy',
      equipment: 'phone only',
      tiktokSignal: 'genre knowledge',
    },
  ];
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { genres = ['indie'], songName = '', songStory = '', artistVibe = '', comfortLevel = '', releaseDate = '' } = body;

    // Fetch TikTok data + synthesise ideas in parallel where possible
    const posts = await getTikTokInsights(genres);

    const ideas = await synthesiseInsights(posts, {
      genres,
      songName,
      songStory,
      artistVibe,
      comfortLevel,
      releaseDate,
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
