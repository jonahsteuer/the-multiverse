import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const STORAGE_BUCKET = 'smartedit-videos';

/**
 * POST /api/instagram/schedule-post
 *
 * Accepts multipart/form-data:
 *   - video: Blob (MP4)
 *   - caption: string
 *   - scheduledPublishTime: ISO timestamp (UTC)
 *   - pieceIndex: number
 *   - isTrialReel: 'true' | undefined
 *   - variationType: 'hook-swap' | 'length-trim' | 'audio-shift' | undefined
 *
 * Steps:
 *   1. Upload video blob to Supabase Storage → get public URL
 *   2. Create Instagram container (video + caption + schedule)
 *   3. Publish container
 *   4. Return { success, instagramMediaId }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('instagram_access_token, instagram_user_id')
      .eq('id', user.id)
      .single();

    if (!profile?.instagram_access_token || !profile?.instagram_user_id) {
      return NextResponse.json({ error: 'Instagram not connected', message: 'Please connect Instagram first' }, { status: 401 });
    }

    // ── Parse form data ───────────────────────────────────────────────────────
    const formData = await request.formData();
    const videoBlob = formData.get('video') as File | null;
    const caption = formData.get('caption') as string ?? '';
    const scheduledPublishTime = formData.get('scheduledPublishTime') as string;
    const pieceIndex = Number(formData.get('pieceIndex') ?? 0);
    const isTrialReel = formData.get('isTrialReel') === 'true';
    const variationType = formData.get('variationType') as string | null;

    if (!videoBlob) {
      return NextResponse.json({ error: 'Missing video blob' }, { status: 400 });
    }
    if (!scheduledPublishTime) {
      return NextResponse.json({ error: 'Missing scheduledPublishTime' }, { status: 400 });
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const storageKey = `${user.id}/piece-${pieceIndex}${isTrialReel ? `-trial-${variationType ?? 'unknown'}` : ''}-${Date.now()}.mp4`;
    const videoBuffer = await videoBlob.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storageKey, videoBuffer, { contentType: 'video/mp4', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: 'Storage upload failed', message: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storageKey);
    const videoUrl = publicUrlData.publicUrl;

    // ── Step 1: Create Instagram media container ──────────────────────────────
    const containerRes = await fetch(
      `${GRAPH_API}/${profile.instagram_user_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          // Scheduling requires a Unix timestamp (seconds)
          scheduled_publish_time: Math.floor(new Date(scheduledPublishTime).getTime() / 1000),
          publish_type: 'SCHEDULED',
          access_token: profile.instagram_access_token,
        }),
      }
    );

    const containerData = await containerRes.json();

    if (containerData.error) {
      return NextResponse.json(
        { error: 'Container creation failed', message: containerData.error.message },
        { status: 400 }
      );
    }

    const containerId: string = containerData.id;

    // ── Step 2: Poll until container is ready ─────────────────────────────────
    // Instagram requires the container to reach status_code FINISHED before publishing.
    // For scheduled posts, we just wait up to 30 s with 5 s intervals.
    let statusCode = 'IN_PROGRESS';
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts && statusCode === 'IN_PROGRESS'; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${profile.instagram_access_token}`
      );
      const statusData = await statusRes.json();
      statusCode = statusData.status_code ?? 'IN_PROGRESS';
    }

    if (statusCode !== 'FINISHED') {
      return NextResponse.json(
        { error: 'Container not ready', message: `status_code: ${statusCode}` },
        { status: 500 }
      );
    }

    // ── Step 3: Publish container ─────────────────────────────────────────────
    const publishRes = await fetch(
      `${GRAPH_API}/${profile.instagram_user_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: profile.instagram_access_token,
        }),
      }
    );

    const publishData = await publishRes.json();

    if (publishData.error) {
      return NextResponse.json(
        { error: 'Publish failed', message: publishData.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, instagramMediaId: publishData.id });
  } catch (error) {
    console.error('[schedule-post]', error);
    return NextResponse.json(
      { error: 'Failed to schedule Instagram post', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
