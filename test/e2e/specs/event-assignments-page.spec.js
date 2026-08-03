import { test, expect } from '../support/browser-coverage.js';
import { apiPost, loginAsEmail, seedStaffScenario } from '../support/workflow-helpers.js';

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
      allowedRoles: ['deacon', 'staff', 'elder', 'usher'],
      assignmentRoles: ['deacon', 'staff'],
      assigneeRoles: ['deacon', 'usher'],
      quickAddAssigneeRole: 'usher',
      allowQuickAddAssignee: true,
      requiredGender: 'male',
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

async function createCandidateMember(request, { stamp, firstName, lastName, gender, tags }) {
  const householdRes = await apiPost(request, '/api/households', {
    lastName: `AssignHH-${lastName}-${stamp}`,
  });
  expect(householdRes.ok()).toBeTruthy();
  const household = await householdRes.json();

  const memberRes = await apiPost(request, '/api/members', {
    householdId: household.id,
    firstName,
    lastName,
    relationship: 'head',
    gender,
    email: `${String(firstName).toLowerCase()}-${stamp}@example.test`,
    phone: '515-555-0999',
    tags,
  });
  expect(memberRes.ok()).toBeTruthy();
  const payload = await memberRes.json();
  const normalizedId = String(payload?.id || payload?.member?._id || '');
  expect(normalizedId).toBeTruthy();
  return {
    ...payload,
    id: normalizedId,
  };
}

function assignmentRow(page, positionId) {
  return page.locator('#assignmentsTableWrap tbody tr').filter({
    has: page.locator('td:nth-child(2)', { hasText: positionId })
  }).first();
}

async function openAssignmentEditor(page, positionId) {
  const row = assignmentRow(page, positionId);
  await expect(row).toBeVisible();
  await row.locator('.assignment-edit-trigger').click();

  const modal = page.locator('#assignmentEditModal');
  await expect(modal).toBeVisible();
  return modal;
}

async function assignPositionsByApi(page, eventId, assignments) {
  const response = await page.request.put(appUrl(`/api/events/${encodeURIComponent(eventId)}/assignments`), {
    headers: {
      'content-type': 'application/json',
    },
    data: {
      assignments,
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.describe('event assignments page', () => {
  test('assigns specific people to specific positions and shows those assignments', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assign-page-${stamp}`;
    const eventTitle = `E2E Assign Page ${stamp}`;
    const serviceDate = getFutureDate(21);

    const staff = await seedStaffScenario(request);
    const personOne = await createCandidateMember(request, {
      stamp,
      firstName: 'Assign',
      lastName: `One${stamp}`,
      gender: 'male',
      tags: ['deacon']
    });
    const personTwo = await createCandidateMember(request, {
      stamp,
      firstName: 'Assign',
      lastName: `Two${stamp}`,
      gender: 'male',
      tags: ['usher']
    });

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    const created = await scheduleEvent(page, eventType, serviceDate, '09:00');

    await page.goto(appUrl(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`));
    await expect(page.locator('#assignmentHeader')).toContainText(eventTitle);

    const assigned = await assignPositionsByApi(page, created.id, [
      { positionId: 'P1', memberId: String(personOne.id) },
      { positionId: 'P2', memberId: String(personTwo.id) },
    ]);

    const p1Assigned = (assigned.event?.positions || []).find(position => position.positionId === 'P1');
    const p2Assigned = (assigned.event?.positions || []).find(position => position.positionId === 'P2');
    expect(String(p1Assigned?.assignedMemberId || '')).toBe(String(personOne.id));
    expect(String(p2Assigned?.assignedMemberId || '')).toBe(String(personTwo.id));
  });

  test('shows only eligible assignment candidates for role and required gender', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assign-eligible-${stamp}`;
    const eventTitle = `E2E Assign Eligible ${stamp}`;
    const serviceDate = getFutureDate(22);

    const staff = await seedStaffScenario(request);
    const eligible = await createCandidateMember(request, {
      stamp,
      firstName: 'Eligible',
      lastName: `Male${stamp}`,
      gender: 'male',
      tags: ['deacon']
    });
    await createCandidateMember(request, {
      stamp,
      firstName: 'Ineligible',
      lastName: `Female${stamp}`,
      gender: 'female',
      tags: ['deacon']
    });
    await createCandidateMember(request, {
      stamp,
      firstName: 'Ineligible',
      lastName: `Helper${stamp}`,
      gender: 'male',
      tags: ['helper']
    });

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    const created = await scheduleEvent(page, eventType, serviceDate, '10:00');

    await page.goto(appUrl(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`));

    const modal = await openAssignmentEditor(page, 'P1');
    await modal.locator('input[placeholder="Type to filter names..."]').fill(String(stamp));

    await expect(modal.locator('label').filter({ hasText: `Eligible Male${stamp}` })).toHaveCount(1);
    await expect(modal.locator('label').filter({ hasText: `Ineligible Female${stamp}` })).toHaveCount(0);
    await expect(modal.locator('label').filter({ hasText: `Ineligible Helper${stamp}` })).toHaveCount(0);

    const bodyRes = await page.request.get(appUrl(`/api/events/${encodeURIComponent(created.id)}/assignments`));
    expect(bodyRes.ok()).toBeTruthy();
    const body = await bodyRes.json();
    expect(body.requiredGender).toBe('male');
    const candidateIds = (body.assignmentCandidates || []).map(candidate => candidate._id);
    expect(candidateIds).toContain(eligible.id);
  });

  test('adds a new member on the fly and can assign that member to a position', async ({ page, request }) => {
    const stamp = Date.now();
    const eventType = `e2e-assign-quickadd-${stamp}`;
    const eventTitle = `E2E Assign Quick Add ${stamp}`;
    const serviceDate = getFutureDate(23);

    const staff = await seedStaffScenario(request);

    await loginAsEmail(page, staff.staffEmail);
    await seedSchedulableEventType(page, eventType, eventTitle);
    const created = await scheduleEvent(page, eventType, serviceDate, '11:00');

    await page.goto(appUrl(`/event-assignments.html?eventId=${encodeURIComponent(created.id)}`));

    const modal = await openAssignmentEditor(page, 'P2');

    await modal.getByRole('button', { name: /Add new member/i }).click();
    const fullName = `QuickAdd${stamp} Person`;
    await modal.locator('input[placeholder="First Last"]').fill(fullName);
    await modal.getByRole('button', { name: /Add Member/i }).click();

    await expect(page.locator('#pageMessage')).toContainText(`Added QuickAdd${stamp} Person as usher.`);

    const candidatesRes = await page.request.get(appUrl(`/api/events/${encodeURIComponent(created.id)}/assignments`));
    expect(candidatesRes.ok()).toBeTruthy();
    const candidatesBody = await candidatesRes.json();
    const quickAdded = (candidatesBody.assignmentCandidates || []).find(candidate => {
      return String(candidate.firstName || '') === `QuickAdd${stamp}` && String(candidate.lastName || '') === 'Person';
    });
    expect(quickAdded).toBeTruthy();
    const quickAddedId = String(quickAdded?._id || '');
    expect(quickAddedId).toBeTruthy();

    const assigned = await assignPositionsByApi(page, created.id, [
      { positionId: 'P2', memberId: quickAddedId }
    ]);
    const assignedP2 = (assigned.event?.positions || []).find(position => position.positionId === 'P2');
    expect(String(assignedP2?.assignedMemberId || '')).toBe(quickAddedId);
    expect(Array.isArray(quickAdded.tags)).toBeTruthy();
    expect(quickAdded.tags).toContain('usher');
  });
});
