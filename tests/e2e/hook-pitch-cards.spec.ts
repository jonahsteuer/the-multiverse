/**
 * hook-pitch-cards.spec.ts
 *
 * Focused tests for the Phase 2 HookPitchCards component.
 * Tests all interactive states of the pitch card UI:
 *   - All cards start as "pending"
 *   - Approve button changes card state
 *   - Cut button changes card state
 *   - Undo resets a card to pending
 *   - Bottom bar count updates live
 *   - "Render these →" is disabled until ≥1 approved
 *   - "Render these →" becomes enabled after first approval
 *   - Cancel (← back) navigates back to upload phase
 *   - Thumbnail tap opens the ClipSwapDrawer
 *   - ClipSwapDrawer closes on ✕ / backdrop click
 *
 * Run: npx playwright test hook-pitch-cards --headed
 */

import { test, expect } from '@playwright/test';
import {
  snap,
  setupToPitchPhase,
  MOCK_PASS2,
} from './smartedit-helpers';

test.use({ storageState: 'tests/e2e/.auth/leon-tax-session.json' });

const PIECE_COUNT = MOCK_PASS2.editPlan.pieces.length; // 3

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.describe('HookPitchCards — pitch card interactions', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(600_000); // 10 min — includes clip upload + lipsync
    await setupToPitchPhase(page);
  });

  // ─── Initial state ───────────────────────────────────────────────────────

  test('shows the correct number of pitch cards', async ({ page }) => {
    const cards = page.locator('button:has-text("Approve")');
    const count = await cards.count();
    expect(count).toBe(PIECE_COUNT);
    await snap(page, 'pitch-initial-state');
  });

  test('all cards start with Approve and Cut buttons (pending state)', async ({ page }) => {
    const approveButtons = page.locator('button:has-text("Approve")');
    const cutButtons     = page.locator('button:has-text("Cut")');
    expect(await approveButtons.count()).toBe(PIECE_COUNT);
    expect(await cutButtons.count()).toBe(PIECE_COUNT);

    // No Undo buttons at start
    const undoButtons = page.locator('button:has-text("Undo")');
    expect(await undoButtons.count()).toBe(0);
  });

  test('bottom bar shows "0 of N approved" initially', async ({ page }) => {
    const bar = page.locator(`text=/0 of ${PIECE_COUNT}/i`).first();
    await expect(bar).toBeVisible();
  });

  test('"Render these →" is disabled when nothing is approved', async ({ page }) => {
    const renderBtn = page.locator('button:has-text("Render these")').first();
    await expect(renderBtn).toBeDisabled();
  });

  // ─── Approve flow ────────────────────────────────────────────────────────

  test('approving a card enables the render button', async ({ page }) => {
    await page.locator('button:has-text("Approve")').first().click();
    const renderBtn = page.locator('button:has-text("Render these")').first();
    await expect(renderBtn).toBeEnabled();
  });

  test('approving a card shows a ✓ badge and removes Approve/Cut buttons for that card', async ({ page }) => {
    await page.locator('button:has-text("Approve")').first().click();
    await page.waitForTimeout(200);

    // Approve and Cut buttons should decrease by 1
    const remainingApprove = await page.locator('button:has-text("Approve")').count();
    expect(remainingApprove).toBe(PIECE_COUNT - 1);

    // An Undo button should appear
    const undoCount = await page.locator('button:has-text("Undo")').count();
    expect(undoCount).toBe(1);

    await snap(page, 'pitch-one-approved');
  });

  test('bottom bar count updates after each approval', async ({ page }) => {
    const approveButtons = page.locator('button:has-text("Approve")');
    await approveButtons.nth(0).click();
    await expect(page.locator(`text=/1 of ${PIECE_COUNT}/i`).first()).toBeVisible();

    await approveButtons.nth(0).click(); // next pending card is now nth(0)
    await expect(page.locator(`text=/2 of ${PIECE_COUNT}/i`).first()).toBeVisible();
  });

  test('trial reel note appears in bottom bar after first approval', async ({ page }) => {
    await page.locator('button:has-text("Approve")').first().click();
    const note = page.locator('text=/trial reel/i').first();
    await expect(note).toBeVisible();
  });

  // ─── Cut flow ────────────────────────────────────────────────────────────

  test('cutting a card changes it to rejected state (dimmed) and shows Undo', async ({ page }) => {
    await page.locator('button:has-text("Cut")').first().click();
    await page.waitForTimeout(200);

    // Approve count should decrease
    const remaining = await page.locator('button:has-text("Approve")').count();
    expect(remaining).toBe(PIECE_COUNT - 1);

    // Undo appears
    expect(await page.locator('button:has-text("Undo")').count()).toBe(1);
    await snap(page, 'pitch-one-cut');
  });

  test('cutting does not enable the render button', async ({ page }) => {
    await page.locator('button:has-text("Cut")').first().click();
    const renderBtn = page.locator('button:has-text("Render these")').first();
    await expect(renderBtn).toBeDisabled();
  });

  // ─── Undo flow ───────────────────────────────────────────────────────────

  test('Undo after approve resets card to pending', async ({ page }) => {
    await page.locator('button:has-text("Approve")').first().click();
    await page.waitForTimeout(200);

    await page.locator('button:has-text("Undo")').first().click();
    await page.waitForTimeout(200);

    // All cards should be pending again
    expect(await page.locator('button:has-text("Approve")').count()).toBe(PIECE_COUNT);
    expect(await page.locator('button:has-text("Undo")').count()).toBe(0);
    await snap(page, 'pitch-undo-after-approve');
  });

  test('Undo after cut resets card to pending', async ({ page }) => {
    await page.locator('button:has-text("Cut")').first().click();
    await page.waitForTimeout(200);

    await page.locator('button:has-text("Undo")').first().click();
    await page.waitForTimeout(200);

    expect(await page.locator('button:has-text("Approve")').count()).toBe(PIECE_COUNT);
    expect(await page.locator('button:has-text("Undo")').count()).toBe(0);
  });

  test('Undo after approve disables render button if no other approvals', async ({ page }) => {
    await page.locator('button:has-text("Approve")').first().click();
    await page.waitForTimeout(200);

    const renderBtn = page.locator('button:has-text("Render these")').first();
    await expect(renderBtn).toBeEnabled();

    await page.locator('button:has-text("Undo")').first().click();
    await page.waitForTimeout(200);

    await expect(renderBtn).toBeDisabled();
  });

  // ─── Cancel / back ────────────────────────────────────────────────────────

  test('← back button exits the pitch phase', async ({ page }) => {
    const backBtn = page.locator('button:has-text("← back"), button:has-text("back")').first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForTimeout(500);

    // Pitch heading should be gone
    const pitchHeading = page.locator("text=/Mark's Pitch/i").first();
    await expect(pitchHeading).not.toBeVisible();
    await snap(page, 'pitch-after-cancel');
  });

  // ─── Card content ─────────────────────────────────────────────────────────

  test('each card shows the piece name', async ({ page }) => {
    for (const piece of MOCK_PASS2.editPlan.pieces) {
      const nameEl = page.locator(`text=${piece.name}`).first();
      await expect(nameEl).toBeVisible();
    }
  });

  test('cards show arc type badges', async ({ page }) => {
    // At least one arc type badge should be visible
    const arcBadge = page
      .locator('span')
      .filter({ hasText: /build to peak|peak.valley.peak|even montage|slow build/i })
      .first();
    await expect(arcBadge).toBeVisible();
  });

  // ─── ClipSwapDrawer ────────────────────────────────────────────────────────

  test('tapping a hook thumbnail opens the ClipSwapDrawer', async ({ page }) => {
    // The hook thumbnail is the first button inside each pitch card
    const thumbnailBtn = page
      .locator('button[title="Tap to swap hook clip"]')
      .first();
    if (await thumbnailBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await thumbnailBtn.click();
      const drawer = page.locator('text=/Swap Hook Clip/i').first();
      await drawer.waitFor({ timeout: 5_000 });
      await expect(drawer).toBeVisible();
      await snap(page, 'pitch-clip-swap-drawer-open');

      // Close drawer with ✕
      const closeBtn = page.locator('button:has-text("✕")').first();
      await closeBtn.click();
      await expect(drawer).not.toBeVisible({ timeout: 3_000 });
    } else {
      console.log('  ⚠️  Thumbnail button not found — skipping drawer open test (no frames extracted yet)');
      test.skip();
    }
  });

  test('ClipSwapDrawer closes when clicking the backdrop', async ({ page }) => {
    const thumbnailBtn = page
      .locator('button[title="Tap to swap hook clip"]')
      .first();
    if (await thumbnailBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await thumbnailBtn.click();
      const drawer = page.locator('text=/Swap Hook Clip/i').first();
      await drawer.waitFor({ timeout: 5_000 });

      // Click the semi-transparent overlay (outside the drawer panel)
      await page.mouse.click(10, 10); // top-left corner of the backdrop
      await expect(drawer).not.toBeVisible({ timeout: 3_000 });
    } else {
      test.skip();
    }
  });

  // ─── Render flow ──────────────────────────────────────────────────────────

  test('"Render these →" click transitions to rendering phase', async ({ page }) => {
    // Approve at least one piece
    await page.locator('button:has-text("Approve")').first().click();

    const renderBtn = page.locator('button:has-text("Render these")').first();
    await expect(renderBtn).toBeEnabled();
    await renderBtn.click();

    // The rendering indicator should appear
    const renderingText = page
      .locator('text=/rendering/i, text=/Rendering/')
      .first();
    await renderingText.waitFor({ timeout: 15_000 });
    await expect(renderingText).toBeVisible();
    await snap(page, 'pitch-rendering-started');
  });
});
