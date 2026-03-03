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

## Open Questions from Users

Things users raised that we haven't fully resolved yet. These should be prioritized.

| # | Question / Request | Source | Date | Priority |
|---|---|---|---|---|
| Q1 | "I want some help brainstorming some new content I like the 15 videos I have but want more to post" — full voice-driven brainstorm end-to-end has not been tested live with the new flow | Kiss Bang | 2026-03-01 | High |
| Q2 | Shoot day planning "now" option currently just adds a task for tomorrow — user expected a guided shoot day planning flow | Kiss Bang | 2026-03-02 | Medium |
| Q3 | "Send edits back to Ruby with notes" task — full revision notification flow to team members not fully verified | Kiss Bang | 2026-03-01 | Medium |

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
