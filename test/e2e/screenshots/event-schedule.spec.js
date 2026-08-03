import { test, expect } from '@playwright/test';
import { DEMO, highlightElement, loginAsEmail, seedDemoData, takeHelpScreenshot } from './capture-helpers.js';

function getNextSundayDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
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
    await page.locator('#serviceDate').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, serviceDate);

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