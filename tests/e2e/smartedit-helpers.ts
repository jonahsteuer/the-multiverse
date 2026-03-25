/**
 * smartedit-helpers.ts
 *
 * Shared helpers for the SmartEdit remodel E2E test suite.
 * Provides:
 *   - Mock API response fixtures
 *   - Navigation helpers
 *   - Phase-transition helpers (uploadClips, waitForPitchPhase, etc.)
 */

import { Page, Route } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BASE_URL    = 'https://the-multiverse.vercel.app';
export const SCREENSHOTS = 'tests/e2e/screenshots/smart-edit';

// Two smallest Ferndell clips — fast frame extraction and FFmpeg export.
const FOOTAGE_DIR = '/Users/jonahsteuer/Dropbox/03.13.26 Ferndell Footage';
export const TEST_CLIPS: string[] = [
  path.join(FOOTAGE_DIR, '715.mov'),
  path.join(FOOTAGE_DIR, '723.mov'),
].filter(f => fs.existsSync(f));

if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ─── Mock API fixtures ────────────────────────────────────────────────────────

/** Pass 1 response — high-confidence soundbyte auto-detected, no follow-up needed */
export const MOCK_PASS1 = {
  message:
    "I've analysed your 2 clips. I can see the energy building nicely. " +
    'I detected the Verse section with high confidence — looks like 0:28–0:43 is the sweetspot. ' +
    "Let me know if that's right and I'll generate the edit plan.",
  editPlan: null,
  pass1: {
    lipsyncClips: [0, 1],
    detectedSoundbyte: { label: 'Verse', confidence: 'high' as const },
  },
  newSoundbyte: null,
};

/** Pass 2 response — 3-piece multi-piece edit plan */
export const MOCK_PASS2 = {
  message:
    "Here are 3 unique pieces — each hits a different arc and clip spread. " +
    "Approve the ones you want rendered.",
  editPlan: {
    pieces: [
      {
        name: 'Peak Energy',
        aspectRatio: '9:16',
        arcType: 'build-to-peak',
        uniquenessNote: 'Opens on clip 0 action moment; peaks with clip 1.',
        clips: [
          { clipIndex: 0, startFrom: 1,   duration: 5, rotation: 0, scale: 1 },
          { clipIndex: 1, startFrom: 2,   duration: 4, rotation: 0, scale: 1 },
          { clipIndex: 0, startFrom: 8,   duration: 4, rotation: 0, scale: 1 },
          { clipIndex: 1, startFrom: 10,  duration: 5, rotation: 0, scale: 1 },
        ],
        audioStartSec: 28,
        audioDurationSec: 18,
        captionSuggestion: 'something about the peak ✨',
        hookNotes: 'Opens on the most kinetic moment in clip 0.',
      },
      {
        name: 'Slow Burn',
        aspectRatio: '9:16',
        arcType: 'slow-build',
        uniquenessNote: 'Starts with calm clip 1 moment; builds through clip 0.',
        clips: [
          { clipIndex: 1, startFrom: 0,  duration: 6, rotation: 0, scale: 1 },
          { clipIndex: 0, startFrom: 3,  duration: 5, rotation: 0, scale: 1 },
          { clipIndex: 1, startFrom: 8,  duration: 5, rotation: 0, scale: 1 },
        ],
        audioStartSec: 28,
        audioDurationSec: 16,
        captionSuggestion: 'patience pays off 🌅',
        hookNotes: 'Quiet start — makes the energy drop land harder.',
      },
      {
        name: 'Even Montage',
        aspectRatio: '9:16',
        arcType: 'even-montage',
        uniquenessNote: 'Equal clip spread; different rhythm from pieces 1 & 2.',
        clips: [
          { clipIndex: 0, startFrom: 2,  duration: 3, rotation: 0, scale: 1 },
          { clipIndex: 1, startFrom: 4,  duration: 3, rotation: 0, scale: 1 },
          { clipIndex: 0, startFrom: 12, duration: 3, rotation: 0, scale: 1 },
          { clipIndex: 1, startFrom: 14, duration: 3, rotation: 0, scale: 1 },
          { clipIndex: 0, startFrom: 20, duration: 3, rotation: 0, scale: 1 },
        ],
        audioStartSec: 28,
        audioDurationSec: 15,
        captionSuggestion: 'equal parts magic 🎞️',
        hookNotes: 'Fast even rhythm — great for mosaic feel.',
      },
    ],
  },
  pass1: null,
  newSoundbyte: null,
};

// ─── Screenshot helper ────────────────────────────────────────────────────────

export async function snap(page: Page, label: string) {
  const file = path.join(SCREENSHOTS, `${label.replace(/\W+/g, '-')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

// ─── Navigation helpers ────────────────────────────────────────────────────────

export async function navigateToSmartEditTab(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);

  // Open Will I Find You world
  const worldBtn = page
    .locator('[data-world-name="Will I Find You"]')
    .or(page.locator('button').filter({ hasText: /will i find you/i }))
    .first();
  await worldBtn.waitFor({ timeout: 20_000 });
  await worldBtn.evaluate((el: HTMLElement) => el.click()).catch(() =>
    worldBtn.click({ force: true }),
  );
  await page.waitForTimeout(2_000);

  // Open Smart Edit tab
  const tab = page
    .locator('button:has-text("Smart Edit"), [role="tab"]:has-text("Smart Edit")')
    .first();
  await tab.waitFor({ timeout: 10_000 });
  await tab.evaluate((el: HTMLElement) => el.click()).catch(() =>
    tab.click({ force: true }),
  );
  await page.waitForTimeout(1_000);
}

export async function clearSmartEditSession(page: Page) {
  const keys = await page.evaluate(() => {
    const toRemove = Object.keys(localStorage).filter(k => k.startsWith('smart-edit-'));
    toRemove.forEach(k => localStorage.removeItem(k));
    return toRemove;
  });
  if (keys.length) console.log(`  🗑️  Cleared localStorage: ${keys.join(', ')}`);

  const startFresh = page.locator('button:has-text("Start Fresh")').first();
  if (await startFresh.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForTimeout(1_000);
  }
}

// ─── API mock helper ──────────────────────────────────────────────────────────

/**
 * Installs a route mock for /api/mark-edit.
 * First call returns Pass 1; subsequent calls return the multi-piece edit plan.
 */
export function mockMarkEditApi(page: Page) {
  let callCount = 0;
  page.route('**/api/mark-edit', async (route: Route) => {
    callCount++;
    const body = callCount === 1 ? MOCK_PASS1 : MOCK_PASS2;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    console.log(`  🤖 Mark API call #${callCount} → mocked (${callCount === 1 ? 'Pass 1' : 'Pass 2'})`);
  });
}

// ─── Chat helpers ─────────────────────────────────────────────────────────────

/** Wait until Mark's last message stops changing (streaming done). */
export async function waitForMarkStable(
  page: Page,
  minLength = 20,
  timeoutMs = 60_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let prev = '';
  let stable = 0;
  while (Date.now() < deadline) {
    const allMsgs = page.locator('div.bg-gray-800\\/80');
    const count = await allMsgs.count();
    if (count > 0) {
      const text = await allMsgs.last().innerText().catch(() => '');
      if (text.length >= minLength && text !== prev) {
        stable = 0;
      } else if (text.length >= minLength && text === prev) {
        stable++;
        if (stable >= 3) return text;
      }
      prev = text;
    }
    await page.waitForTimeout(600);
  }
  return prev;
}

/** Type a message in Mark's chat input and press Enter. */
export async function sendMarkMessage(page: Page, text: string) {
  const input = page
    .locator(
      'input[placeholder*="Tell Mark"], input[placeholder*="Ask Mark"], input[placeholder*="message"], textarea',
    )
    .last();
  await input.waitFor({ state: 'visible', timeout: 15_000 });

  // Wait for Mark's previous response to finish (input may be disabled)
  const deadline = Date.now() + 300_000; // 5 min max (lip sync can be slow)
  while (Date.now() < deadline) {
    if (!(await input.isDisabled().catch(() => true))) break;
    await page.waitForTimeout(2_000);
  }

  await input.fill(text);
  await input.press('Enter');
  console.log(`  💬 Sent: "${text}"`);
}

// ─── Phase-transition helpers ─────────────────────────────────────────────────

/**
 * Upload the test clips and wait for Mark's Pass 1 response.
 * Returns the Pass 1 reply text.
 */
export async function uploadClipsAndWaitForPass1(page: Page): Promise<string> {
  console.log(`  📁 Uploading ${TEST_CLIPS.length} test clips...`);
  const videoInput = page.locator('input[type="file"][accept*="video"]').first();
  await videoInput.waitFor({ state: 'attached', timeout: 15_000 });
  await videoInput.setInputFiles(TEST_CLIPS);
  await page.waitForTimeout(3_000);

  const pass1 = await waitForMarkStable(page, 30, 90_000);
  console.log(`  Mark Pass 1: "${pass1.slice(0, 100)}..."`);
  return pass1;
}

/**
 * Full setup: navigate → clear session → mock API → upload → wait for Pass 1
 * → send soundbyte → wait for pitch phase.
 *
 * Returns when the pitch cards grid is visible.
 */
export async function setupToPitchPhase(page: Page): Promise<void> {
  await navigateToSmartEditTab(page);
  await clearSmartEditSession(page);
  mockMarkEditApi(page);
  await uploadClipsAndWaitForPass1(page);

  await sendMarkMessage(page, 'Verse 1: 0:28 – 0:43');

  // Wait until the pitch cards heading appears
  await page.locator("text=/Mark's Pitch/i").waitFor({ timeout: 60_000 });
  console.log('  ✅ Pitch phase reached');
}

/**
 * Approve the first N pitch cards (0-indexed) and click "Render these →".
 * Call after setupToPitchPhase().
 */
export async function approveAndStartRendering(page: Page, count = 2): Promise<void> {
  const approveButtons = page.locator('button:has-text("Approve")');
  const total = await approveButtons.count();
  const toApprove = Math.min(count, total);
  for (let i = 0; i < toApprove; i++) {
    await approveButtons.nth(i).click();
    await page.waitForTimeout(300);
  }
  console.log(`  ✅ Approved ${toApprove} piece(s)`);

  const renderBtn = page.locator('button:has-text("Render these")');
  await renderBtn.waitFor({ timeout: 5_000 });
  await renderBtn.click();
  console.log('  🎬 Rendering started');
}
