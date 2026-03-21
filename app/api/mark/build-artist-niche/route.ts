/**
 * Build Artist Niche Intelligence
 *
 * Given an artist's profile data (genre, song emotions, listening context, visual style),
 * uses Claude to identify their niche, finds similar high-performing accounts via Apify,
 * scrapes their top content, and writes a niche profile to /lib/mark/artist-niches/[slug].md.
 *
 * Called:
 * - On first artist onboarding (if triggered)
 * - When Mark receives new footage in SmartEdit and detects new visual context
 * - When the artist explicitly updates their profile
 *
 * Also accepts optional `footageInsights` from SmartEdit to refine the niche.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { slugify } from '@/lib/mark/intelligence-loader';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

type ArtistProfileInput = {
  artistName: string;
  genre?: string[];
  songEmotions?: string[];       // e.g. ["heartbreak", "longing", "hope"]
  listeningContext?: string[];   // e.g. ["late-night drive", "gym", "bedroom"]
  visualAesthetic?: string;      // e.g. "dark and cinematic"
  musicalInspiration?: string[]; // e.g. ["Frank Ocean", "SZA"]
  songTitles?: string[];         // for additional context
  footageInsights?: string;      // optional: what Mark observed from uploaded footage in SmartEdit
};

type ApifyPost = {
  likesCount?: number;
  commentsCount?: number;
  videoPlayCount?: number;
  caption?: string;
  type?: string;
  url?: string;
  duration?: number;
  ownerUsername?: string;
};

export async function POST(request: NextRequest) {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });
  }

  const body = await request.json() as ArtistProfileInput;
  const {
    artistName,
    genre = [],
    songEmotions = [],
    listeningContext = [],
    visualAesthetic = '',
    musicalInspiration = [],
    songTitles = [],
    footageInsights = '',
  } = body;

  if (!artistName) {
    return NextResponse.json({ error: 'artistName is required' }, { status: 400 });
  }

  try {
    // Step 1: Ask Claude to identify the artist's niche and find search terms
    const nicheIdentification = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a music industry expert specializing in social media strategy. Given this artist's profile, identify their niche and return a JSON object.

Artist: ${artistName}
Genre: ${genre.join(', ') || 'unknown'}
Song emotions/themes: ${songEmotions.join(', ') || 'unknown'}
Listening contexts: ${listeningContext.join(', ') || 'unknown'}
Visual aesthetic: ${visualAesthetic || 'unknown'}
Musical inspirations: ${musicalInspiration.join(', ') || 'none listed'}
Song titles: ${songTitles.join(', ') || 'none listed'}
${footageInsights ? `Footage observations: ${footageInsights}` : ''}

Return ONLY valid JSON (no markdown, no explanation):
{
  "niche": "2-4 word niche label (e.g. 'bedroom R&B', 'dark indie pop', 'emotional trap')",
  "nicheDescription": "1-2 sentence description of this artist's content niche",
  "searchTerms": ["array", "of", "3-5", "instagram", "search", "terms", "to", "find", "similar", "artists"],
  "similarArtistAccounts": ["array", "of", "3-5", "instagram", "handles", "of", "similar", "artists", "who", "promote", "their", "music", "well"],
  "contentStyle": "Brief description of the ideal content style for this niche",
  "hookApproach": "What hook type works best for this niche (emotional specificity / pattern interrupt / identity resonance / etc.)",
  "aspectRatioRecommendation": "9:16 or 16:9 and why"
}`,
      }],
    });

    const nicheText = nicheIdentification.content[0].type === 'text' ? nicheIdentification.content[0].text : '{}';
    let nicheData: {
      niche: string;
      nicheDescription: string;
      searchTerms: string[];
      similarArtistAccounts: string[];
      contentStyle: string;
      hookApproach: string;
      aspectRatioRecommendation: string;
    };

    try {
      nicheData = JSON.parse(nicheText.trim());
    } catch {
      console.error('[BuildArtistNiche] Failed to parse niche JSON:', nicheText);
      return NextResponse.json({ error: 'Failed to identify artist niche' }, { status: 500 });
    }

    console.log(`[BuildArtistNiche] Niche identified: ${nicheData.niche}`);
    console.log(`[BuildArtistNiche] Scraping accounts: ${nicheData.similarArtistAccounts.join(', ')}`);

    // Step 2: Scrape the similar artist accounts via Apify
    const client = new ApifyClient({ token: apifyToken });
    let posts: ApifyPost[] = [];

    if (nicheData.similarArtistAccounts.length > 0) {
      try {
        const run = await client.actor('apify/instagram-scraper').call({
          directUrls: nicheData.similarArtistAccounts.map((a: string) => `https://www.instagram.com/${a}/`),
          resultsType: 'posts',
          resultsLimit: 20,
          addParentData: false,
        });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        posts = items as ApifyPost[];
      } catch (apifyErr: any) {
        console.warn('[BuildArtistNiche] Apify scrape failed, continuing without scraped data:', apifyErr.message);
      }
    }

    // Step 3: Analyze scraped content for niche-specific patterns
    const videoPosts = posts.filter(p => p.type === 'Video' || (p.videoPlayCount && p.videoPlayCount > 500));
    const topPosts = videoPosts
      .sort((a, b) => ((b.likesCount || 0) + (b.commentsCount || 0)) - ((a.likesCount || 0) + (a.commentsCount || 0)))
      .slice(0, 30);

    let scrapedPatterns = '';
    if (topPosts.length > 0) {
      const patternAnalysis = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze these top posts from artists in the "${nicheData.niche}" music niche.

Posts:
${JSON.stringify(topPosts.map(p => ({
  likes: p.likesCount || 0,
  comments: p.commentsCount || 0,
  views: p.videoPlayCount || 0,
  caption: (p.caption || '').slice(0, 200),
  duration: p.duration || null,
  account: p.ownerUsername || '',
})), null, 2)}

Identify specific patterns for THIS niche:
1. What caption hooks appear most in high-engagement posts?
2. What video duration range performs best?
3. What emotional tone do captions use (vulnerable? confident? mysterious? relatable)?
4. What content types dominate (performance, BTS, story, lipsync, cinematic)?
5. Any niche-specific patterns not seen in general music content?

Write as a concise markdown section titled "## Niche-Specific Patterns". Be specific.`,
        }],
      });
      scrapedPatterns = patternAnalysis.content[0].type === 'text' ? patternAnalysis.content[0].text : '';
    }

    // Step 4: Write the artist niche file
    const slug = slugify(artistName);
    const nicheFilePath = path.join(process.cwd(), 'lib', 'mark', 'artist-niches', `${slug}.md`);

    const nicheFileContent = `# Artist Niche Intelligence: ${artistName}
_Last updated: ${new Date().toISOString().split('T')[0]}_
_Niche: ${nicheData.niche}_

## Niche Profile
${nicheData.nicheDescription}

**Content Style**: ${nicheData.contentStyle}
**Hook Approach**: ${nicheData.hookApproach}
**Recommended Aspect Ratio**: ${nicheData.aspectRatioRecommendation}

## Reference Accounts Analyzed
${nicheData.similarArtistAccounts.map((a: string) => `- @${a}`).join('\n')}

${scrapedPatterns}

${footageInsights ? `## Footage Observations (from SmartEdit)
${footageInsights}
` : ''}## Edit Guidance for Mark
When editing footage for ${artistName}:
- Default aspect ratio: ${nicheData.aspectRatioRecommendation.startsWith('9') ? '9:16 (vertical)' : '16:9 (horizontal)'}
- Hook approach: ${nicheData.hookApproach}
- Content style: ${nicheData.contentStyle}
- Draw from the niche patterns above when making cut decisions, caption suggestions, and format choices
`;

    fs.writeFileSync(nicheFilePath, nicheFileContent, 'utf-8');

    console.log(`[BuildArtistNiche] Written: ${nicheFilePath}`);

    return NextResponse.json({
      success: true,
      niche: nicheData.niche,
      slug,
      accountsScraped: nicheData.similarArtistAccounts,
      postsAnalyzed: topPosts.length,
      message: `Artist niche file written to lib/mark/artist-niches/${slug}.md`,
    });
  } catch (error: any) {
    console.error('[BuildArtistNiche] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
