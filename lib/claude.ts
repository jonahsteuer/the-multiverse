import Anthropic from '@anthropic-ai/sdk';
import type { ArtistOnboardingData, GeneratedPost } from '@/types';

// Initialize Claude client with error handling
function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey });
}

/**
 * Generate promotional social media posts for an artist's release
 * Based on the previous FastAPI implementation patterns
 */
export async function generateContentForRelease(
  data: ArtistOnboardingData
): Promise<GeneratedPost[]> {
  const client = getAnthropicClient();

  // Build comprehensive prompt based on previous implementation patterns
  const prompt = buildContentPrompt(data);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON from response (handle both code blocks and plain JSON)
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const posts: GeneratedPost[] = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    if (!Array.isArray(posts) || posts.length === 0) {
      throw new Error('Invalid response format: expected non-empty array');
    }

    // Ensure all required fields are present
    const validatedPosts = posts.map((post, index) => ({
      id: post.id || `post_${index + 1}`,
      week: post.week || 'Week 0',
      caption: post.caption || '',
      platform: post.platform || 'instagram',
      contentType: post.contentType || 'photo',
      timing: post.timing || 'Monday 12pm',
    }));

    return validatedPosts;
  } catch (error) {
    // Enhanced error handling based on previous implementation
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Claude API key is invalid or missing');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Content generation failed: ${error.message}`);
    }
    throw new Error('Unknown error during content generation');
  }
}

/**
 * Build the prompt for content generation
 * Enhanced based on previous FastAPI insights service patterns
 */
function buildContentPrompt(data: ArtistOnboardingData): string {
  const releaseDate = new Date(data.releaseDate);
  const today = new Date();
  const daysUntilRelease = Math.ceil(
    (releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return `You are a social media expert specializing in music promotion for independent artists.

Generate 15-20 promotional social media posts for this artist's upcoming single release.

ARTIST INFORMATION:
- Artist Name: ${data.artistName}
- Single Title: "${data.singleTitle}"
- Release Date: ${data.releaseDate} (${daysUntilRelease} days from now)
- Genre: ${data.genre}
- Vibe/Tone: ${data.vibe}
${data.targetAudience ? `- Target Audience: ${data.targetAudience}` : ''}

CONTENT CALENDAR REQUIREMENTS:
Create a strategic content calendar covering the full release cycle:
- Week -2 (2 weeks before release): Teaser content, build anticipation
- Week -1 (1 week before release): Pre-save campaign, countdown posts
- Release Week: Launch announcements, celebration posts
- Week +1 (1 week after release): Post-release momentum, engagement posts
- Week +2 (2 weeks after release): Continued engagement, behind-the-scenes

PLATFORM GUIDELINES:
- Instagram: Focus on visual storytelling, use Stories and Reels suggestions
- TikTok: Short-form video ideas, trending sounds, challenges
- Twitter/X: Conversational, behind-the-scenes, fan engagement

CONTENT REQUIREMENTS:
1. Make captions sound authentic and personal - like the artist wrote them
2. Avoid corporate marketing language
3. Include emoji naturally but don't overuse (1-3 per post max)
4. Vary content types: photos, videos, stories, carousels
5. Include specific timing recommendations (day of week + time)
6. Each post should have a clear purpose in the release cycle

Return as a JSON array with this EXACT structure:
[
  {
    "id": "post_1",
    "week": "Week -2",
    "caption": "Your caption text here...",
    "platform": "instagram",
    "contentType": "photo",
    "timing": "Tuesday 2pm"
  }
]

Platform options: "instagram" | "tiktok" | "twitter"
Content type options: "photo" | "video" | "story" | "reel" | "carousel"
Week format: "Week -2" | "Week -1" | "Release Week" | "Week +1" | "Week +2"

Generate exactly 15-20 posts, distributed across the release cycle.`;
}

