import { NextRequest, NextResponse } from 'next/server';
import { generateContentForRelease } from '@/lib/claude';
import type { ArtistOnboardingData, ContentGenerationResponse, ErrorResponse } from '@/types';
import { z } from 'zod';

// Validation schema based on previous FastAPI Pydantic schemas
const ArtistOnboardingSchema = z.object({
  artistName: z.string().min(1, 'Artist name is required').max(100),
  singleTitle: z.string().min(1, 'Single title is required').max(200),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Release date must be in YYYY-MM-DD format'),
  genre: z.string().min(1, 'Genre is required').max(50),
  vibe: z.string().min(1, 'Vibe/tone is required').max(200),
  targetAudience: z.string().max(200).optional(),
});

/**
 * POST /api/generate
 * Generate social media content for an artist's release
 * Based on previous FastAPI /api/ai/generate-ideas endpoint patterns
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    // Validate with Zod schema (similar to Pydantic in FastAPI)
    const validationResult = ArtistOnboardingSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Validation failed',
          message: 'Invalid request data',
          details: errors,
        },
        { status: 400 }
      );
    }

    const data: ArtistOnboardingData = validationResult.data;

    // Additional business logic validation
    const releaseDate = new Date(data.releaseDate);
    if (isNaN(releaseDate.getTime())) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid date',
          message: 'Release date must be a valid date',
        },
        { status: 400 }
      );
    }

    // Check if release date is in the past (warn but allow)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (releaseDate < today) {
      // Allow past dates but could add a warning in response
    }

    // Generate content
    const posts = await generateContentForRelease(data);

    // Build response similar to FastAPI response models
    const response: ContentGenerationResponse = {
      posts,
      summary: `Generated ${posts.length} promotional posts for ${data.artistName}'s release of "${data.singleTitle}"`,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Enhanced error handling based on previous FastAPI patterns
    console.error('Content generation error:', error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('API key')) {
        return NextResponse.json<ErrorResponse>(
          {
            error: 'Configuration error',
            message: 'Claude API key is not configured',
          },
          { status: 500 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json<ErrorResponse>(
          {
            error: 'Rate limit exceeded',
            message: 'Please try again in a few moments',
          },
          { status: 429 }
        );
      }

      return NextResponse.json<ErrorResponse>(
        {
          error: 'Content generation failed',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate
 * Health check or info endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'Content generation API',
    endpoint: 'POST /api/generate',
    requiredFields: ['artistName', 'singleTitle', 'releaseDate', 'genre', 'vibe'],
  });
}
