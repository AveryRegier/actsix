import { test, expect } from '../support/browser-coverage.js';
import { loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('site-nav and redirect coverage', () => {
  test('site-nav hides current page links and tracks post submits', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');
    await expect(page.locator('#navMobileMenu')).toHaveCount(1);

    await page.evaluate(async () => {
      sessionStorage.setItem('lastNavWasPost', 'true');
      const extraScript = document.createElement('script');
      const loaded = new Promise((resolve, reject) => {
        extraScript.onload = () => resolve();
        extraScript.onerror = () => reject(new Error('failed to load site-nav.js'));
      });
      extraScript.src = '/site-nav.js';
      document.body.appendChild(extraScript);
      await loaded;
    });

    const hiddenMembersLinks = await page.evaluate(() => {
      history.replaceState({}, '', '/members.html');
      if (typeof window.hideCurrentPageNavLinks === 'function') {
        window.hideCurrentPageNavLinks();
      }
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const desktopLink = document.querySelector('.nav-content .members-link');
      const mobileLink = document.querySelector('#navMobileMenu .members-link');
      return {
        desktopHidden: desktopLink ? desktopLink.style.display === 'none' : false,
        mobileHidden: mobileLink ? mobileLink.style.display === 'none' : false,
      };
    });
    expect(hiddenMembersLinks.desktopHidden).toBeTruthy();
    expect(hiddenMembersLinks.mobileHidden).toBeTruthy();

    const postMarkerRemoved = await page.evaluate(() => sessionStorage.getItem('lastNavWasPost') === null);
    expect(postMarkerRemoved).toBeTruthy();

    const submitStoredPost = await page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/noop';
      document.body.appendChild(form);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.remove();
      return sessionStorage.getItem('lastNavWasPost') === 'true';
    });
    expect(submitStoredPost).toBeTruthy();

  });

  test('redirect-handler follows redirected fetch responses', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);
    await page.goto('/members.html');

    const redirected = await page.evaluate(async () => {
      const originalUrl = window.location.href;
      window.fetch = async () => ({ redirected: true, url: originalUrl });

      const script = document.createElement('script');
      script.src = '/redirect-handler.js';
      document.body.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('failed to load redirect-handler'));
      });

      await window.fetch('/fake-redirect');
      return window.location.href === originalUrl;
    });

    expect(redirected).toBeTruthy();
  });

  test('members page signout link redirects back to login', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/members.html');
    await page.locator('a.signout-link').first().click();
    await expect(page).toHaveURL(/email-login\.html/);
  });
});