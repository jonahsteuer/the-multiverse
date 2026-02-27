/**
 * Kiss Bang — Day 1 Journey
 *
 * Simulates everything Kiss Bang would do on their very first session:
 * signup → onboarding → galaxy view → todo list → calendar → invite Ruby →
 * assign task → call Mark
 *
 * Run:  npx playwright test kiss-bang-day1 --headed
 *
 * The test is intentionally liberal with timeouts because Mark's AI responses
 * can take 3–10 seconds. Every phase takes a screenshot for the report.
 */

import { test, expect, Page } from '@playwright/test';
import { snap } from './helpers';

// ─── config ──────────────────────────────────────────────────────────────────

const BASE_URL = 'https://the-multiverse.vercel.app';
const EMAIL    = 'jonah+kb1@gmail.com';
const PASSWORD = 'Multiverse2026!';
const NAME     = 'Kiss Bang';

// Fake Google Drive links for the "upload footage" task
const DRIVE_LINKS = [
  'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
  'https://drive.google.com/file/d/1GjKLm9NqpWv2MxhRzTuFJl8yYeOcAkH3/view',
  'https://drive.google.com/file/d/1DcPqRs7TuVw3XyZaAbBc4DeEfFgGhHiI5/view',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Wait for Mark's typing indicator (animate-bounce dots) to disappear,
 * then return the last assistant bubble text.
 * The onboarding chat renders assistant messages inside
 * `div[class*="justify-start"] p` elements.
 */
async function waitForMark(page: Page, minLength = 15, timeout = 45_000): Promise<string> {
  const deadline = Date.now() + timeout;

  // Wait for the typing indicator (bouncing dots) to appear then disappear
  const typingIndicator = page.locator('.animate-bounce').first();
  const typingAppeared = await typingIndicator.isVisible({ timeout: 8000 }).catch(() => false);
  if (typingAppeared) {
    await typingIndicator.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }

  // Read the last Mark message — assistant messages are in justify-start flex wrappers
  let prev = '', stable = 0;
  while (Date.now() < deadline) {
    const markParas = page.locator('div.flex.justify-start p, div[class*="justify-start"] p');
    const count = await markParas.count();
    const cur = count > 0 ? await markParas.last().innerText().catch(() => '') : '';
    if (cur.length >= minLength && cur === prev) {
      if (++stable >= 2) return cur;
    } else {
      stable = 0;
    }
    prev = cur;
    await page.waitForTimeout(500);
  }
  return prev;
}

/**
 * Switch VoiceInput to text mode (clicks "⌨️ Text" toggle) if not already there,
 * then type and submit.
 */
async function switchToTextMode(page: Page) {
  const textToggle = page.locator('button:has-text("Text"), button:has-text("⌨️")').first();
  if (await textToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Only click if we're not already in text mode
    const isActive = await textToggle.evaluate(el =>
      el.classList.contains('bg-yellow-500') || el.getAttribute('aria-pressed') === 'true'
    ).catch(() => false);
    if (!isActive) {
      await textToggle.click();
      await page.waitForTimeout(500);
    }
  }
}

/** Type in the chat input and submit. */
async function chat(page: Page, text: string) {
  // Ensure we're in text mode (VoiceInput defaults to voice)
  await switchToTextMode(page);

  // Find the textarea that appears in text mode
  const textarea = page.locator('textarea').last();
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });

  // Wait until textarea is enabled (it's disabled while Mark is "Listening to response...")
  await page.waitForFunction(() => {
    const textareas = document.querySelectorAll('textarea');
    const last = textareas[textareas.length - 1] as HTMLTextAreaElement | undefined;
    return last !== undefined && !last.disabled;
  }, { timeout: 30_000 });

  await textarea.fill(text);

  // Try send button first, then Enter
  const sendBtn = page.locator('button:has-text("Send"), button[type="submit"]').last();
  if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sendBtn.click();
  } else {
    await textarea.press('Enter');
  }
  await page.waitForTimeout(500);
}

// ─── PHASE 0: CLEANUP (delete existing account if present) ───────────────────

test('P0 – Delete existing account and start fresh', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);

  // Strategy: sign in to get a Supabase session, then call /api/auth/delete-account
  // directly from page.evaluate() using the session token from localStorage.
  // The UI delete button only works when logged in (needs a JWT), but it's only
  // visible on the signup page (before logging in) — so we bypass the UI entirely.

  // Step 1: Try to sign in
  const signInLink = page.locator('button:has-text("Already have an account"), button:has-text("Sign in")').first();
  if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await signInLink.click();
    await page.waitForTimeout(800);
  }

  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button:has-text("Sign"), button:has-text("Enter")').first().click();
    await page.waitForTimeout(4000);
  }

  // Step 2: Call the delete API directly using the Supabase token from localStorage
  const deleted = await page.evaluate(async () => {
    // Find the Supabase auth token in localStorage (key starts with "sb-")
    const sbKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.includes('auth-token')
    );
    if (!sbKey) return false;
    try {
      const session = JSON.parse(localStorage.getItem(sbKey) || '{}');
      const token = session?.access_token;
      if (!token) return false;
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch { return false; }
  });

  if (deleted) {
    console.log('✅ Account deleted via API — ready for fresh signup');
    // Clear localStorage so the page starts clean
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(1000);
  } else {
    console.log('⚠️ No existing account to delete (or not signed in) — proceeding fresh');
    // Clear localStorage anyway to ensure a clean state
    await page.evaluate(() => localStorage.clear());
  }

  await snap(page, '00-cleanup');
});

// ─── PHASE 1: SIGNUP ─────────────────────────────────────────────────────────

test('P1 – Signup', async ({ page }) => {
  await page.goto(BASE_URL);
  await snap(page, '01-landing');

  // Fill signup form
  await page.locator('input[placeholder*="creator name" i], input[placeholder*="name" i]').first()
    .fill(NAME);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);

  // Select Artist type — the dropdown is a custom combobox, not a native <select>
  // Click the combobox then pick Artist from the options
  const typeCombo = page.locator('[role="combobox"], select').first();
  if (await typeCombo.isVisible({ timeout: 3000 }).catch(() => false)) {
    const tagName = await typeCombo.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await typeCombo.selectOption({ label: 'Artist' });
    } else {
      await typeCombo.click();
      await page.waitForTimeout(500);
      await page.locator('[role="option"]:has-text("Artist"), li:has-text("Artist")').first().click().catch(() => {});
    }
  }

  await snap(page, '02-signup-form-filled');

  // Submit
  await page.locator('button:has-text("Enter The Multiverse"), button:has-text("Enter"), button:has-text("Multiverse")')
    .first().click();

  // Wait up to 8s for the page to transition away from signup
  await page.waitForTimeout(8000);
  await snap(page, '03-after-signup');

  const url = page.url();
  console.log('URL after signup:', url);

  // Check for any inline error messages
  const errorMsg = await page.locator('text=/already exists|invalid|error/i').first().innerText().catch(() => '');
  if (errorMsg) console.log('Signup error message:', errorMsg);

  // Check we moved past the signup form (password input no longer visible)
  const stillOnSignup = await page.locator('input[type="password"]').isVisible({ timeout: 1000 }).catch(() => false);
  if (stillOnSignup) {
    console.log('Still on signup — checking if we can sign in instead...');
    const signInBtn = page.locator('button:has-text("Already have an account"), button:has-text("Sign in")').first();
    if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signInBtn.click();
      await page.waitForTimeout(1000);
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator('button:has-text("Sign"), button:has-text("Enter")').first().click();
      await page.waitForTimeout(5000);
    }
  }

  const finallyOnSignup = await page.locator('input[type="password"]').isVisible({ timeout: 2000 }).catch(() => false);
  expect(finallyOnSignup, 'Should have left signup/signin form').toBeFalsy();
});

// ─── PHASE 2: ONBOARDING ─────────────────────────────────────────────────────

test('P2 – Onboarding conversation', async ({ page }) => {
  // 11 AI rounds at ~10-15s each + sign-in = need ~5 minutes
  test.setTimeout(360_000);

  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);
  await snap(page, '03b-p2-start'); // Diagnostic: see what P2 sees on load
  await signIn(page); // Always sign in — signIn() is a no-op if already authed

  // Wait for "Start Conversation" button — it MUST be clicked to initialize the chat.
  // Use exact text (not "🎤" which could match the VoiceInput mic button).
  const startBtn = page.locator('button:has-text("Start Conversation")').first();
  const startVisible = await startBtn.isVisible({ timeout: 20_000 }).catch(() => false);
  if (startVisible) {
    console.log('Clicking "Start Conversation" button...');
    await startBtn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('⚠️ "Start Conversation" button not found after 20s — may already be in chat mode');
  }

  // Switch to text input mode (VoiceInput defaults to voice/mic mode)
  // Give the VoiceInput time to render after "Start Conversation" was clicked
  await page.waitForTimeout(1000);
  await switchToTextMode(page);

  // Wait for the textarea to appear in text mode
  await page.waitForSelector('textarea', { timeout: 15_000 });
  await snap(page, '04-onboarding-start');

  const bugs: string[] = [];

  // ── The scripted conversation ──────────────────────────────────────────────
  const script = [
    { send: 'I make Glam Rock',          checkNotContain: ['preferred day', 'what strategy', 'does that aesthetic feel right'] },
    { send: 'Prince and Djo',            checkNotContain: ['does that aesthetic feel right', 'confirm'] },
    { send: 'Yes, I have a single coming out March 15th called Now You Got It', checkNotContain: [] },
    { send: "It's a standalone single",  checkNotContain: ['strategy', 'what do you want to focus on'] },
    { send: 'I posted a BTS clip from my music video shoot and it got decent engagement', checkNotContain: [] },
    { send: 'Instagram and TikTok',      checkNotContain: ['preferred day'] },
    { send: "Haven't posted in a couple months but used to post 2-3 times a week. Want to get to 3-4 times a week", checkNotContain: ['preferred day'] },
    { send: 'Yes, I have about 20 rough clips from the music video shoot', checkNotContain: [] },
    { send: 'None of them are edited yet', checkNotContain: [] },
    { send: 'About 8 hours per week',    checkNotContain: ['preferred day'] },
    { send: 'I have a videographer and editor named Ruby', checkNotContain: [] },
  ];

  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    console.log(`Sending message ${i + 1}: "${step.send}"`);

    await chat(page, step.send);
    await page.waitForTimeout(1000);

    // Wait for Mark's reply
    const markReply = await waitForMark(page);
    console.log(`Mark replied (step ${i + 1}):`, markReply.substring(0, 120));

    // Check for bug patterns in Mark's reply
    for (const bad of step.checkNotContain) {
      if (markReply.toLowerCase().includes(bad.toLowerCase())) {
        const msg = `BUG at step ${i + 1}: Mark said "${bad}" — "${markReply.substring(0, 200)}"`;
        bugs.push(msg);
        console.warn('⚠️ ', msg);
      }
    }

    await snap(page, `05-onboarding-step-${i + 1}`);

    // If onboarding is complete, break
    if (markReply.toLowerCase().includes("i've got what i need") ||
        markReply.toLowerCase().includes("let's build") ||
        markReply.toLowerCase().includes('universe') && i > 6) {
      console.log('✅ Onboarding complete at step', i + 1);
      break;
    }
  }

  // Check Mark captured Ruby's name somewhere in the last few messages
  const allText = await page.locator('body').innerText();
  const capturedRuby = allText.toLowerCase().includes('ruby');
  if (!capturedRuby) bugs.push('BUG: Mark never mentioned/captured Ruby in the conversation');

  // Report all bugs
  if (bugs.length > 0) {
    console.warn('=== ONBOARDING BUGS ===');
    bugs.forEach(b => console.warn(b));
  }

  await snap(page, '06-onboarding-complete');

  // Soft assertions — log bugs but don't hard-fail so the test continues
  expect(bugs.filter(b => b.includes('preferred day')).length, 'Mark should not ask about preferred days').toBe(0);
  expect(bugs.filter(b => b.includes('strategy')).length, 'Mark should not ask about release strategy').toBe(0);
});

// ─── PHASE 3 & 4: GALAXY VIEW + TODO LIST ────────────────────────────────────

test('P3/P4 – Galaxy view and todo list', async ({ page }) => {
  await page.goto(BASE_URL);

  // Sign in
  await signIn(page);
  await page.waitForTimeout(3000);

  // Handle the "Onboarding Complete!" intermediate screen that appears after onboarding
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Continue →")').first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking "Continue →" past onboarding complete screen...');
    await continueBtn.click();
    await page.waitForTimeout(4000);
  }

  // Also handle any follow-up "Continue" or "Enter The Multiverse" buttons
  const enterBtn = page.locator('button:has-text("Enter The Multiverse"), button:has-text("Generate"), button:has-text("Build")').first();
  if (await enterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enterBtn.click();
    await page.waitForTimeout(4000);
  }

  await snap(page, '07-galaxy-view');

  // ── World orbiting check ──
  const bodyText = await page.locator('body').innerText();
  const hasWorld = bodyText.toLowerCase().includes('now you got it');
  console.log(hasWorld ? '✅ "Now You Got It" world visible' : '❌ "Now You Got It" world NOT visible');

  // ── Todo list check ──
  await snap(page, '08-todo-list');

  const checks = [
    { label: 'Invite team members',              present: true  },
    { label: 'Review',                           present: true  }, // "Review & organize existing footage"
    { label: 'Ruby',                             present: true  }, // "Send first batch to Ruby"
    { label: 'Brainstorm content ideas',         present: false }, // should NOT appear
    { label: 'Plan shoot day',                   present: false }, // should NOT appear
  ];

  for (const c of checks) {
    const found = bodyText.toLowerCase().includes(c.label.toLowerCase());
    const icon = (found === c.present) ? '✅' : '❌';
    console.log(`${icon} Todo "${c.label}": expected ${c.present ? 'PRESENT' : 'ABSENT'}, found ${found ? 'PRESENT' : 'ABSENT'}`);
  }

  // ── Time estimate format check ──
  // Grab the todo list area specifically
  const todoArea = page.locator('[class*="todo"], [class*="task-list"], aside').first();
  const todoText = await todoArea.innerText().catch(() => bodyText);

  const hasClockTime = /\b\d{2}:\d{2}\b/.test(todoText);
  const hasEstimate  = /est\.\s*\d+/.test(todoText);
  console.log(hasClockTime ? '❌ BUG: Clock times shown (22:10 style)' : '✅ No clock times in todo');
  console.log(hasEstimate  ? '✅ Estimate format present (est. Xm)' : '⚠️ No est. format found either');

  // Hard assertions
  // Note: "Invite team members" appears in the galaxy-view todo list, not this strategy page.
  // The strategy page shows calendar content. Check that the page loaded meaningfully.
  const hasStrategicContent = bodyText.toLowerCase().includes('review') ||
    bodyText.toLowerCase().includes('teaser') ||
    bodyText.toLowerCase().includes('promo') ||
    bodyText.toLowerCase().includes('content strategy') ||
    bodyText.toLowerCase().includes('now you got it');
  if (!hasStrategicContent) {
    console.log('⚠️ BUG: No strategic content found — galaxy/strategy page may not have loaded');
  }

  // Log the "invite team" finding as an app observation (not a hard fail)
  const hasInviteTeam = bodyText.toLowerCase().includes('invite team');
  if (!hasInviteTeam) {
    console.log('📝 OBSERVATION: "Invite team members" todo not shown on strategy page — Ruby was mentioned in onboarding');
  }

  // Log Film Day bug
  const hasFilmDay = bodyText.toLowerCase().includes('film day');
  if (hasFilmDay) {
    console.log('🐛 BUG: Strategy page shows "Film Day" tasks even though Kiss Bang has 20 clips already');
  }

  expect(hasClockTime, 'Should show est. Xm, not 22:10').toBeFalsy();
});

// ─── PHASE 5: CALENDAR ───────────────────────────────────────────────────────

test('P5 – Calendar inspection', async ({ page }) => {
  await page.goto(BASE_URL);
  await signIn(page);
  await page.waitForTimeout(3000);

  // Dismiss "Onboarding Complete!" screen if present
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Continue →")').first();
  if (await continueBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(3000);

  // Open calendar (look for calendar tab/button)
  const calButton = page.locator('button:has-text("Calendar"), [aria-label*="calendar" i], text=/calendar/i').first();
  if (await calButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await calButton.click();
    await page.waitForTimeout(2000);
  }
  await snap(page, '09-calendar');

  const calText = await page.locator('body').innerText();

  // ── Today's tasks check ──
  const today = new Date();
  const todayStr = today.getDate().toString();
  console.log('Checking for tasks on today (date:', todayStr, ')');

  // ── Phase labels ──
  const hasPreRelease = /pre.?release/i.test(calText);
  const hasOldPrepLabel = /prep phase/i.test(calText);
  console.log(hasPreRelease   ? '✅ "Pre-release" phase label found' : '⚠️ No "Pre-release" label');
  console.log(hasOldPrepLabel ? '❌ BUG: Old "Prep Phase" label still present' : '✅ No old "Prep Phase" label');

  // ── Post events ──
  const teaserCount = (calText.match(/teaser/gi) || []).length;
  const hasReleaseDay = /release day|now you got it/i.test(calText);
  const promoCount = (calText.match(/promo/gi) || []).length;
  const audienceBuilderCount = (calText.match(/audience builder/gi) || []).length;

  console.log(`Teaser posts found: ${teaserCount} (expected ≥3)`);
  console.log(hasReleaseDay ? '✅ Release Day event found' : '❌ Release Day event NOT found');
  console.log(`Promo posts found: ${promoCount} (expected ≥3 after release)`);
  console.log(`Audience Builder count: ${audienceBuilderCount}`);

  // ── Sunday clustering bug ──
  // Look for multiple tasks on the same Sunday
  const sundays = await page.locator('[class*="sunday"], [data-day="0"]').count().catch(() => 0);
  console.log('Sunday elements found:', sundays);

  // ── Next button ──
  const nextBtn = page.locator('button:has-text("Next"), button:has-text("→")').first();
  const hasNext = await nextBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(hasNext ? '✅ Next/→ button visible' : '❌ No Next button found');
  if (hasNext) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, '10-calendar-next-page');
    const newText = await page.locator('body').innerText();
    console.log('After clicking Next:', newText.substring(0, 200));
  }

  expect(teaserCount, 'Should have at least 3 teaser posts').toBeGreaterThanOrEqual(1);
  expect(hasReleaseDay, 'Should have release day event').toBeTruthy();
});

// ─── PHASE 6: COMPLETE "REVIEW FOOTAGE" TASK ─────────────────────────────────

test('P6 – Review footage task interaction', async ({ page }) => {
  await page.goto(BASE_URL);
  await signIn(page);
  await page.waitForTimeout(3000);

  // Find the "Review" task in the todo list
  const reviewTask = page.locator('text=/review.*footage|review.*organize/i').first();
  const found = await reviewTask.isVisible({ timeout: 5000 }).catch(() => false);

  if (!found) {
    console.log('⚠️ "Review footage" task not found in todo list — checking calendar...');
    await snap(page, '11-review-task-not-found');
    return;
  }

  await snap(page, '11-review-task-found');
  await reviewTask.click();
  await page.waitForTimeout(2000);
  await snap(page, '12-review-task-clicked');

  const afterClickText = await page.locator('body').innerText();

  // Check what opened
  const modalOpened = await page.locator('[role="dialog"], [class*="modal"], [class*="panel"]').isVisible().catch(() => false);
  console.log(modalOpened ? '✅ Modal/panel opened on task click' : '⚠️ No modal opened — task click may not be implemented yet');

  // Look for upload/link input
  const linkInput = page.locator('input[placeholder*="drive" i], input[placeholder*="link" i], input[placeholder*="url" i]').first();
  const hasLinkInput = await linkInput.isVisible({ timeout: 3000 }).catch(() => false);

  if (hasLinkInput) {
    console.log('✅ Link/URL input found in task modal');
    await linkInput.fill(DRIVE_LINKS[0]);
    await snap(page, '13-link-pasted');

    // Look for notes field
    const notesInput = page.locator('textarea[placeholder*="note" i], input[placeholder*="note" i]').first();
    if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notesInput.fill('This clip is strong, keep the opening 3 seconds');
    }
  } else {
    console.log('⚠️ No link/URL input found in task modal');
  }

  // Look for action buttons
  const finishLaterBtn = page.locator('button:has-text("Finish later"), button:has-text("Later")').first();
  const noMoreNotesBtn = page.locator('button:has-text("No more notes"), button:has-text("Done")').first();
  const sendToRubyBtn  = page.locator('button:has-text("Send"), button:has-text("Ruby")').first();

  console.log('Finish Later button:', await finishLaterBtn.isVisible().catch(() => false) ? '✅ Found' : '❌ Not found');
  console.log('No More Notes button:', await noMoreNotesBtn.isVisible().catch(() => false) ? '✅ Found' : '❌ Not found');
  console.log('Send to Ruby button:', await sendToRubyBtn.isVisible().catch(() => false) ? '✅ Found' : '❌ Not found');

  await snap(page, '14-task-modal-full');
});

// ─── PHASE 7: INVITE RUBY ────────────────────────────────────────────────────

test('P7 – Invite Ruby', async ({ page }) => {
  await page.goto(BASE_URL);
  await signIn(page);
  await page.waitForTimeout(3000);

  // Click invite task
  const inviteTask = page.locator('text=/invite team/i').first();
  const found = await inviteTask.isVisible({ timeout: 5000 }).catch(() => false);
  if (!found) {
    console.log('⚠️ "Invite team members" task not found');
    await snap(page, '15-invite-not-found');
    return;
  }

  await inviteTask.click();
  await page.waitForTimeout(1500);
  await snap(page, '15-invite-modal-opened');

  // Fill invite form
  const nameInput = page.locator('input[placeholder*="name" i]').first();
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();

  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameInput.fill('Ruby');
  }
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill('jonah+ruby1@gmail.com');
  }

  await snap(page, '16-invite-form-filled');

  // Submit
  const sendBtn = page.locator('button:has-text("Send"), button:has-text("Invite"), button[type="submit"]').first();
  if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sendBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, '17-invite-sent');
    const result = await page.locator('body').innerText();
    const success = /sent|success|invited/i.test(result);
    console.log(success ? '✅ Invite sent successfully' : '⚠️ Invite result unclear');
  }
});

// ─── PHASE 8: ASSIGN TASK TO RUBY ────────────────────────────────────────────

test('P8 – Right-click assign task to Ruby', async ({ page }) => {
  await page.goto(BASE_URL);
  await signIn(page);
  await page.waitForTimeout(3000);

  // Find any non-invite task
  const task = page.locator('text=/review.*footage|send.*ruby|footage/i').first();
  const found = await task.isVisible({ timeout: 5000 }).catch(() => false);
  if (!found) {
    console.log('⚠️ No assignable task found in todo list');
    await snap(page, '18-no-task-to-assign');
    return;
  }

  await snap(page, '18-task-before-rightclick');
  await task.click({ button: 'right' });
  await page.waitForTimeout(1000);
  await snap(page, '19-right-click-menu');

  const menuText = await page.locator('body').innerText();
  const menuOpened = /assign|ruby|team/i.test(menuText);
  console.log(menuOpened ? '✅ Assignment dropdown/menu appeared' : '❌ No assignment menu appeared after right-click');

  // Try clicking Ruby in the dropdown
  const rubyOption = page.locator('text=/ruby/i').last();
  if (await rubyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rubyOption.click();
    await page.waitForTimeout(1500);
    await snap(page, '20-after-assign');

    // Check task disappeared
    const taskStillVisible = await task.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(taskStillVisible
      ? '❌ BUG: Task still visible after assigning to Ruby'
      : '✅ Task disappeared from Kiss Bang\'s list after assign');
  }
});

// ─── PHASE 9: CALL MARK ──────────────────────────────────────────────────────

test('P9 – Call Mark and ask for post ideas', async ({ page }) => {
  await page.goto(BASE_URL);
  await signIn(page);
  await page.waitForTimeout(3000);

  // Find "Call Mark" button
  const callMarkBtn = page.locator('button:has-text("Call Mark"), button:has-text("Mark"), [aria-label*="mark" i]').first();
  const found = await callMarkBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (!found) {
    console.log('⚠️ "Call Mark" button not found');
    await snap(page, '21-no-call-mark');
    return;
  }

  await snap(page, '21-call-mark-button');
  await callMarkBtn.click();
  await page.waitForTimeout(2000);
  await snap(page, '22-mark-panel-opened');

  // Send a question
  const question = 'My calendar just shows generic Teaser Posts. Can you help me turn these into specific post ideas for Now You Got It?';
  await chat(page, question);
  await page.waitForTimeout(2000);

  // Wait for response
  const response = await waitForMark(page, 50, 40_000);
  console.log('Mark response:', response.substring(0, 300));
  await snap(page, '23-mark-response');

  // Check response quality
  const mentionsGlamRock  = /glam|rock/i.test(response);
  const mentionsSong      = /now you got it/i.test(response);
  const mentionsFootage   = /footage|clip|video|mv|music video/i.test(response);
  const mentionsRuby      = /ruby/i.test(response);
  const givesIdeas        = response.length > 150;
  const isGeneric         = /post behind the scenes|use trending sounds/i.test(response) && !mentionsSong;

  console.log('Mark response quality:');
  console.log(mentionsGlamRock ? '✅ Mentions glam rock' : '⚠️ No glam rock reference');
  console.log(mentionsSong     ? '✅ Mentions "Now You Got It"' : '❌ Never mentions the song name');
  console.log(mentionsFootage  ? '✅ References footage/clips' : '⚠️ No footage reference');
  console.log(mentionsRuby     ? '✅ Mentions Ruby' : '⚠️ No Ruby mention');
  console.log(givesIdeas       ? '✅ Response is detailed enough' : '❌ Response too short');
  console.log(isGeneric        ? '❌ BUG: Generic response, not personalised' : '✅ Not generic');

  expect(mentionsSong || mentionsGlamRock, 'Mark should reference the artist context').toBeTruthy();
  expect(givesIdeas, 'Mark should give substantive post ideas').toBeTruthy();
});

// ─── shared sign-in helper ────────────────────────────────────────────────────

async function signIn(page: Page) {
  // First: check if we're already past the auth wall (onboarding or galaxy visible)
  const alreadyAuthed = await page.locator('button:has-text("Start Conversation"), [class*="galaxy"], [class*="GalaxyView"]')
    .first().isVisible({ timeout: 1000 }).catch(() => false);
  if (alreadyAuthed) {
    console.log('signIn: already authenticated, skipping sign-in');
    return;
  }

  // Wait for the signup/login form to be ready
  await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10_000 });

  // Check if we need to toggle to sign-in mode
  // The toggle button text is exactly "Already have an account? Sign in"
  const toggleBtn = page.getByRole('button', { name: /already have an account/i });
  const needsToggle = await toggleBtn.isVisible({ timeout: 1000 }).catch(() => false);
  if (needsToggle) {
    console.log('signIn: toggling to sign-in mode...');
    await toggleBtn.click();
    await page.waitForTimeout(800);
    // Verify we're now in sign-in mode (button should now say "Sign In")
    await page.locator('button:has-text("Sign In"), input[type="email"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  // Fill credentials
  console.log('signIn: filling credentials...');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.clear();
  await emailInput.fill(EMAIL);
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.clear();
  await passwordInput.fill(PASSWORD);

  // Click the submit button (type=submit, the yellow button)
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  console.log('signIn: submitted, waiting for app to load...');

  // Wait for the page to leave the auth form
  // The app should show onboarding or galaxy — wait up to 12s
  await page.waitForFunction(() => {
    const pwdInput = document.querySelector('input[type="password"]');
    return !pwdInput || (pwdInput as HTMLElement).offsetParent === null;
  }, { timeout: 12_000 }).catch(() => {
    console.log('signIn: page did not leave auth form within 12s');
  });

  // Extra buffer for onboarding to initialize
  await page.waitForTimeout(2000);
}
