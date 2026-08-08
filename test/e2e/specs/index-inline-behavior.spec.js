import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

test.describe('index inline behavior characterization', () => {
  test('index loads nav markup and reports connected api status', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');

    await page.goto('/index.html');

    await expect(page.locator('#site-nav-container .site-nav')).toBeVisible();
    await expect(page.locator('#api-status')).toHaveClass(/connected/);
    await expect(page.locator('#api-status-text')).toHaveText(/Connected to server/i);
  });
});
