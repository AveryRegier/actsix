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

function getNextSundayDate() {
  const date = new Date();
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);
  return date.toISOString().split('T')[0];
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

test.describe('event schedule page', () => {
  test('updates selected service times when defaults are changed and user edits list', async ({ page, request }) => {
    const staff = await seedStaffScenario(request);
    await loginAsEmail(page, staff.staffEmail);

    await page.goto(appUrl('/event-schedule.html'));

    const baseDate = new Date();
    const targetDate = baseDate.getDay() === 0
      ? getLocalDateString(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1))
      : getNextSundayDate();
    await page.locator('#serviceDate').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, targetDate);

    const expectedDefaults = await page.evaluate((value) => {
      const date = new Date(`${value}T12:00:00`);
      return date.getDay() === 0 ? ['08:30', '10:30'] : ['19:00'];
    }, targetDate);

    for (const expectedTime of expectedDefaults) {
      await expect(page.locator('#serviceTimesList')).toContainText(expectedTime);
    }
    await expect(page.locator('#serviceTimesHelp')).toContainText(`${expectedDefaults.length} ${expectedDefaults.length === 1 ? 'time' : 'times'} selected.`);

    if (expectedDefaults.length > 1) {
      await page.locator(`[data-remove-service-time="${expectedDefaults[1]}"]`).click();
      await expect(page.locator('#serviceTimesList')).not.toContainText(expectedDefaults[1]);
      await expect(page.locator('#serviceTimesHelp')).toContainText('1 time selected.');
    }

    await page.fill('#serviceTime', '09:45');
    await page.click('#addServiceTimeBtn');

    await expect(page.locator('#serviceTimesList')).toContainText('09:45');
    await expect(page.locator('#serviceTimesHelp')).toContainText('2 times selected.');
  });

  test('includes typed time on submit without Add click and shows created events in sign-ups', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-schedule-submit-${stamp}`;
    const eventTitle = `E2E Schedule Submit ${stamp}`;
    const serviceDate = getNextSundayDate();

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);

    await page.goto(appUrl('/event-schedule.html'));
    await page.selectOption('#eventType', eventType);

    await page.locator('#serviceDate').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, serviceDate);

    await page.fill('#serviceTime', '11:15');
    await page.click('#saveEventBtn');

    await expect(page).toHaveURL(/sign-ups\.html/);

    const eventsResponse = await page.request.get(appUrl(`/api/events?eventType=${encodeURIComponent(eventType)}&serviceDate=${encodeURIComponent(serviceDate)}`));
    expect(eventsResponse.ok()).toBeTruthy();
    const eventsBody = await eventsResponse.json();

    const times = (eventsBody.events || []).map(event => event.serviceTime).sort();
    expect(times).toContain('11:15');
    expect(times.length).toBeGreaterThanOrEqual(2);

    const createdCard = page.locator('#eventsList .signups-event-card').filter({ hasText: eventTitle }).first();
    await expect(createdCard).toBeVisible();
  });

  test('blocks submit when event type is not selected', async ({ page, request }) => {
    const staff = await seedStaffScenario(request);
    await loginAsEmail(page, staff.staffEmail);

    await page.goto(appUrl('/event-schedule.html'));

    const weekday = getFutureDate(16);
    await page.locator('#serviceDate').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, weekday);

    const eventTypeValidity = await page.locator('#eventType').evaluate((el) => el.checkValidity());
    expect(eventTypeValidity).toBe(false);

    await page.click('#saveEventBtn');
    await expect(page).toHaveURL(/event-schedule\.html/);
  });
});
