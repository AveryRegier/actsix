import fs from 'fs';
import path from 'path';
import { test, expect } from '../support/browser-coverage.js';
import { authenticateAsSeededMember } from '../support/site-session-helpers.js';

function readSignupToggleSeed() {
  const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test-results', 'e2e-summary-seed.json'), 'utf8'));
  return seed.cancelEvents.signupToggle;
}

test.describe('sign ups page (site-only)', () => {
  test('sign-ups page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/sign-ups.html');
    await expect(page).toHaveURL(/email-login\.html/);
  });

  test('availability buttons show a busy state, send one request, and Unavailable frees the position', async ({ page }) => {
    const seed = readSignupToggleSeed();
    await authenticateAsSeededMember(page, 'deacon');

    const signupRequests = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/events\/[^/]+\/signup$/.test(req.url())) {
        signupRequests.push(req.url());
      }
    });

    await page.goto('/sign-ups.html');
    const card = page.locator('.signups-event-card', { hasText: seed.title });
    const availableButton = card.locator('.signup-action-btn[data-available="true"]');
    await expect(availableButton).toBeVisible();

    // Clicking twice in one task proves the first click disables the card's buttons and relabels it.
    const busyState = await availableButton.evaluate((button) => {
      button.click();
      button.click();
      const siblings = Array.from(button.parentNode.querySelectorAll('.signup-action-btn'));
      return {
        text: button.textContent,
        ariaBusy: button.getAttribute('aria-busy'),
        allDisabled: siblings.every((sibling) => sibling.disabled),
      };
    });
    expect(busyState).toEqual({ text: 'Signing Up...', ariaBusy: 'true', allDisabled: true });

    await expect(card.getByText('Your status: Assigned to ST-1')).toBeVisible();
    await expect(card.getByText('Filled: 1/1')).toBeVisible();
    await expect(card.locator('.signup-action-btn[data-available="true"]')).toHaveCount(0);
    await expect(card.locator('.signup-action-btn[data-available="false"]')).toBeVisible();
    expect(signupRequests).toHaveLength(1);

    const unavailableButton = card.locator('.signup-action-btn[data-available="false"]');
    const unavailableBusyState = await unavailableButton.evaluate((button) => {
      button.click();
      return { text: button.textContent, disabled: button.disabled };
    });
    expect(unavailableBusyState).toEqual({ text: 'Marking Unavailable...', disabled: true });

    await expect(card.getByText('Your status: Marked unavailable')).toBeVisible();
    await expect(card.getByText('Filled: 0/1')).toBeVisible();
    await expect(card.locator('.signup-action-btn[data-available="false"]')).toHaveCount(0);
    await expect(card.locator('.signup-action-btn[data-available="true"]')).toBeVisible();
    expect(signupRequests).toHaveLength(2);

    await page.goto(`/event-assignments.html?serviceDate=${encodeURIComponent(seed.serviceDate)}`);
    await expect(page.getByText('Filled: 0/1')).toBeVisible();
    await expect(page.getByText('Open positions needed: Signup Toggle Spot')).toBeVisible();
  });
});
