import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('help links', () => {
  test('login page includes pre-auth help link', async ({ page }) => {
    await page.goto('/email-login.html');

    const helpLink = page.getByRole('link', { name: /need help logging in\?/i });
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', '/help.html?page=login');
  });

  test('members nav includes page-specific help link', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');

    const helpLink = page.locator('#siteNavHelpLink');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', /\/help\.html\?page=members$/);
  });

  test('clicking members help nav opens members help page', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');

    await page.locator('#site-nav-container #siteNavHelpLink').click();
    await expect(page).toHaveURL(/\/help\.html\?page=members$/);
    await expect(page.locator('#help-content')).toBeVisible();
  });

  test('contact summary nav includes correct help link', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/contact-summary.html');

    const helpLink = page.locator('#siteNavHelpLink');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', /\/help\.html\?page=contact-summary$/);
  });

  test('help page nav help link points to help index', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/help.html?page=members');

    const helpLink = page.locator('#siteNavHelpLink');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toHaveAttribute('href', /\/help\.html\?page=help-index$/);

    await helpLink.click();
    await expect(page).toHaveURL(/\/help\.html\?page=help-index$/);
    await expect(page.locator('#help-content')).toContainText(/help index/i);
  });
});
