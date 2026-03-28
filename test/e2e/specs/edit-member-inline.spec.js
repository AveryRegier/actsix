import { test, expect } from '../support/browser-coverage.js';
import {
  apiGet,
  loginAsEmail,
  seedMemberTagsScenario,
  seedTemporaryAddressScenario,
  seedWorkflowScenario,
} from '../support/workflow-helpers.js';

test.describe('edit-member inline behavior', () => {
  test('edit-member page loads nav and existing member state', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request, {
      withTemporaryAddress: true,
      roomNumber: 'Room 312',
      notes: 'Existing temporary stay',
      startDate: '2026-03-01',
    });
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);

    await expect(page.locator('#site-nav-container .site-nav')).toBeVisible();
    await expect(page.locator('script[src="site-nav.js"]')).toHaveCount(1);
    await expect(page.locator('#formTitle')).toHaveText('Edit Member');
    await expect(page.locator('#firstName')).toHaveValue('Patient');
    await expect(page.locator('#tempLocationDropdown')).toHaveValue(scenario.locationName);
    await expect(page.locator('#tempLocationDisplay')).toBeVisible();
    await expect(page.locator('#tempLocationName')).toHaveText(scenario.locationName);
    await expect(page.locator('#tempRoomNumber')).toHaveValue('Room 312');
    await expect(page.locator('#tempNotes')).toHaveValue('Existing temporary stay');
  });

  test('tag badge classes update when tag checkboxes change', async ({ page, request }) => {
    const scenario = await seedMemberTagsScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.editableMemberId}&householdId=${scenario.visibleHouseholdId}`);

    const shutInLabel = page.locator('label.tag-badge:has(input[name="tags"][value="shut-in"])');
    const longTermNeedsLabel = page.locator('label.tag-badge:has(input[name="tags"][value="long-term-needs"])');

    await expect(shutInLabel).not.toHaveClass(/tag-unchecked/);
    await expect(longTermNeedsLabel).toHaveClass(/tag-unchecked/);

    await page.locator('input[name="tags"][value="shut-in"]').uncheck();
    await expect(shutInLabel).toHaveClass(/tag-unchecked/);

    await page.locator('input[name="tags"][value="long-term-needs"]').check();
    await expect(longTermNeedsLabel).not.toHaveClass(/tag-unchecked/);
  });

  test('selecting a temporary location updates display and focuses room field', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);

    await page.locator('#tempLocationDropdown').selectOption(scenario.locationName);

    await expect(page.locator('#tempLocationDisplay')).toBeVisible();
    await expect(page.locator('#tempLocationName')).toHaveText(scenario.locationName);
    await expect(page.locator('#tempLocationAddress')).not.toHaveText('');
    await expect(page.locator('#tempRoomNumber')).toBeFocused();
  });

  test('saving an existing temporary location preserves start date while updating fields', async ({ page, request }) => {
    const scenario = await seedTemporaryAddressScenario(request, {
      withTemporaryAddress: true,
      roomNumber: 'Room 401',
      notes: 'Original notes',
      startDate: '2026-03-02',
    });
    await loginAsEmail(page, scenario.deaconEmail);

    const updatedRoom = 'Room 509';
    const updatedNotes = 'Updated rehabilitation notes';

    await page.goto(`/edit-member.html?memberId=${scenario.memberId}&householdId=${scenario.householdId}`);
    await page.locator('#tempRoomNumber').fill(updatedRoom);
    await page.locator('#tempNotes').fill(updatedNotes);
    await page.getByRole('button', { name: /save member/i }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');

    const memberRes = await apiGet(request, `/api/members/${scenario.memberId}`);
    expect(memberRes.ok()).toBeTruthy();
    const payload = await memberRes.json();
    expect(payload.member.temporaryAddress).toMatchObject({
      locationId: scenario.locationId,
      roomNumber: updatedRoom,
      notes: updatedNotes,
      startDate: '2026-03-02',
      isActive: true,
    });
  });

  test('cancel returns to the household page for the current household', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.targetMemberId}&householdId=${scenario.targetHouseholdId}`);
    await page.locator('#cancelBtn').click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');
    await expect.poll(() => new URL(page.url()).searchParams.get('id')).toBe(scenario.targetHouseholdId);
  });
});