import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsSeededMember } from '../support/site-session-helpers.js';

// Households seeded in global-setup: SortAlpha (10d ago), SortMid (5d), SortZeta (1d), SortNever (no contact).
// Deacon is assigned Alpha/Never/Zeta; helper is assigned Mid/Never/Zeta.

async function openSummary(page, role) {
  await authenticateAsSeededMember(page, role);
  await page.goto('/contact-summary.html');
  await expect(page.locator('#summaryTable tbody tr.summary-row', { hasText: /Sort(Alpha|Mid|Never|Zeta)/ }).first()).toBeVisible();
}

async function seededRowOrder(page) {
  const names = await page.$$eval('#summaryTable tbody tr.summary-row', rows =>
    rows.map(row => (row.querySelector('td a')?.textContent || '').trim()),
  );
  return names.filter(n => /^Sort(Alpha|Mid|Never|Zeta)$/.test(n));
}

async function choose(page, selector, value) {
  await page.locator(selector).selectOption(value);
}

test.describe('contact summary sorting', () => {
  test('sort dropdown offers Name and Newest Contact', async ({ page }) => {
    await openSummary(page, 'deacon');

    const options = await page.locator('#summarySort option').allTextContents();
    expect(options.map(o => o.trim())).toEqual(['Name (A–Z)', 'Newest Contact']);
  });

  test('deacon defaults to Deacon filter with name sort', async ({ page }) => {
    await openSummary(page, 'deacon');

    await expect(page.locator('#assignmentFilter')).toHaveValue('deacon');
    await expect(page.locator('#summarySort')).toHaveValue('name');
    expect(await seededRowOrder(page)).toEqual(['SortAlpha', 'SortNever', 'SortZeta']);

    await choose(page, '#summarySort', 'lastContact');
    expect(await seededRowOrder(page)).toEqual(['SortZeta', 'SortAlpha', 'SortNever']);
  });

  test('staff defaults to All filter with Newest Contact sort shown in the dropdown', async ({ page }) => {
    await openSummary(page, 'staff');

    await expect(page.locator('#assignmentFilter')).toHaveValue('all');
    await expect(page.locator('#summarySort')).toHaveValue('lastContact');
    await expect(page.locator('#summarySort option:checked')).toHaveText('Newest Contact');
    expect(await seededRowOrder(page)).toEqual(['SortZeta', 'SortMid', 'SortAlpha', 'SortNever']);
  });

  test('staff can switch to name sort and back', async ({ page }) => {
    await openSummary(page, 'staff');

    await choose(page, '#summarySort', 'name');
    expect(await seededRowOrder(page)).toEqual(['SortAlpha', 'SortMid', 'SortNever', 'SortZeta']);

    await choose(page, '#summarySort', 'lastContact');
    expect(await seededRowOrder(page)).toEqual(['SortZeta', 'SortMid', 'SortAlpha', 'SortNever']);
  });

  test('helper defaults to H.E.L.P. filter with name sort', async ({ page }) => {
    await openSummary(page, 'helper');

    await expect(page.locator('#assignmentFilter')).toHaveValue('helper');
    await expect(page.locator('#summarySort')).toHaveValue('name');
    expect(await seededRowOrder(page)).toEqual(['SortMid', 'SortNever', 'SortZeta']);

    await choose(page, '#summarySort', 'lastContact');
    expect(await seededRowOrder(page)).toEqual(['SortZeta', 'SortMid', 'SortNever']);
  });

  test('sort selection persists when the assignment filter changes', async ({ page }) => {
    await openSummary(page, 'deacon');

    await choose(page, '#summarySort', 'lastContact');
    await choose(page, '#assignmentFilter', 'all');

    await expect(page.locator('#summarySort')).toHaveValue('lastContact');
    expect(await seededRowOrder(page)).toEqual(['SortZeta', 'SortMid', 'SortAlpha', 'SortNever']);
  });

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('sort dropdown is visible and usable on mobile', async ({ page }) => {
      await openSummary(page, 'staff');

      const sort = page.locator('#summarySort');
      await expect(sort).toBeVisible();
      await choose(page, '#summarySort', 'name');
      expect(await seededRowOrder(page)).toEqual(['SortAlpha', 'SortMid', 'SortNever', 'SortZeta']);
    });
  });
});
