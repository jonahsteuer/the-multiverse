import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180_000,         // 3 min per test — AI chat responses can be slow
  expect: { timeout: 15_000 },
  fullyParallel: false,     // run sequentially so accounts don't collide
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports', open: 'always' }],
    ['list'],
  ],
  use: {
    baseURL: 'https://the-multiverse.vercel.app',
    headless: false,          // watch it run live
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',         // screenshot on every step
    video: 'on',              // full video recording
    trace: 'on',
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--mute-audio'],
        },
      },
    },
  ],
});
