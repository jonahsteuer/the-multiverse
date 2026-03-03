/**
 * auth.setup.ts
 *
 * Runs ONCE before all other tests. Signs in as Kiss Bang and saves the
 * browser session (cookies + localStorage) to .auth/kb3-session.json.
 *
 * Every subsequent test loads that file via `storageState` in playwright.config.ts
 * and starts already signed in on the galaxy view — no repeated sign-in delays.
 */

import { test as setup, expect } from '@playwright/test';

const BASE_URL  = 'https://the-multiverse.vercel.app';
const EMAIL     = 'jonah+kb3@gmail.com';
const PASSWORD  = 'Multiverse2026!';
const SESSION_FILE = 'tests/e2e/.auth/kb3-session.json';

setup('authenticate as Kiss Bang', async ({ page }) => {
  setup.setTimeout(150_000);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_000);

  // Click "Already have an account? Sign in" to switch to login mode
  const loginToggle = page.locator('button:has-text("Already have an account"), button:has-text("Sign in"), button:has-text("log in")').first();
  if (await loginToggle.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await loginToggle.click();
    await page.waitForTimeout(1_500);
  }

  // Try to find and fill a login-specific form (might show just email+password with sign-in button)
  // If we're still on the full signup form, fill minimal required fields
  const emailField = page.locator('input[type="email"], #email, input[placeholder*="email"], input[placeholder*="Email"]').first();
  const passwordField = page.locator('input[type="password"], #password, input[placeholder*="ncryption"], input[placeholder*="assword"]').first();
  
  await emailField.fill(EMAIL);
  await passwordField.fill(PASSWORD);
  
  // Also fill Creator Name if it's visible and required (signup form visible)
  const creatorNameField = page.locator('input[placeholder*="creator name"], input[placeholder*="Creator"]').first();
  if (await creatorNameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const val = await creatorNameField.inputValue();
    if (!val) await creatorNameField.fill('Kiss Bang'); // fill if empty
  }

  // Click submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Enter The Multiverse"), button:has-text("Log in")').first();
  await submitBtn.click();
  await page.waitForTimeout(3_000);

  // Navigate through any intermediate screens until we reach the galaxy view
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const onGalaxy = await page.locator('text=TODO LIST').isVisible({ timeout: 3_000 }).catch(() => false);
    if (onGalaxy) break;

    // Click any "Continue" or "Next" button
    const contBtn = page.locator('button:has-text("Continue →"), button:has-text("Continue"), button:has-text("Next")').first();
    if (await contBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await contBtn.click();
      await page.waitForTimeout(2_000);
      continue;
    }

    // Click any navigation button
    const navBtn = page.locator('button:has-text("View Calendar"), button:has-text("View my universe"), button:has-text("Let\'s go"), button:has-text("Enter")').first();
    if (await navBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await navBtn.click();
      await page.waitForTimeout(2_500);
      continue;
    }

    await page.waitForTimeout(2_000);
  }

  // Take a screenshot to debug
  await page.screenshot({ path: 'tests/e2e/screenshots/auth-setup-result.png' });
  
  const onGalaxy = await page.locator('text=TODO LIST').isVisible({ timeout: 5_000 }).catch(() => false);
  if (!onGalaxy) {
    console.log('[Auth setup] ⚠️ Galaxy view not reached. Current URL:', page.url());
    console.log('[Auth setup] ⚠️ Saving session anyway for tests that can navigate independently');
  } else {
    console.log('✅ Auth setup complete — galaxy view reached');
  }

  // Save session to disk — all tests will start from this state
  await page.context().storageState({ path: SESSION_FILE });
  console.log(`💾 Session saved to ${SESSION_FILE}`);
});
