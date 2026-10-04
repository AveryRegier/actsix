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
  // Demo data has a single household, so stub several rows to make sorting visible.
  async function stubSummaryRows(page) {
    const day = 24 * 60 * 60 * 1000;
    const deacon = [{ _id: 'd1', firstName: 'Mark', lastName: 'Smith', tags: ['deacon'] }];
    const row = (id, last, first, phone, daysAgo, summary) => ({
      household: { _id: id, lastName: last, primaryPhone: phone, members: [{ _id: `${id}-m`, firstName: first }] },
      assignedDeacons: deacon,
      lastContact: daysAgo === null ? {} : {
        contactDate: new Date(Date.now() - daysAgo * day).toISOString(),
        contactType: 'phone',
        contactedBy: deacon,
      },
      summary,
    });
    await page.route('**/api/reports/summary', route => route.fulfill({
      json: {
        summary: [
          row('h1', 'Anderson', 'Carol', '515-555-0141', 10, 'Called to check in after surgery.'),
          row('h2', 'Brooks', 'Dale', '515-555-0142', null, 'No contact logged'),
          row('h3', 'Johnson', 'Beth', '515-555-0100', 1, 'Medications refilled; requested prayer.'),
          row('h4', 'Parker', 'Evelyn', '515-555-0143', 5, 'Visited at home; doing well.'),
        ],
      },
    }));
  }
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
    await stubSummaryRows(page);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    const assignmentFilter = page.locator('#assignmentFilter');
    await expect(assignmentFilter).toBeVisible();
    await highlightElement(page, assignmentFilter, 'blue');
    await highlightElement(page, page.locator('#summarySort'), 'green');
    await takeHelpScreenshot(page, 'contact-summary-filter.png');
  });

  test('capture summary sort', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    await setWideSummaryDesktopViewport(page);
    await stubSummaryRows(page);
    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    const sortSelect = page.locator('#summarySort');
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('lastContact');
    await expect(page.locator('#summaryTable tbody tr').first()).toBeVisible();
    await highlightElement(page, sortSelect, 'green');
    await takeHelpScreenshot(page, 'contact-summary-sort.png');
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
