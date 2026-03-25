import { test, expect } from '../support/browser-coverage.js';
import { apiGet, loginAsEmail, seedMemberTagsScenario } from '../support/workflow-helpers.js';

test.describe('feature1 member tags and deceased filtering', () => {
  test('members page filters living members by tag and excludes deceased members', async ({ page, request }) => {
    const scenario = await seedMemberTagsScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');

    await expect(page.getByText(new RegExp(`Editable${scenario.stamp}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Widow${scenario.stamp}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Deceased${scenario.stamp}`))).toHaveCount(0);

    const tagFilter = page.locator('#tagFilter');
    await expect(tagFilter).toBeVisible();
    await expect(tagFilter.locator('option')).toContainText(['All Tags', 'Member', 'Shut In', 'Widow']);
    await expect(tagFilter.locator('option')).not.toContainText(['Deceased']);

    await tagFilter.selectOption('widow');
    await expect(page.getByText(new RegExp(`Widow${scenario.stamp}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Editable${scenario.stamp}`))).toHaveCount(0);

    await tagFilter.selectOption('shut-in');
    await expect(page.getByText(new RegExp(`Editable${scenario.stamp}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Widow${scenario.stamp}`))).toHaveCount(0);
  });

  test('edit-member updates tags and the updated tag appears in the members filter', async ({ page, request }) => {
    const scenario = await seedMemberTagsScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto(`/edit-member.html?memberId=${scenario.editableMemberId}&householdId=${scenario.visibleHouseholdId}`);

    const shutInTag = page.locator('input[name="tags"][value="shut-in"]');
    const longTermNeedsTag = page.locator('input[name="tags"][value="long-term-needs"]');
    await expect(shutInTag).toBeChecked();
    await expect(longTermNeedsTag).not.toBeChecked();

    await shutInTag.uncheck();
    await longTermNeedsTag.check();
    await page.getByRole('button', { name: /save member/i }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe('/household.html');
    await expect.poll(() => new URL(page.url()).searchParams.get('id')).toBe(scenario.visibleHouseholdId);

    const memberRes = await apiGet(request, `/api/members/${scenario.editableMemberId}`);
    expect(memberRes.ok()).toBeTruthy();
    const payload = await memberRes.json();
    expect(payload.member.tags).toEqual(expect.arrayContaining(['member', 'long-term-needs']));
    expect(payload.member.tags).not.toContain('shut-in');

    await page.goto('/members.html');
    const tagFilter = page.locator('#tagFilter');
    await tagFilter.selectOption('long-term-needs');
    await expect(page.getByText(new RegExp(`Editable${scenario.stamp}`))).toBeVisible();
    await expect(page.getByText('long-term-needs')).toBeVisible();

    await tagFilter.selectOption('shut-in');
    await expect(page.getByText(new RegExp(`Editable${scenario.stamp}`))).toHaveCount(0);
  });
});