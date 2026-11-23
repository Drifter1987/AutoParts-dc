import { defineConfig, devices } from '@playwright/test';

// Unset in CI and normal installs: use Playwright's bundled Chromium.
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: true,
  // Vite's dev server and the OCR-heavy tests starve lazy route chunks at
  // higher parallelism, producing page-load timeouts unrelated to the app.
  workers: 4,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: channel ?? 'chromium',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    // A fresh server avoids stale module graphs and HMR reloads from a
    // long-lived dev server that the suite does not own.
    reuseExistingServer: false,
    timeout: 120000,
    // Keep the telemetry boundary exercised against a loopback collector. Tests
    // intercept this path and assert on the real captured payloads.
    env: {
      VITE_TELEMETRY_ENDPOINT: 'http://127.0.0.1:5174/__telemetry',
    },
  },
});
