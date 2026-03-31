import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildMarkSystemPrompt, MarkContext } from '@/lib/mark-knowledge';
import { loadUniversalTruths, loadLiveIntelligence, loadArtistNiche, slugify } from '@/lib/mark/intelligence-loader';
import { STAFFORD_KNOWLEDGE } from '@/lib/stafford-knowledge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

async function loadTier3Context(userId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey || !userId) return '';
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();
    return prof?.onboarding_profile?.instagramAnalytics?.tier3Context || '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      context: MarkContext;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Load all intelligence tiers
    const universalTruths = loadUniversalTruths();
    const liveIntelligence = loadLiveIntelligence();
    const artistSlug = context.userName ? slugify(context.userName) : '';
    const artistNiche = artistSlug ? loadArtistNiche(artistSlug) : '';

    // Load Tier 3 — artist-specific Apify analytics from Supabase
    const tier3Context = context.userId ? await loadTier3Context(context.userId) : '';

    // Build system prompt with all intelligence tiers
    const systemPrompt = buildMarkSystemPrompt(context, {
      universalTruths,
      liveIntelligence,
      artistNiche,
      staffordPlaybook: STAFFORD_KNOWLEDGE,
      tier3Context: tier3Context || undefined,
    });

    console.log('[Mark API] Processing request with', messages.length, 'messages');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const assistantMessage = response.content[0];
    
    if (assistantMessage.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    console.log('[Mark API] Response generated successfully');

    return NextResponse.json({
      message: assistantMessage.text,
      usage: response.usage,
    });
  } catch (error: any) {
    console.error('[Mark API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get response from Mark',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

