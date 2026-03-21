/**
 * leon-calendar-audit.spec.ts
 *
 * Iterative audit of Leon Tax's calendar to verify it matches the spec:
 *
 * Fri 3/13  Shoot Day, Shoot Check-in
 * Thu 3/19  Edit Day 1
 * Fri 3/20  Trial 1 for Post 1.11, Trial 2 for Post 1.11
 * Sat 3/21  Release Day, Post 1.11, Trial 1 for 1.12, Trial 2 for 1.12
 * Sun 3/22  Post 1.12, Trial 1 for 1.13, Trial 2 for 1.13
 * Mon 3/23  Post 1.13
 * Tue 3/24  Trial 1 for 1.14, Trial 2 for 1.14
 * Wed 3/25  Post 1.14, Trial 1 for 1.15, Trial 2 for 1.15
 * Thu 3/26  Post 1.15
 * Fri 3/27  Trial 1 for 2.11, Trial 2 for 2.11
 * Sat 3/28  Weekly Check-in — Batch 1 Review
 * Sun 3/29+ Promo Posts (ambiguous), Edit Day Week 2, Weekly Check-in
 *
 * Should NOT contain:
 * - "Review Ruby's edits" 
 * - "Upload & finalize posts"
 * - "Brainstorm next content batch"
 * - "Edit Day 2 — Week 1" (old system)
 * - "Promo Post" on 3/20-3/28 (replaced by skeletons)
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'https://the-multiverse.vercel.app';
const LEON_EMAIL = 'jonah@b-zb.com';
const LEON_PASSWORD = 'Multiverse2026!';
const SCREENSHOTS_DIR = 'tests/e2e/screenshots/leon-audit';

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function snap(page: Page, name: string) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

async function signInAsLeon(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Switch to sign-in mode if needed
  const toggle = page.locator('button:has-text("Already have an account"), button:has-text("Sign in")').first();
  if (await toggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await toggle.click();
    await page.waitForTimeout(1000);
  }

  const emailField = page.locator('input[type="email"], input[placeholder*="mail"]').first();
  const passField  = page.locator('input[type="password"]').first();
  await emailField.fill(LEON_EMAIL);
  await passField.fill(LEON_PASSWORD);

  const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Enter")').first();
  await submit.click();
  await page.waitForTimeout(3000);

  // Navigate past any intermediate screens
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.locator('text=TODO LIST').isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Reached galaxy view');
      return;
    }
    for (const txt of ['Continue →', 'Continue', "Let's go", 'View Calendar', 'Enter']) {
      const btn = page.locator(`button:has-text("${txt}")`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
    await page.waitForTimeout(1500);
  }
}

async function openCalendar(page: Page) {
  const calBtn = page.locator('button:has-text("Calendar"), button[aria-label*="calendar"], text=Calendar').first();
  if (await calBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await calBtn.click();
    await page.waitForTimeout(2000);
  }
}

/** Get all visible task titles on the current calendar view */
async function getVisibleTaskTitles(page: Page): Promise<string[]> {
  // Task cards show truncated titles — grab all text from calendar cells
  const titles = await page.locator('[class*="calendar"] span[class*="truncate"], [class*="calendar"] span[class*="font-medium"]')
    .allInnerTexts()
    .catch(() => []);
  return titles.filter(t => t.trim().length > 2);
}

/** Navigate to previous/next page of calendar */
async function goToCalendarPage(page: Page, direction: 'prev' | 'next', times = 1) {
  for (let i = 0; i < times; i++) {
    const btn = direction === 'prev'
      ? page.locator('button:has-text("Previous"), button:has-text("← Previous")').first()
      : page.locator('button:has-text("Next"), button:has-text("Next →")').first();
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

// ─── MAIN AUDIT ───────────────────────────────────────────────────────────────

test.describe('Leon Tax calendar audit', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // start fresh — sign in as Leon Tax
  test.setTimeout(180_000);

  test('full calendar audit', async ({ page }) => {
    // ── 1. Sign in ────────────────────────────────────────────────────────────
    console.log('\n=== STEP 1: Sign in as Leon Tax ===');
    await signInAsLeon(page);
    await snap(page, '01-login');

    // ── 2. Open calendar ──────────────────────────────────────────────────────
    console.log('\n=== STEP 2: Open calendar ===');
    await openCalendar(page);
    await snap(page, '02-calendar-open');

    // ── 3. Navigate to week of Mar 13 (previous) to check shoot/check-in ──────
    console.log('\n=== STEP 3: Navigate to check previous week (Mar 13) ===');
    await goToCalendarPage(page, 'prev', 1);
    await snap(page, '03-week-mar13');

    const titlesWeekMar13 = await getVisibleTaskTitles(page);
    console.log('  Tasks visible (Mar 13 week):', titlesWeekMar13);

    const hasShootDay   = titlesWeekMar13.some(t => t.toLowerCase().includes('shoot day'));
    const hasCheckIn    = titlesWeekMar13.some(t => t.toLowerCase().includes('check-in') || t.toLowerCase().includes('check in'));
    const hasEditDay1   = titlesWeekMar13.some(t => t.toLowerCase().includes('edit day 1'));

    console.log(`  Shoot Day: ${hasShootDay ? '✅' : '❌'}`);
    console.log(`  Shoot Check-in: ${hasCheckIn ? '✅' : '❌'}`);
    console.log(`  Edit Day 1: ${hasEditDay1 ? '✅' : '❌'} (may be on next page)`);

    // ── 4. Go back to Mar 16 week ─────────────────────────────────────────────
    console.log('\n=== STEP 4: Mar 16 week — skeleton posts ===');
    await goToCalendarPage(page, 'next', 1);
    await snap(page, '04-week-mar16');

    const titlesWeekMar16 = await getVisibleTaskTitles(page);
    console.log('  Tasks visible (Mar 16 week):', titlesWeekMar16);

    const checks_mar16 = [
      ['Edit Day 1', t => t.toLowerCase().includes('edit day 1')],
      ['Trial 1 for Post 1.11', t => t.includes('1.11') && t.toLowerCase().includes('trial 1')],
      ['Trial 2 for Post 1.11', t => t.includes('1.11') && t.toLowerCase().includes('trial 2')],
      ['Post 1.11', t => t === 'Post 1.11' || t.includes('Post 1.11')],
      ['Trial 1 for Post 1.12', t => t.includes('1.12') && t.toLowerCase().includes('trial 1')],
      ['Trial 2 for Post 1.12', t => t.includes('1.12') && t.toLowerCase().includes('trial 2')],
      ['Post 1.12', t => t === 'Post 1.12' || t.includes('Post 1.12')],
      ['Trial 1/2 for 1.13', t => t.includes('1.13')],
    ] as [string, (t: string) => boolean][];

    for (const [label, fn] of checks_mar16) {
      const found = titlesWeekMar16.some(fn);
      console.log(`  ${label}: ${found ? '✅' : '❌'}`);
    }

    // BAD tasks that should NOT be here
    const bad_mar16 = ['Review Ruby', 'Upload & finalize', 'Brainstorm next', 'Edit Day 2'];
    for (const bad of bad_mar16) {
      const found = titlesWeekMar16.some(t => t.includes(bad));
      if (found) console.log(`  ⚠️  SHOULD NOT EXIST: "${bad}"`);
    }

    // ── 5. Mar 23 week ────────────────────────────────────────────────────────
    console.log('\n=== STEP 5: Mar 23 week ===');
    await goToCalendarPage(page, 'next', 1);
    await snap(page, '05-week-mar23');

    const titlesWeekMar23 = await getVisibleTaskTitles(page);
    console.log('  Tasks visible (Mar 23 week):', titlesWeekMar23);

    const checks_mar23 = [
      ['Post 1.13', t => t.includes('Post 1.13')],
      ['Trial 1/2 for 1.14', t => t.includes('1.14')],
      ['Post 1.14', t => t === 'Post 1.14' || t.includes('Post 1.14')],
      ['Trial 1/2 for 1.15', t => t.includes('1.15')],
      ['Post 1.15', t => t === 'Post 1.15' || t.includes('Post 1.15')],
      ['Trial 1/2 for 2.11', t => t.includes('2.11')],
      ['Weekly Check-in Batch 1', t => t.toLowerCase().includes('check-in') || t.toLowerCase().includes('check in')],
    ] as [string, (t: string) => boolean][];

    for (const [label, fn] of checks_mar23) {
      const found = titlesWeekMar23.some(fn);
      console.log(`  ${label}: ${found ? '✅' : '❌'}`);
    }

    const bad_mar23 = ['Review Ruby', 'Upload & finalize', 'Brainstorm next'];
    for (const bad of bad_mar23) {
      const found = titlesWeekMar23.some(t => t.includes(bad));
      if (found) console.log(`  ⚠️  SHOULD NOT EXIST: "${bad}"`);
    }

    // ── 6. Check that clicking Shoot Check-in opens the modal ────────────────
    console.log('\n=== STEP 6: Navigate to Mar 13 week and click Shoot Check-in ===');
    await goToCalendarPage(page, 'prev', 2);
    await snap(page, '06-week-mar13-again');

    const checkInCard = page.locator('span:has-text("Shoot Check-in"), span:has-text("Check-in")').first();
    if (await checkInCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkInCard.click();
      await page.waitForTimeout(1500);
      await snap(page, '07-check-in-modal');
      const modalVisible = await page.locator('text=Shoot Check-in, text=Footage Link').first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Check-in modal opens: ${modalVisible ? '✅' : '❌'}`);
      // Close it
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    } else {
      console.log('  ⚠️  Shoot Check-in card not visible on this page');
    }

    // ── 7. Final summary screenshot ───────────────────────────────────────────
    console.log('\n=== STEP 7: Final summary ===');
    await goToCalendarPage(page, 'next', 1);
    await snap(page, '08-final-mar16-week');
    console.log('  📸 All screenshots saved to', SCREENSHOTS_DIR);
    console.log('  ✅ Audit complete');
  });
});
