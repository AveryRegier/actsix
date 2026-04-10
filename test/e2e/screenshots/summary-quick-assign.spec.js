import { test, expect } from '@playwright/test';
import {
  seedDemoData, loginAsEmail, highlightElement, takeHelpScreenshot, DEMO
} from './capture-helpers.js';

function buildUniqueSummaryRows() {
  return [
    {
      household: {
        _id: 'hh-1',
        lastName: 'Johnson',
        primaryPhone: '515-555-0100',
        members: [
          { firstName: 'Beth', lastName: 'Johnson', phone: '515-555-0095' },
        ],
      },
      assignedDeacons: [{ firstName: 'Mark', lastName: 'Smith', tags: ['deacon'] }],
      lastContact: {
        contactType: 'visit',
        contactDate: '2026-04-07T16:00:00.000Z',
        contactedBy: [{ firstName: 'Mark', lastName: 'Smith' }],
      },
      summary: 'Hospital bedside visit at Mercy General. Reviewed upcoming discharge plan and closed with prayer for steady recovery.',
    },
    {
      household: {
        _id: 'hh-2',
        lastName: 'Anderson',
        primaryPhone: '515-555-0111',
        members: [
          { firstName: 'Clara', lastName: 'Anderson', phone: '515-555-0181' },
        ],
      },
      assignedDeacons: [{ firstName: 'Mark', lastName: 'Smith', tags: ['deacon'] }],
      lastContact: {
        contactType: 'phone',
        contactDate: '2026-04-06T14:30:00.000Z',
        contactedBy: [{ firstName: 'Mark', lastName: 'Smith' }],
      },
      summary: 'Phone check-in confirmed transportation to Tuesday cardiology appointment and arranged meal support for two evenings.',
    },
    {
      household: {
        _id: 'hh-3',
        lastName: 'Martinez',
        primaryPhone: '515-555-0122',
        members: [
          { firstName: 'Rosa', lastName: 'Martinez', phone: '515-555-0192' },
        ],
      },
      assignedDeacons: [{ firstName: 'Mark', lastName: 'Smith', tags: ['deacon'] }],
      lastContact: {
        contactType: 'text',
        contactDate: '2026-04-05T12:15:00.000Z',
        contactedBy: [{ firstName: 'Mark', lastName: 'Smith' }],
      },
      summary: 'Text follow-up noted improved appetite, refill completed, and request for prayer before oncology consult this Friday.',
    },
  ];
}

test.describe('contact-summary and quick-contact screenshots', () => {
  test('capture contact summary table', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    const mockSummary = buildUniqueSummaryRows();
    await page.route('**/api/reports/summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: mockSummary }),
      });
    });

    await page.goto('/contact-summary.html');
    await page.waitForLoadState('networkidle');
    await takeHelpScreenshot(page, 'contact-summary-table.png');
  });

  test('capture summary filter', async ({ page, request }) => {
    await seedDemoData(request);
    await loginAsEmail(page, DEMO.deaconEmail);

    const mockSummary = buildUniqueSummaryRows();
    await page.route('**/api/reports/summary', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: mockSummary }),
      });
    });

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

    const fakeDeacons = [
      { _id: 'fake-1', firstName: 'Ethan', lastName: 'Parker', tags: ['deacon'] },
      { _id: 'fake-2', firstName: 'Noah', lastName: 'Bennett', tags: ['deacon'] },
      { _id: 'fake-3', firstName: 'Caleb', lastName: 'Turner', tags: ['deacon'] },
      { _id: 'fake-4', firstName: 'Liam', lastName: 'Foster', tags: ['deacon'] },
    ];

    await page.route('**/api/deacons**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deacons: fakeDeacons, count: fakeDeacons.length }),
      });
    });

    await page.route(`**/api/households/${ids.memberHHId}/assignments`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [{ householdId: ids.memberHHId, deaconMemberId: 'fake-1', isActive: true }],
        }),
      });
    });

    await page.goto(`/assign-deacons.html?householdId=${ids.memberHHId}`);
    await page.waitForLoadState('networkidle');

    await page.setViewportSize({ width: 1000, height: 360 });

    const deaconList = page.locator('#deaconList');
    await expect(deaconList).toBeVisible();
    const rows = deaconList.locator('div');
    await expect(rows).toHaveCount(4);

    const renderedNames = (await rows.allTextContents()).map(text => text.trim());
    expect(new Set(renderedNames).size).toBe(renderedNames.length);

    await highlightElement(page, deaconList, 'green');
    await takeHelpScreenshot(page, 'assign-deacons-list.png');
  });
});
