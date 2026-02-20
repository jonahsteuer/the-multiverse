import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ============================================================================
// GET /api/instagram/analytics?postId=xxx
// Fetches performance metrics for a specific Instagram post
// Requires: instagram_manage_insights permission (needs Meta app review for production)
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const instagramPostId = searchParams.get('postId');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Get tokens from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('instagram_access_token, instagram_user_id, facebook_access_token, facebook_page_id')
      .eq('id', user.id)
      .single();

    if (!profile?.instagram_access_token) {
      return NextResponse.json({ error: 'Instagram not connected' }, { status: 401 });
    }

    const pageToken = profile.facebook_access_token || profile.instagram_access_token;

    if (instagramPostId) {
      // Fetch metrics for a specific post
      const metricsRes = await fetch(
        `https://graph.facebook.com/v21.0/${instagramPostId}/insights?` +
        `metric=impressions,reach,likes,comments,shares,saves,video_views,plays&` +
        `access_token=${pageToken}`
      );
      const metricsData = await metricsRes.json();

      if (metricsData.error) {
        return NextResponse.json({ 
          error: metricsData.error.message,
          code: metricsData.error.code 
        }, { status: 400 });
      }

      // Also get basic media info
      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${instagramPostId}?` +
        `fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&` +
        `access_token=${pageToken}`
      );
      const mediaData = await mediaRes.json();

      // Format metrics
      const metrics: Record<string, number> = {};
      for (const item of metricsData.data || []) {
        metrics[item.name] = item.values?.[0]?.value || item.value || 0;
      }

      return NextResponse.json({
        postId: instagramPostId,
        caption: mediaData.caption,
        mediaType: mediaData.media_type,
        thumbnailUrl: mediaData.thumbnail_url || mediaData.media_url,
        postedAt: mediaData.timestamp,
        likeCount: mediaData.like_count || 0,
        commentCount: mediaData.comments_count || 0,
        metrics,
      });
    }

    // No specific post — return recent media list
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${profile.instagram_user_id}/media?` +
      `fields=id,caption,media_type,thumbnail_url,timestamp,like_count,comments_count&` +
      `limit=30&access_token=${pageToken}`
    );
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      return NextResponse.json({ error: mediaData.error.message }, { status: 400 });
    }

    return NextResponse.json({ media: mediaData.data || [] });

  } catch (err: any) {
    console.error('[Instagram Analytics] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================================
// POST /api/instagram/analytics/sync
// Syncs analytics for all approved/posted team tasks that have instagram_post_id
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { teamId } = await request.json();
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

    const pageToken = profile.facebook_access_token || profile.instagram_access_token;

    // Get all tasks with instagram_post_id
    const { data: tasks } = await supabase
      .from('team_tasks')
      .select('id, instagram_post_id, title, date')
      .eq('team_id', teamId)
      .not('instagram_post_id', 'is', null)
      .eq('post_status', 'posted');

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No posted tasks to sync' });
    }

    let synced = 0;
    for (const task of tasks) {
      try {
        const metricsRes = await fetch(
          `https://graph.facebook.com/v21.0/${task.instagram_post_id}/insights?` +
          `metric=impressions,reach,likes,comments,shares,saves&access_token=${pageToken}`
        );
        const metricsData = await metricsRes.json();

        if (!metricsData.error && metricsData.data) {
          const metrics: Record<string, number> = {};
          for (const item of metricsData.data) {
            metrics[item.name] = item.values?.[0]?.value || 0;
          }

          await supabase
            .from('team_tasks')
            .update({
              mark_analysis: {
                ...(task as any).mark_analysis,
                performance: metrics,
                lastSynced: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          synced++;
        }
      } catch (taskErr) {
        console.error('[Instagram Analytics] Error syncing task:', task.id, taskErr);
      }
    }

    return NextResponse.json({ synced, total: tasks.length });

  } catch (err: any) {
    console.error('[Instagram Analytics] Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

