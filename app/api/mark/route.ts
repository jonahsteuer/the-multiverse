import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildMarkSystemPrompt, MarkContext } from '@/lib/mark-knowledge';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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

    // Build system prompt with user context
    const systemPrompt = buildMarkSystemPrompt(context);

    console.log('[Mark API] Processing request with', messages.length, 'messages');

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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

