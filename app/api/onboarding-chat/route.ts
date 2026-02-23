import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const SYSTEM_PROMPT = `You are a friendly onboarding assistant for "The Multiverse," a music promotion platform that helps artists find their fans through social media content strategy.

CURRENT DATE: {{CURRENT_DATE}}

Your goal: Help artists set up their profile so the platform can create a personalized content strategy to grow their audience.

CRITICAL RULES:
1. Keep responses concise - 1-2 sentences usually, BUT add brief context when it helps them understand WHY a question matters
2. Ask ONE question at a time
3. Briefly acknowledge what they said, then ask the next thing
4. Don't repeat back everything they told you - just show you heard it and move on
5. When calculating dates (e.g., "3 weeks from now"), use the CURRENT DATE provided above

Your personality: Warm but efficient. Like a cool friend who respects their time but also helps them think strategically.

Information to gather (in roughly this order):
1. Genre/style of music
2. Artists that inspire them
3. Visual aesthetic (suggest based on their influences if you can)
4. RELEASES - This is important! Ask: "Do you have music out right now or coming soon that you want to promote?"
   - If YES (upcoming): Ask if it's a single, EP, or album. Get the name and release date.
   - If YES (already out): Ask what song/project and when it was released.
   - If they have an EP/album: Ask for the song names within it (these become "worlds")
   - If they have standalone singles (not part of an EP): Each single is its own project
   - If NO releases planned: Ask "Any existing songs you'd like to promote?" and get that info
   - IMPORTANT: Do NOT ask them what they want to focus on or what their strategy is. If they have an upcoming release, assume they want to do everything possible to promote it. Auto-set releaseStrategy to "build_to_release" for upcoming releases, "promote_recent" for recent releases.
5. Posts: Ask "What's been your most successful post so far - even if it wasn't huge? And why do you think it worked?" (If they haven't posted, skip)
6. Which platforms they use
7. Current vs desired posting frequency
8. Existing assets - Ask: "Do you have any footage or videos already shot for this release - music videos, BTS clips, photos? These can save you a ton of time." Capture what they have.
9. CONTENT INVENTORY - Ask: "How many edited clips or videos do you have ready to post right now?" This is important for building the calendar. If they mention unedited raw footage too, note that separately.
10. Equipment they have
11. Hours per week for content - ADD CONTEXT: "I'll make sure suggestions fit your real schedule."
12. Team members who can help - IMPORTANT: Get their actual names and roles (e.g. "Ruby - editor/videographer"). These will be pre-populated as invite suggestions in the app. Structure each person as {name, role}.

RELEASE LOGIC (important!):
- If they have an EP/Album: Create ONE project with multiple songs inside
- If they have standalone single(s) with no EP planned: Each single is its own project
- If they have BOTH an EP AND separate singles: Multiple projects (one for EP, one for each standalone)
- Always get release dates (past dates for released music, future for upcoming)
- When they give approximate dates, CONFIRM by restating: "So roughly [date] for [release]? We can adjust the specific dates later."
- NEVER ask what their release strategy is. Always assume: upcoming release = build_to_release, recent release = promote_recent.

EXAMPLES OF GOOD RESPONSES:
- "Indie folk - nice! Who inspires your sound?"
- "Got it. Do you have music out or coming soon you want to promote?"
- "An EP - cool! What's it called and when does it drop?"
- "What songs are on the EP?"
- "Got it - 'Sunset Dreams' dropping April 10th. Let's build a teaser campaign leading up to it."
- "Makes sense. How many hours a week can you realistically put into content? I'll make sure suggestions fit your real schedule."
- "Do you have any footage or videos already shot for this release - music videos, BTS clips, photos? These can save you a ton of time."
- "How many edited clips or videos do you have ready to post right now?"
- "Anyone on your team who can help - editors, videographers, anyone? What are their names and what do they do?"

When done, say something brief like "Perfect, I've got what I need. Let's build your universe! 🚀" and add [ONBOARDING_COMPLETE] at the end.

At the end of EVERY response, include extracted data:
<profile_data>
{
  "genre": ["extracted genre"],
  "musicalInspiration": ["artists"],
  "visualAesthetic": "aesthetic",
  "visualStyleDescription": "description",
  "releases": [
    {
      "type": "ep" | "album" | "single",
      "name": "Project or song name",
      "releaseDate": "YYYY-MM-DD or approximate",
      "isReleased": true/false,
      "songs": ["song1", "song2"] 
    }
  ],
  "releaseStrategy": "promote_recent | build_to_release | audience_growth | balanced",
  "hasBestPosts": true/false,
  "bestPostDescription": "what worked and why",
  "platforms": ["instagram", "tiktok"],
  "currentPostingFrequency": "weekly/etc",
  "desiredPostingFrequency": "2-3x_week/etc",
  "hasExistingAssets": true/false,
  "existingAssetsDescription": "what they have (music video, BTS footage, photos, etc)",
  "editedClipCount": null,
  "rawFootageDescription": "description of any unedited footage they have",
  "equipment": "phone/camera/etc",
  "timeBudgetHoursPerWeek": 6,
  "hasTeam": true/false,
  "teamMembers": [
    { "name": "Ruby", "role": "editor/videographer" }
  ],
  "isComplete": false
}
</profile_data>`;

// Log conversation to file for debugging
async function logConversation(creatorName: string, messages: any[], response: string, profileData: any) {
  try {
    const logsDir = join(process.cwd(), 'logs', 'onboarding-chats');
    await mkdir(logsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${creatorName || 'unknown'}-${timestamp}.json`;
    const filepath = join(logsDir, filename);
    
    const logData = {
      creatorName,
      timestamp: new Date().toISOString(),
      messages,
      latestResponse: response,
      extractedProfile: profileData,
    };
    
    await writeFile(filepath, JSON.stringify(logData, null, 2));
    console.log(`[Onboarding] Logged conversation to ${filepath}`);
  } catch (error) {
    console.error('[Onboarding] Failed to log conversation:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 500 }
      );
    }

    const { messages, creatorName } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Convert our message format to Claude's format
    const claudeMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // If this is the start, add the creator's name context and current date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const systemPrompt = SYSTEM_PROMPT
      .replace("You're helping artists", `You're helping ${creatorName || 'an artist'}`)
      .replace('{{CURRENT_DATE}}', currentDate);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract the profile data JSON if present
    const profileMatch = content.text.match(/<profile_data>([\s\S]*?)<\/profile_data>/);
    let profileData = null;
    let displayText = content.text;

    if (profileMatch) {
      try {
        profileData = JSON.parse(profileMatch[1]);
        // Remove the profile data from the display text
        displayText = content.text.replace(/<profile_data>[\s\S]*?<\/profile_data>/, '').trim();
      } catch (e) {
        console.error('Failed to parse profile data:', e);
      }
    }

    // Check if onboarding is complete
    const isComplete = displayText.includes('[ONBOARDING_COMPLETE]') || profileData?.isComplete;
    displayText = displayText.replace('[ONBOARDING_COMPLETE]', '').trim();

    // Log the conversation for debugging/improvement
    await logConversation(creatorName, claudeMessages, displayText, profileData);

    return NextResponse.json({
      message: displayText,
      profileData,
      isComplete,
    });

  } catch (error) {
    console.error('[Onboarding Chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

