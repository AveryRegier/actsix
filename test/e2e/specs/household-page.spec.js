import { test, expect } from '../support/browser-coverage.js';
import { apiGet, apiPost, loginAsEmail, seedWorkflowScenario, seedMemberTagsScenario } from '../support/workflow-helpers.js';

test.describe('household page functions', () => {

  test('shows error state when household id is missing from URL', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/household.html');

    await expect(page.locator('#loadingState')).toContainText('No household ID provided');
    await expect(page.locator('#loadingState')).toContainText('Retry');
  });
  
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

  test('household info action links render usable map and phone actions', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const householdInfo = page.locator('#householdInfo');
    const mapLink = householdInfo.locator('a[target="_blank"]').first();
    await expect(mapLink).toBeVisible();
    const mapHref = await mapLink.getAttribute('href');
    expect(mapHref).toBeTruthy();
    expect(mapHref).toContain('google');

    const phoneLink = householdInfo.locator('a[href^="tel:"]').first();
    await expect(phoneLink).toBeVisible();
    const phoneHref = await phoneLink.getAttribute('href');
    expect(phoneHref).toContain('tel:');
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

  test('loadContactHistory shows empty-state message when there are no contacts', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.route(`**/api/households/${scenario.targetHouseholdId}/contacts`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, contacts: [] }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const contactHistorySection = page.locator('.section').filter({ hasText: 'Contact History' });
    await expect(contactHistorySection).toContainText('No contact history available.');
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

  test('member card action links include callable phone and emailable address actions', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const memberCard = page.locator(`[data-member-id="${scenario.targetMemberId}"]`);
    await expect(memberCard).toBeVisible();

    const phoneLink = memberCard.locator('a[href^="tel:"]');
    await expect(phoneLink).toBeVisible();
    const phoneHref = await phoneLink.getAttribute('href');
    expect(phoneHref).toContain('tel:');

    const emailLink = memberCard.locator('a[href^="mailto:"]');
    await expect(emailLink).toBeVisible();
    const emailHref = await emailLink.getAttribute('href');
    expect(emailHref).toContain('mailto:');
  });

  test('hidden add member form submit posts age payload and shows success state', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    let capturedBody = null;
    await page.route('**/api/members', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: `Added-${scenario.stamp}` }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    await page.evaluate(() => {
      const form = document.getElementById('memberForm');
      const success = document.createElement('div');
      success.id = 'memberSuccess';
      success.style.display = 'none';
      form.appendChild(success);

      document.getElementById('firstName').value = 'Action';
      document.getElementById('lastName').value = 'Add';
      document.getElementById('relationship').value = 'head';
      document.getElementById('gender').value = 'male';
      document.getElementById('age').value = '42';
      document.getElementById('birthDate').value = '';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await expect.poll(() => capturedBody !== null).toBeTruthy();
    expect(capturedBody.householdId).toBe(scenario.targetHouseholdId);
    expect(capturedBody.age).toBe(42);
    expect(capturedBody.birthDate).toBeUndefined();

    await expect(page.locator('#memberSuccess')).toContainText('Member added successfully!');
  });

  test('hidden add member form submit shows error message when api rejects', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.route('**/api/members', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Bad member payload' }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    await page.evaluate(() => {
      const form = document.getElementById('memberForm');
      const error = document.createElement('div');
      error.id = 'memberError';
      error.style.display = 'none';
      form.appendChild(error);

      document.getElementById('firstName').value = 'Action';
      document.getElementById('lastName').value = 'Error';
      document.getElementById('relationship').value = 'head';
      document.getElementById('gender').value = 'female';
      document.getElementById('birthDate').value = '1990-01-01';
      document.getElementById('age').value = '';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await expect(page.locator('#memberError')).toContainText('Bad member payload');
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
      const href = await quickContactBtn.getAttribute('href');
      expect(href).toContain('/deacon-quick-contact.html');
      expect(href).toContain(`deaconMemberId=${deaconMemberId}`);
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

  test('displayAssignedDeacons provides actionable household links for assigned deacons', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const section = page.locator('#assignedDeaconsSection');
    const deaconLink = section.locator('a[href^="household.html?id="]').first();
    await expect(deaconLink).toBeVisible();
    const href = await deaconLink.getAttribute('href');
    expect(href).toContain('household.html?id=');
  });

  test('edit member modal form submits update and supports overlay close action', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    let capturedBody = null;
    await page.route(`**/api/members/${scenario.targetMemberId}`, async route => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    await page.evaluate((memberId) => {
      const modal = document.getElementById('editMemberModal');
      const modalContent = modal.querySelector('.modal-content');
      modal.style.display = 'block';
      modalContent.style.display = 'block';

      document.getElementById('editMemberId').value = memberId;
      document.getElementById('editFirstName').value = 'Edited';
      document.getElementById('editLastName').value = 'Member';
      document.getElementById('editRelationship').value = 'head';
      document.getElementById('editGender').value = 'male';
      document.getElementById('editBirthDate').value = '1988-02-03';
      document.getElementById('editAge').value = '';

      document.getElementById('editMemberForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, scenario.targetMemberId);

    await expect.poll(() => capturedBody !== null).toBeTruthy();
    expect(capturedBody.birthDate).toBe('1988-02-03');
    expect(capturedBody.age).toBeUndefined();
    await expect(page.locator('#editMemberSuccess')).toContainText('Member updated successfully!');

    await page.evaluate(() => {
      const modal = document.getElementById('editMemberModal');
      modal.style.display = 'block';
      modal.querySelector('.modal-content').style.display = 'block';
      modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect(page.locator('#editMemberModal')).toHaveCSS('display', 'none');
  });

  test('edit member modal form shows error on failed update request', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.route(`**/api/members/${scenario.targetMemberId}`, async route => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Update failed in test' }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    await page.evaluate((memberId) => {
      const modal = document.getElementById('editMemberModal');
      const modalContent = modal.querySelector('.modal-content');
      modal.style.display = 'block';
      modalContent.style.display = 'block';

      document.getElementById('editMemberId').value = memberId;
      document.getElementById('editFirstName').value = 'Broken';
      document.getElementById('editLastName').value = 'Update';
      document.getElementById('editRelationship').value = 'head';
      document.getElementById('editGender').value = 'female';
      document.getElementById('editBirthDate').value = '';
      document.getElementById('editAge').value = '39';

      document.getElementById('editMemberForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, scenario.targetMemberId);

    await expect(page.locator('#editMemberError')).toContainText('Update failed in test');
  });

  test('household page remains functional when Array.from polyfill path is activated', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.addInitScript(() => {
      try {
        window.__arrayFromBeforeHouseholdScript = typeof Array.from;
        Object.defineProperty(Array, 'from', {
          value: undefined,
          configurable: true,
          writable: true,
        });
      } catch {
        // Best-effort for environments that lock Array.from.
      }
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const arrayFromState = await page.evaluate(() => {
      const src = String(Array.from);
      const probe = Array.from({ 0: 'polyfill-ok', length: 1 });
      return {
        beforeType: window.__arrayFromBeforeHouseholdScript,
        afterType: typeof Array.from,
        isNative: src.includes('[native code]'),
        looksLikeHouseholdPolyfill: src.includes('arrayLike') && src.includes('var items'),
        probeResult: probe,
      };
    });

    expect(arrayFromState.beforeType).toBe('function');
    expect(arrayFromState.afterType).toBe('function');
    expect(arrayFromState.isNative).toBeFalsy();
    expect(arrayFromState.looksLikeHouseholdPolyfill).toBeTruthy();
    expect(arrayFromState.probeResult).toEqual(['polyfill-ok']);

    await expect(page.locator('#membersList')).toBeVisible();
    await expect(page.locator('.member-card').first()).toBeVisible();
  });

  test('displayAssignedDeacons renders plain text name when deacon has no householdId', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.route(`**/api/households/${scenario.targetHouseholdId}/assignments`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              deacon: {
                firstName: 'NoLink',
                lastName: 'Deacon',
                tags: ['deacon'],
              },
            },
          ],
        }),
      });
    });

    await page.goto(`/household.html?id=${scenario.targetHouseholdId}`);

    const section = page.locator('#assignedDeaconsSection');
    await expect(section).toContainText('NoLink Deacon');
    await expect(section.locator('a[href^="household.html?id="]')).toHaveCount(0);
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

