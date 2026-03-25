/**
 * smartedit-remodel.spec.ts
 *
 * Full happy-path E2E test for the SmartEdit remodel (Phases 1–7).
 * Covers every new phase in sequence:
 *
 *   upload → Pass 1 (mocked) → pitch cards → approve 2 of 3 →
 *   rendering phase → review phase → scheduling confirmation
 *
 * Mark's API is mocked so no real Claude calls are made.
 * Rendering uses real FFmpeg WASM with 2 small test clips (~15 MB total).
 *
 * Run: npx playwright test smartedit-remodel --headed
 */

import { test, expect, Page, Response } from '@playwright/test';
import {
  snap,
  navigateToSmartEditTab,
  clearSmartEditSession,
  mockMarkEditApi,
  uploadClipsAndWaitForPass1,
  sendMarkMessage,
  waitForMarkStable,
  approveAndStartRendering,
  TEST_CLIPS,
  MOCK_PASS2,
} from './smartedit-helpers';

// ─── Use Leon Tax session ──────────────────────────────────────────────────────

test.use({ storageState: 'tests/e2e/.auth/leon-tax-session.json' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForPhase(page: Page, phaseText: RegExp | string, timeoutMs = 60_000) {
  await page.locator(`text=${phaseText}`).first().waitFor({ timeout: timeoutMs });
}

// ─── Main test ────────────────────────────────────────────────────────────────

test('SmartEdit remodel: full happy path — pitch → render → review → schedule', async ({ page }) => {
  test.setTimeout(900_000); // 15 min — rendering with real FFmpeg WASM

  const networkFailures: { url: string; status: number }[] = [];
  const consoleErrors: string[] = [];

  page.on('response', (r: Response) => {
    if (r.status() >= 400) networkFailures.push({ url: r.url(), status: r.status() });
  });
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ── 1. Navigate to SmartEdit, clear session, install API mock ─────────────
  console.log('\n▶ Phase 0: Setup');
  await navigateToSmartEditTab(page);
  await clearSmartEditSession(page);
  mockMarkEditApi(page);
  await snap(page, 'remodel-00-upload-state');

  // ── 2. Upload 2 test clips → Pass 1 ──────────────────────────────────────
  console.log('\n▶ Phase 1: Upload clips + Pass 1');
  expect(TEST_CLIPS.length, 'Need at least 2 test clips in FOOTAGE_DIR').toBeGreaterThan(0);

  const pass1Reply = await uploadClipsAndWaitForPass1(page);
  expect(pass1Reply.length, 'Pass 1 reply should have content').toBeGreaterThan(20);
  console.log(`  Pass 1 reply: "${pass1Reply.slice(0, 80)}..."`);
  await snap(page, 'remodel-01-pass1');

  // ── 3. Send soundbyte → Pass 2 → pitch phase ─────────────────────────────
  console.log('\n▶ Phase 2: Send soundbyte → pitch cards');
  await sendMarkMessage(page, 'Verse 1: 0:28 – 0:43');

  const pitchHeading = page.locator("text=/Mark's Pitch/i").first();
  await pitchHeading.waitFor({ timeout: 60_000 });
  await snap(page, 'remodel-02-pitch-phase');

  // Verify 3 cards appeared (one per piece in MOCK_PASS2)
  const pieceCount = MOCK_PASS2.editPlan.pieces.length;
  const cards = page.locator('[class*="rounded-xl"][class*="border"]').filter({
    has: page.locator('button:has-text("Approve")'),
  });
  const cardCount = await cards.count();
  console.log(`  Cards visible: ${cardCount} (expected ~${pieceCount})`);
  expect(cardCount, `Expected ${pieceCount} pitch cards`).toBeGreaterThanOrEqual(pieceCount);

  // Verify bottom bar shows "0 of N approved"
  const bottomBar = page.locator('text=/0 of/i').first();
  await expect(bottomBar).toBeVisible();

  // Render button should be disabled (no approvals yet)
  const renderBtn = page.locator('button:has-text("Render these")').first();
  await expect(renderBtn).toBeDisabled();

  // ── 4. Approve 2 pieces, cut 1 ────────────────────────────────────────────
  console.log('\n▶ Phase 3: Approve 2 of 3 pieces');
  const approveButtons = page.locator('button:has-text("Approve")');
  await approveButtons.nth(0).click();
  await page.waitForTimeout(200);
  await approveButtons.nth(1).click();
  await page.waitForTimeout(200);

  // Verify count updated
  await expect(page.locator('text=/2 of/i').first()).toBeVisible();

  // Verify render button is now enabled
  await expect(renderBtn).toBeEnabled();

  // Cut the third card
  const cutButtons = page.locator('button:has-text("Cut")');
  if (await cutButtons.count() > 0) {
    await cutButtons.first().click();
  }

  // Trial reel note should show
  const trialNote = page.locator('text=/trial reel/i').first();
  await expect(trialNote).toBeVisible();
  await snap(page, 'remodel-03-pitch-approved');

  // ── 5. Start rendering ────────────────────────────────────────────────────
  console.log('\n▶ Phase 4: Rendering phase');
  await renderBtn.click();

  // Rendering indicator should appear
  const renderingIndicator = page.locator('text=/rendering/i, text=/Rendering/').first();
  await renderingIndicator.waitFor({ timeout: 15_000 });
  await snap(page, 'remodel-04-rendering');
  console.log('  ✅ Rendering indicator visible');

  // ── 6. Wait for rendering to complete → review phase ─────────────────────
  console.log('\n▶ Phase 5: Review phase (waiting for render completion)');

  // Poll for the RenderReview heading / "Approve — send to calendar" button
  const reviewBtn = page.locator('button:has-text("Approve — send to calendar")').first();
  await reviewBtn.waitFor({ timeout: 600_000 }); // up to 10 min for FFmpeg WASM
  await snap(page, 'remodel-05-review-phase');
  console.log('  ✅ Review phase reached');

  // Verify piece navigation
  const pieceNavText = page.locator('text=/1 of/i').first();
  await expect(pieceNavText).toBeVisible();

  // Verify variation strip shows
  const mainEditBtn = page.locator('button:has-text("Main edit")').first();
  await expect(mainEditBtn).toBeVisible();

  // ── 7. Approve a piece in review ──────────────────────────────────────────
  console.log('\n▶ Phase 6: Approve pieces in review');
  await reviewBtn.click();
  await page.waitForTimeout(500);
  await snap(page, 'remodel-06-piece-approved');

  // Navigate to next piece if there are multiple
  const nextBtn = page.locator('button:has-text("→")').first();
  if (await nextBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(300);

    const approveBtn2 = page.locator('button:has-text("Approve — send to calendar")').first();
    if (await approveBtn2.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await approveBtn2.click();
      await page.waitForTimeout(500);
    }
  }

  // "Schedule these →" should appear once all reviewed
  const scheduleBtn = page.locator('button:has-text("Schedule these")').first();
  await scheduleBtn.waitFor({ timeout: 15_000 });
  await snap(page, 'remodel-07-all-reviewed');
  console.log('  ✅ "Schedule these →" visible');

  // ── 8. Schedule → confirmation view ──────────────────────────────────────
  console.log('\n▶ Phase 7: Scheduling confirmation');

  // Mock calendar sync so it doesn't actually POST to Google Calendar
  await page.route('**/api/calendar/sync-smartedit', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, created: 4 }),
    });
  });

  await scheduleBtn.click();
  await page.waitForTimeout(2_000);

  // Verify scheduling confirmation view
  const scheduledHeading = page.locator('text=/Posts Scheduled/i').first();
  await scheduledHeading.waitFor({ timeout: 10_000 });
  await snap(page, 'remodel-08-scheduled');
  console.log('  ✅ Scheduling confirmation view visible');

  // Verify post date cards appear
  const trialReelDate = page.locator('text=/Trial reels/i').first();
  await expect(trialReelDate).toBeVisible();

  const mainPost = page.locator('text=/Main post/i').first();
  await expect(mainPost).toBeVisible();

  // Calendar link should be present
  const calendarLink = page.locator('a:has-text("View Calendar")').first();
  await expect(calendarLink).toBeVisible();

  // Done button should be present
  const doneBtn = page.locator('button:has-text("Done")').first();
  await expect(doneBtn).toBeVisible();

  // ── 9. Final report ────────────────────────────────────────────────────────
  console.log('\n──────────── FINAL REPORT ────────────────');
  console.log(`Console errors: ${consoleErrors.length}`);
  console.log(`Network failures: ${networkFailures.filter(f => !f.url.includes('supabase-realtime')).length}`);
  console.log('──────────────────────────────────────────');

  // No 4xx/5xx on our own API routes
  const apiFailures = networkFailures.filter(
    f => f.url.includes('/api/') && ![401].includes(f.status),
  );
  expect(apiFailures, `API failures:\n${apiFailures.map(f => `  ${f.status} ${f.url}`).join('\n')}`).toHaveLength(0);
});
