# Good Prompts

A collection of useful prompts to use in future sessions.

---

## Platform Iteration Prompt

> "Based on our brainstorm sesh here, I want you to pitch to me exactly what you'd change on our app. I'll tell you yes/no with a tiny explanation. We can iterate on this a few more times where each iteration you add/remove changes to the platform depending on my response. I'll tell you when I am satisfied and then we can begin implementation and testing."

**When to use:** After a research or brainstorm session where platform changes have been discussed but not yet scoped. This prompt forces a concrete, reviewable list before any code is written.

**How to run it correctly:**
1. Start with a **labeled pitch** (A, B, C…) — one item per change, each gets a yes/no from the user. Don't be afraid to include your own ideas alongside the user's feedback; just label them clearly.
2. After the user responds, incorporate their yes/no/maybe feedback and keep iterating — add, remove, or refine items as needed
3. Offer additional ideas between rounds if relevant — ask "any new ideas before the final pitch?" style
4. Once direction feels stable, deliver a **Final Pitch** — same A/B/C structure, but if any item is complex, break it into sub-items (e.g. A1, A2, A3 or F1, F2, F3)
5. User says "satisfied" → only then begin editing code — never touch code during the discussion phase
6. After implementation, update `goodprompts.md` with any lessons learned from this iteration

---

## Iterative User Testing

**Process:**
1. User goes through the feature live and takes notes (voice or text)
2. Notes are shared with the assistant
3. Assistant delivers a **labeled pitch** (A, B, C…) based on the notes — including own ideas, not just user-observed issues
4. User responds yes/no/maybe per item; assistant refines and re-pitches as needed
5. Before the Final Pitch, assistant asks if there are any more ideas to consider
6. **Final Pitch** uses same A/B/C structure, with sub-items (e.g. A1, A2) for complex changes
7. Once user says satisfied, implement only approved changes and deploy
8. User runs the next test with inline notes on specific items
9. Repeat steps 2–8 until the feature feels right

**When to use:** Any time a feature needs refinement based on how it feels in real use — especially conversational flows (brainstorm, onboarding, Mark), content generation quality, and scheduling logic.

**Lessons learned (update this section after every iteration):**
- Scene/idea feedback (thumbs up/down + notes) should always be stored persistently — it improves future recommendations for that artist AND informs better defaults across all users
- Framing matters: ideas should be described as *scenes to shoot* (setup, location, energy) not as posts or captions — this matches how artists think on shoot day
- Location constraints must be hard, not soft — if the user confirmed Griffith Park, no suggestions should require a beach, rain, or any other setting inconsistent with the confirmed location and season/weather context
- The "any notes on these ideas?" follow-up step adds unnecessary friction when users are already rating every card inline — collapse that step entirely
- Require a rating (👍/👎) on every shown scene card before proceeding; notes are optional but recommended and should support voice input (mic) in addition to typing
- Always lock progression gates (e.g., "move to scheduling") behind the actual required count (3 scenes), never show the advance button early
- During platform iteration, never rush to a Final Pitch — discuss and refine first, then break into small labeled items only when the direction is stable

---

## Comprehensive Post-Implementation Testing Prompt

> "I want you to do comprehensive testing of everything we just added, making sure all the final changes we agreed upon  are reflected in the app. Please continue editing codebase and testing until all final points are reflected in the app."

**When to use:** After a round of implementation to ensure all agreed-upon changes are actually live and working before moving on. Forces a full audit rather than just testing the last thing changed.

---

## Playwright Testing with Pre-Verification

> "Do comprehensive playwright testing to confirm everything is functioning how it should without creating any new bugs. Please verify what you're aiming for in the playwright test and how you will test this accurately before you do it."

**When to use:** Before running any Playwright test suite — forces the assistant to declare exactly what pass/fail conditions it's testing and how it will verify them accurately, preventing vague or misleading test results.
