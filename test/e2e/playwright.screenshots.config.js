import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

const port = Number(process.env.SCREENSHOTS_PORT || 3102);
const baseURL = `http://127.0.0.1:${port}`;
const rootDir = process.cwd();

export default defineConfig({
  testDir: path.join(rootDir, 'test', 'e2e', 'screenshots'),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'off',
  },
  webServer: {
    command: 'node --import ./test/harness/s3-sim-bootstrap.mjs src/server.js',
    cwd: rootDir,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      USE_S3_SIMULATOR: '1',
      USE_FAKE_MAILER: '1',
      FAKE_MAILBOX_FILE: path.join(rootDir, 'test-results', 'fake-mailbox.json'),
      JWT_SECRET: 'actsix-e2e-secret',
      APP_NAME: 'ActSix Screenshots',
      GENERATION_API_KEY: 'test-generation-key',
      GMAIL_FROM_ADDRESS: 'e2e@example.local',
      GMAIL_APP_PASSWORD: 'e2e-not-used',
      S3_BUCKET: 'deacon-care-system-screenshots',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
