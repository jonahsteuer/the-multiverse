import { NextRequest, NextResponse } from 'next/server';

// ─── OpenAI Whisper transcription ────────────────────────────────────────────
// L2: Transcribes a song MP3 to lyrics text for use in scene recommendations.
// Falls back gracefully if no OPENAI_API_KEY or if Whisper can't get clean lyrics.

export async function POST(req: NextRequest) {
  try {
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      return NextResponse.json({ transcript: null, success: false, error: 'audioUrl required' }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error('[Transcribe] OPENAI_API_KEY is not set in environment variables');
      return NextResponse.json({ transcript: null, success: false, error: 'OPENAI_API_KEY not configured — set it in Vercel environment variables', missingKey: true });
    }

    // Download the MP3 from Supabase storage
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(20_000) });
    if (!audioRes.ok) {
      return NextResponse.json({ transcript: null, success: false, error: 'Could not download audio file' });
    }

    const audioBuffer = await audioRes.arrayBuffer();
    // Detect file type from URL extension; default to mpeg
    const ext = audioUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'mp3';
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
      flac: 'audio/flac', ogg: 'audio/ogg', webm: 'audio/webm',
    };
    const mimeType = mimeMap[ext] || 'audio/mpeg';
    const fileName = `track.${ext}`;

    // Whisper has a 25MB limit — warn if larger (client should pre-downsample)
    const fileSizeMB = audioBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > 24) {
      return NextResponse.json({
        transcript: null, success: false,
        error: `File too large for transcription (${fileSizeMB.toFixed(1)}MB). Please export as MP3 or convert to a lower bitrate.`,
        tooLarge: true,
      });
    }

    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    // Build multipart form for Whisper
    const form = new FormData();
    form.append('file', audioBlob, fileName);
    form.append('model', 'whisper-1');
    // "verbose_json" gives word timestamps — useful for soundbyte mapping later
    form.append('response_format', 'verbose_json');
    // Hint that this is a music song with lyrics
    form.append('prompt', 'This is a music song. Transcribe the lyrics accurately, including repeated choruses and all verses.');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[Transcribe] Whisper error status:', whisperRes.status, errText);
      let errDetail = errText;
      try { errDetail = JSON.parse(errText)?.error?.message || errText; } catch {}
      return NextResponse.json({
        transcript: null,
        success: false,
        error: `Whisper API error (${whisperRes.status}): ${errDetail}`,
        whisperStatus: whisperRes.status,
      });
    }

    const data = await whisperRes.json();
    const transcript: string = data.text || '';

    // Return segments too — useful for L7 soundbyte-to-lyric mapping
    const segments = data.segments?.map((s: any) => ({
      start: Math.round(s.start),
      end: Math.round(s.end),
      text: s.text?.trim() || '',
    })) || [];

    return NextResponse.json({
      transcript: transcript.trim(),
      segments,
      success: true,
      duration: data.duration || null,
    });
  } catch (err: any) {
    console.error('[Transcribe] Error:', err);
    return NextResponse.json({ transcript: null, success: false, error: err.message });
  }
}
