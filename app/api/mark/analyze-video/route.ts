import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// Helpers: Extract thumbnail URL from video link
// ============================================================================

function parseVideoLink(url: string): { 
  source: 'google_drive' | 'dropbox' | 'youtube' | 'direct';
  embedUrl: string;
  thumbnailUrl: string | null;
  fileId?: string;
} | null {
  try {
    // Google Drive: https://drive.google.com/file/d/{ID}/view or /share
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return {
        source: 'google_drive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1280`,
        fileId,
      };
    }

    // YouTube: youtu.be/{ID} or youtube.com/watch?v={ID} or youtube.com/shorts/{ID}
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      return {
        source: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        fileId: videoId,
      };
    }

    // Dropbox: old format /s/{hash}/ or new format /scl/fi/{uuid}/
    // Convert to ?raw=1 which serves the file inline (streamable in <video> tag)
    const dropboxMatch = url.match(/dropbox\.com\/(s|sh|scl\/fi)\//);
    if (dropboxMatch) {
      // Remove any existing dl/raw params and add raw=1 for inline streaming
      const cleanUrl = url.replace(/[?&](dl|raw)=[^&]*/g, '').replace(/[?&]$/, '');
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const streamUrl = `${cleanUrl}${separator}raw=1`;
      return {
        source: 'dropbox',
        embedUrl: streamUrl,
        thumbnailUrl: null,
      };
    }

    // Direct video URL (.mp4, .mov, .webm)
    if (url.match(/\.(mp4|mov|webm|avi)(\?.*)?$/i)) {
      return {
        source: 'direct',
        embedUrl: url,
        thumbnailUrl: null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// POST /api/mark/analyze-video
// Accepts a video URL, fetches thumbnail, sends to Claude Vision for analysis
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, postType, postTitle, artistName, songName } = body as {
      videoUrl: string;
      postType?: string;
      postTitle?: string;
      artistName?: string;
      songName?: string;
    };

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
    }

    const parsed = parseVideoLink(videoUrl);
    if (!parsed) {
      return NextResponse.json({ 
        error: 'Could not parse video URL. Supported: Google Drive, YouTube, Dropbox, or direct .mp4 links.' 
      }, { status: 400 });
    }

    let analysisResult: {
      colorPalette: string[];
      setting: string;
      hasInstrument: boolean;
      cameraDistance: string;
      hasTextOverlay: boolean;
      estimatedLength?: string;
      energyLevel: string;
      markNotes: string;
      score: number;
      strengths: string[];
      improvements: string[];
    };

    if (parsed.thumbnailUrl) {
      // Fetch thumbnail and send to Claude Vision
      try {
        const thumbnailRes = await fetch(parsed.thumbnailUrl);
        if (!thumbnailRes.ok) throw new Error('Could not fetch thumbnail');
        
        const imageBuffer = await thumbnailRes.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const contentType = thumbnailRes.headers.get('content-type') || 'image/jpeg';

        const context = [
          artistName ? `Artist: ${artistName}` : '',
          songName ? `Song: ${songName}` : '',
          postType ? `Post type: ${postType} (${postType === 'teaser' ? 'build anticipation before release' : postType === 'promo' ? 'promote the released song' : 'audience building'})` : '',
          postTitle ? `Post title: ${postTitle}` : '',
        ].filter(Boolean).join('\n');

        const response = await anthropic.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: contentType as any,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `You are Mark, an experienced music industry social media strategist. Analyze this video thumbnail/first frame for a social media post.

${context}

Analyze the following and respond in JSON format:
{
  "colorPalette": ["#hex1", "#hex2", "#hex3"] (dominant colors you observe),
  "setting": "brief description of location/environment",
  "hasInstrument": true/false,
  "cameraDistance": "close-up" | "medium" | "wide" | "extreme-close-up",
  "hasTextOverlay": true/false,
  "energyLevel": "low" | "medium" | "high",
  "score": 1-10 (overall hook/visual strength for social media),
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "markNotes": "2-3 sentences of practical feedback as Mark would say it — specific, direct, industry-experienced tone. Address what's working and what could be stronger for a ${postType || 'social media'} post."
}

Be honest and specific. Focus on what actually matters for social media performance: hook strength, visual clarity, authenticity, and whether it fits the post goal.`,
              },
            ],
          }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse Claude response as JSON');
        }
      } catch (visionError) {
        console.error('[analyze-video] Vision analysis failed, using fallback:', visionError);
        // Fallback: text-only analysis
        analysisResult = await getTextOnlyAnalysis(postType, postTitle, artistName, songName);
      }
    } else {
      // No thumbnail available (Dropbox) — ask Mark for guidance without vision
      analysisResult = await getTextOnlyAnalysis(postType, postTitle, artistName, songName);
    }

    return NextResponse.json({
      ...parsed,
      analysis: analysisResult,
    });

  } catch (error: any) {
    console.error('[analyze-video] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze video', details: error.message },
      { status: 500 }
    );
  }
}

async function getTextOnlyAnalysis(
  postType?: string,
  postTitle?: string,
  artistName?: string,
  songName?: string
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are Mark, a music industry social media strategist. 
      
A video has been linked for a ${postType || 'social media'} post${postTitle ? ` titled "${postTitle}"` : ''}${artistName ? ` for ${artistName}` : ''}${songName ? ` promoting "${songName}"` : ''}.

I couldn't get a preview of the video, but respond with general guidance in JSON:
{
  "colorPalette": [],
  "setting": "unknown — preview unavailable",
  "hasInstrument": false,
  "cameraDistance": "unknown",
  "hasTextOverlay": false,
  "energyLevel": "unknown",
  "score": 0,
  "strengths": [],
  "improvements": ["Upload to Google Drive or YouTube for automatic analysis"],
  "markNotes": "I couldn't get a preview of this one — try linking it from Google Drive or YouTube so I can take a proper look. In the meantime, make sure your hook hits in the first 2-3 seconds and the visual is clean and on-brand."
}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {
    colorPalette: [],
    setting: 'preview unavailable',
    hasInstrument: false,
    cameraDistance: 'unknown',
    hasTextOverlay: false,
    energyLevel: 'unknown',
    score: 0,
    strengths: [],
    improvements: ['Link from Google Drive or YouTube for automatic analysis'],
    markNotes: "I couldn't preview this video. Link it from Google Drive or YouTube so I can give you real feedback.",
  };
}

