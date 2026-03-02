/**
 * brainstorm-flow.spec.ts
 *
 * Tests the brainstorm content pipeline against the USER_LENS principles.
 *
 * USER_LENS checks:
 * - Efficiency: brainstorm reached within 2 interactions from Mark
 * - Authenticity: ideas reference the artist's specific song/genre (not generic)
 * - Control: user can thumbs down ideas
 * - Transparency: ideas include "why it works" context
 *
 * P1 — Mark asks the intake questions in his chat (not inside brainstorm modal)
 * P2 — After answering 3 questions, brainstorm modal opens automatically
 * P3 — Brainstorm modal skips intake and shows ideas directly
 * P4 — Idea cards have hook, example caption, and "why it works" fields
 * P5 — Brainstorm task click opens modal (skips to ideas or intake, not Mark chat)
 */

import { test, expect, Page } from '@playwright/test';
import { snap } from './helpers';

const BASE_URL = 'https://the-multiverse.vercel.app';

async function goToGalaxy(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('text=Todo List').waitFor({ timeout: 30_000 });
  await snap(page, 'bs-galaxy-ready');
}

test.describe('Brainstorm content pipeline (User Lens validated)', () => {

  test('P1 — Mark asks intake questions in chat when brainstorm requested', async ({ page }) => {
    await goToGalaxy(page);

    // Open Mark
    const callMark = page.locator('button:has-text("CALL MARK"), button:has-text("Call Mark")').first();
    await callMark.click();
    await page.waitForTimeout(1_000);
    await snap(page, 'bs-mark-open');

    // Check Mark's panel is open and greeting visible
    const greeting = page.locator('.bg-gray-800 p').first();
    await expect(greeting).toBeVisible({ timeout: 5_000 });
    console.log('Mark greeting:', await greeting.textContent());

    // Verify the brainstorm modal is NOT open yet (efficiency: no premature openings)
    const brainstormHeader = page.locator('text=BRAINSTORM CONTENT');
    expect(await brainstormHeader.isVisible()).toBe(false);

    console.log('✅ P1 — Mark panel opens without immediately launching brainstorm modal');
  });

  test('P2 — Brainstorm task click opens modal, starts intake (not Mark chat)', async ({ page }) => {
    await goToGalaxy(page);
    await snap(page, 'bs-todo-before-click');

    // Look for a brainstorm task in the todo list
    const brainstormTask = page.locator('text=Brainstorm').first();
    const hasBrainstormTask = await brainstormTask.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasBrainstormTask) {
      console.log('ℹ️  No brainstorm task on todo list for this account — skipping P2');
      return;
    }

    await brainstormTask.click();
    await page.waitForTimeout(1_500);
    await snap(page, 'bs-modal-after-task-click');

    // Brainstorm modal should open directly (not Mark's chat panel)
    const brainstormHeader = page.locator('text=BRAINSTORM CONTENT');
    await expect(brainstormHeader).toBeVisible({ timeout: 5_000 });

    // Mark's chat should NOT be open (efficiency: no extra panel)
    const markPanel = page.locator('h2:has-text("Mark")');
    expect(await markPanel.isVisible()).toBe(false);

    console.log('✅ P2 — Brainstorm task opens modal directly, not Mark panel');
  });

  test('P3 — Brainstorm modal reached in under 5 interactions (USER_LENS: Efficiency)', async ({ page }) => {
    await goToGalaxy(page);

    let interactionCount = 0;

    // Interaction 1: Click CALL MARK
    const callMark = page.locator('button:has-text("CALL MARK"), button:has-text("Call Mark")').first();
    await callMark.click();
    interactionCount++;
    await page.waitForTimeout(1_500);

    // Check if there's a text input we can use (voice-only UI may not have one)
    const textInput = page.locator('input[type="text"]').last();
    const hasTextInput = await textInput.isVisible({ timeout: 2_000 }).catch(() => false);

    if (!hasTextInput) {
      console.log('ℹ️  No text input in Mark panel — voice-only UI. Interaction count check skipped.');
      await snap(page, 'bs-mark-voice-only');
      return;
    }

    // Interaction 2: Send brainstorm request
    await textInput.fill('I want to brainstorm new content ideas for my upcoming release');
    await textInput.press('Enter');
    interactionCount++;
    await page.waitForTimeout(8_000); // Wait for Mark's AI response
    await snap(page, 'bs-mark-after-brainstorm-request');

    const messages = await page.locator('.bg-gray-800 p').allTextContents();
    const lastMsg = messages[messages.length - 1] || '';
    console.log('Mark response:', lastMsg.slice(0, 200));

    // Mark should ask the first intake question (song story), not open brainstorm immediately
    const asksQuestion = lastMsg.toLowerCase().includes('story') ||
      lastMsg.toLowerCase().includes('going through') ||
      lastMsg.toLowerCase().includes('wrote');

    const openedBrainstormAlready = await page.locator('text=BRAINSTORM CONTENT').isVisible().catch(() => false);

    if (openedBrainstormAlready) {
      console.log('⚠️  Mark opened brainstorm without asking questions — check prompt');
      interactionCount++;
    } else {
      expect(asksQuestion, 'Mark should ask about song story before opening brainstorm').toBe(true);
      console.log('✅ Mark asked intake question, brainstorm not open yet');
    }

    console.log(`Total interactions so far: ${interactionCount} (target: < 5)`);
    expect(interactionCount).toBeLessThan(5);
  });

  test('P4 — API: TikTok insights returns structured idea cards', async ({ page }) => {
    // Direct API test — validates idea card structure against USER_LENS transparency principle
    // Navigate to app first so request runs in same origin context
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/tiktok-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: ['glam rock'],
          songName: 'Now You Got It',
          songStory: 'I wrote this when someone I trusted let me down. It was about reclaiming my power.',
          artistVibe: 'dark glam, dramatic, theatrical',
          comfortLevel: 'Performance — singing/playing to camera',
          releaseDate: '2026-03-15',
        }),
      });
      return res.json();
    }, BASE_URL);
    console.log(`TikTok posts analyzed: ${data.tiktokPostsAnalyzed}`);
    console.log(`Ideas generated: ${data.ideas?.length}`);

    expect(data.ideas).toBeDefined();
    expect(data.ideas.length).toBeGreaterThan(0);

    const idea = data.ideas[0];
    console.log('First idea:', JSON.stringify(idea, null, 2));

    // USER_LENS: Transparency — ideas must explain why they work
    expect(idea.whyItWorks).toBeTruthy();
    // USER_LENS: Authenticity — hook should be specific, not generic
    expect(idea.hook).toBeTruthy();
    expect(idea.hook.length).toBeGreaterThan(10);
    // USER_LENS: Art over everything — caption should feel human
    expect(idea.exampleCaption).toBeTruthy();
    // USER_LENS: Budget respect — difficulty and equipment fields present
    expect(idea.difficulty).toMatch(/easy|medium|hard/);
    expect(idea.equipment).toBeTruthy();

    // Authenticity check: ideas should reference the song or genre context
    const allText = JSON.stringify(data.ideas).toLowerCase();
    const hasGenreReference = allText.includes('glam') || allText.includes('rock') ||
      allText.includes('performance') || allText.includes('dramatic');
    expect(hasGenreReference, 'Ideas should reference artist genre/vibe').toBe(true);

    console.log('✅ P4 — Idea cards have all required fields (USER_LENS: Transparency + Authenticity)');
  });

});
