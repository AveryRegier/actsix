import { test, expect } from '../support/browser-coverage.js';
import { apiPost, loginAsEmail } from '../support/workflow-helpers.js';

async function seedRoleFilterScenario(request) {
  const stamp = Date.now();

  const createMemberWithTag = async (roleTag, label) => {
    const householdRes = await apiPost(request, '/api/households', {
      lastName: `${label}UserHH-${stamp}`,
      primaryPhone: '515-555-1000',
    });
    expect(householdRes.ok()).toBeTruthy();
    const household = await householdRes.json();

    const email = `${label.toLowerCase()}-${stamp}@example.test`;
    const memberRes = await apiPost(request, '/api/members', {
      householdId: household.id,
      firstName: label,
      lastName: `User${stamp}`,
      relationship: 'head',
      gender: 'female',
      email,
      phone: '515-555-1001',
      tags: [roleTag],
    });
    expect(memberRes.ok()).toBeTruthy();
    const member = await memberRes.json();

    return { email, memberId: member.id };
  };

  const deacon = await createMemberWithTag('deacon', 'Deacon');
  const helper = await createMemberWithTag('helper', 'Helper');
  const staff = await createMemberWithTag('staff', 'Staff');

  const createAssignedHousehold = async (householdPrefix, assigneeId, memberLabel) => {
    const expectedLastName = `${householdPrefix}-${stamp}`;
    const householdRes = await apiPost(request, '/api/households', {
      lastName: expectedLastName,
      primaryPhone: '515-555-1002',
      address: {
        street: '100 Main St',
        city: 'Des Moines',
        state: 'IA',
        zipCode: '50309',
      },
    });
    expect(householdRes.ok()).toBeTruthy();
    const household = await householdRes.json();

    const memberRes = await apiPost(request, '/api/members', {
      householdId: household.id,
      firstName: memberLabel,
      lastName: `Member${stamp}`,
      relationship: 'head',
      gender: 'male',
      email: `${memberLabel.toLowerCase()}-member-${stamp}@example.test`,
      phone: '515-555-1003',
      tags: ['member'],
    });
    expect(memberRes.ok()).toBeTruthy();
    const member = await memberRes.json();

    const assignRes = await apiPost(request, `/api/households/${household.id}/assignments`, {
      deaconIds: [assigneeId],
    });
    expect(assignRes.ok()).toBeTruthy();

    const contactRes = await apiPost(request, '/api/contacts', {
      memberId: [member.id],
      deaconId: [assigneeId],
      contactType: 'phone',
      summary: `Role filter seed ${householdPrefix} ${stamp}`,
      contactDate: new Date().toISOString(),
    });
    expect(contactRes.ok()).toBeTruthy();

    return expectedLastName;
  };

  const deaconHouseholdLastName = await createAssignedHousehold('DeaconOnlyTarget', deacon.memberId, 'DeaconTarget');
  const helperHouseholdLastName = await createAssignedHousehold('HelperOnlyTarget', helper.memberId, 'HelperTarget');

  return {
    deacon,
    helper,
    staff,
    deaconHouseholdLastName,
    helperHouseholdLastName,
  };
}

async function openSummaryAs(page, email, memberId) {
  await loginAsEmail(page, email);
  await page.evaluate((id) => {
    localStorage.setItem('memberId', id);
  }, memberId);
  await page.goto('/contact-summary.html');
  await expect(page.getByRole('heading', { name: /contact summary report/i })).toBeVisible();
}

test.describe('role-based contact summary defaults', () => {
  test('helper defaults filter to helper and shows helper-assigned households', async ({ page, request }) => {
    const scenario = await seedRoleFilterScenario(request);

    await openSummaryAs(page, scenario.helper.email, scenario.helper.memberId);
    await expect(page.locator('#assignmentFilter')).toHaveValue('helper');
    await expect(page.getByText(scenario.helperHouseholdLastName)).toBeVisible();
    await expect(page.getByText(scenario.deaconHouseholdLastName)).toHaveCount(0);
  });

  test('deacon defaults filter to deacon and shows deacon-assigned households', async ({ page, request }) => {
    const scenario = await seedRoleFilterScenario(request);

    await openSummaryAs(page, scenario.deacon.email, scenario.deacon.memberId);
    await expect(page.locator('#assignmentFilter')).toHaveValue('deacon');
    await expect(page.getByText(scenario.deaconHouseholdLastName)).toBeVisible();
    await expect(page.getByText(scenario.helperHouseholdLastName)).toHaveCount(0);
  });

  test('staff defaults filter to all and includes both helper and deacon households', async ({ page, request }) => {
    const scenario = await seedRoleFilterScenario(request);

    await openSummaryAs(page, scenario.staff.email, scenario.staff.memberId);
    await expect(page.locator('#assignmentFilter')).toHaveValue('all');
    await expect(page.getByText(scenario.deaconHouseholdLastName)).toBeVisible();
    await expect(page.getByText(scenario.helperHouseholdLastName)).toBeVisible();
  });
});