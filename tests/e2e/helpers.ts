/**
 * Shared helpers for e2e journey tests.
 */

import { Page, expect } from '@playwright/test';

// ─── chat helpers ─────────────────────────────────────────────────────────────

/**
 * Wait for the most recent assistant bubble in the onboarding chat to
 * finish streaming (no longer changing), then return its text.
 */
export async function waitForMarkReply(page: Page, timeoutMs = 30_000): Promise<string> {
  // Wait for at least one assistant message bubble
  const bubble = page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').last();
  await bubble.waitFor({ state: 'visible', timeout: timeoutMs });

  // Poll until the text stabilises (streaming done)
  let prev = '';
  let stable = 0;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cur = await bubble.innerText().catch(() => '');
    if (cur === prev && cur.length > 10) {
      stable++;
      if (stable >= 3) return cur; // same for 3 checks → done
    } else {
      stable = 0;
    }
    prev = cur;
    await page.waitForTimeout(600);
  }
  return prev;
}

/**
 * Find the chat input, type a message, and press Enter.
 * Works for both the onboarding chat and the Mark chat panel.
 */
export async function sendChatMessage(page: Page, text: string) {
  const input = page
    .locator('input[type="text"], textarea')
    .filter({ hasText: '' })
    .last();
  await input.fill(text);
  await input.press('Enter');
}

/**
 * Go through the full onboarding conversation using the scripted responses.
 * Returns the full conversation transcript and extracted profile data.
 */
export interface OnboardingScript {
  triggerKeywords: string[];   // words Mark's message must contain before sending reply
  reply: string;
}

export async function runOnboardingScript(
  page: Page,
  script: OnboardingScript[],
  screenshotDir: string
): Promise<{ transcript: string[]; profileData: any }> {
  const transcript: string[] = [];
  let profileData: any = null;

  for (let i = 0; i < script.length; i++) {
    const step = script[i];

    // Wait until Mark says something containing the trigger keywords
    const deadline = Date.now() + 40_000;
    let markText = '';
    while (Date.now() < deadline) {
      markText = await page
        .locator('[data-role="assistant"], .assistant-message, [class*="assistant"]')
        .last()
        .innerText()
        .catch(() => '');
      const matches = step.triggerKeywords.some(kw =>
        markText.toLowerCase().includes(kw.toLowerCase())
      );
      if (matches) break;
      await page.waitForTimeout(800);
    }

    transcript.push(`Mark: ${markText}`);
    await page.screenshot({ path: `${screenshotDir}/step-${i + 1}-before-reply.png` });

    // Send the reply
    await sendChatMessage(page, step.reply);
    transcript.push(`User: ${step.reply}`);

    await page.waitForTimeout(1500); // brief pause before next check
  }

  // Wait for [ONBOARDING_COMPLETE] or final Mark message
  await page.waitForTimeout(3000);
  return { transcript, profileData };
}

// ─── assertion helpers ────────────────────────────────────────────────────────

/**
 * Find a todo list task by partial text. Returns the locator.
 */
export function findTodoTask(page: Page, partialText: string) {
  return page.locator(`text=/${partialText}/i`).first();
}

/**
 * Check that a string looks like a duration estimate, not a clock time.
 * "est. 30m" → valid. "22:10" → invalid.
 */
export function isEstimate(text: string): boolean {
  return /est\.\s*\d+/.test(text) && !/\d{2}:\d{2}/.test(text);
}

/**
 * Take a labelled screenshot.
 */
export async function snap(page: Page, label: string) {
  await page.screenshot({
    path: `tests/e2e/screenshots/${label.replace(/\s+/g, '-')}.png`,
    fullPage: false,
  });
}
