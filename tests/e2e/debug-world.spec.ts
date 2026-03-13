import { test, expect } from '@playwright/test';

const BASE_URL = 'https://the-multiverse.vercel.app';

test.use({ storageState: 'tests/e2e/.auth/kb3-session.json' });

test('debug: inspect DOM after galaxy loads', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  
  // Wait for galaxy view
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const onGalaxy = await page.locator('text=TODO LIST').isVisible({ timeout: 3_000 }).catch(() => false);
    if (onGalaxy) break;
    for (const btnText of ['Continue →', 'Continue', 'View my calendar', "Let's go", 'View Calendar', 'Enter The Multiverse']) {
      const btn = page.locator(`button:has-text("${btnText}")`).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1_500);
        break;
      }
    }
    await page.waitForTimeout(1_500);
  }

  // Wait extra time for worlds to load
  await page.waitForTimeout(10_000);
  await page.screenshot({ path: 'tests/e2e/screenshots/debug-galaxy.png' });

  // Check DOM state
  const worldBtnCount = await page.evaluate(() => document.querySelectorAll('[data-world-name]').length);
  const dataTestIdCount = await page.evaluate(() => document.querySelectorAll('[data-testid*="open-world"]').length);
  const srOnlyContent = await page.evaluate(() => {
    const div = document.querySelector('[aria-label="worlds"]');
    return div ? div.innerHTML.substring(0, 500) : 'NOT FOUND';
  });
  
  console.log('[Debug] [data-world-name] count:', worldBtnCount);
  console.log('[Debug] [data-testid*="open-world"] count:', dataTestIdCount);
  console.log('[Debug] [aria-label="worlds"] innerHTML:', srOnlyContent);

  // Current URL
  console.log('[Debug] Current URL:', page.url());

  // Check if there are any worlds shown on page
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('[Debug] Page text (first 2000 chars):', pageText);
});
