import { test, expect } from '@playwright/test';
import { DEMO, highlightElement, loginAsEmail, seedDemoData, takeHelpScreenshot } from './capture-helpers.js';

function getNextSundayDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);
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
        { positionId: 'P1', label: 'Front', priority: 1, isCritical: true },
        { positionId: 'P2', label: 'Back', priority: 2, isCritical: false }
      ],
      isActive: true
    }
  });

  expect(response.ok()).toBeTruthy();
}

test.describe('event assignments help screenshots', () => {
  test('capture event assignments event view', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assignments-help-${stamp}`;
    const eventTitle = `E2E Assignments Help ${stamp}`;
    const serviceDate = getNextSundayDate();

    await seedDemoData(request);
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

    await highlightElement(page, assignmentHeader, 'green');
    await highlightElement(page, printButton, 'orange');
    await takeHelpScreenshot(page, 'event-assignments-event.png');
  });
});