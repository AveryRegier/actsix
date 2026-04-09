import { test, expect } from '../support/browser-coverage.js';
import {
  loginAsEmail,
  seedWorkflowScenario,
  seedStaffScenario,
  seedHelperScenario,
} from '../support/workflow-helpers.js';

test.describe('help content role filtering', () => {
  test('login help renders markdown sections and images', async ({ page }) => {
    await page.goto('/help.html?page=login');

    await expect(page.locator('#help-content h2')).toHaveCount(1);
    await expect(page.locator('#help-content h2').first()).toContainText(/logging in/i);
    await expect(page.locator('#help-content')).toContainText(/validation code/i);
    await expect(page.locator('#help-content img')).toHaveCount(3);
  });

  test('deacon sees assign-deacons and contact-history behaviors for household help', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).toContainText(/assigning deacons to a household/i);
    await expect(page.locator('#help-content')).toContainText(/viewing contact history/i);
  });

  test('staff does not see assign-deacons behavior in household help', async ({ page, request }) => {
    const scenario = await seedStaffScenario(request);
    await loginAsEmail(page, scenario.staffEmail);

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).not.toContainText(/assigning deacons to a household/i);
    await expect(page.locator('#help-content')).toContainText(/viewing contact history/i);
  });

  test('helper does not see contact-history behavior in household help', async ({ page, request }) => {
    const scenario = await seedHelperScenario(request);
    await loginAsEmail(page, scenario.helperEmail);

    await page.goto('/help.html?page=household');

    await expect(page.locator('#help-content')).toContainText(/assigning deacons to a household/i);
    await expect(page.locator('#help-content')).not.toContainText(/viewing contact history/i);
  });

  test('members help page is non-empty for deacon role', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/help.html?page=members');

    await expect(page.locator('#help-content h2')).toHaveCount(3);
    await expect(page.locator('#help-content')).toContainText(/viewing the members list/i);
  });
});
