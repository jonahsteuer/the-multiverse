# Claude API Usage Guide

## Current Integration Status

✅ **Fully Integrated and Working**

Claude API is integrated into the application and ready to use. Here's how it works:

## How It Works

### 1. **Structured Content Generation** (Main Feature)

**Location:** `lib/claude.ts` → `generateContentForRelease()`

**How to use:**
1. Fill out the onboarding form on the homepage
2. Submit the form
3. Claude generates 15-20 promotional posts based on:
   - Artist name
   - Single/release title
   - Release date
   - Genre
   - Vibe/tone
   - Target audience (optional)

**The Prompt:**
- Structured prompt in `buildContentPrompt()` function
- Includes artist info, release cycle requirements, platform guidelines
- Returns JSON array of posts with captions, platforms, timing

**API Endpoint:** `POST /api/generate`

## Current Prompt Structure

The main content generation prompt includes:

1. **Role Definition:** "You are a social media expert specializing in music promotion"
2. **Artist Information:** Name, single title, release date, genre, vibe, audience
3. **Content Calendar Requirements:** Week -2 through Week +2 breakdown
4. **Platform Guidelines:** Instagram, TikTok, Twitter-specific guidance
5. **Content Requirements:** Authentic voice, emoji usage, content type variety
6. **Output Format:** Structured JSON with specific fields

## Testing the Integration

### Test the Main Flow:
1. Go to `http://localhost:3000`
2. Fill out the form with test data
3. Submit and wait for generation (10-30 seconds)
4. Review the generated posts

## Iterating on Prompts

### To Modify the Main Prompt:

Edit `lib/claude.ts` → `buildContentPrompt()` function:

```typescript
function buildContentPrompt(data: ArtistOnboardingData): string {
  // Modify the prompt template here
  return `Your updated prompt...`;
}
```

### To Test Prompt Changes:

1. Update `buildContentPrompt()` in `lib/claude.ts`
2. Test the full flow through the onboarding form
3. Review generated content and iterate

## API Configuration

**Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 4000
**API Key:** Stored in `.env.local` as `ANTHROPIC_API_KEY`

## Error Handling

The integration includes:
- ✅ API key validation
- ✅ Rate limit handling
- ✅ Response parsing and validation
- ✅ Error messages for users

## Next Steps

1. **Refine prompts** - Based on real artist feedback
2. **Add prompt variations** - Different prompts for different genres
3. **A/B test prompts** - Compare different prompt structures
4. **Iterate on content quality** - Improve based on usage data

## Example Use Cases

### Content Generation
- Generate 15-20 posts for a release cycle
- Structured output with platforms, timing, captions
- Tailored to artist's genre, vibe, and release date

