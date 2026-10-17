import { test, expect } from '@playwright/test';
import { DEMO, highlightElement, loginAsEmail, seedDemoData, takeHelpScreenshot } from './capture-helpers.js';

function getNextSundayDate(weeksAhead = 0) {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday + weeksAhead * 7);
  return date.toISOString().split('T')[0];
}

async function seedSchedulableEventType(page, eventType, title) {
  const response = await page.request.post('/api/events/types', {
    headers: { 'content-type': 'application/json' },
    data: {
      eventType,
      title,
      allowedRoles: ['deacon', 'staff'],
      assignmentRoles: ['deacon', 'staff'],
      defaultPositions: [
        { positionId: '4-FC', label: 'Aisle 4 Front Center', note: 'Take 2 trays', priority: 1, isCritical: true },
        { positionId: '5-FCR', label: 'Aisle 5 Front Center Right', note: 'Take 2 trays', priority: 2, isCritical: false }
      ],
      isActive: true
    }
  });

  expect(response.ok()).toBeTruthy();
}

test.describe('event assignments help screenshots', () => {
  test('capture event assignments event view', async ({ page, request }, testInfo) => {
    const stamp = Date.now();
    const eventType = `e2e-assignments-help-${stamp}`;
    const eventTitle = 'Sunday Worship Service';
    // Projects share one server, so give each its own Sunday to keep the date view to a single event.
    const serviceDate = getNextSundayDate(testInfo.project.name.includes('mobile') ? 1 : 0);

    const demo = await seedDemoData(request);
    await loginAsEmail(page, DEMO.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);

    const createResponse = await page.request.post('/api/events', {
      headers: { 'content-type': 'application/json' },
      data: {
        eventType,
        serviceDate,
        serviceTime: '09:00'
      }
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();
    expect(created.id).toBeTruthy();

    // Fill one of the two positions so the Filled badge shows a realistic partial count.
    const assignResponse = await page.request.put(`/api/events/${encodeURIComponent(created.id)}/assignments`, {
      headers: { 'content-type': 'application/json' },
      data: { assignments: [{ positionId: '4-FC', memberId: demo.deaconId }] }
    });
    expect(assignResponse.ok()).toBeTruthy();

    await page.goto(`/event-assignments.html?serviceDate=${encodeURIComponent(serviceDate)}`);
    await page.waitForLoadState('networkidle');

    await page.waitForFunction(() => {
      const header = document.getElementById('assignmentHeader');
      return Boolean(header && header.textContent && header.textContent.includes('Assignments for'));
    });

    const printButton = page.locator('#printAssignmentsBtn');
    const assignmentHeader = page.locator('#assignmentHeader');
    const assignmentsTableWrap = page.locator('#assignmentsTableWrap');

    await expect(printButton).toBeVisible();
    await expect(assignmentHeader).toBeVisible();
    await expect(assignmentsTableWrap).toBeVisible();
    await expect(page.locator('.worship-map').first()).toBeVisible();
    const filledBadge = page.getByText('Filled: 1/2');
    await expect(filledBadge).toBeVisible();
    await expect(page.locator('.assignment-edit-trigger', { hasText: DEMO.deaconFirstName })).toHaveCount(1);
    await expect(page.locator('.assignment-edit-trigger', { hasText: 'Open' })).toHaveCount(1);

    await highlightElement(page, filledBadge, 'blue');
    await highlightElement(page, assignmentHeader, 'green');
    await highlightElement(page, printButton, 'orange');
    await takeHelpScreenshot(page, 'event-assignments-event.png');

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`);
    await page.waitForLoadState('networkidle');

    const cancelButton = page.locator('.cancel-event-button');
    await expect(cancelButton).toBeVisible();
    await highlightElement(page, cancelButton, 'orange');
    await takeHelpScreenshot(page, 'event-assignments-cancel.png');
  });
});