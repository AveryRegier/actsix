import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('index inline behavior characterization', () => {
  test('index loads nav markup and reports connected api status', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/index.html');

    await expect(page.locator('#site-nav-container .site-nav')).toBeVisible();
    await expect(page.locator('#api-status')).toHaveClass(/connected/);
    await expect(page.locator('#api-status-text')).toHaveText(/Connected to server/i);
  });
});
