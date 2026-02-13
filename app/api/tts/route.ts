import { NextRequest, NextResponse } from 'next/server';

// ElevenLabs Text-to-Speech API
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Popular ElevenLabs voices - warm and inviting options
const ELEVENLABS_VOICES = {
  // Female voices
  rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Warm, calm, American female' },
  bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Young, friendly, American female' },
  elli: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Young, pleasant, American female' },
  domi: { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, confident female' },
  // Male voices  
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, warm, American male' },
  josh: { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep, warm, American male' },
  sam: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Young, dynamic, American male' },
};

// Default to Rachel - warm and inviting
const DEFAULT_VOICE_ID = ELEVENLABS_VOICES.rachel.id;

export async function POST(request: NextRequest) {
  try {
    console.log('[TTS] API called');
    console.log('[TTS] API key exists:', !!ELEVENLABS_API_KEY);
    console.log('[TTS] API key length:', ELEVENLABS_API_KEY?.length || 0);
    
    if (!ELEVENLABS_API_KEY) {
      console.error('[TTS] No API key found in environment');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const { text, voiceId } = await request.json();
    console.log('[TTS] Text length:', text?.length, 'Voice ID:', voiceId);

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Clean text (remove emojis and markdown)
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    const selectedVoiceId = voiceId || DEFAULT_VOICE_ID;

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2_5', // Updated model for free tier
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs] API Error:', response.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get audio as array buffer and return as base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      audio: base64Audio,
      format: 'audio/mpeg',
    });

  } catch (error) {
    console.error('[ElevenLabs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}

// GET endpoint to list available voices
export async function GET() {
  return NextResponse.json({
    voices: ELEVENLABS_VOICES,
    defaultVoice: 'rachel',
  });
}

