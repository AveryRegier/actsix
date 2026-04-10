// Load reusable navigation bar
document.addEventListener('DOMContentLoaded', async () => {
  const navContainer = document.getElementById('site-nav-container');
  if (navContainer) {
    const navResp = await fetch('site-nav.html');
    if (navResp.ok) {
      navContainer.innerHTML = await navResp.text();
      const script = document.createElement('script');
      script.src = 'site-nav.js';
      document.body.appendChild(script);
    }
  }

  const backLink = document.getElementById('helpBackLink');
  if (backLink) {
    backLink.addEventListener('click', (event) => {
      event.preventDefault();
      const menu = document.getElementById('navMobileMenu');
      if (menu) {
        menu.classList.remove('open');
      }
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    });
  }
});

// Determine the user's role token ('deacon', 'staff', 'helper', or null)
async function getCurrentRole() {
  try {
    const memberId = localStorage.getItem('memberId');
    if (!memberId) return null;

    const resp = await fetch(`/api/members/${encodeURIComponent(memberId)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` }
    });
    if (!resp.ok) return null;

    const payload = await resp.json();
    const member = payload && payload.member ? payload.member : payload;
    const tags = Array.isArray(member && member.tags) ? member.tags : [];
    if (tags.includes('deacon')) return 'deacon';
    if (tags.includes('staff')) return 'staff';
    if (tags.includes('helper')) return 'helper';
    return null;
  } catch {
    return null;
  }
}

// Filter behavior entries from config for this page and role
function getBehaviorsForRole(config, pageKey, role) {
  const entries = config[pageKey];
  if (!Array.isArray(entries)) return [];
  return entries.filter(entry => {
    const roles = entry.roles || [];
    return roles.includes('*') || (role !== null && roles.includes(role));
  });
}

async function loadHelpContent() {
  const contentEl = document.getElementById('help-content');

  const params = new URLSearchParams(window.location.search);
  const pageKey = params.get('page') || 'index';

  // Update page title
  document.title = `Help: ${pageKey} — Deacon Care System`;

  let config;
  try {
    const configResp = await fetch('/help/help-config.json');
    if (!configResp.ok) throw new Error('config not found');
    config = await configResp.json();
  } catch {
    contentEl.innerHTML = '<p class="help-error">Unable to load help configuration. Please try again later.</p>';
    return;
  }

  const role = await getCurrentRole();
  const behaviors = getBehaviorsForRole(config, pageKey, role);

  if (behaviors.length === 0) {
    contentEl.innerHTML = '<p class="help-empty">No help is available for your role on this page.</p>';
    return;
  }

  // Fetch and render each behavior markdown file in order
  let html = '';
  for (const behavior of behaviors) {
    try {
      const mdResp = await fetch(`/help/behaviors/${behavior.file}`);
      if (!mdResp.ok) continue;
      const md = await mdResp.text();
      html += marked.parse(md);
    } catch {
      // skip failed individual behavior
    }
  }

  if (!html.trim()) {
    contentEl.innerHTML = '<p class="help-empty">No help content could be loaded. Please try again later.</p>';
    return;
  }

  contentEl.innerHTML = html;

  // Make images responsive
  contentEl.querySelectorAll('img').forEach(img => {
    img.classList.add('help-screenshot');
    if (!img.alt) img.alt = 'Screenshot';
  });
}

loadHelpContent();
