---
phase: 2
slug: new-mvp-app-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / jest (new repo — Wave 0 installs) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | Repo scaffold | build | `pnpm build` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | Supabase SSR client | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | Mark API route | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | Scrape pipeline | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | OAuth routes | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | Edit Feedback route | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | Galaxy UI | manual | n/a | n/a | ⬜ pending |
| 02-03-02 | 03 | 2 | Onboarding flow | manual | n/a | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/supabase-client.test.ts` — no module-level instantiation assertion
- [ ] `__tests__/mark-route.test.ts` — stubs for Mark API route
- [ ] `vitest` or `jest` install + config — new repo has no test framework yet

*Wave 0 must install testing infrastructure before any API routes are ported.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Galaxy 3D view renders and animates | D-07, D-09 | Visual/WebGL — no automated visual regression | Load `themultiverse2.vercel.app`, verify planet spins, stars visible |
| Onboarding flow: handle → OAuth → scrape → Mark | D-10, D-11 | End-to-end OAuth requires live Instagram credentials | Full E2E walkthrough with test Instagram account |
| Edit Feedback: paste URL → Mark notes | D-13, D-14 | Requires Apify, OpenAI, live video URL | Submit real Instagram reel URL, verify feedback references artist ER |
| Edit Feedback: Tier 3 context wired | CONTEXT code_context gap | Requires live Supabase artist data | Verify Mark's critique references artist's actual avg ER baseline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
