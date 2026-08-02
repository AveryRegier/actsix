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

test.describe('event schedule help screenshots', () => {
  test('capture event schedule form', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-schedule-help-${stamp}`;
    const eventTitle = `E2E Schedule Help ${stamp}`;
    const serviceDate = getNextSundayDate();

    await seedDemoData(request);
    await loginAsEmail(page, DEMO.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);

    await page.goto('/event-schedule.html');
    await page.waitForLoadState('networkidle');

    await page.selectOption('#eventType', eventType);
    await page.locator('#serviceDate').fill(serviceDate);
    await page.locator('#serviceDate').dispatchEvent('change');

    const eventTypeSelect = page.locator('#eventType');
    const addButton = page.locator('#addServiceTimeBtn');
    const serviceTimesList = page.locator('#serviceTimesList');

    await expect(eventTypeSelect).toBeVisible();
    await expect(addButton).toBeVisible();
    await expect(serviceTimesList).toContainText('08:30');
    await expect(serviceTimesList).toContainText('10:30');

    await highlightElement(page, eventTypeSelect, 'blue');
    await highlightElement(page, addButton, 'orange');
    await takeHelpScreenshot(page, 'event-schedule-form.png');
  });
});