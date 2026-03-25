import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { selectWinner, type TrialReelEngagement } from '@/lib/instagram-posting';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * POST /api/instagram/check-engagement
 *
 * Body: { trialReels: Array<{ instagramMediaId: string; variationType: string }> }
 *
 * For each trial reel, fetches Instagram Insights (video_views, reach, likes,
 * comments, shares, saves) then runs selectWinner() to determine which
 * variation performed best.
 *
 * Returns: { winner, reels, reason }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('instagram_access_token, facebook_access_token')
      .eq('id', user.id)
      .single();

    if (!profile?.instagram_access_token) {
      return NextResponse.json({ error: 'Instagram not connected' }, { status: 401 });
    }

    const token = profile.facebook_access_token || profile.instagram_access_token;

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await request.json() as {
      trialReels: Array<{ instagramMediaId: string; variationType: string }>;
    };

    if (!Array.isArray(body.trialReels) || body.trialReels.length === 0) {
      return NextResponse.json({ error: 'Missing trialReels array' }, { status: 400 });
    }

    // ── Fetch engagement metrics for each reel ────────────────────────────────
    const engagementResults: TrialReelEngagement[] = [];
    const errors: string[] = [];

    for (const reel of body.trialReels) {
      try {
        // Fetch Insights — video_views and reach for watch-through rate
        const insightsRes = await fetch(
          `${GRAPH_API}/${reel.instagramMediaId}/insights?` +
          `metric=video_views,reach,likes,comments,shares,saved&` +
          `access_token=${token}`
        );
        const insightsData = await insightsRes.json();

        if (insightsData.error) {
          errors.push(`${reel.variationType}: ${insightsData.error.message}`);
          continue;
        }

        const metrics: Record<string, number> = {};
        for (const item of insightsData.data ?? []) {
          metrics[item.name] = item.values?.[0]?.value ?? item.value ?? 0;
        }

        const reach = metrics.reach ?? 0;
        const videoViews = metrics.video_views ?? 0;
        const engagementCount =
          (metrics.likes ?? 0) +
          (metrics.comments ?? 0) +
          (metrics.shares ?? 0) +
          (metrics.saved ?? 0);

        engagementResults.push({
          variationType: reel.variationType as TrialReelEngagement['variationType'],
          instagramMediaId: reel.instagramMediaId,
          watchThroughRate: reach > 0 ? videoViews / reach : 0,
          engagementCount,
        });
      } catch (err) {
        errors.push(`${reel.variationType}: ${err instanceof Error ? err.message : 'failed'}`);
      }
    }

    // ── Select winner ─────────────────────────────────────────────────────────
    const { winner, reason } = selectWinner(engagementResults);

    return NextResponse.json({
      winner,
      reason,
      reels: engagementResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[check-engagement]', error);
    return NextResponse.json(
      { error: 'Failed to check engagement', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
