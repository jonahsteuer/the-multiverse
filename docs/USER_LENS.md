# The Multiverse — User Lens

A reference for Playwright testing and product decisions. Every feature, flow, and interaction should be evaluated against these principles. If a test reveals behavior that violates the lens, flag it as a bug — not just a test failure.

---

## 1. Efficiency First

Music artists are busy. They are recording, performing, writing, and managing their careers simultaneously. Every interaction with this app should respect that.

**What this means in practice:**
- No unnecessary steps between intent and action. If an artist wants to brainstorm, they should be brainstorming within 2 interactions — not filling out a form.
- Tasks should resolve themselves when possible. Don't make the artist manually tick a box for something the app already knows is done.
- The app should load fast and never make the artist wait without visual feedback.
- When Mark communicates, keep it short. Artists don't have time to read paragraphs.

**Testing red flags:**
- More than 3 clicks to reach a core action (upload, brainstorm, finalize)
- Loading states without spinners or progress indicators
- Forms that could be replaced by a single question
- Mark responses longer than 5 sentences

---

## 2. Art Over Everything

Artists use this platform to grow, but their deepest motivation is to make something they're proud of. This app should feel like it's in service of their art — not the algorithm.

**What this means in practice:**
- Content ideas should feel authentic to the artist's sound and aesthetic, not generic "growth hacks." A glam rock artist should never receive advice that feels like it was written for a pop influencer.
- Mark should speak to the artist's creative identity, not just their metrics. Reference their song name, genre, and vibe in every recommendation.
- The app should never pressure artists to post content they don't believe in. Suggestions are options, not mandates.
- Visual design of the app itself should feel like a creative tool, not a SaaS dashboard.

**Testing red flags:**
- Generic content ideas with no reference to the artist's genre, song name, or vibe
- Mark giving "posting frequency" advice before understanding the artist's creative priorities
- UI language that sounds like marketing ("maximize engagement", "boost your metrics") rather than artist-first ("get your music to more people")

---

## 3. Creative Control

Artists are protective of their brand. They've spent years developing a sound and an aesthetic. The app should feel like a trusted collaborator, not a manager telling them what to do.

**What this means in practice:**
- Suggestions should always be framed as options: "Here are 3 ideas — which fits your setup?" not "You should post this."
- When Mark makes a recommendation, he should briefly explain *why* — so the artist can decide whether it applies to them.
- Artists should always be able to reject a suggestion, skip a task, or override a plan.
- Locked tasks should explain prerequisites clearly, not just block action.

**Testing red flags:**
- Tasks or suggestions presented as mandatory when they're not
- No way to dismiss or skip a recommendation
- Mark giving advice without context ("post 5x a week" with no explanation)

---

## 4. Momentum Over Perfection

Independent artists often struggle with consistency and motivation. The app should make them feel like they're always moving forward — never stuck or overwhelmed.

**What this means in practice:**
- Tasks should be broken into manageable pieces (e.g. "Upload 15 edits today" not "Upload 20 edits")
- Incomplete tasks carry over automatically — artists shouldn't lose progress or feel penalized
- Completing a task should feel satisfying. Visual confirmation, progress indicators, and clear "what's next" guidance matter.
- Mark should acknowledge wins. If an artist just uploaded 15 edits, he should recognize it.

**Testing red flags:**
- Tasks with no clear completion state or missing progress feedback
- Overdue tasks that disappear instead of carrying forward
- No visual reward or acknowledgment when a task is completed

---

## 5. Transparency

Artists want to understand why they're doing something, not just be told to do it. Understanding the strategy makes them better at executing it — and more likely to trust the platform.

**What this means in practice:**
- When Mark recommends a content format, he should briefly mention why it works (e.g. "this drives saves — the algorithm rewards that")
- Task descriptions should explain the purpose, not just the action
- When something is locked, explain what unlocks it in plain language
- Data shown (post performance, upload progress) should be interpreted, not just displayed raw

**Testing red flags:**
- Content ideas with no "why it works" context
- Locked tasks with only a lock icon and no explanation
- Statistics shown with no interpretation or recommendation

---

## 6. Respect for Budget and Resources

Most independent artists operate on tight budgets and limited time. Recommendations should reflect reality, not a world with an unlimited marketing budget.

**What this means in practice:**
- Default content recommendations should work with a phone and basic lighting — not assume a professional setup
- Mark should ask about budget before recommending paid promotion (Meta ads, PR campaigns)
- Equipment difficulty should be flagged on content ideas ("phone only" vs "needs lighting setup")
- Shoot day scheduling should account for the artist's preferred days (not assume every day is free)

**Testing red flags:**
- Content ideas defaulting to "professional setup" without checking equipment availability
- Mark recommending paid ads without first asking about budget
- Shoot days scheduled on days the artist said they're unavailable

---

## 7. Collaboration Without Friction

Most artists work with a small team — a manager, an editor, a photographer. The platform should make collaboration easy without adding coordination overhead.

**What this means in practice:**
- Inviting a team member should take one step from the todo list
- When a task is assigned to a team member, they should be notified immediately and see it in their view
- The artist (admin) should always have a clear view of what their team is doing
- Revision notes and feedback should be attached directly to the content, not sent in a separate message thread

**Testing red flags:**
- Invite flow requiring more than 2 steps
- Assigned tasks not appearing in the team member's view
- No notification when a task is assigned or completed

---

## Using This Lens in Playwright Tests

Always open **both** `USER_LENS.md` (principles) and `USER_FEEDBACK.md` (real user data) before evaluating a test result or a proposed change.

When writing or reviewing Playwright tests, ask:

1. **Efficiency check**: How many clicks/interactions does this flow take? Is that the minimum possible?
2. **Authenticity check**: Does Mark's output reference this specific artist (name, genre, song)? Or is it generic?
3. **Control check**: Can the user skip, reject, or override at each step?
4. **Momentum check**: Is there clear progress feedback and a "what's next" after each completion?
5. **Transparency check**: Does the user understand *why* each suggestion is being made?
6. **Feedback alignment check**: Does this change resolve any `open` entries in `USER_FEEDBACK.md`? Does it risk reversing any `resolved` ones?

If a test passes but violates one of these principles or contradicts logged feedback, treat it as a product bug and surface it for review before shipping.
