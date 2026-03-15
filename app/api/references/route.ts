import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { sceneTitle, action, location, genre } = await req.json() as {
    sceneTitle: string;
    action?: string;
    location?: string;
    genre?: string;
  };

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ urls: [] });
  }

  // Build a targeted search query
  const parts = [
    sceneTitle,
    action ? action.split(' ').slice(0, 6).join(' ') : '',
    genre || '',
    'music video short film',
  ].filter(Boolean);
  const query = parts.join(' ');

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        include_domains: ['instagram.com', 'tiktok.com'],
        max_results: 5,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      console.warn('[references] Tavily error', res.status);
      return NextResponse.json({ urls: [] });
    }

    const data = await res.json();
    const urls: string[] = (data.results || [])
      .map((r: any) => r.url as string)
      .filter((url: string) =>
        url && (url.includes('instagram.com') || url.includes('tiktok.com'))
      )
      .slice(0, 3);

    return NextResponse.json({ urls });
  } catch (err) {
    console.error('[references] error:', err);
    return NextResponse.json({ urls: [] });
  }
}
