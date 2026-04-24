# Proposal 3: Site Structure Changes

## Role Reference

| Role | Projects list | Project detail | Edit project | Requirements | Documents | Discussion |
|------|---|---|---|---|---|---|
| `admin` | All (incl. confidential) | Any | Yes | Full edit | Full edit | Yes |
| `lead-deacon` | All (incl. confidential) | Any | Yes | Full edit | Full edit | Yes |
| `deacon` | All public + assigned-to confidential | Any matching | Yes | Full edit | Full edit | Yes |
| `staff` | All public + assigned-to confidential | Any matching | Yes | Full edit | Full edit | Yes |
| `worker` | **Assigned only** | **Assigned only** | No | Status + notes only | View + add | Yes (non-confidential) |
| `helper` | — | — | — | — | — | — |

Workers have **no access to `household.html`** or contact history. Their entry point is
`projects.html` (or the combined My Assignments & Projects page).

---

## New Pages

### `site/my-work.html` + `site/my-work-page.js`
**Purpose:** Personal dashboard combining assignments and project participation. Entry point
for deacons and workers. Also the place where any member can propose a project.

**Section 1 — My Assignments** *(deacon/lead-deacon/staff only)*
- Calls `GET /api/assignments` filtered to `assignedDeaconId = currentMemberId`
- Shows the same compact assignment cards as the current assignments view:
  household name, member name, phone number, last contact date
- One-tap phone/text link per contact
- Visible only when caller has a `deacon` or `staff` role

**Section 2 — My Projects**
- Calls `GET /api/projects?assigned=me` (or `GET /api/projects` scoped by worker role)
- Shows a compact project card per project:
  household name, project title, phase badge, last update preview, link to detail page
- "New Project" button at top of section (deacon/staff only) → `edit-project.html`
- Shown to all roles (deacon, staff, worker)

**Section 3 — Propose a Project** *(any authenticated member)*
- Short inline form: household (auto-filled to own household for non-deacons; searchable for deacons), title, description
- **Deacons** can propose for any household
- **Non-deacon members** can only propose for their own household (data privacy)
- Posts to `POST /api/projects/propose`
- On submit: lead-deacon is always auto-assigned; submitting deacon is auto-assigned; non-deacon submitter added to `workerIds`
- Shows confirmation with link to the new project on success
- Shown to all authenticated members

**Role access:** `deacon`, `staff`, `lead-deacon`, `worker`, any member (propose only)

---

### `site/projects.html` + `site/projects-page.js`
**Purpose:** Full project list — all projects with filters. Primarily for deacons and staff
managing the overall ministry workload.

**Behavior:**
- Loads via `GET /api/projects`
- API automatically scopes results: workers see only their assigned projects; deacons/staff
  see all public projects + confidential projects they are assigned to;
  admin/lead-deacon see all projects including all confidential
- Default filter: `status=active`
- Filter controls (deacon/staff/lead-deacon/admin — hide for workers):
  phase, status, visibility, assigned deacon, household last name search
- Each row shows: household name, project title, phase badge, assigned deacons, last update date,
  last update preview (first 80 chars), confidential lock icon if applicable
- Clicking a row → `project-detail.html?id=<projectId>`
- "New Project" button (deacon/staff only) → `edit-project.html`
- Role access: `deacon`, `staff`, `lead-deacon`, `admin`, `worker`

---

### `site/project-detail.html` + `site/project-detail-page.js`
**Purpose:** View a single project. Roles: `deacon`, `staff`, `lead-deacon`, `admin`, `worker`
(worker: only if assigned; blocked for confidential projects if not assigned).

**Sections:**
1. **Project header** — title, phase badge, status, visibility badge (🔒 if confidential)
   - Household name + **address** — shown to all assigned participants including workers
   - Household phone + link to `household.html` for deacon/staff only (hidden for workers)
2. **Assigned deacons + worker list** — names and contact info
3. **Description** — project description
4. **Cost** — estimated cost if set; hidden from workers if `needsApproval` is true
5. **Communication link** — shown to all assigned participants
6. **Requirements** — see requirements behavior below
7. **Documents** — see documents behavior below
8. **Discussion / Updates timeline** — most recent first; "Add Update" form for all roles

**Requirements panel:**
- All assigned participants can see the full requirements list
- Deacon/staff/lead-deacon/admin: can add, edit, or remove any requirement
- Workers: can change `status`, `owner`, and append notes on existing requirements
  (inline "Mark Fulfilled" button; "Add Note" form per requirement)
- Uses `PATCH /api/projects/:projectId` or `POST .../requirements/:id/notes`
- "All requirements met" banner appears when all items are `fulfilled` — convenience only

**Documents panel:**
- All assigned participants can see and open document links
- All roles can add a new document (label + type; URL or file upload when Files feature lands)
- Deacon/staff/admin can remove documents; workers can only add
- Uses `PATCH /api/projects/:projectId` with updated `documents` array

**Discussion panel:**
- Inline "Add Update" form: type selector + textarea + confidential checkbox
- Posts to `POST /api/projects/:projectId/updates`
- Workers: type selector fixed to `note`; confidential checkbox hidden (always false)
- Confidential updates shown to workers as: *"[Confidential update — deacon/staff only]"*
- Deacon/staff/admin: can post any type; can mark any update confidential

**"Edit Project" button:** visible to deacon/staff/admin only → `edit-project.html?id=<projectId>`

**Phase stepper:** visual row of phase pills; clicking updates phase via
`PATCH /api/projects/:projectId`; visible and interactive for deacon/staff/admin only

---

### `site/edit-project.html` + `site/edit-project-page.js`
**Purpose:** Create a new project or edit an existing one. Roles: `deacon`, `staff`,
`lead-deacon`, `admin` only. Workers attempting to access are redirected to `projects.html`.

**Behavior (Create mode):** `?householdId=<id>` pre-fills household; without it, household
is a required searchable select field.
**Behavior (Edit mode):** `?id=<projectId>` loads existing data into the form.

**Fields:**
- Household (required — searchable, locked after creation)
- Title (required text input)
- Description (required textarea)
- Phase (required select — all phase values)
- Status (required select — `active`, `on-hold`, `cancelled`)
- Visibility (required select — `public`, `confidential`; default `public`)
- Assigned Deacons (required — multi-select of members tagged `deacon` or `lead-deacon`)
- Workers (optional — multi-select of any members; search by name)
- Estimated Cost (optional number input)
- Needs Approval (checkbox)
- Communication Link (optional text input)

**Note:** Requirements and documents are managed on the detail page, not the edit form.

**On submit:** POST (create) or PATCH (edit) to `/api/projects[/:projectId]` then redirect
to `project-detail.html?id=<id>`

---

## Modified Pages

### `site/household.html` / `site/household-page.js`
**Add:** A "Projects" section below the contact history section.

- Calls `GET /api/households/:householdId/projects`
- Shows a compact list of projects: title, phase badge, visibility badge, last update summary
- "View" link per project → `project-detail.html?id=<projectId>`
- "New Project" button → `edit-project.html?householdId=<householdId>`
- Displayed to: `deacon`, `staff`, `lead-deacon`, `admin` only (workers do not access this page)
- Confidential projects only shown to those who are assigned to them (API handles scoping)

### `site/index.html` / `site/index-page.js`
**Add:** "Projects" quick-access card on the dashboard.
- Shows count of active projects (or count of worker's assigned active projects)
- Links to `projects.html`
- Shown to: `deacon`, `staff`, `lead-deacon`, `admin`, `worker`

### `site/site-nav.html`
**Add:** "Projects" nav link. Shown to all authenticated users.
**Add:** "My Work" nav link. Shown to deacons, staff, workers.

---

## Auth Changes: `src/auth/auth.js`

Roles are generated from **all matching member tags** — not a single winner.
The `generateToken` function must emit `roles: string[]` from the member's tags:

```javascript
const KNOWN_ROLES = ['admin', 'lead-deacon', 'deacon', 'staff', 'helper', 'worker'];
const roles = (member.tags ?? []).filter(t => KNOWN_ROLES.includes(t));
```

A member tagged `['admin', 'deacon']` gets `roles: ['admin', 'deacon']` in their JWT.

---

## Consistent Patterns to Follow

| Pattern | Where to copy from |
|---|---|
| `apiFetch()` for all API calls | `site/fetch-utils.js` |
| `GET /api/me` for current user roles | `src/api.js` — `GET /api/me` endpoint |
| Role-gated element visibility | `site/household-page.js` |
| `?id=` URL param extraction | `site/household-page.js` `getHouseholdId()` |
| `document.addEventListener('DOMContentLoaded', ...)` entry point | All existing `*-page.js` |

---

## CSS Additions (`site/site.css`)

Badge classes for phases, update types, requirement status, and visibility:

```
.phase-badge               — base badge style
.phase-discovery           — neutral/grey
.phase-vetting             — yellow/amber
.phase-funding             — blue
.phase-preparation         — purple
.phase-implementation      — orange
.phase-completed           — green
.phase-cancelled           — red/muted

.update-type-note          — default/grey
.update-type-status        — blue
.update-type-blocker       — red
.update-type-resolved      — green

.req-open                  — red/muted
.req-blocked               — orange
.req-fulfilled             — green

.req-type-material         — grey
.req-type-plans            — blue
.req-type-funding          — amber
.req-type-labor            — purple
.req-type-permit           — teal
.req-type-other            — grey/light

.visibility-confidential   — red/lock icon badge
.visibility-public         — (no badge needed — default)
```


## Role Reference

| Role | Projects list | Project detail | Edit project | Materials | Documents | Discussion |
|------|---|---|---|---|---|---|
| `deacon` | All projects | Any | Yes (lead or any) | Full edit | Full edit | Yes |
| `staff` | All projects | Any | Yes | Full edit | Full edit | Yes |
| `worker` | **Assigned only** | **Assigned only** | No | View + update status/providedBy | View + add | Yes (assigned only) |
| `helper` | — | — | — | — | — | — |

Workers have **no access to `household.html`** or contact history. Their entry point is
`projects.html` where they can only see projects they are assigned to.

---

## New Pages

### `site/projects.html` + `site/projects-page.js`
**Purpose:** List projects. Deacons/staff see all; workers see only their assigned projects.

**Behavior:**
- Loads on page ready via `GET /api/projects`
- API automatically scopes results for workers (by JWT memberId vs. `workerIds`)
- Default filter: `status=active`
- Filter controls (deacon/staff only — hide for workers): phase, status, assigned deacon,
  household last name search
- Each row shows: household name, project title, phase badge, lead deacon, last update date,
  last update preview (first 80 chars)
- Clicking a row navigates to `project-detail.html?id=<projectId>`
- "New Project" button (deacon/staff only) → `edit-project.html`
- Role access: `deacon`, `staff`, `worker`

### `site/project-detail.html` + `site/project-detail-page.js`
**Purpose:** View a single project. Roles: `deacon`, `staff`, `worker` (only if assigned).

**Sections:**
1. **Project header** — title, phase badge, status, household name + phone
   (household is a link to `household.html` for deacon/staff only — hidden for workers)
2. **Lead deacon + worker list** — names and contact info
3. **Description** — project description
4. **Cost** — estimated cost if set (hidden from workers if `needsApproval` is true)
5. **Communication link** — shown to all assigned participants
6. **Materials list** — see materials behavior below
7. **Documents** — see documents behavior below
8. **Discussion / Updates timeline** — most recent first; "Add Update" form for all roles

**Materials panel:**
- All assigned participants can see the full materials list
- Deacon/staff: can add, edit, or remove any material item
- Workers: can change `status` and set `providedBy` on items
  (inline "I'll provide this" button sets `providedBy = currentMemberId`)
- Uses `PATCH /api/projects/:projectId` with updated `materials` array

**Documents panel:**
- All assigned participants can see and open document links
- All roles can add a new document (label + URL + type)
- Deacon/staff can remove documents; workers can only add
- Uses `PATCH /api/projects/:projectId` with updated `documents` array

**Discussion panel:**
- Inline "Add Update" form: type selector + textarea
- Posts to `POST /api/projects/:projectId/updates`
- Workers can only post `note` type; deacon/staff can post any type

**"Edit Project" button:** visible to deacon/staff only → `edit-project.html?id=<projectId>`

**Phase stepper:** visual row of phase pills; clicking one updates phase via
`PATCH /api/projects/:projectId`; visible and interactive for deacon/staff only

### `site/edit-project.html` + `site/edit-project-page.js`
**Purpose:** Create a new project or edit an existing one. Roles: `deacon`, `staff` only.
Workers attempting to access this page are redirected to `projects.html`.

**Behavior (Create mode):** `?householdId=<id>` pre-fills household; without it, household
  is a required searchable select field.
**Behavior (Edit mode):** `?id=<projectId>` loads existing data into the form.

**Fields:**
- Household (required — searchable, locked after creation)
- Title (required text input)
- Description (required textarea)
- Phase (required select — all phase values)
- Status (required select — `active`, `on-hold`, `cancelled`)
- Lead Deacon (required — searchable select filtered to members tagged `deacon`)
- Workers (optional — multi-select of any members; search by name)
- Estimated Cost (optional number input)
- Needs Approval (checkbox)
- Communication Link (optional text input)

**Note:** Materials and documents are managed on the detail page, not the edit form, to
keep the form focused and allow workers to contribute without edit access.

**On submit:** POST (create) or PATCH (edit) to `/api/projects[/:projectId]` then redirect
  to `project-detail.html?id=<id>`

---

## Modified Pages

### `site/household.html` / `site/household-page.js`
**Add:** A "Projects" section below the contact history section.

- Calls `GET /api/households/:householdId/projects`
- Shows a compact list of projects: title, phase badge, last update summary
- "View" link per project → `project-detail.html?id=<projectId>`
- "New Project" button → `edit-project.html?householdId=<householdId>`
- Displayed to roles: `deacon`, `staff` only (workers do not access this page)

### `site/index.html` / `site/index-page.js`
**Add:** "Projects" quick-access card on the dashboard.
- Shows count of active projects (or count of worker's assigned active projects)
- Links to `projects.html`
- Shown to: `deacon`, `staff`, `worker`

### `site/site-nav.html`
**Add:** "Projects" nav link. Shown to all authenticated users (deacon, staff, worker).

---

## Auth Changes: `src/auth/auth.js`

The `generateToken` function currently derives role as:
```javascript
const role = tags.includes('deacon') ? 'deacon'
           : tags.includes('staff') ? 'staff'
           : tags.includes('helper') ? 'helper'
           : null;
```

**Must be updated to:**
```javascript
const role = tags.includes('deacon') ? 'deacon'
           : tags.includes('staff') ? 'staff'
           : tags.includes('helper') ? 'helper'
           : tags.includes('worker') ? 'worker'
           : null;
```

---

## Consistent Patterns to Follow

| Pattern | Where to copy from |
|---|---|
| `apiFetch()` for all API calls | `site/fetch-utils.js` |
| `localStorage.getItem('memberId')` + `apiFetch api/members/:id` for role check | `site/household-page.js` lines 32–47 |
| Role-gated element visibility (show/hide based on `currentUser.tags`) | `site/household-page.js` |
| `?id=` URL param extraction | `site/household-page.js` `getHouseholdId()` |
| `document.addEventListener('DOMContentLoaded', ...)` entry point | All existing `*-page.js` |

---

## CSS Additions (`site/site.css`)

Add badge classes for phases, update types, and material status:

```
.phase-badge               — base badge style
.phase-discovery           — neutral/grey
.phase-vetting             — yellow/amber
.phase-funding             — blue
.phase-preparation         — purple
.phase-implementation      — orange
.phase-complete            — green
.phase-cancelled           — red/muted

.update-type-note          — default/grey
.update-type-status        — blue
.update-type-blocker       — red
.update-type-resolved      — green

.material-status-needed    — red/muted
.material-status-sourced   — yellow/amber
.material-status-obtained  — blue
.material-status-used      — green/muted
```
