import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { SnapshotStrategy, Snapshot } from '@/types';
import { calculatePostingDates, calculateFilmingDates } from '@/lib/snapshot-schedule';

// Validation schema
const snapshotGenerationSchema = z.object({
  worldName: z.string().min(1),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.string().optional(),
  visualReferences: z.array(z.string()).optional(),
  galaxyVisualLandscape: z.object({
    images: z.array(z.string()).optional(),
    colorPalette: z.array(z.string()).optional(),
  }).optional(),
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
    const data = snapshotGenerationSchema.parse(body);

    const client = getAnthropicClient();

    // Build prompt for snapshot generation
    const prompt = buildSnapshotPrompt(data);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Same model used elsewhere in codebase
      max_tokens: 3000, // Reduced to speed up generation
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const parsedSnapshots: Omit<Snapshot, 'id' | 'worldId' | 'postingDate' | 'weekLabel'>[] = JSON.parse(jsonMatch[0]);

    // Validate and filter out snapshots missing required fields
    const snapshots = parsedSnapshots.filter((snapshot) => {
      if (!snapshot.visualDescription || !snapshot.platform || !snapshot.contentType) {
        console.warn('Skipping snapshot missing required fields:', snapshot);
        return false;
      }
      return true;
    });

    if (snapshots.length === 0) {
      throw new Error('No valid snapshots generated. All snapshots were missing required fields.');
    }

    // Calculate posting dates based on release date
    const snapshotsWithPostingDates = calculatePostingDates(snapshots, data.releaseDate);
    
    // Calculate filming dates (1 week before posting)
    const snapshotsWithFilmingDates = calculateFilmingDates(snapshotsWithPostingDates);

    // Create snapshot strategy
    // Note: worldId will be set by the caller when the world is created
    const strategy: SnapshotStrategy = {
      id: `snapshot-strategy-${Date.now()}`,
      worldId: `temp-${Date.now()}`, // Temporary - will be replaced by caller
      snapshots: snapshotsWithFilmingDates.map((snapshot, index) => ({
        ...snapshot,
        id: `snapshot-${Date.now()}-${index + 1}`,
        worldId: `temp-${Date.now()}`, // Temporary - will be replaced by caller
      })),
      generatedAt: new Date().toISOString(),
    };
    
    // Debug: Log to verify posting dates are set
    console.log('Generated snapshot strategy:', {
      snapshotCount: strategy.snapshots.length,
      snapshots: strategy.snapshots.map(s => ({
        id: s.id,
        postingDate: s.postingDate,
        suggestedFilmingDate: s.suggestedFilmingDate,
        weekLabel: s.weekLabel
      }))
    });

    return NextResponse.json(strategy);
  } catch (error) {
    console.error('Error generating snapshots:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    // Provide more detailed error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : 'Unknown error';
    
    console.error('Full error details:', {
      message: errorMessage,
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate snapshot strategy', 
        message: errorMessage
      },
      { status: 500 }
    );
  }
}

function buildSnapshotPrompt(data: z.infer<typeof snapshotGenerationSchema>): string {
  const releaseDate = new Date(data.releaseDate);
  const today = new Date();
  const daysUntilRelease = Math.ceil(
    (releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const colorInfo = data.color ? `\n- Primary Color: ${data.color}` : '';
  const visualInfo = data.visualReferences && data.visualReferences.length > 0
    ? `\n- Visual References: ${data.visualReferences.length} images selected`
    : '';

  return `You are a creative director specializing in visual storytelling for music releases.

Generate a snapshot strategy (social media content plan) for this world (song release):

WORLD INFORMATION:
- World Name (Song Title): "${data.worldName}"
- Release Date: ${data.releaseDate} (${daysUntilRelease} days from now)${colorInfo}${visualInfo}

SNAPSHOT REQUIREMENTS:
Each snapshot should be a visual, imagery-rich description of what the social media content will look like. Think of snapshots as "memories" or "events" that occurred on this world.

For each snapshot, provide:
1. **Visual Description**: A detailed, imagery-rich description of what the video/photo will look like
   - Describe the scene, mood, colors, movement, composition
   - Be specific about visual elements (e.g., "15-second loop of artist running through lush forest")
   - Include duration if it's a video (10-15 second loops work well)
   - Describe the emotional tone and visual style

2. **Platform & Content Type**: Choose appropriate platform and content type
   - Instagram: Reels, Stories, Posts, Carousels
   - TikTok: Short videos, trends
   - Twitter: Visual posts with text

3. **Suggested Filming Date**: When this snapshot should be filmed (before release date)
4. **Timing**: When it should be posted (day of week + time)
5. **Caption**: Optional, but can suggest a caption that matches the visual

SNAPSHOT DISTRIBUTION:
- Create 10-15 snapshots total
- Distribute across the release cycle:
  * 2 weeks before release (Week -2): 3-4 Teaser/anticipation snapshots
  * 1 week before release (Week -1): 2-3 Countdown/pre-save snapshots
  * Release week: 2-3 Launch snapshots
  * 1-8 weeks after: 3-5 Post-release engagement snapshots
- The system will automatically calculate specific posting dates based on the release date

VISUAL COHERENCE:
- All snapshots should feel part of the same visual universe
- Use the color palette and visual references to inform the descriptions
- Each snapshot should tell part of the story of this world

Return as a JSON array with this EXACT structure:
[
  {
    "visualDescription": "A 15-second loop of the artist running through a lush forest, lip-syncing the lyrics. The scene is color-graded with deep greens and warm sunlight filtering through trees.",
    "caption": "Will I find you in the forest? 🌲",
    "platform": "instagram",
    "contentType": "reel",
    "timing": "Tuesday 2pm",
    "order": 1
  }
]

NOTE: Do NOT include "postingDate" or "suggestedFilmingDate" in your response. The system will calculate these automatically based on the release date and order number.

Platform options: "instagram" | "tiktok" | "twitter"
Content type options: "photo" | "video" | "story" | "reel" | "carousel"
Order: Number indicating sequence in release cycle (1, 2, 3, etc.)

Generate 6-8 snapshots with rich visual descriptions that artists can use to film and create their content. Keep descriptions concise but vivid.`;
}

