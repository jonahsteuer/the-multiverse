# The Multiverse — Product Specification

**Version:** 3.0  
**Last Updated:** February 22, 2026  
**Status:** Live — Active Development  
**URL:** [themultiverse.space](https://themultiverse.space)  
**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase · Claude AI

---

## Overview

The Multiverse is an intelligent content management platform for independent music artists. It acts as a **master scheduler and manager** — guiding artists through the full content lifecycle: brainstorming ideas, planning and executing shoot days, managing post-production, and scheduling posts to social media.

The platform's core differentiator is its **AI assistant, Mark**, who guides artists through structured workflows and eliminates the guesswork from content creation. Rather than a passive tool, The Multiverse proactively helps artists stay consistent, build their visual universe, and coordinate their team.

---

## Core Metaphor: Universe → Galaxy → World

| Term | Meaning |
|------|---------|
| **Universe** | The artist's entire persona and all their releases |
| **Galaxy** | A release project (album, EP, or standalone single campaign) |
| **World** | A single song/release within a galaxy |
| **Posts / Snapshots** | Individual social media content pieces linked to a world |

---

## What's Built (Current State)

### 1. Authentication & Onboarding

- Email + password auth via Supabase
- **Conversational onboarding** (`ConversationalOnboarding.tsx`): Mark greets new users and collects artist profile data through a chat interface
- **Creator setup form** (`CreatorOnboardingForm.tsx`): Name, genre, location (zip code stored for location-aware recommendations)
- **Galaxy + World creation** (`GalaxyCreationForm.tsx`, `WorldCreationForm.tsx`): Artists name their release project and first song
- Profile editing panel (`ProfileEditPanel.tsx`) with editable user-specific data (zip code, listening context, song emotion, soundbytes, etc.)

---

### 2. Universe View (Homepage after login)

- 3D galaxy visualization using **Three.js / React Three Fiber** (`Galaxy3DView.tsx`, `Galaxy3DWrapper.tsx`)
- Worlds orbit a sun; each world represents a release
- Release countdown displayed ("Releasing in X days")
- Click a world to open the **World Detail View**
- **View Calendar** button opens the full calendar
- Invite team members from the galaxy view
- Remove team members from the galaxy

---

### 3. World Detail View (`WorldDetailView.tsx`)

A tabbed panel for each song/release with the following tabs:

#### All Posts Tab
- Grid of all post slots linked to this world
- Posts sourced from `team_tasks` (Supabase) where `task_category = 'event'`
- Post titles shown (e.g. "Post 1.11", "Trial 1 for Post 1.11", "Reflection in Stream")
- Click a post card to open the **Post Detail Modal**

#### Footage Tab
- List of footage links (Google Drive / Dropbox URLs) uploaded from the Shoot Day event
- Each link's name is **editable inline**

#### Song Data Tab
- **Track upload**: Upload a WAV/MP3; large files (>50MB) are auto-converted to MP3 client-side before upload using `@breezystack/lamejs`
- **Waveform editor** using **WaveSurfer.js**: Visual waveform with draggable soundbyte selection (3–5 soundbytes)
- Each soundbyte is named (e.g. "Verse 1", "Chorus"), plays on loop when previewed, and stores start/end times
- Soundbytes and track URL persisted to `galaxies.brainstorm_draft`
- **Lyrics** storage and editing
- If soundbytes are already saved, a "locked in" summary view is shown instead of the full editor

#### Team Tab
- Shows all team members with roles
- Admin can assign tasks, view activity

---

### 4. Calendar (`EnhancedCalendar.tsx`)

A fully-featured weekly calendar that is the primary scheduling interface.

#### Layout
- 4-week grid view (current month + context)
- Previous/Next navigation to browse past and future weeks
- Task/event cards sized to fit all tasks without hiding any
- Fixed-height day boxes; cells with many tasks stack cards smaller

#### Task/Event Types & Colors
| Type | Color | Description |
|------|-------|-------------|
| `prep` | Blue | Prep tasks (e.g. "Prep for shoot day") |
| `edit` | Cyan | Edit days and editing tasks |
| `shoot` | Orange | Shoot day events |
| `post` | Yellow/Green (skeleton: greyed+dashed) | Post slots and trial reels |
| `release` | Red | Release day |
| `review` | Purple | Review tasks |
| `custom` (check_in) | Teal | Shoot check-ins, weekly check-ins |
| `promo` | Yellow | Promo posts (post-release) |
| `audience-builder` | Green | Audience builder posts |

#### Skeleton Posts (Unedited Placeholder Slots)
- Skeleton posts are greyed out with a dashed border
- Named using **X.YZ convention**: `Post 1.11`, `Post 1.12`, … where `X` = shoot number, `Y` = batch number (edit day), `Z` = post within the batch
- Trial reels are named: `Trial 1 for Post 1.11`, `Trial 2 for Post 1.11` — 2 per post, scheduled the day before their corresponding main post
- When a finished edit is submitted on Edit Day, skeleton slots become filled posts

#### Calendar Generation Logic
- DB-backed tasks (from `team_tasks` in Supabase) are the primary source of truth
- Local prep-task generation (for "Upload footage"-type tasks) is **skipped entirely** if the team already has skeleton posts — the brainstorm/shoot-check-in workflow replaces the generic prep phase
- Generated tasks are saved to Supabase and are never re-generated if already present
- The "Save to DB" guard also does a real-time DB check for skeleton posts before inserting, preventing race conditions on first render

#### Task Interactions
- Click a post-type task → opens **Post Detail Modal**
- Click a Shoot Check-in task → opens **Shoot Check-in Modal**
- Click any other task → opens **Task Panel**
- Right-click → context menu (assign to team member, delete)
- Delete → removes from Supabase and all associated world view tabs

#### Rollout Zones (Calendar Phases)
- `Pre-release`, `Release Week`, `Post-release` banners shown above each week
- Based on calculated distance from release date

---

### 5. Mark — AI Content Assistant (`MarkChatPanel.tsx`)

Mark is a conversational AI assistant powered by **Claude (Anthropic)**. He lives in a chat panel that can be opened from any screen.

#### Mark's Capabilities
- **Content brainstorming**: Full guided brainstorm session (see §6)
- **Task awareness**: Knows what's on the calendar and can answer questions about it
- **Proactive suggestions**: Can recommend next steps based on current state
- **Knowledge base** (`lib/mark-knowledge.ts`): Domain knowledge about music content strategy
- **Voice input** (`VoiceInput.tsx`): Users can speak to Mark; transcribed via Whisper API

#### Mark's Chat Panel
- Persistent chat thread per galaxy
- Real-time streaming responses
- Team chat integration (Mark messages appear in the team feed)

---

### 6. Content Brainstorm Flow (`BrainstormContent.tsx`)

A multi-step, Mark-guided session that produces a complete shoot plan. All data is saved incrementally to Supabase so the session can be resumed at any time.

#### Saved Per-User (Never Re-Asked)
- **Zip code** (for location recommendations)

#### Saved Per-Song/World (Never Re-Asked After First Collection)
- **Song file** (WAV → MP3, stored in Supabase Storage)
- **Lyrics** (stored in `galaxies.brainstorm_draft.lyrics`)
- **Song emotion** (1–2 word description, e.g. "heartbreak")
- **Listening context** (where someone might listen, e.g. "driving alone at night")
- **Soundbytes** (3–5 named time ranges, stored in `brainstorm_draft.confirmedSoundbytes`)

#### Session-Specific Data (Guides Brainstorm, Restorable)
- Location area, specific location (confirmed via Google Maps Places API)
- Selected scenes (from AI-generated options with Instagram reference links)
- Looks per scene (camera setups, location-aware)
- Post format assignments
- Shoot day date and schedule

#### Brainstorm Steps
1. Check for saved song data → skip if already saved
2. Gather song emotion (if not saved)
3. Gather listening context (if not saved)
4. Suggest and confirm shoot location (Google Maps Places API, weather-aware)
5. Generate 5 scene concepts with Instagram/TikTok reference links (Tavily API)
6. User selects 3 scenes
7. Generate 4–5 looks per scene (camera angles, location-specific descriptions)
8. User selects looks (checked on shoot day)
9. Soundbyte confirmation (shows waveform editor if not already saved, or "locked in" summary)
10. Generate shoot schedule → outputs `BrainstormResult`

#### Brainstorm Output (`handleBrainstormComplete` in `GalaxyView.tsx`)
Creates in Supabase:
- **Shoot Day event** (`type: 'shoot'`): Timed schedule per scene/look
- **Shoot Check-in task** (`type: 'custom'`, `rollout_zone: 'shoot-check-in'`): Appears 1 hour after shoot end
- **Skeleton post slots** (Batch 1): 5 main posts + 2 trial reels each = up to 10 tasks, named `Post 1.11–1.15`, trials scheduled day-before
- Does NOT immediately create filled post content — those are created at Edit Day

---

### 7. Shoot Day Event & Modal (`ShootDayModal.tsx`)

Clicking the Shoot Day calendar event opens a dedicated modal:

- **Timed shoot schedule**: Per-scene, per-look breakdown with times
  - Each scene: concept, setting, best-light window, hook description
  - Each look: 3–5 takes of each of the 3 selected soundbytes
  - Scene-specific Instagram/TikTok reference links (tappable)
- **Footage link upload**: Input for Google Drive / Dropbox link (saved to World → Footage tab)
- **Download PDF**: Full shoot schedule as a downloadable PDF with complete descriptions
  - All 3 looks per scene (not truncated)
  - Hook + lighting descriptions
  - Clickable reference links

---

### 8. Shoot Check-in Modal (`ShootCheckInModal.tsx`)

Auto-generated task that appears on the calendar ~1 hour after the shoot day ends. Clicking it opens a structured form:

#### Form Sections
1. **Footage link**: Where today's raw footage is stored
2. **Location**: "Did you shoot at the original location?" — if No, add Google Maps links with reasons (stored for Mark's future location recommendations)
3. **Per-scene capture**: For each planned scene — was it shot? Editable title + description (updated titles propagate to all associated skeleton post instructions)
4. **Per-look capture**: For each look within each shot scene — was it shot? How many takes? Which soundbytes were covered?
5. **Notes**: Free-text field

#### On Submission
- Check-in data saved to `mark_analysis` JSONB on the check-in task
- Task status set to `completed`
- `generateEditDayInstructions()` creates detailed per-post edit instructions for Edit Day 1, referencing updated scene/look titles and soundbyte coverage
- Edit Day 1 task description is updated with those instructions
- Alternate location notes saved to `galaxies.brainstorm_draft`

---

### 9. Edit Day

The Edit Day task (e.g. "Edit Day 1 — Batch 1.1") appears on the calendar on the scheduled date. Its description contains the Mark-generated edit instructions.

#### Edit Instructions Format
Each of the 5 skeleton post slots gets a specific instruction card:
- Scene + look reference (using updated titles from check-in)
- Which soundbyte to use (start/end time)
- Number of takes available
- Suggested caption direction / hook framing
- Trial reel guidance (same clip, slight caption variation)

#### Batch Logic
- **Batch 1.1** = 5 posts from the first edit day of Shoot 1
- Each batch tests one variable (e.g. Batch 1 = test soundbyte performance: each post uses a different soundbyte)
- 2 trial reels per post (day before each post) for micro-testing caption/take variations
- **Weekly Check-in** auto-schedules after the last post of each batch to review performance

#### Post Naming Convention
```
Post X.YZ
 └── X = shoot number  (1 = first shoot)
 └── Y = batch number  (1 = first edit day output)
 └── Z = post within batch (1–5)

Example: Post 1.11 = Shoot 1, Batch 1, Post 1
         Trial 1 for Post 1.12 = trial reel for Shoot 1, Batch 1, Post 2
```

---

### 10. Post Detail Modal (`PostDetailModal.tsx`)

Opens when clicking any post card (from calendar or All Posts tab):
- Post title, date, description
- Edit instructions (from Edit Day)
- Upload finished video edit (Google Drive / Dropbox link)
- Caption / hashtags
- Approval workflow: `unlinked → linked → analyzed → caption_written → revision_requested → approved → scheduled → posted`
- Send edit for review: opens **Send With Notes Modal**

---

### 11. Team Collaboration

#### Invitation System (`InviteModal.tsx`)
- Admin invites collaborators by email
- Invitation is to a **specific galaxy** (not the entire universe)
- Invite link uses a signed token
- Invited user lands on the galaxy view automatically

#### Team Roles
- **Admin**: Full access — brainstorm, calendar, world view, team management
- **Member (Videographer/Editor)**: Scoped access — can view calendar, upload edits, view shoot schedule
- Permission-based UI rendering throughout

#### Team Chat (`TeamChat.tsx`)
- Group chat for all galaxy members + optional direct messages between pairs
- Mark's responses appear in the team chat thread
- Edit cards shared in chat are **clickable** → open the post card in the world view
- Edit cards sent via DM look identical to group chat edit cards
- Email notifications sent via **Resend API** (domain: `themultiverse.space`) when:
  - Edit is shared with notes
  - A note is sent to a team member

---

### 12. Notification System (`NotificationBell.tsx`)

- In-app notification bell in the header
- Notifications for: new team member joined, edit uploaded, notes received, task assigned

---

### 13. Todo List (`TodoList.tsx`)

- Shows today's tasks pulled from `team_tasks` for today's date
- Reflects what's actually on the calendar for today
- Tasks link to the same DB records — checking one off updates the calendar

---

## Tech Stack

### Core
| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | Claude 3.5 Sonnet (Anthropic) via streaming API |
| 3D | Three.js + React Three Fiber |
| Deployment | Vercel (production: themultiverse.space) |

### Key Libraries
| Library | Purpose |
|---------|---------|
| `wavesurfer.js` | Waveform display + soundbyte selection |
| `@breezystack/lamejs` | Client-side WAV → MP3 conversion |
| `@dnd-kit` | Drag-and-drop for calendar tasks |
| `resend` | Email notifications |
| `jspdf` | Shoot schedule PDF export |
| `tavily` | Instagram/TikTok reference link search |
| `@anthropic-ai/sdk` | Claude API |

### APIs & Services
| Service | Usage |
|---------|-------|
| Google Maps Places API | Location search in brainstorm |
| Tavily API | Reference video search for scenes |
| Google Calendar API | Two-way sync of events |
| Resend | Transactional emails from `themultiverse.space` |
| Supabase Storage | Song files, footage |

---

## Database Schema (Key Tables)

### `universes`
- `id`, `user_id`, `name`, `created_at`

### `galaxies`
- `id`, `universe_id`, `user_id`, `name`, `release_date`
- `brainstorm_draft` (JSONB): `{ lyrics, track_url, confirmedSoundbytes, confirmedLocation, alternateLocationNotes, listeningContext, songEmotion, ... }`
- `brainstorm_liked_scenes` (JSONB array): scenes selected during brainstorm
- `brainstorm_location_area`: location context

### `teams`
- `id`, `universe_id`, `galaxy_id`, `name`, `created_by`

### `team_tasks`
- `id`, `team_id`, `galaxy_id`, `title`, `description`
- `type`: `'custom' | 'edit' | 'post' | 'prep' | 'release' | 'review' | 'shoot'`
- `task_category`: `'task' | 'event' | 'footage'`
- `date`, `start_time`, `end_time`
- `status`: `'pending' | 'in_progress' | 'completed'`
- `rollout_zone`: e.g. `'skeleton-1.11'`, `'shoot-check-in'`, `'pre-release'`, etc.
- `mark_analysis` (JSONB): Shoot check-in data, edit instructions
- `soundbyte`, `shoot_look`, `video_url`, `caption`, `hashtags`, etc.

---

## Current Calendar State (Leon Tax — "Will I Find You")

As of February 2026, Leon Tax's calendar reflects the full brainstorm → shoot → check-in workflow:

| Date | Events |
|------|--------|
| Fri 3/13 | Shoot Day — Ferndell Nature Trail |
| Fri 3/13 | Shoot Check-in — Ferndell Nature Trail |
| Thu 3/19 | Edit Day 1 — Batch 1.1 (with per-post instructions) |
| Fri 3/20 | Trial 1 for Post 1.11, Trial 2 for Post 1.11 |
| Sat 3/21 | Post 1.11, Trial 1 for Post 1.12, Trial 2 for Post 1.12, Release Day |
| Sun 3/22 | Post 1.12, Trial 1 for Post 1.13, Trial 2 for Post 1.13 |
| Mon 3/23 | Post 1.13 |
| Tue 3/24 | Trial 1 for Post 1.14, Trial 2 for Post 1.14 |
| Wed 3/25 | Post 1.14, Trial 1 for Post 1.15, Trial 2 for Post 1.15 |
| Thu 3/26 | Post 1.15 |
| Fri 3/27 | Trial 1 for Post 2.11, Trial 2 for Post 2.11 |
| Sat 3/28 | Weekly Check-in — Batch 1 Review |
| Sun 3/29+ | Promo Posts (daily), Edit Day 2, Weekly Check-ins |

---

## What's Pending / Not Yet Built

### Near-Term Priorities

1. **Edit Day → Skeleton post filling**: When the editor submits finished edits on Edit Day, the corresponding skeleton post slot should transform into a filled post with the video attached

2. **Weekly Check-in flow**: The Weekly Check-in task should open a structured form to review batch performance and inform the next batch's strategy (soundbyte winner, scene that performed best, etc.)

3. **Batch 2+ planning**: After Batch 1 check-in, automatically plan Edit Day 2 with instructions based on the learnings

4. **Post scheduling / auto-posting**: Connect Instagram/TikTok accounts and schedule posts directly from the platform

### Medium-Term

5. **Performance analytics**: Track views, saves, shares per post; identify what's working

6. **Instagram/TikTok API integration**: Pull metrics into the platform post-posting

7. **Stream attribution**: Correlate posting activity with Spotify stream spikes

8. **Pattern recognition**: AI identifies what formats/soundbytes/scenes perform best

### Future

9. **Pinterest integration**: Visual references during brainstorm from Pinterest boards

10. **Automated posting**: Auto-post at scheduled times to connected social platforms

11. **Benchmarking**: Compare performance against similar artists

12. **Predictive insights**: Pre-posting predictions based on historical patterns

---

## Key Design Principles

1. **Mark is the guide** — every major workflow starts with a Mark conversation, not a blank form
2. **Never re-ask what we already know** — all user/song/brainstorm data is persisted and referenced automatically
3. **No locally-generated tasks for teams with skeleton posts** — the brainstorm workflow is the source of truth for teams that have completed a brainstorm
4. **Calendar is always DB-backed** — every visible task has a real Supabase record; nothing exists only in memory
5. **Galaxy-scoped sharing** — artists share individual galaxies (releases), not their entire universe
6. **Test before committing** — the trial reel system (2 trial reels per post, day before) enables micro-testing before the main post goes out

---

*This spec reflects the live production state as of February 22, 2026. It should be updated after each major feature release.*
