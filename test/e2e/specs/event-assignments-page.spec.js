import fs from 'fs';
import path from 'path';
import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsSeededMember } from '../support/site-session-helpers.js';

function readCancelSeed() {
  const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test-results', 'e2e-summary-seed.json'), 'utf8'));
  return seed.cancelEvents;
}

test.describe('event assignments page (site-only)', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/event-assignments.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });

  test('deacon without leader access does not see Cancel Event', async ({ page }) => {
    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'deacon');

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(seed.deniedEventId)}`);
    await expect(page.locator('#assignmentsTableWrap')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Event' })).toHaveCount(0);
  });

  test('staff can dismiss then confirm cancelling an event', async ({ page }) => {
    const seed = readCancelSeed();
    await authenticateAsSeededMember(page, 'staff');

    await page.goto('/sign-ups.html');
    await expect(page.locator('#eventsList')).toContainText(seed.title);
    const cardsBefore = await page.locator('.signups-event-card', { hasText: seed.title }).count();
    expect(cardsBefore).toBeGreaterThanOrEqual(2);

    await page.goto(`/event-assignments.html?eventId=${encodeURIComponent(seed.flowEventId)}`);
    const cancelButton = page.getByRole('button', { name: 'Cancel Event' });
    await expect(cancelButton).toBeVisible();

    page.once('dialog', (dialog) => dialog.dismiss());
    await cancelButton.click();
    await expect(cancelButton).toBeVisible();
    await expect(page.getByText('Event cancelled.')).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await cancelButton.click();
    await expect(page.getByText('Event cancelled.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Event' })).toHaveCount(0);

    await page.goto('/sign-ups.html');
    await expect(page.locator('.signups-event-card', { hasText: seed.title })).toHaveCount(cardsBefore - 1);
  });
});
