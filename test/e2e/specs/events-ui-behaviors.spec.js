import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedStaffScenario, seedWorkflowScenario } from '../support/workflow-helpers.js';

function getFutureDate(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

async function seedSchedulableEventType(page, eventType, title) {
  const response = await page.request.post('/api/events/types', {
    headers: {
      'content-type': 'application/json',
    },
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

async function scheduleEvent(page, eventType, serviceDate, serviceTime = '09:00') {
  const response = await page.request.post('/api/events', {
    headers: {
      'content-type': 'application/json',
    },
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

test.describe('events ui behaviors', () => {
  test('sign-ups hides the already selected availability action button', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-${stamp}`;
    const eventTitle = `E2E Signups ${stamp}`;
    const serviceDate = getFutureDate();

    const staff = await seedStaffScenario(request);
    const deacon = await seedWorkflowScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    await scheduleEvent(page, eventType, serviceDate, '09:00');

    page.removeAllListeners('dialog');
    await loginAsEmail(page, deacon.deaconEmail);
    await page.goto('/sign-ups.html');

    const card = page.locator('#eventsList > div').filter({ hasText: eventTitle }).first();
    const availableButton = card.locator('.signup-action-btn[data-available="true"]');
    const unavailableButton = card.locator('.signup-action-btn[data-available="false"]');

    await expect(availableButton).toHaveCount(1);
    await expect(unavailableButton).toHaveCount(1);

    await availableButton.click();
    await expect(page.locator('#pageMessage')).toContainText('Availability updated.');

    await expect(availableButton).toHaveCount(0);
    await expect(unavailableButton).toHaveCount(1);

    await unavailableButton.click();
    await expect(page.locator('#pageMessage')).toContainText('Availability updated.');

    await expect(availableButton).toHaveCount(1);
    await expect(unavailableButton).toHaveCount(0);
  });

  test('assignments report does not show Critical section', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assign-${stamp}`;
    const eventTitle = `E2E Assignments ${stamp}`;
    const serviceDate = getFutureDate();

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    const created = await scheduleEvent(page, eventType, serviceDate, '10:00');

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`);

    await expect(page.locator('#assignmentHeader')).not.toContainText('Critical:');
    await expect(page.locator('#assignmentsTableWrap th', { hasText: 'Critical' })).toHaveCount(0);
  });

  test('schedule event link is home quick link and mobile nav only', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-nav-${stamp}`;
    const eventTitle = `E2E Nav ${stamp}`;

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/members.html');

    await expect(page.locator('.nav-content .schedule-event-link')).toHaveCount(0);

    await page.goto('/');
    const quickLinks = page.locator('div').filter({ hasText: 'Quick Link:' }).first();
    await expect(quickLinks.locator('a[href="/event-schedule.html"]')).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/members.html');
    await page.locator('.nav-menu-btn').click();

    await expect(page.locator('#navMobileMenu .schedule-event-link')).toHaveCount(1);
  });
});
