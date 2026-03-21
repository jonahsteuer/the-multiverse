import { NextRequest, NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

interface ApifyRun {
  data: { id: string; status: string; defaultDatasetId?: string };
}

interface PostItem {
  type?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoDuration?: number;
  timestamp?: string;
  url?: string;
  hashtags?: string[];
}

async function runActor(actorId: string, input: object, timeoutMs = 60_000): Promise<PostItem[]> {
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
  );
  const { data }: ApifyRun = await startRes.json();
  if (!data?.id) return [];

  // Poll for completion
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${data.id}?token=${APIFY_TOKEN}`);
    const { data: run } = await pollRes.json();
    if (run.status === 'SUCCEEDED') {
      const itemsRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${data.id}/dataset/items?token=${APIFY_TOKEN}&limit=20`,
      );
      return itemsRes.json();
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) return [];
  }
  return [];
}

function summariseItems(items: PostItem[], platform: string): string {
  const videos = items.filter(p => p.type === 'Video' || platform === 'tiktok');
  if (!videos.length) return `No ${platform} data available.`;

  const sorted = videos
    .filter(v => v.videoViewCount)
    .sort((a, b) => (b.videoViewCount ?? 0) - (a.videoViewCount ?? 0))
    .slice(0, 10);

  const avgDur = sorted.reduce((s, v) => s + (v.videoDuration ?? 0), 0) / (sorted.length || 1);
  const avgViews = sorted.reduce((s, v) => s + (v.videoViewCount ?? 0), 0) / (sorted.length || 1);

  const captions = sorted
    .slice(0, 5)
    .map(v => `- [${v.videoViewCount?.toLocaleString()} views, ${Math.round(v.videoDuration ?? 0)}s] ${(v.caption ?? '').slice(0, 150)}`)
    .join('\n');

  const allHashtags = sorted.flatMap(v => v.hashtags ?? []);
  const hashtagCounts: Record<string, number> = {};
  allHashtags.forEach(h => { hashtagCounts[h] = (hashtagCounts[h] ?? 0) + 1; });
  const topHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h]) => h)
    .join(', ');

  return `${platform.toUpperCase()} top ${sorted.length} music videos:
Average views: ${Math.round(avgViews).toLocaleString()} | Average duration: ${Math.round(avgDur)}s
Top hashtags: ${topHashtags || 'n/a'}
Top performing captions:
${captions}`;
}

// GET /api/trend-insights?genre=pop&platform=instagram
export async function GET(request: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const genre = searchParams.get('genre') || 'music';
  const platform = searchParams.get('platform') || 'both';

  try {
    const results: Record<string, string> = {};

    const promises: Promise<void>[] = [];

    if (platform === 'instagram' || platform === 'both') {
      promises.push(
        runActor('apify~instagram-scraper', {
          directUrls: [`https://www.instagram.com/explore/tags/${genre}music/`],
          resultsType: 'posts',
          resultsLimit: 20,
        }).then(items => { results.instagram = summariseItems(items, 'instagram'); }),
      );
    }

    if (platform === 'tiktok' || platform === 'both') {
      promises.push(
        runActor('clockworks~tiktok-scraper', {
          hashtags: [`${genre}music`, 'musicmarketing', 'newmusic'],
          resultsPerPage: 20,
          maxRequestRetries: 2,
        }).then(items => { results.tiktok = summariseItems(items, 'tiktok'); }),
      );
    }

    await Promise.allSettled(promises);

    const summary = Object.entries(results)
      .map(([platform, text]) => text)
      .join('\n\n');

    return NextResponse.json({ summary, raw: results, genre, platform });
  } catch (error: any) {
    console.error('[trend-insights]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
