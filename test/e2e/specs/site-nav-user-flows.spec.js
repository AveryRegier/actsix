import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('site nav user flows', () => {
  test('goBack falls back to index page when no referrer exists', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');
    await page.evaluate(() => {
      if (typeof window.goBack === 'function') {
        window.goBack();
      }
    });

    await expect(page).toHaveURL(/(?:\/|index\.html)$/);
  });

  test('addNavLink appends custom links to desktop and mobile nav extras', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');
    await page.evaluate(() => {
      if (typeof window.addNavLink === 'function') {
        window.addNavLink('<a href="/custom-test-link.html" class="nav-link custom-nav-link">Custom Link</a>');
      }
    });

    await expect(page.locator('.site-nav .nav-extra .custom-nav-link')).toHaveCount(2);
  });
});