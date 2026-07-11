import { apiFetch } from './fetch-utils.js';

const pendingNavLinkHtml = [];
let shouldHideCurrentPageNavLinks = false;

function applyBootstrapAddNavLink(html) {
  let applied = false;
  const desktopExtra = document.querySelector('.site-nav .nav-extra');
  if (desktopExtra) {
    desktopExtra.insertAdjacentHTML('beforeend', html);
    applied = true;
  }

  const mobileExtra = document.querySelector('.site-nav #navMobileMenu .nav-extra');
  if (mobileExtra) {
    mobileExtra.insertAdjacentHTML('beforeend', html);
    applied = true;
  }

  return applied;
}

function applyBootstrapHideCurrentPageNavLinks() {
  let page = window.location.pathname.split('/').pop();
  if (!page.endsWith('.html')) {
    page += '.html';
  }

  const navMap = {
    'deacon-quick-contact.html': '.deacon-link',
    'members.html': '.members-link',
    'contact-summary.html': '.summary-link',
    'sign-ups.html': '.sign-ups-link',
    'event-schedule.html': '.schedule-event-link'
  };

  Object.entries(navMap).forEach(([key, selector]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.display = (key === page) ? 'none' : '';
    });
  });
}

if (typeof window.goBack !== 'function') {
  window.goBack = function goBackBootstrap() {
    if (document.referrer) {
      window.location.href = document.referrer;
    } else {
      window.location.href = 'index.html';
    }
  };
}

if (typeof window.addNavLink !== 'function') {
  window.addNavLink = function addNavLinkBootstrap(html) {
    if (!applyBootstrapAddNavLink(html)) {
      pendingNavLinkHtml.push(html);
    }
  };
}

if (typeof window.hideCurrentPageNavLinks !== 'function') {
  window.hideCurrentPageNavLinks = function hideCurrentPageNavLinksBootstrap() {
    shouldHideCurrentPageNavLinks = true;
    applyBootstrapHideCurrentPageNavLinks();
  };
}

async function loadNav() {
  const navContainer = document.getElementById('site-nav-container');
  if (!navContainer) {
    return;
  }

  const navResp = await fetch('site-nav.html');
  if (!navResp.ok) {
    return;
  }

  navContainer.innerHTML = await navResp.text();

  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'site-nav.js';
    script.onload = resolve;
    script.onerror = resolve;
    document.body.appendChild(script);
  });

  while (pendingNavLinkHtml.length > 0) {
    const html = pendingNavLinkHtml.shift();
    if (typeof window.addNavLink === 'function') {
      window.addNavLink(html);
    } else {
      applyBootstrapAddNavLink(html);
    }
  }

  if (shouldHideCurrentPageNavLinks) {
    if (typeof window.hideCurrentPageNavLinks === 'function') {
      window.hideCurrentPageNavLinks();
    } else {
      applyBootstrapHideCurrentPageNavLinks();
    }
  }
}

// Load reusable navigation bar.
document.addEventListener('DOMContentLoaded', async () => {
  await loadNav();
});

let membersCache = [];
let currentSort = { key: 'lastName', asc: true };
let currentTagFilter = '';

async function fetchMembers() {
  const res = await apiFetch('/api/members');
  const data = await res.json();
  return data.members || [];
}

function getAllTags() {
  const tagsSet = new Set();
  membersCache.forEach((member) => {
    if (member.tags && Array.isArray(member.tags)) {
      member.tags.forEach((tag) => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet).sort();
}

function populateTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  const tags = getAllTags();
  tagFilter.innerHTML = '<option value="">All Tags</option>';
  tags.forEach((tag) => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    if (tag === currentTagFilter) {
      option.selected = true;
    }
    tagFilter.appendChild(option);
  });
}

function filterByTag() {
  const tagFilter = document.getElementById('tagFilter');
  currentTagFilter = tagFilter.value;
  renderMemberTable();
}

function sortTable(key) {
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = true;
  }
  renderMemberTable();
}

function wireInteractions() {
  const headers = document.querySelectorAll('#memberTable thead th');
  if (headers[0]) {
    headers[0].addEventListener('click', () => sortTable('lastName'));
  }
  if (headers[1]) {
    headers[1].addEventListener('click', () => sortTable('firstName'));
  }

  const tagFilter = document.getElementById('tagFilter');
  if (tagFilter) {
    tagFilter.addEventListener('change', filterByTag);
  }
}

async function renderMemberTable() {
  if (!membersCache.length) {
    membersCache = await fetchMembers();
  }

  populateTagFilter();
  const tbody = document.getElementById('memberTableBody');
  if (!membersCache.length) {
    tbody.innerHTML = '<tr><td colspan="3">No members found.</td></tr>';
    return;
  }

  let filteredMembers = membersCache;
  if (currentTagFilter) {
    filteredMembers = membersCache.filter(
      (member) => member.tags && member.tags.includes(currentTagFilter),
    );
  }

  filteredMembers.sort((a, b) => {
    const ka = (a[currentSort.key] || '').toLowerCase();
    const kb = (b[currentSort.key] || '').toLowerCase();
    if (ka < kb) return currentSort.asc ? -1 : 1;
    if (ka > kb) return currentSort.asc ? 1 : -1;

    if (currentSort.key === 'lastName') {
      const fa = (a.firstName || '').toLowerCase();
      const fb = (b.firstName || '').toLowerCase();
      if (fa < fb) return currentSort.asc ? -1 : 1;
      if (fa > fb) return currentSort.asc ? 1 : -1;
    }
    return 0;
  });

  tbody.innerHTML = '';
  if (!filteredMembers.length) {
    tbody.innerHTML = '<tr><td colspan="3">No members found with the selected tag.</td></tr>';
    return;
  }

  filteredMembers.forEach((member) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a class="member-link" href="household.html?id=${encodeURIComponent(member.householdId)}">${member.lastName}</a></td>
      <td><a class="member-link" href="household.html?id=${encodeURIComponent(member.householdId)}">${member.firstName}</a></td>
      <td>${(member.tags || []).map((tag) => `<span class='status-badge'>${tag}</span>`).join(' ')}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Temporary compatibility hooks while inline handlers are being removed elsewhere.
window.filterByTag = filterByTag;
window.sortTable = sortTable;

wireInteractions();
renderMemberTable();
