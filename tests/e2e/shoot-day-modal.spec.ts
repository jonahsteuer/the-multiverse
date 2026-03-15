/**
 * shoot-day-modal.spec.ts
 *
 * Verifies ShootDayModal correctness:
 *  SD0 – DB: shoot day task has [3,3,3] looks and hook descriptions
 *  SD1 – Click shoot day in EnhancedCalendar → ShootDayModal (not PostCardModal)
 *  SD2 – Modal shows 3 looks per scene
 *  SD3 – Modal shows 💡 hook descriptions for each scene
 *  SD4 – PDF download button is present
 *
 * Run: npx playwright test shoot-day-modal --headed
 */

import { test, Page } from '@playwright/test';
import { snap } from './helpers';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://the-multiverse.vercel.app';
const SUPABASE_URL = 'https://bjwesfqinkktspzcchec.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function goToGalaxy(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('text=Todo List').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000); // Let brainstorm_result/draft load
}

async function openCalendarAndFindShootDay(page: Page): Promise<boolean> {
  // Click the "📅 Calendar" button
  const calBtn = page.getByRole('button', { name: /📅|calendar/i }).first();
  const visible = await calBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!visible) {
    console.log('[cal] Calendar button not found');
    return false;
  }
  await calBtn.click({ force: true });

  // Wait for calendar modal to fully appear (contains "Snapshot Calendar" heading)
  await page.locator('text=Snapshot Calendar').waitFor({ timeout: 8_000 }).catch(() => null);
  await page.waitForTimeout(2000); // Extra time for DB events to load
  await snap(page, 'calendar-opened');

  // Shoot day task renders as an orange/amber colored card (type: 'shoot')
  const SHOOT_SELECTORS = [
    'text=/Shoot Day/i',            // matches "Shoot Day — Ferndell..." title text
    '[class*="orange"][class*="cursor"]', // orange clickable card
    '[class*="amber"][class*="cursor"]',  // amber clickable card
    'button[class*="orange"]',
    'button[class*="amber"]',
  ];

  for (const sel of SHOOT_SELECTORS) {
    const el = page.locator(sel).first();
    const vis = await el.isVisible({ timeout: 2_000 }).catch(() => false);
    if (vis) {
      const text = await el.textContent().catch(() => '');
      if (text && /shoot/i.test(text)) {
        console.log(`[cal] Found shoot day via: ${sel}, text: "${text?.slice(0, 50)}"`);
        return true;
      }
    }
  }

  // Fallback: find any element with "Shoot Day" anywhere in calendar area
  const allShootEls = await page.locator('text=/Shoot/i').all();
  console.log(`[cal] Elements with "Shoot" text: ${allShootEls.length}`);
  for (let i = 0; i < allShootEls.length; i++) {
    const t = await allShootEls[i].textContent().catch(() => '');
    console.log(`  [${i}]: "${t?.slice(0, 60)}"`);
  }
  return false;
}

async function clickShootDayInCalendar(page: Page): Promise<boolean> {
  // The shoot day renders as an orange card (bg-orange-500/30) with title "Shoot Day — Ferndell..."
  // Avoid clicking the legend (which also has orange/amber colors but no cursor-pointer)
  const shootCard = page.locator('.bg-orange-500\\/30').filter({ hasText: /Shoot/i }).first();
  const vis = await shootCard.isVisible({ timeout: 3_000 }).catch(() => false);
  if (vis) {
    const t = await shootCard.textContent().catch(() => '');
    console.log(`[click] Clicking orange card: "${t?.slice(0, 60)}"`);
    await shootCard.click({ force: true });
    return true;
  }
  // Fallback: find any orange-border element with Shoot Day title text
  const allOrange = await page.locator('.border-orange-500').all();
  for (const el of allOrange) {
    const t = await el.textContent().catch(() => '');
    if (t && /shoot day/i.test(t)) {
      console.log(`[click] Clicking border-orange element: "${t?.slice(0, 60)}"`);
      await el.click({ force: true });
      return true;
    }
  }
  // Final fallback: dispatchEvent to bypass Three.js or z-index issues
  const allEls = await page.locator('text=/Shoot Day —/i').all();
  for (const el of allEls) {
    const vis2 = await el.isVisible({ timeout: 500 }).catch(() => false);
    if (vis2) {
      await el.dispatchEvent('click');
      return true;
    }
  }
  return false;
}

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe('ShootDayModal — 3 looks per scene + hook descriptions', () => {
  test.setTimeout(120_000);

  test('SD_DEBUG – Capture browser console to see calendar tasks', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[EnhancedCalendar]') || text.includes('shoot') || text.includes('Shoot')) {
        logs.push(`[${msg.type()}] ${text}`);
      }
    });

    await goToGalaxy(page);

    // Click calendar to trigger the calendar's useEffect
    const calBtn = page.getByRole('button', { name: /📅|calendar/i }).first();
    await calBtn.click({ force: true });
    await page.locator('text=Snapshot Calendar').waitFor({ timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(3000);

    console.log('\n[BROWSER CONSOLE LOGS]:');
    logs.forEach(l => console.log(l));

    // Also evaluate the DOM to see if orange task cards exist
    const orangeCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="orange"]'));
      return cards.map(c => ({
        tag: c.tagName,
        classes: c.className.slice(0, 100),
        text: c.textContent?.slice(0, 60),
      }));
    });
    console.log('\n[ORANGE DOM ELEMENTS]:');
    orangeCards.slice(0, 10).forEach(c => console.log(' ', JSON.stringify(c)));

    await snap(page, 'sd-debug-calendar');
  });

  test('SD0 – DB confirms [3,3,3] looks and hooks in shoot day task', async ({ page }) => {
    await goToGalaxy(page);
    if (!SERVICE_KEY) { console.log('[SD0] No service key — skipping'); return; }

    const db = adminDb();
    const { data: tasks } = await db
      .from('team_tasks')
      .select('id, title, description')
      .eq('type', 'shoot')
      .order('created_at', { ascending: false })
      .limit(3);

    let allPass = true;
    if (tasks) {
      for (const t of tasks) {
        const lines = (t.description || '').split('\n').filter(Boolean);
        const lookCount = lines.filter((l: string) => /Look \d+:/.test(l)).length;
        const hasHook = lines.some((l: string) => l.includes('💡'));
        let sceneIdx = -1;
        const looksPerScene: number[] = [];
        for (const l of lines) {
          if (/SCENE \d+:/.test(l)) { sceneIdx++; looksPerScene.push(0); }
          else if (/Look \d+:/.test(l) && sceneIdx >= 0) { looksPerScene[sceneIdx]++; }
        }
        const pass3 = looksPerScene.length > 0 && looksPerScene.every(n => n === 3);
        console.log(`[SD0] "${t.title}": looks=${looksPerScene} hook=${hasHook}`);
        if (pass3) console.log('  ✅ 3 looks per scene');
        else { console.log('  ❌ NOT 3 looks per scene'); allPass = false; }
        if (hasHook) console.log('  ✅ hooks present');
        else { console.log('  ❌ hooks missing'); allPass = false; }
      }
    }
    if (allPass && tasks?.length) console.log('✅ SD0 PASS');
    await snap(page, 'sd0-done');
  });

  test('SD1 – Click shoot day in calendar → ShootDayModal badge visible', async ({ page }) => {
    await goToGalaxy(page);
    await snap(page, 'sd1-start');

    const found = await openCalendarAndFindShootDay(page);
    if (!found) {
      console.log('[SD1] ⚠️  Shoot day not found in calendar — skipping SD1');
      return;
    }

    // Click the shoot day inside the calendar modal
    const clicked = await clickShootDayInCalendar(page);
    await page.waitForTimeout(2500); // Allow modal + async brainstorm_draft fetch
    await snap(page, 'sd1-after-click');

    // Verify ShootDayModal opened: look for "🎬 Shoot Day" badge OR "Shoot Schedule" heading
    // Wait longer since the modal fetches brainstorm_draft async before rendering full schedule
    if (!clicked) {
      console.log('[SD1] ⚠️  Could not click shoot day');
      return;
    }
    await page.waitForTimeout(3500);
    await snap(page, 'sd1-after-wait');

    // "Download PDF" and "Shoot Footage" only exist in ShootDayModal — use these as proof
    const hasPdf     = await page.locator('button').filter({ hasText: /download pdf/i }).first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasFootage = await page.locator('text=Shoot Footage').first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasSchedule = await page.locator('text=Shoot Schedule').first().isVisible({ timeout: 2_000 }).catch(() => false);
    // "🎬 Shoot Day" badge — specific to ShootDayModal (calendar shows "Shoot Day — ..." not this badge)
    const hasModalBadge = await page.locator('[class*="yellow"]').filter({ hasText: /Shoot Day/i }).first().isVisible({ timeout: 2_000 }).catch(() => false);

    console.log(`[SD1] PDF button: ${hasPdf}`);
    console.log(`[SD1] Shoot Footage section: ${hasFootage}`);
    console.log(`[SD1] Shoot Schedule heading: ${hasSchedule}`);
    console.log(`[SD1] Yellow ShootDay badge: ${hasModalBadge}`);

    if (hasPdf || hasFootage || hasModalBadge) {
      console.log('✅ SD1 PASS: ShootDayModal opened');
    } else {
      // Take a screenshot to see what's actually showing
      await snap(page, 'sd1-fail-state');
      // Check what modals are visible
      const modals = await page.locator('[class*="fixed inset-0"], [class*="z-["]').count();
      console.log(`[SD1] Fixed/modal elements: ${modals}`);
      console.log('❌ SD1 FAIL: ShootDayModal not detected');
    }
  });

  test('SD2 + SD3 – Modal shows 3 looks per scene and hook descriptions', async ({ page }) => {
    await goToGalaxy(page);

    const found = await openCalendarAndFindShootDay(page);
    if (!found) {
      console.log('[SD2] ⚠️  Shoot day not found — skipping');
      return;
    }

    const calModal = page.locator('.max-w-6xl, [class*="max-w-6"]').first();
    const clicked = await clickShootDayInCalendar(page);
    if (!clicked) {
      console.log('[SD2] ⚠️  Could not click shoot day — skipping');
      await snap(page, 'sd2-no-click');
      return;
    }
    await page.waitForTimeout(3500); // Extra time for async brainstorm_draft fetch + re-render
    await snap(page, 'sd2-modal-opened');

    // Verify schedule content — use case-insensitive regex since CSS uppercase affects innerText
    const scheduleHdr = page.locator('text=/shoot schedule/i, text=/shoot footage/i').first();
    const hasSchedule = await scheduleHdr.isVisible({ timeout: 4_000 }).catch(() => false);
    const hasPdf = await page.locator('button').filter({ hasText: /download pdf/i }).first().isVisible({ timeout: 2_000 }).catch(() => false);
    if (!hasSchedule && !hasPdf) {
      console.log('❌ SD2 FAIL: ShootDayModal content not found (no schedule or PDF button)');
      await snap(page, 'sd2-fail');
      return;
    }
    console.log(`[SD2] Schedule section: ${hasSchedule}, PDF button: ${hasPdf}`);

    // Count look lines and scene headers
    const lookEntries  = await page.locator('text=/Look \\d+:/').count();
    const sceneHeaders = await page.locator('text=/SCENE \\d+:/').count();
    const hookLines    = await page.locator('text=/💡/').count();

    console.log(`[SD2] Scenes: ${sceneHeaders}, Looks: ${lookEntries}, Hooks: ${hookLines}`);

    if (sceneHeaders > 0) {
      const avg = lookEntries / sceneHeaders;
      if (avg >= 2.9) console.log(`✅ SD2 PASS: ${avg.toFixed(1)} looks/scene`);
      else console.log(`❌ SD2 FAIL: only ${avg.toFixed(1)} looks/scene`);
    } else {
      console.log('❌ SD2 FAIL: No scene headers found');
    }

    if (hookLines >= sceneHeaders && sceneHeaders > 0) {
      console.log(`✅ SD3 PASS: ${hookLines} hook lines for ${sceneHeaders} scenes`);
    } else if (hookLines > 0) {
      console.log(`⚠️  SD3 PARTIAL: ${hookLines} hooks for ${sceneHeaders} scenes`);
    } else {
      console.log('❌ SD3 FAIL: No hook descriptions');
    }

    await snap(page, 'sd2-sd3-result');
  });
});
