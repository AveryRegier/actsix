---
name: site-frontend
description: >
  **WORKFLOW SKILL** — Build or modify site pages for ActSix. Covers the CSS design system
  (Grace Home theme), JavaScript file separation rules, badge/component patterns, and how
  client-side pages load and authenticate. USE FOR: building a new HTML page; adding a new
  *-page.js file; adding CSS badges or component styles; understanding site-nav, modals, or
  the role-gating pattern in page JS. ALWAYS: keep all page JavaScript in a separate
  *-page.js file (never inline in HTML); use existing CSS variables and badge classes from
  site.css; load site-nav.html via #site-nav-container; call GET /api/me for role detection.
  NEVER: add a <script> block with business logic directly in the HTML file; duplicate badge
  CSS already in site.css; skip the #loadingState / error state pattern.
  DO NOT USE FOR: API routes (use api-security skill); Sengo queries (use sengo skill).
---

# Site Frontend Skill

## Hard Rule: JavaScript in Separate Files

Every HTML page that has behaviour **must** keep ALL JavaScript in a dedicated
`site/<page-name>-page.js` file. This is enforced for test coverage — the e2e suite
can only instrument `*-page.js` files, not inline `<script>` blocks.

```
site/
  projects.html             ← HTML shell only
  projects-page.js          ← ALL page JavaScript lives here
  project-detail.html
  project-detail-page.js
  edit-project.html
  edit-project-page.js
```

**Allowed in HTML only:**

```html
<link rel="stylesheet" href="site.css">
<div id="site-nav-container"></div>
<script type="module" src="projects-page.js"></script>
```

**Not allowed in HTML:** `<script>` blocks containing function definitions, event
listeners, fetch calls, DOM manipulation, or any business logic. All of that goes
in `*-page.js`.

---

## CSS Design System — Grace Home Theme

All color and surface tokens are in `site/site.css`. **Always use these — never hardcode
hex values in new styles.**

```css
/* Color tokens */
--gh-text: #1f4f5a;            /* Primary text */
--gh-text-muted: #426671;      /* Secondary / muted text */
--gh-surface: #ffffff;         /* Card / panel background */
--gh-surface-soft: #eef5f7;    /* Slightly tinted surface */
--gh-surface-subtle: #e3ecef;  /* More tinted surface */
--gh-border: #c9d8de;          /* Borders and dividers */
--gh-dark: hsl(192.6,89.29%,21.96%);       /* Nav bar, dark headers */
--gh-dark-soft: hsl(180,43.7%,26.47%);     /* Hover/active nav state */
--gh-accent: hsl(181.88,13.56%,53.73%);    /* Primary action buttons */
--gh-accent-hover: hsl(181.88,13.56%,46%); /* Button hover */
--gh-link: hsl(192.6,89.29%,21.96%);       /* Link color */
```

---

## HTML Shell Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects – ActSix</title>
  <link rel="stylesheet" href="site.css">
</head>
<body>
  <div id="site-nav-container"></div>

  <div class="container" style="margin-top: 64px;">
    <div class="header">
      <h2>Projects</h2>
    </div>

    <div id="loadingState" class="section">Loading…</div>

    <div id="projectsContent" class="section" style="display:none">
      <!-- rendered by projects-page.js -->
    </div>
  </div>

  <script type="module" src="projects-page.js"></script>
</body>
</html>
```

Layout classes from `site.css`:
| Class | Purpose |
|-------|---------|
| `.container` | Centered content card with shadow, 64px top margin |
| `.header` | Dark-background title bar inside container |
| `.section` | Padded content region inside container |
| `.content` | Alternative padded content area |
| `.modal`, `.modal-content` | Modal overlay |
| `.household-info` | Soft-background info panel (address/contact blocks) |

---

## Navigation Bar

Every authenticated page includes:

```html
<div id="site-nav-container"></div>
```

The nav HTML is fetched and injected by `site/site-nav.js`. It renders the fixed top bar,
handles the mobile hamburger menu, and auto-sets the `?` help link for the current page.
No additional setup needed in page JS.

---

## Button Styles

```html
<!-- Primary action -->
<button class="section-button">Save</button>

<!-- Icon/ghost button -->
<button class="icon-btn" aria-label="Edit"><span>✏️</span></button>
```

---

## Badge Classes (All in site.css — Do Not Duplicate)

### Phase badges (projects)

```javascript
function phaseBadge(phase) {
  return `<span class="phase-badge phase-${phase}">${phase}</span>`;
}
// Valid phase values: discovery | vetting | preparation | implementation | followup | completed | cancelled
```

```html
<span class="phase-badge phase-discovery">discovery</span>
<span class="phase-badge phase-preparation">preparation</span>
<span class="phase-badge phase-completed">completed</span>
```

### Requirement badges

```html
<!-- Status -->
<span class="req-status-badge req-open">open</span>
<span class="req-status-badge req-blocked">blocked</span>
<span class="req-status-badge req-fulfilled">fulfilled</span>

<!-- Type -->
<span class="req-type-badge">material</span>
```

### Update type badge

```html
<span class="update-type-badge">note</span>
```

### Tag badges (members)

```html
<span class="tag-badge tag-shut-in">shut-in</span>
<span class="tag-badge tag-widow">widow</span>
<span class="tag-badge tag-long-term-needs">long-term needs</span>
```

### Status color helpers

```html
<span class="status-red">Overdue</span>
<span class="status-yellow">Due soon</span>
<span class="status-green">Current</span>
```

---

## Page JavaScript Structure

```javascript
// projects-page.js

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate — get roles from /api/me
  const meRes = await fetch('/api/me', { credentials: 'include' });
  if (!meRes.ok) {
    window.location.href = '/email-login.html';
    return;
  }
  const { roles = [], memberId } = await meRes.json();

  const loadingEl = document.getElementById('loadingState');
  const contentEl = document.getElementById('projectsContent');

  try {
    // 2. Fetch data
    const res = await fetch('/api/projects', { credentials: 'include' });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const { projects } = await res.json();

    // 3. Render
    renderProjects(projects, roles);
    loadingEl.style.display = 'none';
    contentEl.style.display = '';
  } catch (err) {
    loadingEl.innerHTML = 'Failed to load. <button onclick="location.reload()">Retry</button>';
  }
});

function renderProjects(projects, roles) {
  const isDeacon = roles.includes('deacon') || roles.includes('staff') || roles.includes('admin');
  // ...
}
```

### `GET /api/me` — Role Detection

**Always use `/api/me`** for role detection — never parse the JWT manually or trust
a stored `userRole` string.

```javascript
const { roles, memberId } = await (await fetch('/api/me', { credentials: 'include' })).json();
// roles: string[] e.g. ['deacon', 'lead-deacon']

const isDeaconOrStaff = roles.some(r => ['deacon', 'staff', 'admin'].includes(r));
const isWorkerOnly    = roles.includes('worker') && !roles.some(r => ['deacon','staff','admin'].includes(r));
```

---

## Role-Based UI Gating

Show/hide elements based on roles — do not just disable them:

```javascript
// Show "Add Project" button for deacon/staff/admin only
const canCreate = roles.some(r => ['deacon', 'staff', 'admin'].includes(r));
document.getElementById('addProjectBtn').style.display = canCreate ? '' : 'none';

// Worker: show address, hide phone and household link
if (isWorkerOnly) {
  document.getElementById('householdPhoneRow')?.remove();
  document.querySelectorAll('.household-detail-link').forEach(el => el.remove());
}
```

---

## Modal Pattern

HTML shell (no logic):

```html
<div id="addRequirementModal" class="modal" style="display:none">
  <div class="modal-content">
    <button class="icon-btn modal-close" id="closeAddRequirement">✕</button>
    <h3>Add Requirement</h3>
    <form id="addRequirementForm"><!-- fields --></form>
  </div>
</div>
```

Wire in `*-page.js`:

```javascript
function wireModal(openBtnId, modalId, closeBtnId) {
  const modal = document.getElementById(modalId);
  document.getElementById(openBtnId)?.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  document.getElementById(closeBtnId)?.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}
```

---

## Checklist Before Submitting Frontend Changes

- [ ] All business logic is in `*-page.js`, not inline in HTML
- [ ] No hardcoded hex colors — uses `--gh-*` CSS variables
- [ ] Badge classes used from `site.css` (not new duplicated styles)
- [ ] `GET /api/me` used for role detection (not JWT parsing)
- [ ] `#loadingState` shown during fetch, hidden on success
- [ ] Error state has a retry affordance
- [ ] Role-gated UI elements hidden (not just disabled) for unauthorised roles
- [ ] `<script type="module">` — not `<script>` without type
- [ ] Mobile layout visually tested at ≤600px
