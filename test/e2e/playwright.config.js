import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const port = Number(process.env.E2E_PORT || 3101);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: path.join(process.cwd(), 'test', 'e2e', 'specs'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: 'node src/server.js',
    cwd: process.cwd(),
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      NODE_V8_COVERAGE: path.join(process.cwd(), '.coverage', 'e2e-v8'),
      JWT_SECRET: process.env.JWT_SECRET || 'actsix-e2e-secret',
      APP_NAME: process.env.APP_NAME || 'ActSix E2E',
      GMAIL_FROM_ADDRESS: process.env.GMAIL_FROM_ADDRESS || 'e2e@example.local',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || 'e2e-not-used',
      S3_BUCKET: process.env.S3_BUCKET || 'deacon-care-system-e2e',
    },
  },
  globalSetup: path.join(process.cwd(), 'test', 'e2e', 'support', 'global-setup.js'),
  globalTeardown: path.join(process.cwd(), 'test', 'e2e', 'support', 'global-teardown.js'),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
