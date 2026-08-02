import { test, expect } from '@playwright/test';
import { DEMO, highlightElement, loginAsEmail, seedDemoData, takeHelpScreenshot } from './capture-helpers.js';

function getFutureDate(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

async function seedEventType(page, eventType, title) {
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

async function createEvent(page, eventType, serviceDate, serviceTime = '09:00') {
  const response = await page.request.post('/api/events', {
    headers: { 'content-type': 'application/json' },
    data: {
      eventType,
      serviceDate,
      serviceTime
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.id).toBeTruthy();
  return body;
}

test.describe('sign ups help screenshots', () => {
  test('capture sign ups availability', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-help-${stamp}`;
    const eventTitle = `E2E Sign Ups Help ${stamp}`;
    const serviceDate = getFutureDate();

    await seedDemoData(request);
    await loginAsEmail(page, DEMO.staffEmail);
    await seedEventType(page, eventType, eventTitle);
    await createEvent(page, eventType, serviceDate, '09:00');

    await page.goto('/sign-ups.html');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#eventsList')).toContainText(eventTitle);

    const availableButton = page.locator('#eventsList .signup-action-btn[data-available="true"]').first();
    const unavailableButton = page.locator('#eventsList .signup-action-btn[data-available="false"]').first();
    await expect(availableButton).toBeVisible();
    await expect(unavailableButton).toBeVisible();

    await highlightElement(page, availableButton, 'blue');
    await highlightElement(page, unavailableButton, 'orange');
    await takeHelpScreenshot(page, 'sign-ups-availability.png');
  });
});