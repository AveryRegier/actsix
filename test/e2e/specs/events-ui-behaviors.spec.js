import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedStaffScenario, seedWorkflowScenario } from '../support/workflow-helpers.js';

const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;

function appUrl(path) {
  return `${baseURL}${path}`;
}

function getFutureDate(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

function getNextSundayDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);
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
  test('schedule form includes typed time on submit even without clicking Add', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-multitime-${stamp}`;
    const eventTitle = `E2E Multi Time ${stamp}`;
    const serviceDate = getNextSundayDate();

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);

    await page.goto(appUrl('/event-schedule.html'));
    await page.selectOption('#eventType', eventType);
    await page.fill('#serviceDate', serviceDate);

    // Keep the first default time in the selected list, then type a second time without clicking Add.
    await page.fill('#serviceTime', '10:30');

    await page.click('#saveEventBtn');
    await expect(page).toHaveURL(/sign-ups\.html/);

    const eventsResponse = await page.request.get(appUrl(`/api/events?eventType=${encodeURIComponent(eventType)}&serviceDate=${encodeURIComponent(serviceDate)}`));
    expect(eventsResponse.ok()).toBeTruthy();
    const eventsBody = await eventsResponse.json();

    const times = (eventsBody.events || []).map(event => event.serviceTime).sort();
    expect(times).toContain('10:30');
    expect(times).toHaveLength(2);
    expect(times.some(time => time !== '10:30')).toBe(true);
  });

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
    await page.goto(appUrl('/sign-ups.html'));

    const card = page.locator('#eventsList').locator('div[style*="border:1px solid #ddd"]').filter({ hasText: eventTitle }).first();
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

    await page.goto(appUrl(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`));

    await expect(page.locator('#assignmentHeader')).not.toContainText('Critical:');
    await expect(page.locator('#assignmentsTableWrap th', { hasText: 'Critical' })).toHaveCount(0);
  });

  test('sign-ups shows one assignments button per date and opens date assignments view', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-date-assign-${stamp}`;
    const eventTitle = `E2E Date Assign ${stamp}`;
    const serviceDate = getFutureDate();

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    await scheduleEvent(page, eventType, serviceDate, '08:30');
    await scheduleEvent(page, eventType, serviceDate, '10:30');

    await page.goto(appUrl('/sign-ups.html'));

    const dateAssignmentsLink = page.locator(`#eventsList a[href*="/event-assignments.html?serviceDate=${serviceDate}"]`);
    await expect(dateAssignmentsLink).toHaveCount(1);

    await dateAssignmentsLink.click();
    await expect(page).toHaveURL(new RegExp(`event-assignments\\.html\\?serviceDate=${serviceDate}`));
    await expect(page.locator('#assignmentHeader')).toContainText('Assignments for');
    await expect(page.locator('#assignmentsTableWrap table').first()).toBeVisible();
    await expect(page.locator('#assignmentsTableWrap table').nth(1)).toBeVisible();
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
