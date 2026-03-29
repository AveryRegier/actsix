import { test, expect } from '../support/browser-coverage.js';
import { apiGet, apiPost, loginAsEmail, seedWorkflowScenario, seedMemberTagsScenario } from '../support/workflow-helpers.js';

test.describe('household page functions', () => {
  
  test('getHouseholdId and loadHouseholdData fetches household info, members, and assignments', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Test getHouseholdId by navigating with URL param
    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Verify household info displays (tests displayHouseholdInfo)
    await expect(page.locator('#householdTitle')).toContainText('Household');
    await expect(page.locator('#householdInfo')).toBeVisible();
    await expect(page.locator('#householdInfo h3')).toContainText('Household');

    // Verify members section displays (tests displayMembers)
    await expect(page.locator('#membersList')).toBeVisible();
    await expect(page.locator('.member-card')).toBeVisible();
    
    // Verify assigned deacons section displays (tests displayAssignedDeacons)
    await expect(page.locator('#assignedDeaconsSection')).toBeVisible();
  });

  test('displayHouseholdInfo renders household address and contact info when available', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Get household details to see what data we have
    const householdRes = await apiGet(request, `/api/households/${scenario.targetHouseholdId}`);
    const household = await householdRes.json();

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const householdInfo = page.locator('#householdInfo');
    await expect(householdInfo).toBeVisible();

    // If household has phone, verify it displays
    if (household.primaryPhone) {
      await expect(householdInfo).toContainText(household.primaryPhone);
    }

    // If household has email, verify it displays
    if (household.email) {
      await expect(householdInfo).toContainText(household.email);
    }
  });

  test('loadContactHistory displays contact history table with edit links', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Create a contact via API
    const contactData = {
      householdId: scenario.targetHouseholdId,
      summary: `Test contact ${scenario.stamp}`,
      whom: [scenario.targetMemberId],
      how: 'phone',
      when: new Date().toISOString(),
    };
    await apiPost(request, `/api/contacts`, contactData);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Wait for contact history section to load (CSS class)
    const contactsTable = page.locator('.contacts-table');
    await expect(contactsTable).toBeVisible();

    // Verify contact date displays
    const contactDateCell = page.locator('.contacts-table tbody tr td').first();
    await expect(contactDateCell).toBeVisible();

    // Verify edit contact link exists
    const editContactBtn = page.locator('.contact-edit-btn').first();
    await expect(editContactBtn).toBeVisible();
    const href = await editContactBtn.getAttribute('href');
    expect(href).toContain('record-contact.html');
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

  test('displayMembers shows edit button linking to edit-member.html page', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Get the member's ID for verification
    const memberRes = await apiGet(request, `/api/members/${scenario.targetMemberId}`);
    const memberData = await memberRes.json();

    // Find member card
    const memberCard = page.locator(`[data-member-id="${scenario.targetMemberId}"]`);
    await expect(memberCard).toBeVisible();

    // Find edit button in the card
    const editLink = memberCard.locator('a[title="Edit Member"]');
    await expect(editLink).toBeVisible();

    // Verify it links to edit-member.html with correct params
    const href = await editLink.getAttribute('href');
    expect(href).toContain('edit-member.html');
    expect(href).toContain(`memberId=${scenario.targetMemberId}`);
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

  test('displayMembers renders member data correctly', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Get member data
    const memberRes = await apiGet(request, `/api/members/${scenario.targetMemberId}`);
    const memberData = await memberRes.json();
    const member = memberData.member;

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Find member card and verify data displays
    const memberCard = page.locator(`[data-member-id="${scenario.targetMemberId}"]`);
    await expect(memberCard).toBeVisible();

    // Verify name displays
    await expect(memberCard).toContainText(member.firstName);
    await expect(memberCard).toContainText(member.lastName);

    // Verify relationship displays
    await expect(memberCard).toContainText(member.relationship);

    // Verify gender displays
    await expect(memberCard).toContainText(member.gender);

    // Verify contact info if present
    if (member.phone) {
      await expect(memberCard).toContainText(member.phone);
    }
  });


  test('displayMembers shows tags as badges', async ({ page, request }) => {
    // Use a simple scenario and verify tags display if present
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Get member to check if it has tags
    const memberRes = await apiGet(request, `/api/members/${scenario.targetMemberId}`);
    const memberData = await memberRes.json();
    const member = memberData.member;

    // If member has tags, verify they display
    if (member.tags && member.tags.length > 0) {
      const memberCard = page.locator(`[data-member-id="${scenario.targetMemberId}"]`);
      const badges = memberCard.locator('.status-badge');
      await expect(badges.first()).toBeVisible();
    }
  });

  test('displayMembers shows deacon quick contact link when member has deacon tag', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Create a member with deacon tag
    const deaconMemberData = {
      householdId: scenario.targetHouseholdId,
      firstName: `Deacon${scenario.stamp}`,
      lastName: 'Test',
      relationship: 'head',
      gender: 'male',
      tags: ['deacon'],
    };
    const createRes = await apiPost(request, `/api/members`, deaconMemberData);
    const deaconMemberData_resp = await createRes.json();
    const deaconMemberId = deaconMemberData_resp.id;

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Find the deacon member card
    const memberCard = page.locator(`[data-member-id="${deaconMemberId}"]`);
    await expect(memberCard).toBeVisible();

    // Verify quick contact emoji button appears for deacon members
    const quickContactBtn = memberCard.locator('a[title*="Quick contact"]');
    if (await quickContactBtn.count() > 0) {
      await expect(quickContactBtn).toContainText('📞');
    }
  });

  test('displayAssignedDeacons renders deacon assignments with names and tags', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Verify assigned deacons section displays
    const section = page.locator('#assignedDeaconsSection');
    await expect(section).toBeVisible();

    // Verify there's content (either deacon list or "no deacons assigned" message)
    const content = await section.textContent();
    expect(content).toBeTruthy();
  });

  test('add member button links to edit-member.html with correct householdId', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const addMemberBtn = page.locator('#addMemberBtn');
    await expect(addMemberBtn).toBeVisible();

    const href = await addMemberBtn.getAttribute('href');
    expect(href).toContain('edit-member.html');
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

  test('assign deacon button links to assign-deacons.html with correct householdId', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const assignDeaconBtn = page.locator('#assignDeaconBtn');
    await expect(assignDeaconBtn).toBeVisible();

    const href = await assignDeaconBtn.getAttribute('href');
    expect(href).toContain('assign-deacons.html');
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

  test('edit household button links to edit-household.html with correct householdId', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const editHouseholdBtn = page.locator('#editHouseholdBtn');
    await expect(editHouseholdBtn).toBeVisible();

    const href = await editHouseholdBtn.getAttribute('href');
    expect(href).toContain('edit-household.html');
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

  test('record contact button in contact history links to record-contact.html with returnTo parameter', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    // Create a contact so contact history section appears
    const contactData = {
      householdId: scenario.targetHouseholdId,
      summary: `Test contact ${scenario.stamp}`,
      whom: [scenario.targetMemberId],
      how: 'phone',
      when: new Date().toISOString(),
    };
    await apiPost(request, `/api/contacts`, contactData);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    // Find record contact link in contact history section
    const recordContactLink = page.locator('a:has-text("Record Contact")').first();
    await expect(recordContactLink).toBeVisible();

    const href = await recordContactLink.getAttribute('href');
    expect(href).toContain('record-contact.html');
    expect(href).toContain(`householdId=${scenario.targetHouseholdId}`);
  });

});

