# Implementation Examples - Specific Features

**Date:** January 12, 2026  
**Status:** Final Refinement Before Implementation

---

## 1. Snapshot Schedule Calculator (Dynamic)

### How It Works:

**Step 1: Collect Artist Capacity**
```
Question: "How many hours per week can you dedicate to snapshot creation?"
- Options: 2-4 hours, 5-8 hours, 9-12 hours, 13+ hours
- Default: 5-8 hours

Question: "Which platforms are you posting to?"
- Instagram (2-3 posts/week recommended)
- TikTok (4-7 posts/week recommended)
- YouTube (1-2 posts/week recommended)
- Multiple: We'll optimize for your primary platform
```

**Step 2: Calculate Timeline**
```
World 1 Release: February 1st
World 2 Release: April 1st
Gap: 2 months

Snapshot timeline for World 1:
- Start: January 18th (2 weeks before)
- End: March 15th (2 weeks before World 2 promo starts)
- Duration: 8 weeks
```

**Step 3: Calculate Snapshot Count**
```
If artist has 6 hours/week:
- Can create ~2-3 snapshots per week
- Over 8 weeks = 16-24 snapshots total
- But we want 6-8 snapshots per world
- Solution: Space them out (2-3 per week)

If artist has 2-4 hours/week:
- Can create ~1-2 snapshots per week
- Over 8 weeks = 8-16 snapshots total
- Adjust to 6 snapshots (1 per week)

If artist has 9+ hours/week:
- Can create ~3-4 snapshots per week
- Over 8 weeks = 24-32 snapshots total
- Can do 8 snapshots (2-3 per week)
```

**Step 4: Generate Schedule**
```
Platform: TikTok (higher frequency)
Capacity: 6 hours/week
Timeline: 8 weeks
Result: 8 snapshots, posted 2-3 times per week

Schedule:
- Week -2: 2 snapshots (Tuesday, Friday)
- Week -1: 2 snapshots (Tuesday, Friday)
- Release Week: 2 snapshots (Tuesday, Friday)
- Week +1: 1 snapshot (Wednesday)
- Week +2: 1 snapshot (Wednesday)
- Weeks +3-6: 0 snapshots (saving for next release)
```

**Step 5: Adjust for Next Release**
```
If World 2 releases April 1st:
- World 1 snapshots stop 2 weeks before (March 15th)
- World 2 pre-release starts March 18th
- Seamless transition
```

### UI Implementation:

```typescript
// Snapshot Schedule Calculator
interface ScheduleConfig {
  releaseDate: Date;
  nextReleaseDate?: Date;
  hoursPerWeek: number; // 2-4, 5-8, 9-12, 13+
  platforms: ('instagram' | 'tiktok' | 'youtube')[];
  preferredFrequency: 'low' | 'medium' | 'high';
}

function calculateSnapshotSchedule(config: ScheduleConfig) {
  // Calculate timeline
  const startDate = subtractWeeks(config.releaseDate, 2);
  const endDate = config.nextReleaseDate 
    ? subtractWeeks(config.nextReleaseDate, 2)
    : addWeeks(config.releaseDate, 8);
  
  const durationWeeks = differenceInWeeks(endDate, startDate);
  
  // Calculate capacity
  const snapshotsPerWeek = calculateCapacity(
    config.hoursPerWeek,
    config.platforms
  );
  
  // Calculate total snapshots
  const totalSnapshots = Math.min(
    snapshotsPerWeek * durationWeeks,
    8 // Max per world
  );
  
  // Generate posting dates
  const postingDates = generatePostingDates(
    startDate,
    endDate,
    totalSnapshots,
    config.platforms
  );
  
  return {
    totalSnapshots,
    postingDates,
    timeline: { startDate, endDate, durationWeeks }
  };
}
```

---

## 2. Enhanced Onboarding (5 Questions + Follow-ups)

### Question Set:

**Question 1: Genre & Musical Style**
```
"What genre best describes your music?"
- [Dropdown: Pop, Rock, Hip-Hop, R&B, Electronic, Indie, Alternative, etc.]
- [Optional: "Select multiple if you blend genres"]

Follow-up (if needed):
"What artists inspire your sound?"
- [Text input: "e.g., The Weeknd, Dua Lipa, Tame Impala"]
```

**Question 2: Visual Style**
```
"What visual aesthetic best matches your music?"
- [Multiple choice with images]
  - Dark & Moody (gothic, noir, cinematic)
  - Bright & Energetic (neon, vibrant, high-energy)
  - Dreamy & Ethereal (soft, pastel, atmospheric)
  - Retro/Vintage (80s, 90s, film grain)
  - Minimalist (clean, simple, modern)
  - [Custom: Describe your own]

Follow-up (if custom):
"Describe your visual style in 2-3 sentences"
- [Textarea]
```

**Question 3: Best Performing Posts**
```
"Do you have any posts that performed really well?"
- [Yes / No / Not Sure]

If Yes:
"Tell us about your best post(s):"
- [Textarea: "What made it successful? What did it look like?"]
- [Optional: Upload screenshot or paste Instagram/TikTok URL]
- [Optional: "What metrics made it successful? (views, likes, streams, etc.)"]

Follow-up:
"What visual elements did it have?"
- [Checkboxes: Specific colors, lighting, locations, shot types, etc.]
```

**Question 4: Platforms & Frequency**
```
"Which platforms do you post to?"
- [Checkboxes: Instagram, TikTok, YouTube, Twitter]
- [Primary platform selector]

"What's your current posting frequency?"
- [Dropdown: Daily, 2-3x/week, Weekly, Less than weekly]
- [Desired frequency: Same options]
```

**Question 5: Visual Themes for Worlds**
```
"When creating content for a new release, what visual themes do you want to explore?"
- [Textarea: "e.g., neon cityscapes, vintage cars, dreamy forests, etc."]
- [Optional: Upload visual references or Pinterest board link]

Follow-up:
"Are there specific visual trends you want to incorporate?"
- [Textarea: "e.g., Y2K aesthetic, film grain, specific color palettes, etc."]
```

### UI Flow:

```typescript
// Onboarding Form Component
const onboardingQuestions = [
  {
    id: 'genre',
    question: "What genre best describes your music?",
    type: 'select',
    options: GENRES,
    followUp: {
      condition: 'if_multiple_selected',
      question: "What artists inspire your sound?",
      type: 'text'
    }
  },
  {
    id: 'visual_style',
    question: "What visual aesthetic best matches your music?",
    type: 'multiple_choice_with_images',
    options: VISUAL_STYLES,
    followUp: {
      condition: 'if_custom_selected',
      question: "Describe your visual style in 2-3 sentences",
      type: 'textarea'
    }
  },
  {
    id: 'best_posts',
    question: "Do you have any posts that performed really well?",
    type: 'yes_no',
    followUp: {
      condition: 'if_yes',
      questions: [
        {
          question: "Tell us about your best post(s):",
          type: 'textarea',
          optional: ['screenshot_upload', 'url_input']
        },
        {
          question: "What visual elements did it have?",
          type: 'checkboxes',
          options: VISUAL_ELEMENTS
        }
      ]
    }
  },
  // ... more questions
];
```

---

## 3. World Creation Questionnaire (Visual Direction)

### Required Questions:

**Question 1: Overall Visual Direction**
```
"What should snapshots for this world look and feel like?"
- [Textarea: "Describe the mood, aesthetic, colors, and overall vibe"]
- [Visual reference upload: Drag & drop images or paste URLs]
- [Optional: Pinterest board link]

AI Suggestion Button (always available):
"Need help? Get AI suggestions based on your world"
```

**Question 2: Per-Snapshot Visual Direction**
```
"For each snapshot, what should it look like specifically?"

[For each of the 6-8 snapshots in schedule:]

Snapshot 1 (Pre-release, Week -2):
- Visual description: [Textarea]
- Mood/Feel: [Dropdown: Energetic, Dreamy, Dark, Bright, etc.]
- Key visual elements: [Checkboxes: Specific colors, lighting, locations, etc.]
- [AI Suggestion Button]

Snapshot 2 (Pre-release, Week -2):
- [Same fields]
...

[Or: "Use same visual direction for all" checkbox]
```

**Question 3: Story/Concept**
```
"What's the story or concept for this world?"
- [Textarea: "e.g., A journey through a neon-lit city at night"]
- [Optional: Key moments to capture (lyrics, hooks, visual moments)]
```

**Question 4: Specific Shot Ideas**
```
"Do you have specific shot ideas for snapshots?"
- [Yes / No / Some Ideas]

If Yes:
"Describe your shot ideas:"
- [Textarea: "e.g., Close-up of face in neon light, wide shot of running through city, etc."]

AI Suggestion Button:
"Get AI shot suggestions based on your visual direction"
```

### UI Implementation:

```typescript
// World Creation Form
interface WorldVisualDirection {
  overallDirection: string;
  visualReferences: string[]; // Image URLs
  storyConcept?: string;
  snapshots: SnapshotVisualDirection[];
}

interface SnapshotVisualDirection {
  snapshotId: string;
  visualDescription: string;
  mood: string;
  keyElements: string[];
  specificShots?: string[];
}

// Component
<WorldCreationForm>
  <VisualDirectionSection>
    <OverallDirectionInput />
    <VisualReferenceUpload />
    <AISuggestionButton prompt="Generate visual direction" />
  </VisualDirectionSection>
  
  <PerSnapshotSection>
    {snapshots.map(snapshot => (
      <SnapshotVisualDirection
        snapshot={snapshot}
        onAISuggest={() => generateAISuggestions(snapshot)}
      />
    ))}
  </PerSnapshotSection>
  
  <StoryConceptSection />
  <SpecificShotsSection />
</WorldCreationForm>
```

---

## 4. Memory-to-Snapshots Workflow (Required Steps)

### Clarification: "Cut Memories"

**What I mean:** After filming a "memory" (master video), you need to select specific clips/segments and assign them to different snapshots. For example:
- Memory: 30-second video of artist running through neon city
- Snapshot 1: 10-second clip (first half, close-up)
- Snapshot 2: 15-second clip (middle section, wide shot)
- Snapshot 3: 10-second clip (ending, different angle)

### Required Workflow:

**Step 1: Create Memory (Required)**
```
Memory Creator Form:
- Visual Direction: [Pre-filled from world creation]
- Treatment/Script: [Required textarea]
  - "Describe what will be filmed"
  - "Include shot descriptions, mood, locations, etc."
  - [AI Suggestion Button available]

- Shot List: [Required]
  - [Add shot button]
  - Each shot:
    - Description: [Textarea]
    - Type: [Dropdown: Close-up, Wide, Movement, etc.]
    - Duration: [Number input: seconds]
    - Notes: [Optional textarea]
  - [AI Suggestion Button: "Generate shot list from treatment"]

- Filming Date: [Date picker]
- Location: [Text input]
- Team Members: [Multi-select]
```

**Step 2: Film Memory**
```
[Artist films the memory - happens outside platform]
```

**Step 3: Upload Raw Footage**
```
Upload Interface:
- [Drag & drop video file]
- [Progress bar]
- [Preview player]
- [Confirm upload]
```

**Step 4: Cut Memory into Snapshots (Required)**
```
Snapshot Cutter Interface:

[Video Timeline Player]
- Shows full memory video
- Can scrub through timeline
- Can mark in/out points

For each snapshot (2-4 total):
- Snapshot 1:
  - [Select clip button] → Opens timeline
  - In point: [Timecode]
  - Out point: [Timecode]
  - Duration: [Auto-calculated]
  - Length: [Dropdown: 10s, 15s, 20s, 30s] (must match clip)
  - Platform: [Checkboxes: Instagram, TikTok, YouTube]
  - Caption: [Textarea]
  - Post Date: [Pre-filled from schedule]
  - [Preview button]

- Snapshot 2:
  [Same fields]
  
- Snapshot 3:
  [Same fields]

[Guidance always available:]
- "Tip: Select clips that match the visual direction for each snapshot"
- "Tip: Different platforms may need different lengths"
- [AI Suggestion: "Suggest clip selections based on visual direction"]
```

**Step 5: Review & Approve**
```
Review Screen:
- [Preview all snapshots]
- [Edit button for each]
- [Approve all] or [Approve individually]
- [Export/Download] (for posting)
```

### UI Implementation:

```typescript
// Memory Creator
<MemoryCreator>
  <TreatmentSection required>
    <Textarea 
      value={treatment}
      placeholder="Describe what will be filmed..."
    />
    <AISuggestionButton />
  </TreatmentSection>
  
  <ShotListSection required>
    {shots.map(shot => (
      <ShotInput
        description={shot.description}
        type={shot.type}
        duration={shot.duration}
      />
    ))}
    <AddShotButton />
    <AISuggestionButton prompt="Generate shot list" />
  </ShotListSection>
  
  <FilmingDetailsSection>
    <DatePicker />
    <LocationInput />
    <TeamSelect />
  </FilmingDetailsSection>
</MemoryCreator>

// Snapshot Cutter
<SnapshotCutter video={uploadedVideo}>
  <VideoTimeline 
    video={video}
    onSelectClip={(inPoint, outPoint) => {
      // Handle clip selection
    }}
  />
  
  {snapshots.map(snapshot => (
    <SnapshotEditor
      snapshot={snapshot}
      clipSelection={snapshot.clip}
      onSelectClip={() => openTimelineSelector()}
      caption={snapshot.caption}
      platform={snapshot.platform}
      postDate={snapshot.postDate}
      guidance={
        "Tip: Select clips that match the visual direction"
      }
      aiSuggestion={() => suggestClips(snapshot)}
    />
  ))}
  
  <ReviewButton />
</SnapshotCutter>
```

---

## 5. AI Suggestions (Always Available, Never Forced)

### Implementation:

**AI Suggestion Buttons (Throughout Platform):**

```typescript
// Always available, never forced
<AISuggestionButton
  prompt="Generate visual direction"
  context={worldData}
  onSuggest={(suggestion) => {
    // Show suggestion in modal
    // User can accept, modify, or dismiss
  }}
/>

// Usage Examples:
1. Visual Direction: "Get AI suggestions for visual direction"
2. Treatment: "Generate treatment from visual direction"
3. Shot List: "Generate shot list from treatment"
4. Clip Selection: "Suggest clip selections for snapshots"
5. Captions: "Generate captions for this snapshot"
```

**AI Suggestion Modal:**
```
[Modal appears when button clicked]

AI Suggestion:
[Generated content displayed]

Actions:
- [Accept] → Fills in form
- [Modify] → Opens editor with suggestion pre-filled
- [Dismiss] → Closes modal
- [Get Another] → Generates new suggestion
```

---

## Summary of Implementation

### 1. Snapshot Schedule Calculator
- Dynamic based on hours/week, platforms, release timeline
- Adjusts for next release (stops 2 weeks before)
- Range: 3-7 snapshots per week, 6-8 total per world
- Timeline: 2 weeks before to 2 months after

### 2. Enhanced Onboarding
- 5 core questions with conditional follow-ups
- Asks about best posts (manual entry)
- Focuses on visual themes and trends
- Collects what's working visually

### 3. World Creation Questionnaire
- Overall visual direction (required)
- Per-snapshot visual direction (required)
- Story/concept (optional)
- Specific shot ideas (optional)
- AI suggestions always available

### 4. Memory-to-Snapshots Workflow
- Treatment required (cannot skip)
- Shot list required (cannot skip)
- Cut memories = select clips from master video
- Assign clips to 2-4 snapshots
- Always offer guidance, full control to artist

### 5. AI Suggestions
- Always available, never forced
- Available at every step
- User can accept, modify, or dismiss

---

**Ready for your feedback on these specific implementations!**


