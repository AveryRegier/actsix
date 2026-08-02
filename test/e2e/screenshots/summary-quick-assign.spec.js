import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

async function setWideSummaryDesktopViewport(page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 600) {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
}

async function setDesktopOnlyAssignViewport(page) {
  const viewport = page.viewportSize();
  if (!viewport || viewport.width > 600) {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
}

test.describe('contact-summary and quick-contact screenshots', () => {
  test('capture contact summary table', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await setWideSummaryDesktopViewport(page);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'contact-summary-table.png');
  });

  test('capture summary filter', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await setWideSummaryDesktopViewport(page);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    const assignmentFilter = page.locator('#assignmentFilter');
    await expect(assignmentFilter).toBeVisible();
    await highlightElement(page, assignmentFilter, 'blue');
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

    await setDesktopOnlyAssignViewport(page);
    await page.goto(`/assign-deacons.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const deaconList = page.locator('#deaconList');
    await expect(deaconList).toBeVisible();
    await takeHelpScreenshot(page, 'assign-deacons-list.png');
  });

  test('capture assign deacons form with selection', async ({ page, request }) => {
    const ids = await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await setDesktopOnlyAssignViewport(page);
    await page.goto(`/assign-deacons.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    const deaconToSelect = page.locator('#deaconList label').first();
    await deaconToSelect.click();

    await takeHelpScreenshot(page, 'assign-deacons-selection.png');
  });
});
