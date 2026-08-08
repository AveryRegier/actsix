import { test, expect } from '../support/browser-coverage.js';

test.describe('storage simulator smoke (site-only)', () => {
  test('index page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ActSix|Deacon|Login/i);
  });
});
