import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const snapshotIdeaSchema = z.object({
  worldName: z.string(),
  releaseDate: z.string(),
  color: z.string().optional(),
  visualReferences: z.array(z.string()).optional(),
  artistProfile: z.object({
    genre: z.array(z.string()).optional(),
    enjoyedContentFormats: z.array(z.string()).optional(),
    bestPosts: z.array(z.object({
      description: z.string().optional(),
      postFormat: z.string().optional(),
    })).optional(),
    visualAesthetic: z.string().optional(),
  }).optional(),
  existingSnapshots: z.array(z.object({
    visualDescription: z.string(),
    platform: z.string(),
  })).optional(),
});

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = snapshotIdeaSchema.parse(body);

    const client = getAnthropicClient();

    // Build prompt for snapshot idea generation
    const prompt = buildSnapshotIdeasPrompt(data);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON from response (expecting array of 3-5 ideas)
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const ideas = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ ideas });
  } catch (error) {
    console.error('Error generating snapshot ideas:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to generate snapshot ideas', message: errorMessage },
      { status: 500 }
    );
  }
}

function buildSnapshotIdeasPrompt(data: z.infer<typeof snapshotIdeaSchema>): string {
  const releaseDate = new Date(data.releaseDate);
  const today = new Date();
  const daysUntilRelease = Math.ceil(
    (releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const artistInfo = data.artistProfile ? `
ARTIST PROFILE:
- Genres: ${data.artistProfile.genre?.join(', ') || 'Not specified'}
- Enjoyed Content Formats: ${data.artistProfile.enjoyedContentFormats?.join(', ') || 'Not specified'}
- Visual Aesthetic: ${data.artistProfile.visualAesthetic || 'Not specified'}
- Best Performing Posts: ${data.artistProfile.bestPosts?.map(p => `- ${p.postFormat}: ${p.description || 'No description'}`).join('\n') || 'None'}
` : '';

  const existingSnapshotsInfo = data.existingSnapshots && data.existingSnapshots.length > 0
    ? `\nEXISTING SNAPSHOTS (avoid duplicating these):\n${data.existingSnapshots.map((s, i) => `${i + 1}. ${s.visualDescription} (${s.platform})`).join('\n')}`
    : '';

  return `You are a creative director helping an artist brainstorm snapshot ideas for their upcoming release.

WORLD INFORMATION:
- World Name (Song Title): "${data.worldName}"
- Release Date: ${data.releaseDate} (${daysUntilRelease} days from now)
- Primary Color: ${data.color || 'Not specified'}
${artistInfo}

${existingSnapshotsInfo}

TASK:
Generate 3-5 snapshot ideas that:
1. Match the artist's preferred content formats (from their profile)
2. Align with the world's visual aesthetic and color
3. Include both viral-potential content AND brand-building content
4. Are achievable and enjoyable for the artist to create
5. Are unique and don't duplicate existing snapshots

Each idea should include:
- **visualDescription**: A vivid, imagery-rich description of what the video/photo will look like (be specific about scene, mood, colors, movement)
- **platform**: "instagram" | "tiktok" | "twitter" | "youtube"
- **contentType**: "photo" | "video" | "story" | "reel" | "carousel"
- **whyItWorks**: Brief explanation of why this idea fits the artist and has potential

Return as a JSON array with this EXACT structure:
[
  {
    "visualDescription": "A 15-second loop of the artist running through a lush forest, lip-syncing the lyrics. The scene is color-graded with deep greens and warm sunlight filtering through trees.",
    "platform": "instagram",
    "contentType": "reel",
    "whyItWorks": "Matches artist's vlog-style preference, has viral potential with movement, builds visual identity"
  }
]

Generate 3-5 diverse ideas that balance:
- Quick, low-barrier content (if artist is beginner)
- High-production content (if artist has experience)
- Viral-potential moments
- Brand-building consistency

Platform options: "instagram" | "tiktok" | "twitter" | "youtube"
Content type options: "photo" | "video" | "story" | "reel" | "carousel"
`;
}


