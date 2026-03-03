# The Multiverse — User Feedback Log

Real feedback from real users. This file is a living document — every piece of feedback gets logged here, synthesized into themes, and referenced alongside `USER_LENS.md` whenever making product changes or running Playwright tests.

---

## How to Use This File

**When adding feedback:**
- Log the raw quote (or close paraphrase) under the Feedback Log
- Tag it with a theme and a status
- Update the relevant Synthesized Findings section if the pattern is new or strengthened

**When making changes or reviewing Playwright results:**
1. Open `USER_LENS.md` and `USER_FEEDBACK.md` side by side
2. Ask: does this change resolve any open feedback? Does it create new misalignments?
3. If a Playwright test passes but contradicts logged feedback, surface it as a product issue

**Status tags:**
- `open` — not yet addressed
- `in progress` — actively being worked on
- `resolved` — fixed and verified
- `wont fix` — acknowledged, deliberately not addressing

---

## Feedback Log

Entries are listed chronologically. Each entry includes the date, source, raw quote or close paraphrase, the theme it belongs to, and its current status.

---

### Entry 001
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"I don't like this upload posts side panel we created. Let's keep it a normal task card that opens in the center, similar to the invite team members task card."*
**Theme:** Modal / UI Design
**Status:** resolved
**Resolution:** All task panels converted to centered modals.

---

### Entry 002
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"It is not clear where they should upload their edits. We had a pretty good system before that allowed users to pair their existing edits with scheduled posts. Let's reintegrate that, but with the ask mark for help button at the bottom."*
**Theme:** Upload Flow / Task Clarity
**Status:** resolved
**Resolution:** UploadPostsModal reintegrated post-slot pairing; Ask Mark button added with context awareness.

---

### Entry 003
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"There isn't any reason for the upload edits tasks to be broken down into 2 separate tasks. This should be one task that says upload edits 1-20."*
**Theme:** Task Naming / Batching
**Status:** resolved
**Resolution:** Tasks now show as "Upload 20 edits" with batching logic (15/day cap) producing "Upload 15 edits" today and "Upload 5 edits" tomorrow.

---

### Entry 004
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"Any posts they don't upload are added as a todo list task for the next day if not completed... It'll stay on their todo list as upload 10 tasks, if they log back in again the next day, it'll show up at the top of their todo list."*
**Theme:** Task Carryover / Momentum
**Status:** resolved
**Resolution:** Incomplete tasks carry over to the next day with updated titles reflecting remaining count.

---

### Entry 005
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"When I press my 'Upload 15 edits' task on my calendar nothing happens, it should open the same window that appears when I click on the task in my todo list."*
**Theme:** Calendar Interaction / Consistency
**Status:** resolved
**Resolution:** Calendar task clicks now open the same modal as todo list task clicks.

---

### Entry 006
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"The mark help window should work very much like the call mark button in that Mark should come out asking what they need help with given the context he knows. If I'm asking for help within an upload edits window, mark should say something along the lines of 'need help uploading your edits?'"*
**Theme:** Mark / Contextual AI
**Status:** resolved
**Resolution:** Mark opens with context-aware greeting based on the task the user has open.

---

### Entry 007
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"Can we also make all modals closeable by clicking on the gray space outside of the card?"*
**Theme:** Modal / UI Design
**Status:** resolved
**Resolution:** Backdrop click-to-close added to all modals.

---

### Entry 008
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"Yes, your thinking is right, but let's organize the posts similarly to how we do in the all posts tab. I like how they're organized into cards and show the type of post and the date."*
**Theme:** Finalize Posts / UI Design
**Status:** resolved
**Resolution:** FinalizePostsModal redesigned to use post cards matching All Posts tab layout.

---

### Entry 009
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"Realistically, Kiss Bang can't finalize their 15 posts if they haven't uploaded any posts yet, therefore this task should be locked and show a different view than if it were unlocked."*
**Theme:** Task Locking / Workflow Logic
**Status:** resolved
**Resolution:** isTaskLocked helper and LockedTaskModal implemented; locked tasks show grayed out with a lock icon and explain prerequisites.

---

### Entry 010
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"Right now [Mark's voice] switches between a male and female voice, let's stick to the male voice."*
**Theme:** Mark / Voice Consistency
**Status:** resolved
**Resolution:** Male voice preference enforced in browser TTS fallback with expanded voice name list and forced lower pitch.

---

### Entry 011
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test — Mark conversation transcript)
**Raw quote:** *"[Mark said] For brainstorming new ideas, you can tap 'Brainstorm Content' on your Todo List and I'll walk you through generating fresh concepts..."*
**Observation:** Mark referenced a "Brainstorm Content" task that didn't exist on Kiss Bang's actual todo list.
**Theme:** Mark / Context Accuracy
**Status:** resolved
**Resolution:** Mark's context now includes actual todo list tasks with status; system prompt explicitly says never reference tasks that don't appear in the list.

---

### Entry 012
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"His answers were way too long. 4. I agree. Although these can be helpful questions, we should start brainstorming sooner."*
**Theme:** Mark / Response Length + Brainstorm Flow
**Status:** resolved
**Resolution:** max_tokens reduced to 500; response length rules added to system prompt; brainstorm intake moved to Mark's chat (3 questions max), then modal opens directly to ideas.

---

### Entry 013
**Date:** 2026-03-01
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"These can be helpful questions, we should start brainstorming sooner. These are all my notes so far."*
**Theme:** Brainstorm Flow / Efficiency
**Status:** resolved
**Resolution:** Mark now asks all 3 intake questions in his existing chat, then opens the brainstorm modal pre-loaded with the context — no second chatbox inside the modal.

---

### Entry 014
**Date:** 2026-03-02
**Source:** Kiss Bang (direct user test — brainstorm modal screenshot)
**Raw quote:** *"After I chose the two pieces of content that I liked it gave me this window asking to choose a format which doesn't make sense after I already chose the 2 posts."*
**Theme:** Brainstorm Flow / Redundant Step
**Status:** resolved
**Resolution:** format_selection step removed. After ideas are liked, user is asked for notes/feedback. Liked idea formats are auto-assigned to posts. No manual format picking.

---

### Entry 015
**Date:** 2026-03-02
**Source:** Kiss Bang (direct user test — brainstorm modal screenshot)
**Raw quote:** *"When we offer the content ideas, and users like them we should then ask the user if they have any notes on Mark's ideas or if they have an idea they want to pitch to Mark instead. We can then keep following this cycle until we land on around 5 posts."*
**Theme:** Brainstorm Flow / Feedback Loop
**Status:** resolved
**Resolution:** Iterative feedback loop added: user can give notes, new ideas are generated incorporating feedback, liked ideas accumulate across rounds until ~5 are locked in.

---

### Entry 016
**Date:** 2026-03-02
**Source:** Kiss Bang (direct user test)
**Raw quote:** *"By the time the user finishes with this interaction... these 5 posts are added to their schedule and... either they plan a shot day now, or a 'plan shoot day' task is scheduled."*
**Theme:** Brainstorm → Schedule Pipeline
**Status:** resolved
**Resolution:** Liked ideas now saved as post events in the DB. Shoot day prompt added after plan confirmation with 3 choices: plan now, schedule task, or skip.

---

### Entry 017
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test)
**Raw quote:** *"I tried creating an account as Leon Tax, but it skipped onboarding and went straight to post-onboarding."*
**Theme:** Onboarding / Test Mode Leakage
**Status:** resolved
**Resolution:** Removed Leon Tax hardcoded bypass from app/page.tsx and CreatorOnboardingForm.tsx. All new accounts now go through full onboarding regardless of name.

---

## Synthesized Findings

Patterns that appear across multiple entries. These should directly inform feature priorities and Playwright test coverage.

---

### Theme: Efficiency (Entries: 003, 005, 013, 014)
**Pattern:** Users get frustrated when they have to do the same thing twice, or when a step feels redundant given what they already did. Examples: upload tasks split into two, format picker appearing after ideas were already selected, chatbox inside a chatbox.
**Implication:** Every multi-step flow should be audited for redundant steps. If the user already made a decision, don't make them make it again.
**Playwright check:** Count the number of taps/clicks to reach any core action. Flag if > 3.

---

### Theme: Consistency (Entries: 005, 007, 008)
**Pattern:** Users expect behaviors to be the same across the app — if clicking a task in the todo list opens a modal, clicking it in the calendar should do the same. If one modal closes on backdrop click, they all should.
**Implication:** Every interaction pattern should be applied universally once established. No exceptions.
**Playwright check:** Verify that calendar clicks and todo list clicks produce identical modals.

---

### Theme: Context Accuracy (Entries: 006, 011)
**Pattern:** Mark's usefulness drops sharply when he references things that don't exist for the user (phantom tasks, generic advice). Users notice immediately and it breaks trust.
**Implication:** Mark must always work from the user's actual data — real todo list, real tasks, real context. No hallucinating tasks or features.
**Playwright check:** After login, verify Mark's first message only references tasks that actually appear in the todo list.

---

### Theme: Mark Response Quality (Entries: 012, 013)
**Pattern:** Mark was talking too much before getting useful. Long responses meant more time before the user got what they came for. Artists don't have time for paragraphs.
**Implication:** Mark's default mode should be short, direct, and action-first. Questions should come one at a time. Ideas should be specific to the artist's context.
**Playwright check:** Assert Mark's responses are under 500 characters in general chat; verify idea cards reference genre, song name, or story.

---

### Theme: Workflow Logic / Locking (Entries: 009)
**Pattern:** Users understand that some tasks have prerequisites. They don't want to be blocked from seeing a task — they just want it to be clearly labeled as locked and told what to do first.
**Implication:** Locked tasks must always be visible, grayed out, and explain the unlock condition in plain language. Never hide them.
**Playwright check:** Verify locked tasks appear in todo list and calendar with lock icon and explanation text.

---

### Theme: Momentum / Carryover (Entries: 004)
**Pattern:** Incomplete work should automatically resurface. Users expect the app to track their progress and not let things fall through the cracks.
**Implication:** Any task not completed by end of day should appear at the top of the next day's todo list with updated context (e.g. "Upload 5 edits" not "Upload 15 edits").
**Playwright check:** Simulate a day-old incomplete task and verify it appears at the top of the todo list with correct count.

---

### Theme: Brainstorm → Schedule (Entries: 014, 015, 016)
**Pattern:** Users want the brainstorm to actually produce something tangible on their calendar. The cycle should end with posts scheduled and shoot day accounted for — not just a list of ideas.
**Implication:** The brainstorm flow must always terminate with DB writes. Ideas → post events. Shoot day → either a scheduled task or a confirmed shoot event.
**Playwright check:** After brainstorm completion, verify new post events exist in the schedule and a shoot-day task or event was created.

---

### Theme: Test Mode Hygiene (Entries: 017)
**Pattern:** Hardcoded test bypasses for specific names leaked into production, causing real users with matching names to skip onboarding.
**Implication:** Test data and demo modes must be gated behind environment variables or admin-only flags — never by matching a user's name.
**Playwright check:** Sign up as any name that was previously used in test mode and verify normal onboarding is triggered.

---

---

### Entry 018
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — onboarding)
**Raw quote:** *"I thought my manager's name was Mark. Why is it in a girl's voice?"*
**Theme:** Mark / Voice Consistency
**Status:** open
**Notes:** The male voice fix from Entry 010 was not sufficient — voice still switches to female for some users. Browser TTS voice loading is asynchronous and the cached voice may not be ready on first speak.

---

### Entry 019
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — calendar walkthrough)
**Raw quote:** *"I noticed on the calendar walkthrough after I finished the initial conversation that it got my release date wrong. I told it March 21st, but on the walkthrough calendar it said March 20th."*
**Theme:** Release Date / Timezone Bug
**Status:** open
**Notes:** Classic off-by-1 timezone issue. Dates stored as "2026-03-21" parse as UTC midnight, which renders as March 20 in UTC-8 (PST) timezones.

---

### Entry 020
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — calendar walkthrough)
**Raw quote:** *"I responded to Mark's question 'do you think you could stick to the plan' with 'yes, send' and it didn't send the message like it was sending it during the initial conversation. It just turned off the mic and I had to manually press send."*
**Theme:** Voice Input / Send Trigger
**Status:** open
**Notes:** "Yes, send" is a recognized send trigger phrase. It's working in the initial onboarding conversation but not in the post-onboarding calendar walkthrough — suggesting the PostOnboardingConversation component has a different VoiceInput configuration.

---

### Entry 021
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — todo list)
**Raw quote:** *"For some reason it scheduled tasks for today at 10am, but that time has already passed. How could I review and organize existing footage at 10am when it is 5:26PM?"*
**Theme:** Task Scheduling / Past Times
**Status:** open
**Notes:** The scheduling logic always uses 10am as default start time. If the user signs up in the afternoon, today's tasks are immediately in the past.

---

### Entry 022
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — task panel)
**Raw quote:** *"I got this task 'review and organize existing footage' that doesn't make sense at all. Why is it having me review 10 rough edits when I told it I only have one?"*
**Theme:** Task Generation / Data Accuracy
**Status:** open
**Notes:** The task description is pulling from a hardcoded template ("10 rough clips") rather than the actual `editedClipCount` from the user's onboarding profile. Leon Tax said he has 1 rough edit, not 10.

---

### Entry 023
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — task generation)
**Raw quote:** *"If I told Mark that I have footage, there should be a task that asks me to upload this footage. There should also be a task that asks me to upload my rough edit since it knows I have that."*
**Theme:** Task Generation / Content Workflow
**Status:** open
**Notes:** Instead of "Review & organize existing footage," the app should generate two distinct tasks: "Upload footage" (for the raw visualizer footage) and "Upload rough edit" (for the one rough edit). These should be the entry points for team collaboration.

---

### Entry 024
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — team collaboration)
**Raw quote:** *"If I log on, invite Ruby, upload footage from the visualizer I said I have, can you make sure she can access both the footage and the rough edit I made. Maybe it makes sense somewhere in the main galaxyview to include a place where all members of my team can access edits and footage."*
**Theme:** Team Collaboration / Media Library
**Status:** open
**Notes:** There is currently no shared media library in GalaxyView. Uploaded footage and edits should be accessible to all invited team members. This is a new feature request.

---

### Entry 025
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — brainstorm)
**Raw quote:** *"Those ideas were fine but the angle and a lot of the captions seemed a little corny to me."*
**Theme:** Brainstorm / Idea Quality
**Status:** open
**Notes:** User noticed the captions felt generic/corny. This confirms the need for more authentic, artist-specific language in generated captions — less marketing-speak.

---

### Entry 026
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — brainstorm)
**Raw quote:** *"Some of those ideas were a little bit better but do you have anything that's a little less depressing — a lot of those ideas were kind of morbid. I wonder if there's a way to take a more lighthearted approach, think ideas that I can easily film with my phone in my studio or outside my backyard."*
**Theme:** Brainstorm / Idea Tone + Equipment Match
**Status:** open
**Notes:** The first two rounds generated emotionally heavy content. The brainstorm should calibrate tone to what the artist actually wants. Also, equipment context ("phone in studio or backyard") should be weighted more heavily when generating ideas.

---

### Entry 027
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — brainstorm summary)
**Raw quote:** *"For some reason it added 6 posts. I chose 3 and I guess it duplicated each."*
**Theme:** Brainstorm → Schedule / Post Duplication
**Status:** open
**Notes:** `proceedToPostAssignment` fills ALL scheduled post slots by cycling through liked ideas. If there are 6 slots and 3 ideas, each idea gets used twice. Fix: create exactly N post events for N liked ideas, not fill all slots.

---

### Entry 028
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — shoot day)
**Raw quote:** *"When I hit 'plan shoot day now', it just added the posts to my schedule instead of helping me plan my shoot day. Mark should've remembered that I said I wanted to shoot these content ideas tomorrow."*
**Theme:** Shoot Day Planning / Context Memory
**Status:** open
**Notes:** "Plan it now" just creates a generic task for tomorrow. (1) It should ask for the shoot date, defaulting to what the user mentioned. (2) Mark should retain context from the brainstorm conversation (e.g., "shoot tomorrow") and pre-fill answers.

---

### Entry 029
**Date:** 2026-03-02
**Source:** Leon Tax (direct user test — data)
**Raw quote:** *"We should be saving all user conversations with Mark, especially during brainstorm — this is valuable data that we can use to make Mark better and more informed."*
**Theme:** Data / Conversation Logging
**Status:** open
**Notes:** Mark conversations (especially brainstorm sessions) are not currently persisted to the database. This data is critical for improving Mark and for future context recall.

---

## Open Questions from Users

Things users raised that we haven't fully resolved yet. These should be prioritized.

| # | Question / Request | Source | Date | Priority |
|---|---|---|---|---|
| Q1 | Full voice-driven brainstorm end-to-end has not been tested live with the new flow | Kiss Bang | 2026-03-01 | High |
| Q2 | Shoot day planning "now" should ask for preferred date, not blindly use tomorrow | Kiss Bang / Leon Tax | 2026-03-02 | High |
| Q3 | "Send edits back to Ruby with notes" — full revision notification flow to team not verified | Kiss Bang | 2026-03-01 | Medium |
| Q4 | Shared media library in GalaxyView — team members need access to uploaded footage and rough edits | Leon Tax | 2026-03-02 | High |
| Q5 | Mark conversations (especially brainstorm) should be saved to DB for training and future context | Leon Tax | 2026-03-02 | High |
| Q6 | Mark's voice still switching to female for some users despite the fix in Entry 010 | Leon Tax | 2026-03-02 | High |

---

## Positive Signals

Things users explicitly liked or that got a positive reaction. Protect these when making changes.

| What they liked | Source | Date |
|---|---|---|
| Invite team members modal design — used as the reference for all other modals | Kiss Bang | 2026-03-01 |
| Post cards in "All Posts" tab — used as reference for FinalizePostsModal design | Kiss Bang | 2026-03-01 |
| Mark's brainstorm idea quality after TikTok data integration | Kiss Bang | 2026-03-02 |
| Idea cards with hook, caption formula, and "why it works" | (internal review) | 2026-03-02 |
| Task batching into manageable daily goals (15 edits/day) | Kiss Bang | 2026-03-01 |
| Iterative feedback loop for brainstorm — user can pitch ideas and refine | Kiss Bang | 2026-03-02 |
