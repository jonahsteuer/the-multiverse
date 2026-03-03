import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,          // 60s per test (was 3 min — most tests don't need that)
  expect: { timeout: 10_000 },
  fullyParallel: false,     // sequential so accounts don't collide
  retries: 0,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports', open: 'never' }], // don't auto-open
    ['list'],
  ],
  use: {
    baseURL: 'https://the-multiverse.vercel.app',
    headless: false,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',  // was 'on' — saves time writing files
    video: 'retain-on-failure',     // was 'on' — video for every test was slow
    trace: 'retain-on-failure',     // was 'on'
    actionTimeout: 15_000,
    // Reuse the saved auth session so tests don't sign in every time
    storageState: 'tests/e2e/.auth/kb3-session.json',
  },
  projects: [
    {
      // One-time setup: sign in and save session to disk
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/empty-session.json', // no auth — must sign in fresh
        launchOptions: { args: ['--mute-audio'] },
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--mute-audio'] },
      },
      dependencies: ['setup'], // setup runs first, then all other tests share its session
    },
  ],
});
