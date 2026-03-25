/**
 * render-review.spec.ts
 *
 * Focused tests for the Phase 5 RenderReview component and the
 * Phase 6 scheduling confirmation view.
 *
 * Test coverage:
 *   Rendering phase:
 *     - Progress indicator shows during rendering
 *     - Piece count in the progress label matches approved count
 *
 *   Review phase (reached after rendering completes):
 *     - Piece navigation (← → arrows and dot nav)
 *     - Status badge updates (pending → approved, pending → killed)
 *     - Undo reverting a status
 *     - Variation strip buttons (Main edit / Alt hook / Short cut / Shifted audio)
 *     - Re-edit panel opens and shows quick-tag pills
 *     - Send to Mark is disabled until a tag or text is entered
 *     - Re-edit panel cancel closes the panel
 *     - "Schedule these →" only appears after all pieces are reviewed
 *
 *   Scheduling confirmation phase:
 *     - Shows "Posts Scheduled" heading
 *     - Each post has a trial reel date row and a main post date row
 *     - Post dates fall on a Tue / Thu / Fri
 *     - "View Calendar" link is present
 *     - "Done" button resets to upload phase
 *
 * Run: npx playwright test render-review --headed
 */

import { test, expect, Page } from '@playwright/test';
import {
  snap,
  setupToPitchPhase,
  approveAndStartRendering,
  MOCK_PASS2,
} from './smartedit-helpers';

test.use({ storageState: 'tests/e2e/.auth/leon-tax-session.json' });

// ─── Shared: get all the way to the review phase ──────────────────────────────

async function setupToReviewPhase(page: Page): Promise<void> {
  await setupToPitchPhase(page);
  // Approve all pieces so all variations appear in review
  await approveAndStartRendering(page, MOCK_PASS2.editPlan.pieces.length);

  // Wait for rendering to complete (FFmpeg WASM with 2 small clips)
  console.log('  ⏳ Waiting for rendering to finish (may take several minutes)...');
  const reviewBtn = page.locator('button:has-text("Approve — send to calendar")').first();
  await reviewBtn.waitFor({ timeout: 600_000 }); // up to 10 min
  console.log('  ✅ Review phase reached');
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('RenderReview — rendering phase', () => {
  test('shows a rendering progress indicator after pitch approval', async ({ page }) => {
    test.setTimeout(600_000);
    await setupToPitchPhase(page);
    await approveAndStartRendering(page, 2);

    const indicator = page.locator('text=/rendering/i').first();
    await indicator.waitFor({ timeout: 15_000 });
    await expect(indicator).toBeVisible();
    await snap(page, 'review-rendering-indicator');
  });

  test('rendering progress shows the correct total piece count', async ({ page }) => {
    test.setTimeout(600_000);
    await setupToPitchPhase(page);
    await approveAndStartRendering(page, 2);

    // e.g. "Rendering piece 1 of 2..."
    const progressText = page.locator('text=/rendering piece/i, text=/piece.*of.*2/i').first();
    await progressText.waitFor({ timeout: 15_000 });
    await expect(progressText).toBeVisible();
  });
});

test.describe('RenderReview — review phase interactions', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(900_000); // 15 min including rendering
    await setupToReviewPhase(page);
  });

  // ─── Navigation ─────────────────────────────────────────────────────────

  test('shows piece "1 of N" navigation indicator', async ({ page }) => {
    const nav = page.locator('text=/1 of/i').first();
    await expect(nav).toBeVisible();
    await snap(page, 'review-initial-state');
  });

  test('→ arrow navigates to the next piece', async ({ page }) => {
    const nextBtn = page.locator('button').filter({ hasText: '→' }).last();
    const prevNav = await page.locator('text=/1 of/i').first().isVisible();
    expect(prevNav).toBeTruthy();

    await nextBtn.click();
    await page.waitForTimeout(300);

    const afterNav = page.locator('text=/2 of/i').first();
    await expect(afterNav).toBeVisible();
  });

  test('← arrow is disabled on the first piece', async ({ page }) => {
    const prevBtn = page.locator('button').filter({ hasText: '←' }).first();
    await expect(prevBtn).toBeDisabled();
  });

  test('→ arrow is disabled on the last piece', async ({ page }) => {
    const total = MOCK_PASS2.editPlan.pieces.length;
    // Navigate to last piece
    const nextBtn = page.locator('button').filter({ hasText: '→' }).last();
    for (let i = 1; i < total; i++) {
      if (await nextBtn.isEnabled({ timeout: 1_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(200);
      }
    }
    await expect(nextBtn).toBeDisabled();
  });

  test('dot navigation buttons are visible for each piece', async ({ page }) => {
    const total = MOCK_PASS2.editPlan.pieces.length;
    // Dots are small rounded-full buttons in the dot nav row
    // They each navigate to a specific piece when clicked
    const dots = page.locator('.rounded-full[class*="w-2"][class*="h-2"]');
    const count = await dots.count();
    expect(count).toBe(total);
  });

  test('dot click navigates to the correct piece', async ({ page }) => {
    const total = MOCK_PASS2.editPlan.pieces.length;
    if (total < 2) { test.skip(); return; }

    const dots = page.locator('.rounded-full[class*="w-2"][class*="h-2"]');
    await dots.nth(1).click(); // go to piece 2
    await page.waitForTimeout(300);
    await expect(page.locator('text=/2 of/i').first()).toBeVisible();
    await snap(page, 'review-dot-nav');
  });

  // ─── Status transitions ──────────────────────────────────────────────────

  test('Approve button changes status badge to "Approved"', async ({ page }) => {
    const approveBtn = page.locator('button:has-text("Approve — send to calendar")').first();
    await approveBtn.click();
    await page.waitForTimeout(300);

    const badge = page.locator('text=/Approved/i').first();
    await expect(badge).toBeVisible();
    await snap(page, 'review-piece-approved');
  });

  test('Kill button changes status badge to "Killed"', async ({ page }) => {
    const killBtn = page.locator('button:has-text("Kill")').first();
    await killBtn.click();
    await page.waitForTimeout(300);

    const badge = page.locator('text=/Killed/i').first();
    await expect(badge).toBeVisible();
    await snap(page, 'review-piece-killed');
  });

  test('Undo after Approve reverts to "Pending" and re-shows action buttons', async ({ page }) => {
    await page.locator('button:has-text("Approve — send to calendar")').first().click();
    await page.waitForTimeout(300);

    const undoBtn = page.locator('button:has-text("Undo")').first();
    await undoBtn.click();
    await page.waitForTimeout(300);

    // Status badge back to Pending
    await expect(page.locator('text=/Pending/i').first()).toBeVisible();

    // Action buttons back
    await expect(
      page.locator('button:has-text("Approve — send to calendar")').first(),
    ).toBeVisible();
  });

  test('Undo after Kill reverts to "Pending"', async ({ page }) => {
    await page.locator('button:has-text("Kill")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Undo")').first().click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=/Pending/i').first()).toBeVisible();
  });

  // ─── Variation strip ─────────────────────────────────────────────────────

  test('variation strip shows "Main edit" button', async ({ page }) => {
    const mainBtn = page.locator('button:has-text("Main edit")').first();
    await expect(mainBtn).toBeVisible();
  });

  test('variation strip shows trial reel variation buttons', async ({ page }) => {
    // Trial reel buttons: "Alt hook", "Short cut", or "Shifted audio"
    const varBtn = page
      .locator('button')
      .filter({ hasText: /Alt hook|Short cut|Shifted audio/ })
      .first();
    await expect(varBtn).toBeVisible();
    await snap(page, 'review-variation-strip');
  });

  test('clicking a variation button makes it active', async ({ page }) => {
    const varBtn = page
      .locator('button')
      .filter({ hasText: /Alt hook|Short cut|Shifted audio/ })
      .first();

    await varBtn.click();
    await page.waitForTimeout(300);

    // Active class contains yellow styling
    const classList = await varBtn.getAttribute('class');
    expect(classList).toContain('yellow');
    await snap(page, 'review-variation-active');
  });

  // ─── Re-edit panel ────────────────────────────────────────────────────────

  test('Re-edit button opens the re-edit panel', async ({ page }) => {
    const reEditBtn = page.locator('button:has-text("Re-edit")').first();
    await reEditBtn.click();
    await page.waitForTimeout(300);

    const panel = page.locator('text=/Tell Mark what to fix/i').first();
    await expect(panel).toBeVisible();
    await snap(page, 'review-reedit-panel-open');
  });

  test('re-edit panel shows all 6 quick-tag pills', async ({ page }) => {
    await page.locator('button:has-text("Re-edit")').first().click();
    await page.waitForTimeout(300);

    const expectedTags = [
      'Faster cuts', 'Slower pacing', 'Swap opening clip',
      'Different ending', 'More lip sync', 'Less movement',
    ];
    for (const tag of expectedTags) {
      const pill = page.locator(`button:has-text("${tag}")`).first();
      await expect(pill).toBeVisible();
    }
  });

  test('"Send to Mark →" is disabled with no tags or text', async ({ page }) => {
    await page.locator('button:has-text("Re-edit")').first().click();
    await page.waitForTimeout(300);

    const sendBtn = page.locator('button:has-text("Send to Mark")').first();
    await expect(sendBtn).toBeDisabled();
  });

  test('"Send to Mark →" enables after selecting a tag', async ({ page }) => {
    await page.locator('button:has-text("Re-edit")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Faster cuts")').first().click();
    await page.waitForTimeout(200);

    const sendBtn = page.locator('button:has-text("Send to Mark")').first();
    await expect(sendBtn).toBeEnabled();
    await snap(page, 'review-reedit-tag-selected');
  });

  test('"Send to Mark →" enables after typing free text', async ({ page }) => {
    await page.locator('button:has-text("Re-edit")').first().click();
    await page.waitForTimeout(300);

    const textarea = page.locator('textarea[placeholder*="Anything else"]').first();
    await textarea.fill('Please make the opening clip shorter');

    const sendBtn = page.locator('button:has-text("Send to Mark")').first();
    await expect(sendBtn).toBeEnabled();
  });

  test('Cancel button closes the re-edit panel', async ({ page }) => {
    await page.locator('button:has-text("Re-edit")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Cancel")').first().click();
    await page.waitForTimeout(300);

    const panel = page.locator('text=/Tell Mark what to fix/i').first();
    await expect(panel).not.toBeVisible();
    await snap(page, 'review-reedit-cancelled');
  });

  // ─── "Schedule these →" only appears when all reviewed ───────────────────

  test('"Schedule these →" does not appear while pieces are still pending', async ({ page }) => {
    // Approve only the first piece; others remain pending
    await page.locator('button:has-text("Approve — send to calendar")').first().click();
    await page.waitForTimeout(300);

    const total = MOCK_PASS2.editPlan.pieces.length;
    if (total > 1) {
      // Navigate to second piece — it should still be pending
      const nextBtn = page.locator('button').filter({ hasText: '→' }).last();
      if (await nextBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      // "Schedule these →" should NOT be visible yet
      const scheduleBtn = page.locator('button:has-text("Schedule these")').first();
      await expect(scheduleBtn).not.toBeVisible({ timeout: 3_000 });
    }
  });

  test('"Schedule these →" appears after all pieces are reviewed', async ({ page }) => {
    const total = MOCK_PASS2.editPlan.pieces.length;
    const approveBtn = page.locator('button:has-text("Approve — send to calendar")');
    const nextBtn = page.locator('button').filter({ hasText: '→' }).last();

    // Review every piece
    for (let i = 0; i < total; i++) {
      if (await approveBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await approveBtn.first().click();
        await page.waitForTimeout(300);
      }
      if (i < total - 1 && await nextBtn.isEnabled({ timeout: 1_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(200);
      }
    }

    const scheduleBtn = page.locator('button:has-text("Schedule these")').first();
    await scheduleBtn.waitFor({ timeout: 10_000 });
    await expect(scheduleBtn).toBeVisible();
    await snap(page, 'review-all-reviewed');
  });
});

// ─── Scheduling confirmation phase ───────────────────────────────────────────

test.describe('Scheduling confirmation view', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(900_000);

    // Mock Google Calendar sync so it doesn't call the real API
    await page.route('**/api/calendar/sync-smartedit', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, created: 4 }),
      });
    });

    await setupToReviewPhase(page);

    // Approve all pieces
    const total = MOCK_PASS2.editPlan.pieces.length;
    const approveBtn = page.locator('button:has-text("Approve — send to calendar")');
    const nextBtn = page.locator('button').filter({ hasText: '→' }).last();

    for (let i = 0; i < total; i++) {
      if (await approveBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
        await approveBtn.first().click();
        await page.waitForTimeout(300);
      }
      if (i < total - 1 && await nextBtn.isEnabled({ timeout: 1_000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // Click "Schedule these →"
    const scheduleBtn = page.locator('button:has-text("Schedule these")').first();
    await scheduleBtn.waitFor({ timeout: 10_000 });
    await scheduleBtn.click();
    await page.waitForTimeout(2_000);
  });

  test('shows "Posts Scheduled" heading', async ({ page }) => {
    const heading = page.locator('text=/Posts Scheduled/i').first();
    await heading.waitFor({ timeout: 10_000 });
    await expect(heading).toBeVisible();
    await snap(page, 'schedule-confirmation-view');
  });

  test('shows trial reel date sections for each approved post', async ({ page }) => {
    const trialReelHeaders = page.locator('text=/Trial reels/i');
    const count = await trialReelHeaders.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('shows main post date sections for each approved post', async ({ page }) => {
    const mainPostHeaders = page.locator('text=/Main post/i');
    const count = await mainPostHeaders.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('post dates fall on Tue / Thu / Fri', async ({ page }) => {
    // Extract all post date strings from the confirmation view
    // The dates are shown as YYYY-MM-DD text next to weekday labels
    const datePattern = /\d{4}-\d{2}-\d{2}/;
    const allText = await page.locator('text=/Main post/i').first().locator('..').innerText().catch(() => '');
    const dateMatches = allText.match(new RegExp(datePattern.source, 'g')) ?? [];

    const VALID_DAYS = [2, 4, 5]; // Tue=2, Thu=4, Fri=5
    for (const dateStr of dateMatches) {
      const day = new Date(dateStr + 'T12:00:00').getDay();
      expect(VALID_DAYS, `Post date ${dateStr} fell on day ${day} (not Tue/Thu/Fri)`).toContain(day);
    }
  });

  test('shows weekday label next to each post date', async ({ page }) => {
    // Should show "Tuesday", "Thursday", or "Friday"
    const weekdayLabel = page
      .locator('text=/Tuesday|Thursday|Friday/')
      .first();
    await expect(weekdayLabel).toBeVisible();
  });

  test('"View Calendar" link is present and points to /calendar', async ({ page }) => {
    const calLink = page.locator('a:has-text("View Calendar")').first();
    await expect(calLink).toBeVisible();
    const href = await calLink.getAttribute('href');
    expect(href).toBe('/calendar');
  });

  test('"Done" button is present and resets to upload phase', async ({ page }) => {
    const doneBtn = page.locator('button:has-text("Done")').first();
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await page.waitForTimeout(1_000);

    // After Done, pitch heading should be gone and upload state restored
    const pitchHeading = page.locator("text=/Mark's Pitch/i").first();
    await expect(pitchHeading).not.toBeVisible({ timeout: 5_000 });
    await snap(page, 'schedule-after-done');
  });

  test('piece names from the edit plan appear in the confirmation cards', async ({ page }) => {
    for (const piece of MOCK_PASS2.editPlan.pieces) {
      const nameEl = page.locator(`text=${piece.name}`).first();
      await expect(nameEl).toBeVisible();
    }
  });
});
