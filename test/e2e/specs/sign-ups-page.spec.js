import { test, expect } from '../support/browser-coverage.js';
import { apiPost, loginAsEmail, seedStaffScenario, seedWorkflowScenario } from '../support/workflow-helpers.js';

const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${Number(process.env.E2E_PORT || 3101)}`;

function appUrl(path) {
  return `${baseURL}${path}`;
}

function getFutureDate(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

async function seedSignupsEventType(request, eventType, title) {
  const response = await apiPost(request, '/api/events/types', {
    eventType,
    title,
    allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
    assignmentRoles: ['deacon', 'staff'],
    assigneeRoles: ['deacon', 'staff', 'elder', 'usher'],
    defaultPositions: [
      { positionId: 'P1', label: 'Front', priority: 1, isCritical: true },
      { positionId: 'P2', label: 'Back', priority: 2, isCritical: false }
    ],
    isActive: true
  });

  expect(response.ok()).toBeTruthy();
}

async function scheduleEvent(request, eventType, serviceDate, serviceTime) {
  const response = await apiPost(request, '/api/events', {
    eventType,
    serviceDate,
    serviceTime,
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function seedElderScenario(request) {
  const stamp = Date.now();
  const householdRes = await apiPost(request, '/api/households', {
    lastName: `SignupsElderHH-${stamp}`,
  });
  expect(householdRes.ok()).toBeTruthy();
  const household = await householdRes.json();

  const elderEmail = `signups-elder-${stamp}@example.test`;
  const elderRes = await apiPost(request, '/api/members', {
    householdId: household.id,
    firstName: 'Elder',
    lastName: `User${stamp}`,
    relationship: 'head',
    gender: 'male',
    email: elderEmail,
    phone: '515-555-0888',
    tags: ['elder'],
  });
  expect(elderRes.ok()).toBeTruthy();

  return { elderEmail };
}

test.describe('sign ups page', () => {
  test('renders upcoming events grouped by date with status metadata', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-group-${stamp}`;
    const eventTitle = `E2E Sign Ups Grouping ${stamp}`;
    const dateA = getFutureDate(14);
    const dateB = getFutureDate(15);

    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await seedSignupsEventType(request, eventType, eventTitle);
    await scheduleEvent(request, eventType, dateA, '08:30');
    await scheduleEvent(request, eventType, dateA, '10:00');
    await scheduleEvent(request, eventType, dateB, '09:15');

    await page.goto(appUrl('/sign-ups.html'));

    const matchingCards = page.locator('#eventsList .signups-event-card').filter({ hasText: eventTitle });
    const matchingGroups = page.locator('.signups-date-group').filter({
      has: page.locator('.signups-event-card', { hasText: eventTitle })
    });
    await expect(matchingGroups).toHaveCount(2);
    await expect(matchingCards).toHaveCount(3);

    const firstCard = matchingCards.first();
    await expect(firstCard).toContainText('Filled: 0/2');
    await expect(firstCard).toContainText('Your status: Not responded');

    const dateAssignmentsLinks = page.locator(`#eventsList a[href*="/event-assignments.html?serviceDate=${dateA}"]`);
    await expect(dateAssignmentsLinks).toHaveCount(1);
  });

  test('updates availability and keeps only the opposite action visible', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-toggle-${stamp}`;
    const eventTitle = `E2E Sign Ups Toggle ${stamp}`;
    const serviceDate = getFutureDate(21);

    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await seedSignupsEventType(request, eventType, eventTitle);
    const created = await scheduleEvent(request, eventType, serviceDate, '09:00');

    await page.goto(appUrl('/sign-ups.html'));

    const card = page.locator('#eventsList .signups-event-card').filter({ hasText: eventTitle }).first();
    const availableButton = card.locator('.signup-action-btn[data-available="true"]');
    const unavailableButton = card.locator('.signup-action-btn[data-available="false"]');

    await expect(availableButton).toHaveCount(1);
    await expect(unavailableButton).toHaveCount(1);

    await availableButton.click();
    await expect(page.locator('#pageMessage')).toContainText('Availability updated.');
    await expect(card).toContainText('Your status: Available');
    await expect(availableButton).toHaveCount(0);
    await expect(unavailableButton).toHaveCount(1);

    await page.reload();

    const cardAfterReload = page.locator('#eventsList .signups-event-card').filter({ hasText: eventTitle }).first();
    const availableAfterReload = cardAfterReload.locator('.signup-action-btn[data-available="true"]');
    const unavailableAfterReload = cardAfterReload.locator('.signup-action-btn[data-available="false"]');
    await expect(cardAfterReload).toContainText('Your status: Available');
    await expect(availableAfterReload).toHaveCount(0);
    await expect(unavailableAfterReload).toHaveCount(1);

    await unavailableAfterReload.click();
    await expect(page.locator('#pageMessage')).toContainText('Availability updated.');
    await expect(cardAfterReload).toContainText('Your status: Marked unavailable');
    await expect(cardAfterReload.locator('.signup-action-btn[data-available="true"]')).toHaveCount(1);
    await expect(cardAfterReload.locator('.signup-action-btn[data-available="false"]')).toHaveCount(0);

    const memberAssignmentsResponse = await page.request.get(appUrl('/api/member/assignments'));
    expect(memberAssignmentsResponse.ok()).toBeTruthy();
    const assignmentBody = await memberAssignmentsResponse.json();
    const matching = (assignmentBody || []).find(row => row?.event?._id === created.id);
    expect(matching).toBeTruthy();
    expect(matching.signup).toBeTruthy();
    expect(matching.signup.isAvailable).toBe(false);
  });

  test('shows date assignments link for staff and opens date assignments view', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-assignments-${stamp}`;
    const eventTitle = `E2E Sign Ups Assignments ${stamp}`;
    const serviceDate = getFutureDate(28);

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSignupsEventType(request, eventType, eventTitle);
    await scheduleEvent(request, eventType, serviceDate, '08:30');
    await scheduleEvent(request, eventType, serviceDate, '10:30');

    await page.goto(appUrl('/sign-ups.html'));

    const staffAssignmentsLink = page.locator(`#eventsList a[href*="/event-assignments.html?serviceDate=${serviceDate}"]`);
    await expect(staffAssignmentsLink).toHaveCount(1);
    await staffAssignmentsLink.click();

    await expect(page).toHaveURL(new RegExp(`event-assignments\\.html\\?serviceDate=${serviceDate}`));
    await expect(page.locator('#assignmentHeader')).toContainText('Assignments for');
  });

  test('hides date assignments link for elder role', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-signups-elder-${stamp}`;
    const eventTitle = `E2E Sign Ups Elder ${stamp}`;
    const serviceDate = getFutureDate(35);

    const elder = await seedElderScenario(request);
    await seedSignupsEventType(request, eventType, eventTitle);
    await scheduleEvent(request, eventType, serviceDate, '09:45');

    await loginAsEmail(page, elder.elderEmail);
    await page.goto(appUrl('/sign-ups.html'));

    const elderAssignmentsLink = page.locator(`#eventsList a[href*="/event-assignments.html?serviceDate=${serviceDate}"]`);
    await expect(elderAssignmentsLink).toHaveCount(0);
  });
});
