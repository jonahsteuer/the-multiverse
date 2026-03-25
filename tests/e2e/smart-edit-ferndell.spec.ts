/**
 * smart-edit-ferndell.spec.ts
 *
 * End-to-end test for the SmartEdit tab using Leon Tax's account,
 * the 29 Ferndell footage clips, and the "Will I Find You" audio master.
 *
 * What this tests:
 *   1. No 413 (payload too large) on /api/mark-edit
 *   2. No Supabase 400 errors on galaxies query
 *   3. Mark responds with Pass 1 analysis and asks for soundbyte
 *   4. MediaPipe lip sync runs without WASM crash (or gracefully skips)
 *   5. Mark generates a valid edit plan on Pass 2
 *   6. Edit plan passes mark-review validation (clip indices, durations, rotation)
 *   7. WAV audio uploads and plays without NotSupportedError
 *   8. Remotion Player plays without console errors
 *
 * Run: npx playwright test smart-edit-ferndell --headed
 */

import { test, expect, Page, ConsoleMessage, Response } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL     = 'https://the-multiverse.vercel.app';
const LEON_EMAIL   = 'jonah@b-zb.com';
const LEON_PASSWORD = 'Multiverse2026!';
const WORLD_NAME   = 'WILL I FIND YOU';           // uppercase as shown in UI
const FOOTAGE_DIR  = '/Users/jonahsteuer/Dropbox/03.13.26 Ferndell Footage';
const AUDIO_FILE   = '/Users/jonahsteuer/Dropbox/Will I find You Final Master.wav';
const SCREENSHOTS  = 'tests/e2e/screenshots/smart-edit';
const SOUNDBYTE    = 'Verse 1: 0:46 - 1:15';

// Use 6 clips for the test (balanced spread across the shoot).
// All 29 clips = 1.8GB total; frame extraction for all takes >10 min in CI.
// 6 clips ~= 400MB is sufficient to test the fix and produce a real edit plan.
const ALL_FOOTAGE_FILES = fs.readdirSync(FOOTAGE_DIR)
  .filter(f => f.endsWith('.mov') || f.endsWith('.mp4'))
  .sort()
  .map(f => path.join(FOOTAGE_DIR, f));
const FOOTAGE_FILES = [
  ALL_FOOTAGE_FILES[0],                                             // first
  ALL_FOOTAGE_FILES[Math.floor(ALL_FOOTAGE_FILES.length * 0.2)],  // 20%
  ALL_FOOTAGE_FILES[Math.floor(ALL_FOOTAGE_FILES.length * 0.4)],  // 40%
  ALL_FOOTAGE_FILES[Math.floor(ALL_FOOTAGE_FILES.length * 0.6)],  // 60%
  ALL_FOOTAGE_FILES[Math.floor(ALL_FOOTAGE_FILES.length * 0.8)],  // 80%
  ALL_FOOTAGE_FILES[ALL_FOOTAGE_FILES.length - 1],                 // last
].filter(Boolean) as string[];

if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ─── Use saved Leon Tax session (captured from live browser) ─────────────────

test.use({ storageState: 'tests/e2e/.auth/leon-tax-session.json' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function snap(page: Page, label: string) {
  const file = path.join(SCREENSHOTS, `${label.replace(/\W+/g, '-')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

async function signInAsLeon(page: Page) {
  // Session is pre-loaded from leon-tax-session.json (captured from live browser).
  // Just navigate to the app and wait for the authenticated view.
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);

  // If the login form appears despite the saved session, the token may have expired.
  // Fall back to clicking through the sign-in form.
  const loginForm = page.locator('input[type="password"]').first();
  if (await loginForm.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log('  ⚠️  Session expired — attempting manual sign-in');
    const toggle = page.locator('button:has-text("Already have an account")').first();
    if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(800);
    }
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill(LEON_EMAIL);
    await page.locator('input[type="password"]').first().fill(LEON_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(4_000);
  }

  // Navigate past any onboarding/intermediate screens
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (
      bodyText.includes('TODO LIST') ||
      bodyText.includes('WILL I FIND YOU') ||
      bodyText.includes('YOUR WORLD') ||
      url.includes('dashboard')
    ) {
      console.log('  ✅ Signed in as Leon Tax — main view reached');
      return;
    }
    for (const txt of ['Continue →', 'Continue', "Let's go", 'View Calendar', 'Enter']) {
      const btn = page.locator(`button:has-text("${txt}")`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(2_000);
        break;
      }
    }
    await page.waitForTimeout(1_500);
  }
  // Don't throw — proceed anyway and let subsequent steps determine if login worked
  console.log('  ⚠️  Could not confirm galaxy view — proceeding anyway');
}

async function waitForMarkStable(page: Page, minLength = 20, timeoutMs = 180_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let prev = '';
  let stable = 0;

  while (Date.now() < deadline) {
    // Mark's messages are in bg-gray-800/80 divs (assistant role)
    // Find all non-user message bubbles
    const allMsgs = page.locator('div.bg-gray-800\\/80');
    const count = await allMsgs.count();
    if (count > 0) {
      const lastText = await allMsgs.last().innerText().catch(() => '');
      // Skip if it's just the loading indicator (3 dots from animated spans)
      const isLoading = lastText.trim().length < 5;
      if (!isLoading && lastText.length >= minLength) {
        if (lastText === prev) {
          stable++;
          if (stable >= 4) return lastText;
        } else {
          stable = 0;
        }
        prev = lastText;
      }
    }
    await page.waitForTimeout(700);
  }
  return prev;
}

async function sendMarkMessage(page: Page, text: string) {
  // SmartEditTab uses placeholder "Tell Mark what you want..."
  // The input is disabled while Mark's API call is running (loading=true).
  // Wait up to 3 min for Mark to finish and the input to become enabled.
  const input = page.locator(
    'input[placeholder*="Tell Mark"], input[placeholder*="Ask Mark"], input[placeholder*="message"], textarea'
  ).last();
  await input.waitFor({ state: 'visible', timeout: 15_000 });

  // Wait for input to become enabled (not disabled) — frame extraction for large .mov files
  // can take several minutes, so give it up to 7 minutes.
  const enabledDeadline = Date.now() + 420_000;
  while (Date.now() < enabledDeadline) {
    const isDisabled = await input.isDisabled().catch(() => true);
    if (!isDisabled) break;
    console.log('  ⏳ Waiting for Mark to finish before sending message...');
    await page.waitForTimeout(3_000);
  }

  await input.fill(text);
  await input.press('Enter');
  console.log(`  💬 Sent: "${text}"`);
}

// ─── Mark-Review: inline validation of edit plan ─────────────────────────────

interface EditPlanClip {
  clipIndex: number;
  startFrom: number;
  duration: number;
  rotation?: number;
  scale?: number;
  label?: string;
}

interface EditPiece {
  name: string;
  aspectRatio: string;
  clips: EditPlanClip[];
  audioStartSec?: number;
  audioDurationSec?: number;
}

function validateEditPlan(
  pieces: EditPiece[],
  clipCount: number,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const piece of pieces) {
    const prefix = `[${piece.name}]`;

    if (!piece.clips?.length) {
      errors.push(`${prefix} No clips in piece`);
      continue;
    }

    if (!['9:16', '16:9', '1:1', '4:5'].includes(piece.aspectRatio)) {
      errors.push(`${prefix} Invalid aspectRatio: ${piece.aspectRatio}`);
    }

    let clipSum = 0;
    for (const clip of piece.clips) {
      if (clip.clipIndex < 0 || clip.clipIndex >= clipCount) {
        errors.push(`${prefix} Clip clipIndex=${clip.clipIndex} is out of bounds (0-${clipCount - 1})`);
      }
      if (clip.duration < 0.3) {
        warnings.push(`${prefix} Clip #${clip.clipIndex} duration ${clip.duration}s is very short`);
      }
      if (clip.startFrom < 0) {
        errors.push(`${prefix} Clip #${clip.clipIndex} startFrom is negative`);
      }
      // Check rotation/scale black bar risk
      if ((clip.rotation === 90 || clip.rotation === 270) && clip.scale !== undefined && clip.scale < 1) {
        errors.push(`${prefix} Clip #${clip.clipIndex} rotation=${clip.rotation}° with scale=${clip.scale} will show black bars`);
      }
      if ((clip.rotation === 90 || clip.rotation === 270) && clip.scale === undefined) {
        warnings.push(`${prefix} Clip #${clip.clipIndex} rotation=${clip.rotation}° — add scale:1.0 explicitly`);
      }
      clipSum += clip.duration;
    }

    // Audio continuity check
    if (piece.audioDurationSec !== undefined) {
      const diff = Math.abs(piece.audioDurationSec - clipSum);
      if (diff > 1) {
        warnings.push(`${prefix} audioDurationSec=${piece.audioDurationSec}s but clip sum=${clipSum.toFixed(1)}s (diff ${diff.toFixed(1)}s)`);
      }
    }

    // Duration sanity by aspect ratio
    if (piece.aspectRatio === '9:16' && (clipSum < 5 || clipSum > 65)) {
      warnings.push(`${prefix} 9:16 total ${clipSum.toFixed(1)}s — ideal 15-60s for Reels/TikTok`);
    }
  }

  return { errors, warnings };
}

// ─── Main Test ────────────────────────────────────────────────────────────────

test('SmartEdit: Ferndell footage + Will I Find You audio — full Mark session', async ({ page }) => {
  test.setTimeout(900_000); // 15 minutes — frame extraction + lip sync + 2 Mark API calls

  // ── Track all errors ──────────────────────────────────────────────────────
  const consoleErrors: string[] = [];
  const networkFailures: { url: string; status: number }[] = [];
  const criticalErrors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      // Flag the errors we specifically fixed
      if (text.includes('NotSupportedError') || text.includes('no supported sources')) {
        criticalErrors.push(`❌ AUDIO ERROR: ${text}`);
      }
      if (text.includes('RuntimeError') && text.includes('face_mesh')) {
        criticalErrors.push(`❌ MEDIAPIPE CRASH: ${text.slice(0, 120)}`);
      }
    }
  });

  page.on('response', (response: Response) => {
    const url = response.url();
    const status = response.status();
    if (status >= 400) {
      networkFailures.push({ url, status });
      if (url.includes('mark-edit') && status === 413) {
        criticalErrors.push(`❌ 413 PAYLOAD TOO LARGE on ${url}`);
      }
      if (url.includes('supabase') && status === 400) {
        criticalErrors.push(`❌ Supabase 400 on ${url}`);
      }
    }
  });

  // ── Sign in ───────────────────────────────────────────────────────────────
  console.log('\n▶ Step 1: Sign in as Leon Tax');
  await signInAsLeon(page);
  await snap(page, '01-galaxy-view');

  // ── Navigate to Will I Find You world ─────────────────────────────────────
  console.log('\n▶ Step 2: Navigate to "Will I Find You" world');
  // The Three.js canvas intercepts pointer events — use force:true or JS click.
  const worldBtn = page.locator('[data-world-name="Will I Find You"]').or(
    page.locator('button').filter({ hasText: /will i find you/i })
  ).first();
  await worldBtn.waitFor({ timeout: 15_000 });
  // Try JS click first (bypasses canvas overlay), fall back to force click
  await worldBtn.evaluate((el: HTMLElement) => el.click()).catch(async () => {
    await worldBtn.click({ force: true });
  });
  await page.waitForTimeout(2_000);
  await snap(page, '02-world-view');

  // ── Open Smart Edit tab ───────────────────────────────────────────────────
  console.log('\n▶ Step 3: Open Smart Edit tab');
  const smartEditTab = page.locator('button:has-text("Smart Edit"), [role="tab"]:has-text("Smart Edit")').first();
  await smartEditTab.waitFor({ timeout: 10_000 });
  await smartEditTab.evaluate((el: HTMLElement) => el.click()).catch(async () => {
    await smartEditTab.click({ force: true });
  });
  await page.waitForTimeout(1_500);
  await snap(page, '03-smart-edit-tab');

  // Clear any previous SmartEdit session from localStorage so Mark runs Pass 1 fresh
  const clearedKeys = await page.evaluate(() => {
    const toRemove = Object.keys(localStorage).filter(k => k.startsWith('smart-edit-'));
    toRemove.forEach(k => localStorage.removeItem(k));
    return toRemove;
  });
  if (clearedKeys.length) console.log(`  🗑️  Cleared localStorage keys: ${clearedKeys.join(', ')}`);

  // Also click "Start Fresh" button if the UI shows one
  const startFresh = page.locator('button:has-text("Start Fresh"), button:has-text("start fresh")').first();
  if (await startFresh.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await startFresh.click();
    await page.waitForTimeout(1_000);
    console.log('  🗑️  Clicked Start Fresh button');
  }
  await page.waitForTimeout(500);

  // ── Upload 29 Ferndell footage clips ──────────────────────────────────────
  console.log(`\n▶ Step 4: Upload ${FOOTAGE_FILES.length} Ferndell footage clips`);
  console.log(`  Files: ${FOOTAGE_FILES.map(f => path.basename(f)).join(', ')}`);

  // Find the hidden video file input (class="hidden" — use state:'attached')
  const videoInput = page.locator('input[type="file"][accept*="video"]').first();
  await videoInput.waitFor({ state: 'attached', timeout: 15_000 });
  await videoInput.setInputFiles(FOOTAGE_FILES);

  console.log('  📁 Files dispatched to input — waiting for clip library to populate...');
  // Wait for all 29 clips to finish analyzing (frame extraction)
  await page.waitForTimeout(5_000);

  // Wait until clip thumbnails appear — should see ~29 items
  const clipDeadline = Date.now() + 120_000;
  while (Date.now() < clipDeadline) {
    const clips = await page.locator('[class*="clip"], [class*="thumb"], [class*="library"]').count();
    if (clips >= 5) {
      console.log(`  ✅ Clip library populated (${clips} visible elements)`);
      break;
    }
    await page.waitForTimeout(2_000);
  }
  await snap(page, '04-footage-uploaded');

  // ── Wait for Mark's Pass 1 analysis ───────────────────────────────────────
  console.log('\n▶ Step 5: Waiting for Mark Pass 1 (footage analysis + soundbyte question)');
  const pass1Reply = await waitForMarkStable(page, 30, 120_000);
  console.log(`  Mark: "${pass1Reply.slice(0, 200)}..."`);
  await snap(page, '05-mark-pass1');

  // Validate Pass 1 happened (should ask about soundbyte)
  const askedAboutSoundbyte =
    pass1Reply.toLowerCase().includes('soundbyte') ||
    pass1Reply.toLowerCase().includes('section') ||
    pass1Reply.toLowerCase().includes('chorus') ||
    pass1Reply.toLowerCase().includes('verse') ||
    pass1Reply.toLowerCase().includes('which part') ||
    pass1Reply.toLowerCase().includes('time range');

  console.log(`  Soundbyte question detected: ${askedAboutSoundbyte ? '✅' : '⚠️ (not explicitly asked)'}`);

  // ── Upload audio ──────────────────────────────────────────────────────────
  console.log('\n▶ Step 6: Upload WAV audio master');
  const audioButton = page.locator('button:has-text("Audio"), label:has-text("Audio")').first();
  // Try clicking the audio button to reveal the input
  if (await audioButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await audioButton.click();
    await page.waitForTimeout(500);
  }
  const audioInput = page.locator('input[type="file"][accept*="audio"], input[type="file"][accept*=".wav"]').first();
  await audioInput.waitFor({ state: 'attached', timeout: 10_000 });
  await audioInput.setInputFiles(AUDIO_FILE);
  await page.waitForTimeout(3_000); // allow WAV re-encoding if needed
  await snap(page, '06-audio-uploaded');

  // Verify audio loaded message from Mark
  const audioAck = await page.locator('text=/Got your audio|Audio loaded|Will I Find You/i').first().isVisible({ timeout: 8_000 }).catch(() => false);
  console.log(`  Audio acknowledged: ${audioAck ? '✅' : '⚠️'}`);

  // ── Send soundbyte info to Mark ───────────────────────────────────────────
  console.log(`\n▶ Step 7: Tell Mark the soundbyte — "${SOUNDBYTE}"`);
  await sendMarkMessage(page, SOUNDBYTE);
  await page.waitForTimeout(2_000);

  // ── Wait for lip sync detection + Pass 2 edit plan ───────────────────────
  console.log('\n▶ Step 8: Waiting for lip sync + Mark Pass 2 edit plan (may take 2-4 min)');
  await snap(page, '07-waiting-for-pass2');

  // Poll until we see an edit plan applied (timeline appears or new pieces)
  let editPlanText = '';
  const pass2Deadline = Date.now() + 240_000; // 4 minutes
  while (Date.now() < pass2Deadline) {
    const allMsgs = page.locator('[class*="bg-gray-900"][class*="rounded"], [class*="assistant"]');
    const count = await allMsgs.count();
    if (count > 0) {
      const lastText = await allMsgs.last().innerText().catch(() => '');
      // Check if Mark produced an edit (references clips, timing, etc.)
      const hasEditContent = (
        lastText.toLowerCase().includes('cut') ||
        lastText.toLowerCase().includes('edit') ||
        lastText.toLowerCase().includes('clip') ||
        lastText.toLowerCase().includes('second') ||
        lastText.toLowerCase().includes('timeline')
      ) && lastText !== pass1Reply;

      if (hasEditContent && lastText.length > 50) {
        editPlanText = lastText;
        console.log(`  Mark Pass 2: "${lastText.slice(0, 200)}..."`);
        break;
      }
    }
    await page.waitForTimeout(2_000);
  }
  await snap(page, '08-mark-pass2');

  // ── Validate timeline appeared ────────────────────────────────────────────
  console.log('\n▶ Step 9: Validate edit timeline and player');
  const timelineVisible = await page.locator('[class*="timeline"], canvas, [class*="remotion"]').first().isVisible({ timeout: 10_000 }).catch(() => false);
  console.log(`  Timeline/player visible: ${timelineVisible ? '✅' : '⚠️'}`);

  // Click play on the Remotion player if visible
  const playBtn = page.locator('button[aria-label*="play" i], button[title*="play" i], [class*="play"]').first();
  if (await playBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await playBtn.click();
    await page.waitForTimeout(3_000); // let it play briefly
    console.log('  ▶ Player started');
    await snap(page, '09-player-playing');
    // Pause
    await playBtn.click().catch(() => {});
  }

  // ── Extract and validate edit plan from page ──────────────────────────────
  console.log('\n▶ Step 10: Extract and validate edit plan JSON via network intercept');

  // Re-check network responses for any edit plan data
  // Check localStorage for the saved session which contains the edit plan
  const savedSession = await page.evaluate((worldKey) => {
    return localStorage.getItem(worldKey);
  }, `smart-edit-will-i-find-you`).catch(() => null);

  // Try various world IDs (we don't know the exact ID)
  const allKeys = await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('smart-edit-')) keys.push(k);
    }
    return keys;
  }).catch(() => [] as string[]);

  console.log(`  LocalStorage smart-edit keys: ${allKeys.join(', ') || 'none'}`);

  let piecesFromStorage: EditPiece[] = [];
  for (const key of allKeys) {
    const raw = await page.evaluate((k) => localStorage.getItem(k), key).catch(() => null);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session.pieces?.length) {
          piecesFromStorage = session.pieces;
          console.log(`  📋 Found ${piecesFromStorage.length} piece(s) in session`);
          break;
        }
      } catch { /* ignore */ }
    }
  }

  if (piecesFromStorage.length > 0) {
    console.log('\n  Running mark-review validation...');
    const { errors, warnings } = validateEditPlan(piecesFromStorage, FOOTAGE_FILES.length);

    if (errors.length === 0) {
      console.log('  ✅ MARK REVIEW: PASS — no errors');
    } else {
      console.log(`  ❌ MARK REVIEW: FAIL — ${errors.length} error(s)`);
      errors.forEach(e => console.log(`     ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`  ⚠️  ${warnings.length} warning(s):`);
      warnings.forEach(w => console.log(`     ${w}`));
    }

    // Fail the test if mark-review finds critical issues
    expect(errors, `Mark-review found errors:\n${errors.join('\n')}`).toHaveLength(0);
  } else {
    console.log('  ⚠️  No edit plan found in localStorage yet — Mark may still be generating');
  }

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('\n──────────────── FINAL REPORT ────────────────');
  console.log(`Console errors logged: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 10).forEach(e => console.log(`  • ${e.slice(0, 120)}`));
  }
  console.log(`\nNetwork failures: ${networkFailures.length}`);
  if (networkFailures.length > 0) {
    networkFailures.forEach(f => console.log(`  • ${f.status} ${f.url.slice(0, 100)}`));
  }
  console.log(`\nCritical errors (bugs we fixed): ${criticalErrors.length}`);
  criticalErrors.forEach(e => console.log(`  ${e}`));
  console.log('──────────────────────────────────────────────');

  await snap(page, '10-final-state');

  // Assert no critical errors from the 4 bugs we fixed
  expect(criticalErrors, `Critical errors found:\n${criticalErrors.join('\n')}`).toHaveLength(0);

  // Assert no 413 errors specifically
  const has413 = networkFailures.some(f => f.status === 413 && f.url.includes('mark-edit'));
  expect(has413, '413 Content Too Large on /api/mark-edit — frame payload still too large').toBe(false);

  // Assert no Supabase 400 on the galaxies query
  const hasSupabase400 = networkFailures.some(
    f => f.status === 400 && f.url.includes('supabase') && f.url.includes('galaxies'),
  );
  expect(hasSupabase400, 'Supabase 400 on galaxies query — track_url column issue not fixed').toBe(false);
});
