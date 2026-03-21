/**
 * Refresh Universal Music Content Intelligence
 *
 * Scrapes high-performing music accounts via Apify, analyzes patterns with Claude,
 * and updates /lib/mark/universal-truths.md.
 *
 * Seed accounts: @ruffmusicofficial, @staffordsworld + autonomously discovered music promo accounts.
 * Mark uses this file as background context for every edit and recommendation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const SEED_ACCOUNTS = [
  'ruffmusicofficial',
  'staffordsworld',
];

// Accounts focused on music marketing / artist growth education
const MUSIC_MARKETING_ACCOUNTS = [
  'musicmarketingmanifesto',
  'growthhackersmusic',
  'indie_music_coach',
];

type ApifyPost = {
  likesCount?: number;
  commentsCount?: number;
  videoPlayCount?: number;
  caption?: string;
  timestamp?: string;
  videoUrl?: string;
  type?: string;
  url?: string;
  duration?: number;
};

export async function POST(request: NextRequest) {
  // Require an internal secret to prevent public abuse
  const { authorization } = Object.fromEntries(request.headers);
  if (authorization !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_TOKEN not configured' }, { status: 500 });
  }

  try {
    const client = new ApifyClient({ token: apifyToken });
    const allAccounts = [...SEED_ACCOUNTS, ...MUSIC_MARKETING_ACCOUNTS];

    console.log('[RefreshIntelligence] Scraping accounts:', allAccounts);

    // Run Apify Instagram scraper for all seed accounts
    const run = await client.actor('apify/instagram-scraper').call({
      directUrls: allAccounts.map(a => `https://www.instagram.com/${a}/`),
      resultsType: 'posts',
      resultsLimit: 30,
      addParentData: false,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const posts = items as ApifyPost[];

    console.log(`[RefreshIntelligence] Fetched ${posts.length} posts`);

    // Filter for video posts with meaningful engagement
    const videoPosts = posts.filter(p =>
      p.type === 'Video' || (p.videoPlayCount && p.videoPlayCount > 1000)
    );

    // Sort by engagement (likes + comments)
    const sorted = videoPosts.sort((a, b) =>
      ((b.likesCount || 0) + (b.commentsCount || 0)) -
      ((a.likesCount || 0) + (a.commentsCount || 0))
    );

    const top50 = sorted.slice(0, 50);

    // Summarize data for Claude analysis
    const postSummaries = top50.map(p => ({
      likes: p.likesCount || 0,
      comments: p.commentsCount || 0,
      views: p.videoPlayCount || 0,
      caption: (p.caption || '').slice(0, 300),
      duration: p.duration || null,
      url: p.url || '',
    }));

    // Ask Claude to analyze patterns
    const analysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are analyzing high-performing music content posts from Instagram to extract universal truths about what makes music content succeed.

Here are the top 50 posts by engagement from music marketing accounts (${allAccounts.join(', ')}):

${JSON.stringify(postSummaries, null, 2)}

Analyze these posts and identify patterns across:
1. **Hook types**: What patterns appear in the first line of captions that get high engagement?
2. **Optimal video duration**: What duration range appears most in high-engagement posts?
3. **Caption strategy**: What call-to-action patterns appear most?
4. **Content type patterns**: Performance? BTS? Educational? Story-based?
5. **Engagement patterns**: What content types drive the most comments vs saves vs shares?

Format your response as a clear markdown section that can be appended to an existing knowledge file. Start with "## SCRAPED INTELLIGENCE UPDATE (${new Date().toISOString().split('T')[0]})" and write in the same style as a seasoned music marketing expert. Be specific about what the data shows — avoid vague generalities.`,
      }],
    });

    const analysisText = analysis.content[0].type === 'text' ? analysis.content[0].text : '';

    // Append the new analysis to the universal-truths.md file
    const truePath = path.join(process.cwd(), 'lib', 'mark', 'universal-truths.md');
    const existing = fs.readFileSync(truePath, 'utf-8');

    // Replace the last-updated line and append new section
    const updated = existing
      .replace(/_Last updated:.*_/, `_Last updated: ${new Date().toISOString().split('T')[0]} | Auto-refreshed via Apify intelligence pipeline_`)
      + `\n\n---\n\n${analysisText}`;

    fs.writeFileSync(truePath, updated, 'utf-8');

    console.log('[RefreshIntelligence] universal-truths.md updated successfully');

    return NextResponse.json({
      success: true,
      postsAnalyzed: top50.length,
      accounts: allAccounts,
      message: 'Universal truths updated. Commit lib/mark/universal-truths.md to persist across deployments.',
    });
  } catch (error: any) {
    console.error('[RefreshIntelligence] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
