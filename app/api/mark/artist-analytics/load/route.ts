/**
 * GET /api/mark/artist-analytics/load?userId=xxx
 *
 * Loads saved Tier 3 analytics from Supabase for a given user.
 * Returns accountSummary, tier3Context, topPosts if previously scraped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();

    if (error || !prof) {
      return NextResponse.json({ analytics: null });
    }

    const analytics = prof.onboarding_profile?.instagramAnalytics ?? null;
    const instagramHandle = prof.onboarding_profile?.instagramHandle ?? null;

    return NextResponse.json({ analytics, instagramHandle });
  } catch (e: any) {
    console.error('[artist-analytics/load]', e);
    return NextResponse.json({ error: e.message ?? 'Load failed' }, { status: 500 });
  }
}
