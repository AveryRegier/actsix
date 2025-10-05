// JS API for page-specific links in navigation
export function addNavLink(html) {
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
