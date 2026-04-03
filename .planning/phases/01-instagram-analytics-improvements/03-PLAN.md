---
phase: 01-instagram-analytics-improvements
plan: 03
type: execute
wave: 2
depends_on: ["01-01", "01-02"]
files_modified:
  - app/api/auth/instagram/route.ts
  - app/api/auth/instagram/callback/route.ts
  - app/api/mark/artist-analytics/scrape/route.ts
  - components/multiverse/ArtistAnalyticsPanel.tsx
autonomous: false
requirements:
  - REQ-01
  - REQ-02
  - REQ-03
user_setup:
  - service: meta-instagram
    why: "Instagram Graph API OAuth for Insights data (saves, reach per post)"
    env_vars:
      - name: INSTAGRAM_APP_ID
        source: "Meta Developer Dashboard -> Your App -> App Dashboard -> App ID"
      - name: INSTAGRAM_APP_SECRET
        source: "Meta Developer Dashboard -> Your App -> App Dashboard -> App Secret"
    dashboard_config:
      - task: "Create a Meta App (type: Business)"
        location: "https://developers.facebook.com/apps/ -> Create App"
      - task: "Add Instagram API with Instagram Login product"
        location: "Meta App Dashboard -> Add Product -> Instagram API with Instagram Login"
      - task: "Configure OAuth redirect URIs"
        location: "Meta App Dashboard -> Instagram API -> Settings -> OAuth Redirect URIs -> Add: http://localhost:3000/api/auth/instagram/callback AND https://your-production-url.vercel.app/api/auth/instagram/callback"
      - task: "Request instagram_business_manage_insights permission"
        location: "Meta App Dashboard -> Instagram API -> Permissions -> Request instagram_business_manage_insights"
      - task: "Add yourself as a test user (for dev testing before App Review)"
        location: "Meta App Dashboard -> Roles -> Testers -> Add your Instagram account"
must_haves:
  truths:
    - "User can connect their Instagram Business/Creator account via OAuth"
    - "After OAuth, saves and reach data are fetched per post from Graph API"
    - "OAuth access token is stored in Supabase onboarding_profile.instagramOAuth"
    - "Saves data appears in the ArtistAnalyticsPanel UI when available"
  artifacts:
    - path: "app/api/auth/instagram/route.ts"
      provides: "OAuth authorization redirect endpoint"
      contains: "api.instagram.com/oauth/authorize"
    - path: "app/api/auth/instagram/callback/route.ts"
      provides: "OAuth callback handler — code exchange, token storage"
      contains: "api.instagram.com/oauth/access_token"
    - path: "app/api/mark/artist-analytics/scrape/route.ts"
      provides: "Graph API Insights fetch for saves + reach per post"
      contains: "graph.instagram.com"
    - path: "components/multiverse/ArtistAnalyticsPanel.tsx"
      provides: "Connect Instagram button and saves display"
      contains: "Connect Instagram"
  key_links:
    - from: "app/api/auth/instagram/route.ts"
      to: "api.instagram.com/oauth/authorize"
      via: "HTTP redirect with scopes"
      pattern: "instagram_business_basic.*instagram_business_manage_insights"
    - from: "app/api/auth/instagram/callback/route.ts"
      to: "Supabase profiles.onboarding_profile.instagramOAuth"
      via: "Token stored after code exchange"
      pattern: "instagramOAuth"
    - from: "app/api/mark/artist-analytics/scrape/route.ts"
      to: "graph.instagram.com/v25.0/{media-id}/insights"
      via: "fetch with access_token"
      pattern: "graph\\.instagram\\.com.*insights"
---

<objective>
Add Instagram OAuth flow (authorize + callback) and Graph API Insights fetching (saves, reach per post) to the analytics pipeline. This is the Wave 2 work that requires Meta App credentials.

Purpose: OAuth-gated data (saves/bookmarks, reach per post) provides signals that public scraping cannot access. Per D-01/D-02, OAuth is required during onboarding so Mark has complete analytics from day one.

Output: Two new API routes for OAuth, modified scrape route with Graph API Insights, ArtistAnalyticsPanel with Connect button and saves display.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-instagram-analytics-improvements/01-CONTEXT.md
@.planning/phases/01-instagram-analytics-improvements/01-RESEARCH.md
@.planning/phases/01-instagram-analytics-improvements/01-01-SUMMARY.md
@.planning/phases/01-instagram-analytics-improvements/01-02-SUMMARY.md

<interfaces>
<!-- Research-verified OAuth endpoints -->
```
OAuth authorize: https://api.instagram.com/oauth/authorize
  ?client_id={INSTAGRAM_APP_ID}
  &redirect_uri={callback_url}
  &scope=instagram_business_basic,instagram_business_manage_insights
  &response_type=code

Token exchange: POST https://api.instagram.com/oauth/access_token
  body: { client_id, client_secret, grant_type: 'authorization_code', redirect_uri, code }

Per-media Insights: GET https://graph.instagram.com/v25.0/{media-id}/insights
  ?metric=saved,reach
  &access_token={token}

User media list: GET https://graph.instagram.com/v25.0/me/media
  ?fields=id,timestamp,media_type
  &access_token={token}
```

<!-- CRITICAL: impressions metric DEPRECATED in v22+ — only use saved and reach -->
<!-- CRITICAL: follower/non-follower breakdown NOT available per-post — only account-level -->

<!-- Supabase token storage location -->
```
profiles.onboarding_profile.instagramOAuth = {
  accessToken: string,
  tokenIssuedAt: string (ISO),
  igUserId: string
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Instagram OAuth authorize and callback routes</name>
  <files>app/api/auth/instagram/route.ts, app/api/auth/instagram/callback/route.ts</files>
  <read_first>
    - app/api/mark/artist-analytics/scrape/route.ts (understand Supabase write pattern for profiles table)
    - .env.local (check for NEXT_PUBLIC_APP_URL or similar base URL env var)
  </read_first>
  <action>
**1. Create `app/api/auth/instagram/route.ts` — OAuth authorization redirect:**

```typescript
/**
 * GET /api/auth/instagram?userId=xxx
 *
 * Redirects the user to Instagram OAuth consent screen.
 * Requires INSTAGRAM_APP_ID env var (from Meta App Dashboard).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: 'INSTAGRAM_APP_ID not configured' }, { status: 500 });
  }

  // Build callback URL using NEXT_PUBLIC_APP_URL or request origin
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  // Encode userId in state param so callback can associate token with the user
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

  const authUrl = new URL('https://api.instagram.com/oauth/authorize');
  authUrl.searchParams.set('client_id', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
```

**2. Create `app/api/auth/instagram/callback/route.ts` — OAuth callback handler:**

```typescript
/**
 * GET /api/auth/instagram/callback?code=xxx&state=xxx
 *
 * Exchanges the authorization code for an access token,
 * stores the token in Supabase profiles.onboarding_profile.instagramOAuth,
 * then redirects the user back to the app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // Handle OAuth denial
  if (errorParam) {
    console.error('[instagram-callback] OAuth error:', errorParam);
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=${errorParam}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=missing_params`);
  }

  // Decode userId from state
  let userId: string;
  try {
    const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    userId = stateData.userId;
    if (!userId) throw new Error('No userId in state');
  } catch {
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=invalid_state`);
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    console.error('[instagram-callback] Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET');
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=server_config`);
  }

  try {
    // Exchange code for short-lived access token
    const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[instagram-callback] Token exchange failed:', tokenData);
      return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=token_exchange`);
    }

    const { access_token: shortLivedToken, user_id: igUserId } = tokenData;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${appSecret}` +
      `&access_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedRes.json();
    const accessToken = longLivedData.access_token || shortLivedToken;

    // Store token in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[instagram-callback] Missing Supabase env vars');
      return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=server_config`);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();

    const updatedProfile = {
      ...(prof?.onboarding_profile || {}),
      instagramOAuth: {
        accessToken,
        tokenIssuedAt: new Date().toISOString(),
        igUserId: String(igUserId),
      },
    };

    await supabase
      .from('profiles')
      .update({ onboarding_profile: updatedProfile })
      .eq('id', userId);

    console.log(`[instagram-callback] OAuth token stored for user ${userId} (IG user ${igUserId})`);
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=success`);

  } catch (err: any) {
    console.error('[instagram-callback] Error:', err.message);
    return NextResponse.redirect(`${baseUrl}/?instagram_oauth=error&reason=server_error`);
  }
}
```

Per D-01 (OAuth is required, Business/Creator account).
Per D-02 (OAuth happens during onboarding — triggered from UI).
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && ls app/api/auth/instagram/route.ts app/api/auth/instagram/callback/route.ts && grep -c "api.instagram.com/oauth/authorize" app/api/auth/instagram/route.ts && grep -c "api.instagram.com/oauth/access_token" app/api/auth/instagram/callback/route.ts && grep -c "instagramOAuth" app/api/auth/instagram/callback/route.ts && grep -c "ig_exchange_token" app/api/auth/instagram/callback/route.ts && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `app/api/auth/instagram/route.ts` exists and exports a GET handler
    - `app/api/auth/instagram/route.ts` constructs authorize URL with `client_id`, `redirect_uri`, `scope=instagram_business_basic,instagram_business_manage_insights`, `response_type=code`, `state`
    - `app/api/auth/instagram/route.ts` encodes `userId` in base64url `state` parameter
    - `app/api/auth/instagram/callback/route.ts` exists and exports a GET handler
    - Callback route exchanges code via POST to `https://api.instagram.com/oauth/access_token` with `application/x-www-form-urlencoded` content type
    - Callback route exchanges short-lived token for long-lived token via `ig_exchange_token` grant
    - Callback route stores `{ accessToken, tokenIssuedAt, igUserId }` in `profiles.onboarding_profile.instagramOAuth` via Supabase service role
    - Callback route redirects to `/?instagram_oauth=success` on success
    - Callback route redirects to `/?instagram_oauth=error&reason=...` on all error paths
    - Neither route includes `impressions` anywhere (deprecated metric)
    - `npx tsc --noEmit` produces zero errors
  </acceptance_criteria>
  <done>
    - OAuth authorize endpoint redirects to Instagram with correct scopes and state
    - OAuth callback exchanges code for long-lived access token
    - Token stored in Supabase onboarding_profile.instagramOAuth
    - Error handling covers OAuth denial, missing params, token exchange failure
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Graph API Insights fetch to scrape route and saves display to UI</name>
  <files>app/api/mark/artist-analytics/scrape/route.ts, components/multiverse/ArtistAnalyticsPanel.tsx</files>
  <read_first>
    - app/api/mark/artist-analytics/scrape/route.ts (current state after Plan 01 and 02 modifications)
    - app/api/auth/instagram/callback/route.ts (understand token storage shape)
    - components/multiverse/ArtistAnalyticsPanel.tsx (current state after Plan 02 UI update)
  </read_first>
  <action>
**1. In `scrape/route.ts`, add a `fetchInsightsForPosts` function (after the Anthropic client init, before `analyzePost`):**

```typescript
interface InsightsData {
  saves: number;
  reach: number;
}

async function fetchInsightsForPosts(
  accessToken: string,
  igUserId: string,
  analyzedPosts: AnalyzedPost[]
): Promise<Map<string, InsightsData>> {
  const insightsMap = new Map<string, InsightsData>();

  try {
    // Fetch user's media list from Graph API
    const mediaRes = await fetch(
      `https://graph.instagram.com/v25.0/${igUserId}/media` +
      `?fields=id,timestamp,media_type` +
      `&limit=50` +
      `&access_token=${accessToken}`
    );
    if (!mediaRes.ok) {
      console.warn(`[insights] Failed to fetch media list: HTTP ${mediaRes.status}`);
      return insightsMap;
    }
    const mediaData = await mediaRes.json();
    const mediaItems: { id: string; timestamp: string; media_type: string }[] = mediaData.data || [];

    // Build timestamp -> media ID map (60s tolerance window for matching)
    const mediaByTimestamp: { id: string; ts: number }[] = mediaItems.map(m => ({
      id: m.id,
      ts: new Date(m.timestamp).getTime(),
    }));

    // Fetch insights for each media item (batch in parallel, max 10 concurrent)
    const BATCH_SIZE = 10;
    for (let i = 0; i < mediaByTimestamp.length; i += BATCH_SIZE) {
      const batch = mediaByTimestamp.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (media) => {
          // CRITICAL: Only request 'saved' and 'reach' — 'impressions' is DEPRECATED in v22+
          const insightsRes = await fetch(
            `https://graph.instagram.com/v25.0/${media.id}/insights` +
            `?metric=saved,reach` +
            `&access_token=${accessToken}`
          );
          if (!insightsRes.ok) return null;
          const insightsJson = await insightsRes.json();
          const data = insightsJson.data || [];
          const saves = data.find((d: any) => d.name === 'saved')?.values?.[0]?.value ?? 0;
          const reach = data.find((d: any) => d.name === 'reach')?.values?.[0]?.value ?? 0;

          // Find matching analyzed post by timestamp (60s window)
          const matchedPost = analyzedPosts.find(p => {
            const postTs = new Date(p.timestamp).getTime();
            return Math.abs(postTs - media.ts) < 60_000;
          });
          if (matchedPost) {
            insightsMap.set(matchedPost.timestamp, { saves, reach });
          }
        })
      );
    }

    console.log(`[insights] Fetched insights for ${insightsMap.size}/${mediaItems.length} posts`);
  } catch (err: any) {
    console.error('[insights] Error fetching Graph API insights:', err.message);
  }

  return insightsMap;
}
```

**2. Extend `AnalyzedPost` interface with optional Insights fields:**
```typescript
// Add to AnalyzedPost interface after existing fields:
  insightSaves?: number;       // from Graph API (OAuth-gated)
  insightReach?: number;       // from Graph API (OAuth-gated)
```

**3. Extend `AccountSummary` interface with optional saves aggregate:**
```typescript
// Add to AccountSummary interface after existing fields:
  totalSaves?: number;         // sum of all post saves (Graph API)
  avgSavesPerPost?: number;    // average saves per post
  saveRate?: number;           // saves / reach * 100 (when both available)
```

**4. Update POST handler to fetch OAuth token from Supabase and call Insights:**

After the existing Supabase profile fetch (where the userId check happens), add logic to check for OAuth token:

```typescript
// In the POST handler, after `const summary = buildAccountSummary(analyzed, handle);`
// and before `const gapAnalysis = await buildGapAnalysis(analyzed, summary);`:

// Fetch Graph API Insights if OAuth token exists (per D-03, D-06)
let insightsMap = new Map<string, InsightsData>();
if (userId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: prof } = await supabase
      .from('profiles')
      .select('onboarding_profile')
      .eq('id', userId)
      .single();

    const oauthData = prof?.onboarding_profile?.instagramOAuth;
    if (oauthData?.accessToken && oauthData?.igUserId) {
      // Check if token needs refresh (> 30 days old)
      const tokenAge = Date.now() - new Date(oauthData.tokenIssuedAt).getTime();
      let accessToken = oauthData.accessToken;
      if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
        try {
          const refreshRes = await fetch(
            `https://graph.instagram.com/refresh_access_token` +
            `?grant_type=ig_refresh_token` +
            `&access_token=${accessToken}`
          );
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            accessToken = refreshData.access_token;
            // Update stored token
            const updatedProfile = {
              ...prof.onboarding_profile,
              instagramOAuth: {
                ...oauthData,
                accessToken,
                tokenIssuedAt: new Date().toISOString(),
              },
            };
            await supabase.from('profiles').update({ onboarding_profile: updatedProfile }).eq('id', userId);
            console.log('[scrape] Refreshed Instagram OAuth token');
          }
        } catch (err: any) {
          console.warn('[scrape] Token refresh failed:', err.message);
        }
      }

      insightsMap = await fetchInsightsForPosts(accessToken, oauthData.igUserId, analyzed);

      // Merge insights back into analyzed posts
      analyzed.forEach(p => {
        const insights = insightsMap.get(p.timestamp);
        if (insights) {
          p.insightSaves = insights.saves;
          p.insightReach = insights.reach;
        }
      });

      // Update summary with saves aggregates
      const postsWithSaves = analyzed.filter(p => p.insightSaves !== undefined);
      if (postsWithSaves.length > 0) {
        const totalSaves = postsWithSaves.reduce((s, p) => s + (p.insightSaves || 0), 0);
        const totalReach = postsWithSaves.reduce((s, p) => s + (p.insightReach || 0), 0);
        summary.totalSaves = totalSaves;
        summary.avgSavesPerPost = Math.round((totalSaves / postsWithSaves.length) * 10) / 10;
        summary.saveRate = totalReach > 0 ? Math.round((totalSaves / totalReach) * 10000) / 100 : 0;
      }
    }
  }
}
```

**5. Update `buildTier3Context` to include saves data when available:**

Add after the Account Overview section:
```typescript
${summary.totalSaves !== undefined ? `- Total saves (bookmarks): ${summary.totalSaves} across ${summary.postCount} posts (avg ${summary.avgSavesPerPost}/post)
- Save rate: ${summary.saveRate}% (saves / reach)` : ''}
```

**6. Update `ArtistAnalyticsPanel.tsx` — add Connect Instagram button and saves card:**

Add to the `AccountSummary` interface:
```typescript
  totalSaves?: number;
  avgSavesPerPost?: number;
  saveRate?: number;
```

Add a "Connect Instagram" button section after the handle input and before the analytics dashboard. Show it when analytics exist but no saves data:
```tsx
{/* Connect Instagram for Insights (shown when no OAuth data) */}
{analytics && analytics.accountSummary.totalSaves === undefined && userId && (
  <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-lg p-3">
    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Unlock More Data</div>
    <p className="text-xs text-gray-300 mb-2">
      Connect your Instagram Business/Creator account to see saves, reach, and deeper insights.
    </p>
    <a
      href={`/api/auth/instagram?userId=${userId}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white text-xs font-medium transition-colors"
    >
      Connect Instagram
    </a>
  </div>
)}
```

Add a Saves card in the summary grid when saves data is available:
```tsx
{/* Add as a third card in the grid when saves data exists */}
{analytics.accountSummary.totalSaves !== undefined && (
  <div className="bg-gray-800/50 rounded-lg p-3">
    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saves</div>
    <div className="text-xl font-bold text-white">{analytics.accountSummary.avgSavesPerPost}</div>
    <div className="text-[10px] text-gray-500">avg/post · {analytics.accountSummary.saveRate}% save rate</div>
  </div>
)}
```

**7. Update the topPosts mapping in the POST handler** to include saves:
```typescript
// Add to topPosts map:
saves: (analyzed.find(a => a.timestamp === p.timestamp) || p).insightSaves,
```

**8. Update the TopPost interface** in ArtistAnalyticsPanel.tsx:
```typescript
saves?: number;
```

**9. Show saves in top post cards** when available:
```tsx
{post.saves !== undefined && (
  <span className="text-[10px] text-yellow-400">{post.saves} saves</span>
)}
```

Per D-03/D-06 (OAuth unlocks saves, reach — NOT impressions or follower breakdown per post).
IMPORTANT: Do NOT include `impressions` in any Graph API request — deprecated in v22+.
IMPORTANT: Do NOT attempt follower/non-follower breakdown per post — only available at account level.
  </action>
  <verify>
    <automated>cd /Users/jonahsteuer/Documents/projects/the-multiverse && ls app/api/auth/instagram/route.ts app/api/auth/instagram/callback/route.ts && grep -c "fetchInsightsForPosts" app/api/mark/artist-analytics/scrape/route.ts && grep -c "graph.instagram.com" app/api/mark/artist-analytics/scrape/route.ts && grep -c "insightSaves" app/api/mark/artist-analytics/scrape/route.ts && grep -c "Connect Instagram" components/multiverse/ArtistAnalyticsPanel.tsx && grep -c "totalSaves" components/multiverse/ArtistAnalyticsPanel.tsx && grep "impressions" app/api/mark/artist-analytics/scrape/route.ts app/api/auth/instagram/route.ts app/api/auth/instagram/callback/route.ts; echo "impressions check done" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `scrape/route.ts` contains `async function fetchInsightsForPosts` with `accessToken` and `igUserId` params
    - `scrape/route.ts` fetches from `graph.instagram.com/v25.0/{igUserId}/media` for media list
    - `scrape/route.ts` fetches from `graph.instagram.com/v25.0/{media.id}/insights` with `metric=saved,reach` ONLY (no `impressions`)
    - `scrape/route.ts` matches Apify posts to Graph API media by timestamp with 60-second tolerance
    - `scrape/route.ts` includes token refresh logic for tokens > 30 days old via `ig_refresh_token`
    - `AnalyzedPost` interface contains `insightSaves?: number` and `insightReach?: number`
    - `AccountSummary` interface contains `totalSaves?: number`, `avgSavesPerPost?: number`, `saveRate?: number`
    - The word `impressions` does NOT appear in any metric request in `scrape/route.ts` (deprecated)
    - `ArtistAnalyticsPanel.tsx` contains "Connect Instagram" link pointing to `/api/auth/instagram?userId=`
    - `ArtistAnalyticsPanel.tsx` shows saves card when `totalSaves !== undefined`
    - `npx tsc --noEmit` produces zero errors
  </acceptance_criteria>
  <done>
    - Graph API Insights fetched for saves and reach per post (matched by timestamp)
    - Token refresh-on-read implemented (>30 days triggers refresh)
    - Saves aggregates (totalSaves, avgSavesPerPost, saveRate) computed in AccountSummary
    - ArtistAnalyticsPanel shows Connect Instagram CTA when no OAuth, shows saves when available
    - No deprecated metrics (impressions) used anywhere
    - No per-post follower/non-follower breakdown attempted
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify OAuth flow and Graph API Insights</name>
  <files>app/api/auth/instagram/route.ts, app/api/auth/instagram/callback/route.ts, app/api/mark/artist-analytics/scrape/route.ts, components/multiverse/ArtistAnalyticsPanel.tsx</files>
  <action>
Human verification checkpoint — no automated work in this task. Verify the full OAuth + Insights pipeline end-to-end.

Steps to verify:
1. Ensure INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are set in .env.local
2. Start dev server: npm run dev
3. Visit the analytics panel in Galaxy view (or dev page at /mark-training/analytics)
4. Run an initial scrape — verify audio patterns, hashtag ER, carousel stats, and gap analysis appear
5. Click "Connect Instagram" — should redirect to Instagram OAuth consent
6. After authorizing, should redirect back to app with ?instagram_oauth=success
7. Re-run scrape — verify saves card now appears with per-post saves data
8. Check Supabase: profiles.onboarding_profile.instagramOAuth should have accessToken, tokenIssuedAt, igUserId
9. Check Supabase: profiles.onboarding_profile.instagramAnalytics.tier3Context should contain "Mark's Gap Analysis" section
  </action>
  <verify>Human verification — type "approved" or describe issues found</verify>
  <done>User confirms OAuth flow works end-to-end: authorize, callback, token storage, saves data visible in UI</done>
</task>

</tasks>

<verification>
1. `ls app/api/auth/instagram/route.ts app/api/auth/instagram/callback/route.ts` — both files exist
2. `npx tsc --noEmit` passes
3. OAuth authorize redirects to Instagram with correct scopes
4. OAuth callback exchanges code, stores long-lived token in Supabase
5. Scrape route fetches Graph API Insights when OAuth token exists
6. No `impressions` metric used anywhere (deprecated)
7. ArtistAnalyticsPanel shows Connect button and saves data
</verification>

<success_criteria>
- Instagram OAuth flow works end-to-end (authorize, callback, token storage)
- Graph API Insights (saves, reach) fetched and merged into analytics pipeline
- Token refresh-on-read prevents 60-day expiry issues
- ArtistAnalyticsPanel displays Connect Instagram CTA and saves data
- All data stored in Supabase onboarding_profile JSONB (no schema migration needed)
- No deprecated API metrics used
</success_criteria>

<output>
After completion, create `.planning/phases/01-instagram-analytics-improvements/01-03-SUMMARY.md`
</output>
