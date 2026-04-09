import { test } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

test.describe('contact-summary and quick-contact screenshots', () => {
  test('capture contact summary table', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'contact-summary-table.png');
  });

  test('capture summary filter', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    await highlightElement(page, page.locator('#assignmentFilter'), 'blue');
    await takeHelpScreenshot(page, 'contact-summary-filter.png');
  });

  test('capture quick contact list', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/deacon-quick-contact.html?deaconMemberId=${ids.deaconId}`);
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'quick-contact-list.png');
  });

  test('capture assign deacons list', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);
    await page.goto(`/assign-deacons.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');
    await highlightElement(page, page.locator('#deaconList'), 'green');
    await takeHelpScreenshot(page, 'assign-deacons-list.png');
  });
});
