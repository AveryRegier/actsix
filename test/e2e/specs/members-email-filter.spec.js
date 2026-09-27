import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsRole } from '../support/site-session-helpers.js';

// Creates a brand-new member (and household) through the Add Member form, browser-driven only.
async function addMemberViaUi(page, { firstName, lastName, email, tag }) {
  await page.goto('/edit-member.html');
  await page.locator('#firstName').fill(firstName);
  await page.locator('#lastName').fill(lastName);
  if (email) {
    await page.locator('#email').fill(email);
  }
  await page.locator('#gender').selectOption('male');
  await page.locator('#relationship').selectOption('head');
  await page.locator(`input[name="tags"][value="${tag}"]`).check();
  await page.locator('#saveBtn').click();
  await expect(page).toHaveURL(/household\.html\?id=/);
}

test.describe('members page tag filtering and email link (site-only)', () => {
  test('filtering by tag narrows the list and updates the email link recipients', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');
    const stamp = Date.now();

    const elderFirst = 'ElderFilter';
    const elderLast = `ElderTest${stamp}`;
    const elderEmail = `elder-filter-${stamp}@example.test`;
    await addMemberViaUi(page, { firstName: elderFirst, lastName: elderLast, email: elderEmail, tag: 'elder' });

    const helperFirst = 'HelperFilter';
    const helperLast = `HelperTest${stamp}`;
    const helperEmail = `helper-filter-${stamp}@example.test`;
    await addMemberViaUi(page, { firstName: helperFirst, lastName: helperLast, email: helperEmail, tag: 'helper' });

    await page.goto('/members.html');
    await expect(page.locator('#tagFilter option[value="elder"]')).toHaveCount(1);

    await page.locator('#tagFilter').selectOption('elder');

    await expect(page.locator('#memberTableBody')).toContainText(elderLast);
    await expect(page.locator('#memberTableBody')).not.toContainText(helperLast);

    const emailHref = await page.locator('#emailFilteredBtn').getAttribute('href');
    expect(emailHref).toContain('mailto:?to=');
    const decodedRecipients = decodeURIComponent(emailHref.replace('mailto:?to=', ''));
    expect(decodedRecipients).toContain(`"${elderFirst} ${elderLast}" <${elderEmail}>`);
    expect(decodedRecipients).not.toContain(helperEmail);
  });

  test('email link has no recipients when filtered members lack an email on file', async ({ page }) => {
    await authenticateAsRole(page, 'deacon');
    const stamp = Date.now();
    const lastName = `NoEmail${stamp}`;
    await addMemberViaUi(page, { firstName: 'NoEmail', lastName, email: '', tag: 'usher' });

    await page.goto('/members.html');
    await page.locator('#tagFilter').selectOption('usher');
    await expect(page.locator('#memberTableBody')).toContainText(lastName);

    await expect(page.locator('#emailFilteredBtn')).toHaveAttribute('href', '#');

    let alertMessage = null;
    page.once('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.locator('#emailFilteredBtn').click();
    await expect.poll(() => alertMessage).toContain('email address on file');
  });
});
