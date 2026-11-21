import { defineConfig } from '@playwright/test';

// These interaction tests need the deterministic in-memory catalogue used by Vite
// development mode. Production build and HTTP smoke tests remain separate CI gates.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/tour-detail-booking-ux.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
