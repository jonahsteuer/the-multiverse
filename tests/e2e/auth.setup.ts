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
  setup.setTimeout(120_000); // sign-in + galaxy navigation can take ~60-90s
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Switch to sign-in form if needed
  const loginLink = page.locator('button:has-text("log in"), button:has-text("Already have an account")').first();
  if (await loginLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(500);
  }

  await page.locator('#email, input[type="email"]').first().fill(EMAIL);
  await page.locator('#password, input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  // Navigate through any intermediate screens until we reach the galaxy view
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const onGalaxy = await page.locator('text=Todo List').isVisible({ timeout: 2_000 }).catch(() => false);
    if (onGalaxy) break;

    const contBtn = page.locator('button:has-text("Continue →"), button:has-text("Continue")').first();
    if (await contBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await contBtn.click();
      await page.waitForTimeout(2_000);
      continue;
    }

    const navBtn = page.locator('button:has-text("View Calendar"), button:has-text("View my universe"), button:has-text("Let\'s go")').first();
    if (await navBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await navBtn.click();
      await page.waitForTimeout(2_000);
      continue;
    }

    await page.waitForTimeout(1_500);
  }

  await expect(page.locator('text=Todo List')).toBeVisible({ timeout: 10_000 });
  console.log('✅ Auth setup complete — galaxy view reached');

  // Save session to disk — all tests will start from this state
  await page.context().storageState({ path: SESSION_FILE });
  console.log(`💾 Session saved to ${SESSION_FILE}`);
});
