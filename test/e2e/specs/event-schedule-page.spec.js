import { test, expect } from '../support/browser-coverage.js';

test.describe('event schedule page (site-only)', () => {
  test('event schedule page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/event-schedule.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });
});
