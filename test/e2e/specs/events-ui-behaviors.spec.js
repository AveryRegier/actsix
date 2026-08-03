import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedStaffScenario } from '../support/workflow-helpers.js';

const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;

function appUrl(path) {
  return `${baseURL}${path}`;
}

function getFutureDate(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

async function seedSchedulableEventType(page, eventType, title) {
  const response = await page.request.post(appUrl('/api/events/types'), {
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
  const response = await page.request.post(appUrl('/api/events'), {
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
  test('assignments report does not show Critical section', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assign-${stamp}`;
    const eventTitle = `E2E Assignments ${stamp}`;
    const serviceDate = getFutureDate();

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    const created = await scheduleEvent(page, eventType, serviceDate, '10:00');

    await page.goto(appUrl(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`));

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
    await page.goto(appUrl('/members.html'));

    await expect(page.locator('.nav-content .schedule-event-link')).toHaveCount(0);

    await page.goto(appUrl('/'));
    const quickLinks = page.locator('div').filter({ hasText: 'Quick Link:' }).first();
    await expect(quickLinks.locator('a[href="/event-schedule.html"]')).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(appUrl('/members.html'));
    await page.locator('.nav-menu-btn').click();

    await expect(page.locator('#navMobileMenu .schedule-event-link')).toHaveCount(1);
  });
});
