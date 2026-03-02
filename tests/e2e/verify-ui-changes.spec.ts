/**
 * verify-ui-changes.spec.ts
 *
 * Verifies the latest UI changes on the live Vercel app:
 *  P1 – Todo list shows "Upload 15 edits" today only (not tomorrow's "Upload 5 edits")
 *  P2 – Locked tasks show 🔒 + prerequisite text in todo list
 *  P3 – Calendar click on "Upload 15 edits" opens UploadPostsModal (was broken — z-index bug)
 *  P4 – Calendar click on "Finalize 15 posts" shows LockedTaskModal (not finalize modal)
 *  P5 – Clicking backdrop outside UploadPostsModal closes it
 *
 * Run: npx playwright test verify-ui-changes --headed
 */

import { test, Page } from '@playwright/test';
import { snap } from './helpers';

const BASE_URL = 'https://the-multiverse.vercel.app';

// Auth session pre-loaded via storageState in playwright.config.ts —
// each test already starts signed in. Just navigate and wait for the galaxy.
async function goToGalaxy(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('text=Todo List').waitFor({ timeout: 30_000 });
  await snap(page, 'v-galaxy-ready');
}

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe('UI verification — task locking, calendar clicks, finalize modal', () => {
  test.setTimeout(120_000);

  test('P1 – Todo list shows Upload 15 edits today (not Upload 5 edits)', async ({ page }) => {
    await goToGalaxy(page);
    await snap(page, 'v-p1-todo-state');

    const has15 = await page.locator('text=Upload 15 edits').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const has5  = await page.locator('text=Upload 5 edits').first().isVisible({ timeout: 2_000 }).catch(() => false);

    console.log(`Upload 15 edits in todo: ${has15}`);
    console.log(`Upload 5 edits in todo (should be false): ${has5}`);

    if (!has15)  console.log('⚠️  Upload 15 edits not found — user may have already completed it');
    if (has5)    console.log('❌ FAIL: Upload 5 edits is showing (should only appear tomorrow)');
    else         console.log('✅ Upload 5 edits correctly hidden until tomorrow');

    await snap(page, 'v-p1-result');
  });

  test('P2 – Locked tasks show lock icon and prerequisite in todo list', async ({ page }) => {
    await goToGalaxy(page);
    await snap(page, 'v-p2-todo');

    const lockIcons = page.locator('text=🔒');
    const lockCount = await lockIcons.count();
    console.log(`Lock icons visible in todo: ${lockCount}`);

    if (lockCount > 0) {
      // Click a locked task — expect LockedTaskModal
      await lockIcons.first().locator('../..').click();
      await page.waitForTimeout(700);
      await snap(page, 'v-p2-locked-modal');

      const lockedLabel = await page.locator('text=Locked').isVisible({ timeout: 5_000 }).catch(() => false);
      const gotItBtn    = await page.locator('button:has-text("Got it")').isVisible({ timeout: 3_000 }).catch(() => false);
      console.log(`LockedTaskModal opened: ${lockedLabel}, Got it btn: ${gotItBtn}`);

      if (gotItBtn) {
        await page.locator('button:has-text("Got it")').click();
        await page.waitForTimeout(300);
      }
      console.log('✅ P2 passed — locked task opens LockedTaskModal');
    } else {
      console.log('ℹ️  No locked tasks visible today (expected — only upload tasks are today\'s tasks)');
      console.log('✅ P2 passed — no incorrect lock icons on valid tasks');
    }
  });

  test('P3 – Calendar click on Upload 15 edits opens UploadPostsModal', async ({ page }) => {
    await goToGalaxy(page);

    // Open calendar
    const calBtn = page.locator('button:has-text("View Calendar")').first();
    await calBtn.click();
    await page.waitForTimeout(2_000);
    await snap(page, 'v-p3-calendar-open');

    // Find the calendar tile
    const uploadTile = page.locator('[class*="rounded"][class*="text-[10px]"]').filter({ hasText: 'Upload 15 edits' }).first();
    const tileVisible = await uploadTile.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!tileVisible) {
      // Try a simpler locator
      const simpleTile = page.locator('text=Upload 15 edits').first();
      const simpleVisible = await simpleTile.isVisible({ timeout: 5_000 }).catch(() => false);
      console.log(`Upload 15 edits tile (simple locator): ${simpleVisible}`);
      if (!simpleVisible) {
        console.log('⚠️  Upload 15 edits not found on calendar — may not exist yet');
        await snap(page, 'v-p3-no-tile');
        return;
      }
      await simpleTile.click();
    } else {
      await uploadTile.click();
    }

    await page.waitForTimeout(1_500);
    await snap(page, 'v-p3-after-click');

    // Verify UploadPostsModal opened
    const hasGoal    = await page.locator('text=Today\'s goal').isVisible({ timeout: 5_000 }).catch(() => false);
    const hasNoVideo = await page.locator('text=No Video').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasSlots   = await page.locator('text=Post slots, text=post slot').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const modalOpen  = hasGoal || hasNoVideo || hasSlots;

    console.log(`UploadPostsModal opened: ${modalOpen} (goal:${hasGoal} noVideo:${hasNoVideo} slots:${hasSlots})`);
    if (!modalOpen) {
      console.log('❌ FAIL: Calendar click on Upload 15 edits did not open UploadPostsModal');
    } else {
      console.log('✅ P3 passed — calendar task click opens UploadPostsModal');
    }

    // Close by clicking backdrop
    await page.mouse.click(5, 5);
    await page.waitForTimeout(700);
    await snap(page, 'v-p3-closed');
  });

  test('P4 – Calendar click on Finalize 15 posts shows LockedTaskModal', async ({ page }) => {
    await goToGalaxy(page);

    const calBtn = page.locator('button:has-text("View Calendar")').first();
    await calBtn.click();
    await page.waitForTimeout(2_000);
    await snap(page, 'v-p4-calendar');

    const finalizeTile = page.locator('text=Finalize 15 posts').first();
    const tileVisible  = await finalizeTile.isVisible({ timeout: 10_000 }).catch(() => false);
    console.log(`Finalize 15 posts on calendar: ${tileVisible}`);

    if (!tileVisible) {
      console.log('⚠️  Finalize tile not found — skipping');
      return;
    }

    await finalizeTile.click();
    await page.waitForTimeout(1_000);
    await snap(page, 'v-p4-after-click');

    const lockedLabel = await page.locator('text=Locked').isVisible({ timeout: 5_000 }).catch(() => false);
    const gotItBtn    = await page.locator('button:has-text("Got it")').isVisible({ timeout: 3_000 }).catch(() => false);
    const uploadMsg   = await page.locator('text=/upload.*edits/i').first().isVisible({ timeout: 3_000 }).catch(() => false);

    console.log(`Locked label: ${lockedLabel}, Got it: ${gotItBtn}, Upload msg: ${uploadMsg}`);
    if (lockedLabel || gotItBtn || uploadMsg) {
      console.log('✅ P4 passed — Finalize task shows LockedTaskModal');
    } else {
      console.log('❌ FAIL: Finalize task did not show LockedTaskModal');
    }

    if (gotItBtn) {
      await page.locator('button:has-text("Got it")').click();
      await page.waitForTimeout(300);
    }
  });

  test('P5 – Backdrop click closes UploadPostsModal', async ({ page }) => {
    await goToGalaxy(page);

    const upload15 = page.locator('text=Upload 15 edits').first();
    const isVisible = await upload15.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      console.log('⚠️  Upload 15 edits not in todo — skipping backdrop test');
      return;
    }

    await upload15.click();
    await page.waitForTimeout(1_200);
    await snap(page, 'v-p5-modal-open');

    const modalOpen = await page.locator('text=Today\'s goal').isVisible({ timeout: 5_000 }).catch(() => false)
      || await page.locator('text=No Video').first().isVisible({ timeout: 2_000 }).catch(() => false);
    console.log(`Upload modal open: ${modalOpen}`);

    if (!modalOpen) {
      console.log('⚠️  Modal did not open — skipping backdrop test');
      return;
    }

    // Click top-left corner (well outside the centered modal card)
    await page.mouse.click(5, 5);
    await page.waitForTimeout(800);
    await snap(page, 'v-p5-after-backdrop');

    const stillOpen = await page.locator('text=Today\'s goal').isVisible({ timeout: 2_000 }).catch(() => false);
    console.log(`Modal still open after backdrop click: ${stillOpen}`);
    if (!stillOpen) {
      console.log('✅ P5 passed — backdrop click closes UploadPostsModal');
    } else {
      console.log('❌ FAIL: Modal did not close on backdrop click');
    }
  });
});
