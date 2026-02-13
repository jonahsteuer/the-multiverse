# Migration Notes: From FastAPI to Next.js

This document outlines what was migrated from the previous `comeup` FastAPI backend to the new Next.js implementation.

## Overview

The previous `comeup` repository was a full-stack FastAPI backend with:
- Multi-tenant architecture
- OAuth integrations (Spotify, Instagram, TikTok, YouTube)
- PostgreSQL database with SQLAlchemy
- Background jobs (APScheduler)
- AI features using Claude API
- Content management system

The new `comeup_nextjs` focuses on **Phase 1 MVP**: Content generation only, without the complexity of OAuth, databases, or background jobs.

## What Was Migrated

### 1. Claude API Integration Patterns ✅

**Source:** `backend/services/insights_service.py`

**Migrated to:** `lib/claude.ts`

**Improvements:**
- Better error handling (API key validation, rate limiting)
- Enhanced prompt structure based on previous implementation
- Response validation and sanitization
- Client initialization with proper error handling

**Key Changes:**
- Converted from Python `anthropic` SDK to TypeScript `@anthropic-ai/sdk`
- Maintained the same model (`claude-sonnet-4-20250514`)
- Enhanced prompt building with more context and structure
- Added response validation to ensure data integrity

### 2. Type Definitions ✅

**Source:** `backend/schemas/ai.py`, `backend/schemas/artist.py`, `backend/schemas/content.py`

**Migrated to:** `types/index.ts`

**Adaptations:**
- Converted Pydantic `BaseModel` classes to TypeScript interfaces
- Simplified for MVP (removed database IDs, timestamps where not needed)
- Added new types for error responses and future features
- Maintained type safety with TypeScript unions for enums

**Type Mappings:**
- `ArtistBase` → `ArtistOnboardingData` (simplified for form input)
- `ContentPostBase` → `GeneratedPost` (adapted for generated content)
- `GenerateIdeasResponse` → `ContentGenerationResponse` (enhanced)

### 3. API Route Validation ✅

**Source:** `backend/routers/ai.py`

**Migrated to:** `app/api/generate/route.ts`

**Improvements:**
- Replaced Pydantic validation with Zod (TypeScript equivalent)
- Enhanced error responses with detailed validation messages
- Added GET endpoint for API info
- Better HTTP status codes (400, 429, 500)
- Structured error responses matching FastAPI patterns

**Validation Schema:**
```typescript
// Zod schema mirrors Pydantic validation from FastAPI
const ArtistOnboardingSchema = z.object({
  artistName: z.string().min(1).max(100),
  singleTitle: z.string().min(1).max(200),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // ... etc
});
```

### 4. Prompt Engineering ✅

**Source:** `backend/services/insights_service.py` (prompt building patterns)

**Migrated to:** `lib/claude.ts` → `buildContentPrompt()`

**Enhancements:**
- More detailed prompt structure
- Better context about release cycles
- Platform-specific guidelines
- Clearer JSON structure requirements
- Enhanced instructions for authentic voice

## What Was NOT Migrated (By Design)

### 1. Database Models
- **Why:** Phase 1 MVP doesn't require persistence
- **Future:** Will add Supabase integration in Phase 2

### 2. OAuth Integrations
- **Why:** Phase 1 focuses on content generation only
- **Future:** Will add in Phase 2 (Weeks 5-12)

### 3. Background Jobs
- **Why:** Not needed for MVP
- **Future:** Will add scheduled publishing in Phase 2

### 4. Authentication System
- **Why:** MVP is self-service, no accounts needed initially
- **Future:** Will add user accounts in Phase 2

### 5. Analytics/Metrics
- **Why:** Phase 1 is content generation only
- **Future:** Will add performance tracking in Phase 3

## Code Quality Improvements

### Error Handling
- **Before:** Basic try/catch with generic messages
- **After:** Specific error types, proper HTTP status codes, detailed messages

### Validation
- **Before:** Manual field checking
- **After:** Schema-based validation with Zod (similar to Pydantic)

### Type Safety
- **Before:** Basic TypeScript types
- **After:** Comprehensive types with unions, optional fields, and future extensibility

### Prompt Engineering
- **Before:** Simple prompt template
- **After:** Structured prompt builder with context, guidelines, and clear instructions

## File Structure Comparison

### FastAPI (Previous)
```
backend/
├── services/
│   └── insights_service.py    → lib/claude.ts
backend/
├── schemas/
│   ├── ai.py                  → types/index.ts
│   ├── artist.py
│   └── content.py
└── routers/
    └── ai.py                  → app/api/generate/route.ts
```

### Next.js (Current)
```
lib/
└── claude.ts                  (enhanced from insights_service.py)

types/
└── index.ts                   (consolidated from multiple schemas)

app/api/generate/
└── route.ts                   (enhanced from ai.py router)
```

## Best Practices Carried Forward

1. **Error Handling:** Maintained the pattern of specific error types and messages
2. **Validation:** Schema-based validation (Pydantic → Zod)
3. **Type Safety:** Strong typing throughout (Python type hints → TypeScript)
4. **API Design:** RESTful patterns, proper HTTP status codes
5. **Separation of Concerns:** Service layer for business logic, routes for HTTP handling

## Future Migration Opportunities

When moving to Phase 2, consider migrating:

1. **Database Models** → Supabase schema
   - `backend/models/artist.py` → Supabase `artists` table
   - `backend/models/content.py` → Supabase `content_posts` table

2. **OAuth Services** → Next.js API routes
   - `backend/services/spotify_service.py` → `app/api/connect/spotify/route.ts`
   - Similar for Instagram, TikTok, YouTube

3. **Background Jobs** → Vercel Cron Jobs or external scheduler
   - `backend/jobs/publishing.py` → Vercel Cron
   - `backend/jobs/data_sync.py` → Scheduled API routes

4. **Authentication** → NextAuth.js or Supabase Auth
   - `backend/routers/auth.py` → NextAuth.js configuration
   - `backend/utils/auth.py` → NextAuth middleware

## Testing Recommendations

Based on the previous FastAPI implementation, ensure:

1. **API Key Validation:** Test with missing/invalid keys
2. **Rate Limiting:** Handle Claude API rate limits gracefully
3. **Response Parsing:** Validate JSON structure from Claude responses
4. **Error Scenarios:** Test all error paths (validation, API failures, etc.)

## Notes

- The migration maintains the same quality standards as the FastAPI version
- Code is simplified for MVP but structured to scale
- Type safety is preserved throughout the migration
- Error handling patterns are consistent with previous implementation

