/**
 * leon-visual-audit.spec.ts
 *
 * Visual audit of Leon Tax's calendar on the LOCAL dev server.
 * Uses Supabase magic link auth to sign in as Leon Tax.
 *
 * Run with: npx playwright test tests/e2e/leon-visual-audit.spec.ts --project=chromium
 */

import { test, expect, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

const LOCAL_URL = 'http://localhost:3000';
const SUPABASE_URL = 'https://bjwesfqinkktspzcchec.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqd2VzZnFpbmtrdHNwemNjaGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE4MzkzNywiZXhwIjoyMDgzNzU5OTM3fQ.TH5aBHyZrmrmoViNrDt7gVnwj9Cx7uP1HbWcrVLseWg';
const LEON_EMAIL = 'jonah@b-zb.com';
const SCREENSHOTS_DIR = 'tests/e2e/screenshots/leon-visual';

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function snap(page: Page, name: string) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 Saved: ${file}`);
}

test.describe('Leon Tax visual calendar audit', () => {
  test.use({ 
    storageState: { cookies: [], origins: [] },
    baseURL: LOCAL_URL,
  });
  test.setTimeout(240_000);

  test('sign in and audit calendar', async ({ page }) => {
    // ─── Generate fresh magic link ─────────────────────────────────────────
    console.log('\n=== STEP 1: Generate magic link for Leon Tax ===');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: LEON_EMAIL,
    });
    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error(`Failed to generate magic link: ${linkErr?.message}`);
    }
    const magicLink = linkData.properties.action_link;
    console.log('  Magic link generated ✅');

    // ─── Navigate to magic link ────────────────────────────────────────────
    console.log('\n=== STEP 2: Navigate to magic link ===');
    await page.goto(magicLink, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);
    console.log('  Current URL:', page.url());
    await snap(page, '01-after-magic-link');

    // ─── Navigate through onboarding to galaxy view ────────────────────────
    console.log('\n=== STEP 3: Navigate to galaxy view ===');
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const url = page.url();
      const onGalaxy = await page.locator('text=TODO LIST').isVisible({ timeout: 2000 }).catch(() => false);
      if (onGalaxy) {
        console.log('  ✅ Reached galaxy view');
        break;
      }

      // Navigate to localhost if we ended up somewhere else
      if (!url.includes('localhost:3000')) {
        await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await page.waitForTimeout(2000);
        continue;
      }

      // Click through continue buttons
      for (const txt of ["Continue →", "Continue", "Let's go", "View Calendar", "Enter", "Get Started"]) {
        const btn = page.locator(`button:has-text("${txt}")`).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`  Clicking: ${txt}`);
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
      await page.waitForTimeout(1500);
    }

    await snap(page, '02-galaxy-view');
    
    // ─── Click VIEW CALENDAR ───────────────────────────────────────────────
    console.log('\n=== STEP 4: Open calendar ===');
    // First click on the world to enter it, OR directly click View Calendar
    const viewCalBtn = page.locator('button:has-text("VIEW CALENDAR"), button:has-text("View Calendar")').first();
    if (await viewCalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewCalBtn.click();
      await page.waitForTimeout(3000);
      console.log('  Clicked VIEW CALENDAR');
    } else {
      // Try clicking the world title
      const worldBtn = page.locator('text=WILL I FIND YOU').first();
      if (await worldBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await worldBtn.click();
        await page.waitForTimeout(3000);
      }
    }
    await snap(page, '03-after-view-calendar');
    
    // Wait for calendar to load with tasks
    await page.waitForTimeout(3000);
    
    // ─── FULL AUDIT: capture body text from current 4-week view (Mar 16 – Apr 12)
    // The calendar shows 4 weeks at once so ALL content is visible in this single view.
    console.log('\n=== STEP 4b: Full calendar audit (Mar 16 – Apr 12 all visible) ===');
    const bodyText1 = await page.locator('body').innerText().catch(() => '');
    await snap(page, '04-full-calendar');

    // ─── Navigate BACK to see Mar 13 (Shoot Day + Check-in) ──────────────
    console.log('\n=== STEP 5: Navigate back to check Mar 13 Shoot Day ===');
    const prevBtn = page.locator('button:has-text("Previous"), button:has-text("← Previous")').first();
    if (await prevBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prevBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, '04-week-mar9-mar13');
      
      const pageText = await page.locator('body').innerText().catch(() => '');
      const hasShootDay = pageText.includes('Shoot Day');
      const hasCheckIn  = pageText.includes('Check-in') || pageText.includes('Check In');
      console.log(`  Shoot Day visible: ${hasShootDay ? '✅' : '❌'}`);
      console.log(`  Shoot Check-in visible: ${hasCheckIn ? '✅' : '❌'}`);
      // Navigate back to Mar 16 view
      const nextBtn2 = page.locator('button:has-text("Next →"), button:has-text("Next")').first();
      if (await nextBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isDisabled = await nextBtn2.isDisabled().catch(() => true);
        if (!isDisabled) { await nextBtn2.click(); await page.waitForTimeout(2000); }
      }
    }

    // ─── Comprehensive audit of everything in the Mar 16-Apr 12 view ─────
    console.log('\n=== STEP 6: Audit all tasks in Mar 16 – Apr 12 view ===');
    await snap(page, '05-week-mar16-editday');

    const allChecks: [string, boolean][] = [
      ['Edit Day 1 (3/19)',       bodyText1.includes('Edit Day 1')],
      ['Trial 1 for Post 1.11',   bodyText1.includes('Trial 1 for Post 1.11') || (bodyText1.includes('1.11') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 1.11',   bodyText1.includes('Trial 2 for Post 1.11') || (bodyText1.includes('1.11') && bodyText1.includes('Trial 2'))],
      ['Post 1.11 (3/21)',        bodyText1.includes('Post 1.11')],
      ['Trial 1 for Post 1.12',   bodyText1.includes('Trial 1 for Post 1.12') || (bodyText1.includes('1.12') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 1.12',   bodyText1.includes('Trial 2 for Post 1.12') || (bodyText1.includes('1.12') && bodyText1.includes('Trial 2'))],
      ['Release Day (3/21)',       bodyText1.includes('RELEASE DAY') || bodyText1.includes('Release Day') || bodyText1.includes('Will I Find You')],
      ['Post 1.12 (3/22)',        bodyText1.includes('Post 1.12')],
      ['Trial 1 for Post 1.13',   bodyText1.includes('Trial 1 for Post 1.13') || (bodyText1.includes('1.13') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 1.13',   bodyText1.includes('Trial 2 for Post 1.13') || (bodyText1.includes('1.13') && bodyText1.includes('Trial 2'))],
      ['Post 1.13 (3/23)',        bodyText1.includes('Post 1.13')],
      ['Trial 1 for Post 1.14',   bodyText1.includes('Trial 1 for Post 1.14') || (bodyText1.includes('1.14') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 1.14',   bodyText1.includes('Trial 2 for Post 1.14') || (bodyText1.includes('1.14') && bodyText1.includes('Trial 2'))],
      ['Post 1.14 (3/25)',        bodyText1.includes('Post 1.14')],
      ['Trial 1 for Post 1.15',   bodyText1.includes('Trial 1 for Post 1.15') || (bodyText1.includes('1.15') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 1.15',   bodyText1.includes('Trial 2 for Post 1.15') || (bodyText1.includes('1.15') && bodyText1.includes('Trial 2'))],
      ['Post 1.15 (3/26)',        bodyText1.includes('Post 1.15')],
      ['Trial 1 for Post 2.11',   bodyText1.includes('Trial 1 for Post 2.11') || (bodyText1.includes('2.11') && bodyText1.includes('Trial 1'))],
      ['Trial 2 for Post 2.11',   bodyText1.includes('Trial 2 for Post 2.11') || (bodyText1.includes('2.11') && bodyText1.includes('Trial 2'))],
      ['Weekly Check-in (3/28)',   bodyText1.includes('Batch 1') || bodyText1.includes('Weekly Check-in')],
      ['Promo Posts (3/30+)',      bodyText1.includes('Promo Post')],
      ['Edit Day 2 (3/29)',        bodyText1.includes('Edit Day 2')],
    ];

    let passCount = 0;
    for (const [label, found] of allChecks) {
      console.log(`  ${label}: ${found ? '✅' : '❌'}`);
      if (found) passCount++;
    }
    console.log(`\n  Score: ${passCount}/${allChecks.length} checks passed`);

    // BAD checks — these should NOT appear anywhere
    const badTasks = ['Review Ruby', 'Upload & finalize', 'Brainstorm next content', 'Upload footage', 'Send footage to Ruby', 'Plan shoot day'];
    const badFound = badTasks.filter(b => bodyText1.includes(b));
    if (badFound.length > 0) {
      console.log(`  ⚠️ SHOULD NOT EXIST: ${badFound.join(', ')}`);
    } else {
      console.log('  No bad tasks found ✅');
    }
    if (bodyText1.includes('Edit Day — Edit Day')) {
      console.log('  ⚠️ Double-prefix "Edit Day — Edit Day" still present');
    } else {
      console.log('  Edit Day titles clean ✅');
    }

    await snap(page, '06-full-final');

    console.log(`\n=== ✅ Audit complete — ${passCount}/${allChecks.length} checks passed ===`);
    console.log(`    Screenshots saved to: ${SCREENSHOTS_DIR}`);
  });
});
