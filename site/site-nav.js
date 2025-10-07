// --- Navigation Bar JS (from site-nav.html) ---
function goBack() {
  if (document.referrer) {
    window.location.href = document.referrer;
  } else {
    window.location.href = 'index.html';
  }
}
function toggleMenu() {
  const menu = document.getElementById('navMobileMenu');
  menu.classList.toggle('open');
}

// Hide nav link for current page
function hideCurrentPageNavLinks() {
  let page = window.location.pathname.split('/').pop();
  if (!page.endsWith('.html')) {
    page += '.html';
  }
  const navMap = {
    'deacon-quick-contact.html': '.deacon-link',
    'members.html': '.members-link',
    'contact-summary.html': '.summary-link'
  };
  Object.entries(navMap).forEach(([key, selector]) => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = (key === page) ? 'none' : '';
    });
  });
}

// Auto-close mobile menu when a link is clicked
document.addEventListener('DOMContentLoaded', function() {
  // Hide Back link if previous navigation was a POST

  let showBack = true;
  // Main nav page filenames
  const mainNavPages = ['deacon-quick-contact.html', 'index.html', 'members.html', 'contact-summary.html', 'summary-report.html'];
  // Check Navigation API for POST
  if (window.navigation && window.navigation.entries) {
    const entries = window.navigation.entries();
    if (entries && entries.length > 1) {
      const prev = entries[entries.length - 2];
      if (prev && prev.method && prev.method.toUpperCase() === 'POST') {
        showBack = false;
      }
    }
  }
  // Fallback: check sessionStorage for last navigation type
  if (sessionStorage.getItem('lastNavWasPost') === 'true') {
    showBack = false;
    sessionStorage.removeItem('lastNavWasPost');
  }
  // Only show Back if referrer is a valid, non-main page
  if (document.referrer) {
    let isMainNav = false;
    try {
      const refUrl = new URL(document.referrer);
      const refPath = refUrl.pathname.split('/').pop();
      isMainNav = mainNavPages.includes(refPath);
    } catch (e) {
      for (const page of mainNavPages) {
        if (document.referrer.includes(page)) {
          isMainNav = true;
          break;
        }
      }
    }
    showBack = !isMainNav;
  } else {
    showBack = false;
  }
  document.getElementById('siteNavBackLink').style.display = showBack ? '' : 'none';
  document.getElementById('siteNavBackLinkMobile').style.display = showBack ? '' : 'none';

  // Hide nav link for current page
  hideCurrentPageNavLinks();

  // Add auto-close for mobile menu
  const mobileMenu = document.getElementById('navMobileMenu');
  mobileMenu.querySelectorAll('a.nav-link').forEach(link => {
    link.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
    });
  });
});
document.addEventListener('submit', function(e) {
  if (e.target && e.target.method && e.target.method.toUpperCase() === 'POST') {
    sessionStorage.setItem('lastNavWasPost', 'true');
  }
}, true);
// JS API for page-specific links in navigation
// addNavLink API for direct script usage
window.addNavLink = function(html) {
  // Add to desktop nav
  const extra = document.querySelector('.site-nav .nav-extra');
  if (extra) {
    extra.insertAdjacentHTML('beforeend', html);
  }
  // Add to mobile nav
  const mobileExtra = document.querySelector('.site-nav #navMobileMenu .nav-extra');
  if (mobileExtra) {
    mobileExtra.insertAdjacentHTML('beforeend', html);
  }
}
// Example usage:
// import { addNavLink } from './site-nav.js';
// addNavLink('<a href="custom.html" class="nav-link">Custom</a>');
