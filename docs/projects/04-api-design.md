# Proposal 4: API Design — Projects Feature

## Implementation File

`src/api/projects.js` — export `registerProjectRoutes(app)`, registered in `src/api.js`
following the same pattern as `registerContactRoutes`, `registerAssignmentRoutes`, etc.

---

## Role Reference

| Role | Notes |
|------|-------|
| `admin` | Superuser — all access, all pages, file approval. Currently equivalent to `lead-deacon` in authority but tracked separately so the administrator can test everything and manage files. |
| `lead-deacon` | Ministry lead (Travis) — funding/approval authority. Is also a `deacon`, so satisfies all deacon checks. Only called out separately when an action is specific to their ministry role. |
| `deacon` | Full project access. Auto-assigned on project create. |
| `staff` | Full project access. |
| `worker` | Scoped to assigned projects (`workerIds`). Sees address but no household history. |
| `helper` | **No access to any project endpoints.** |

**Roles are a list.** `c.req.roles` is an array. Use `hasRole(c, 'worker')` or
`verifyRole(c, ['deacon','staff'])`. `admin` satisfies every role check.
Since `lead-deacon` is also a `deacon`, write `verifyRole(c, ['deacon','staff'])` —
not `['deacon','staff','lead-deacon']` — unless the action is lead-deacon-specific.

---

## Role Access Summary

> `deacon` below includes `lead-deacon` and `admin` (they satisfy the same check).
> `lead-deacon` is only called out when the action is exclusive to that role.

| Action | Roles | Scoping |
|--------|-------|---------|
| List all projects | `deacon`, `staff` | All public projects; confidential only if assigned |
| List my projects | `worker` | Only where `workerIds` includes caller's memberId |
| Get single project | `deacon`, `staff`, `worker` | Worker: only if assigned; confidential: must be assigned |
| Create project | `deacon`, `staff` | Creator auto-added to `assignedDeaconIds`; lead-deacon auto-added |
| Propose project (deacon) | `deacon`, `staff` | Any household; proposer + lead-deacon auto-assigned |
| Propose project (member) | any authenticated member | **Own household only** (data privacy); lead-deacon auto-assigned |
| Accept proposal | `deacon`, `staff` | Sets `status: active`; accepting deacon added to `assignedDeaconIds` |
| Update project metadata | `deacon`, `staff` | Any assigned deacon or any staff |
| Set `visibility: confidential` | `deacon`, `staff` | Any assigned deacon or any staff |
| Manage funding / approve cost | `lead-deacon` only | *(Lead-deacon-specific action)* |
| Add / manage workers | `deacon`, `staff` | Any deacon can add workers |
| Update requirements | `deacon`, `staff`, `worker` | Worker: only if assigned |
| Update documents list | `deacon`, `staff`, `worker` | Worker: only if assigned (add only) |
| Add discussion update | `deacon`, `staff`, `worker` | Worker: only if assigned; forced non-confidential |
| List project updates | `deacon`, `staff`, `worker` | Worker: only if assigned; confidential entries redacted |
| Get projects for household | `deacon`, `staff` | Confidential projects only if assigned |
| Monthly report section | `deacon`, `staff` | — |
| Approve uploaded files | `admin` only | *(Admin-exclusive action)* |

---

## Shared Utility Endpoint

### `GET /api/me`
Returns the current caller's `memberId` and `roles` array from JWT.
Used by all frontend pages to determine role-based rendering.

**Auth:** any authenticated user

**Response:**
```json
{
  "memberId": "<id>",
  "roles": ["deacon", "worker"]
}
```

---

## Endpoints

### Projects

#### `GET /api/projects`
List projects.

**Auth:** `deacon`, `staff`, `worker`

**Confidential project scoping:**
- `admin` / `lead-deacon` — see all projects including all confidential
- `deacon` / `staff` — see all `visibility: public` projects + any `visibility: confidential`
  projects where they are in `assignedDeaconIds`
- `worker` — see only projects where they are in `workerIds` (public or confidential)

**Query params (deacon/staff only — ignored for workers):**
- `status` — filter by status (default: `active`)
- `phase` — filter by phase
- `visibility` — `public` | `confidential` | `all` (default: `all`)
- `assignedDeaconId` — filter by assigned deacon member ID
- `householdId` — filter by household

**Response:**
```json
{
  "projects": [ { ...project } ],
  "count": 12
}
```

---

#### `POST /api/projects`
Create a new project.

**Auth:** `deacon`, `staff`

**Behavior:** Creator is automatically added to `assignedDeaconIds`. Lead-deacon(s) are
also automatically added to `assignedDeaconIds`.

**Request body:**
```json
{
  "title": "Replace water heater",
  "description": "Heater failed, family has no hot water. 50-gallon unit needed.",
  "householdId": "<id>",
  "visibility": "public",
  "phase": "discovery",
  "status": "active",
  "assignedDeaconIds": [],
  "workerIds": [],
  "estimatedCost": null,
  "needsApproval": false,
  "communicationLink": ""
}
```

**Validation:**
- `title`, `description`, `householdId` are required
- `visibility` must be `public` or `confidential` (default: `public`)
- `phase` must be a valid phase value (default: `discovery`)
- `status` must be a valid status value (default: `active`)
- `requirements` and `documents` default to `[]`

**Response:**
```json
{
  "message": "Project created successfully",
  "id": "<projectId>",
  "project": { ...project }
}
```

---

#### `POST /api/projects/propose`
Submit a project proposal from any user.

**Auth:** any authenticated member

**Rules:**
- **Deacons, staff, lead-deacon, admin** — may propose for **any household**
  (same as creating a project, but sets `status: proposed` for explicit tracking)
- **All other members** (workers, plain members) — may only propose for a household
  they belong to (`householdId` must match a household containing the caller's `memberId`)
  This is a **data privacy rule** — non-deacons must not be able to access or create
  records on households they are not part of

**Server behavior for all proposals:**
1. Caller is set as `proposedBy`; `proposedAt` = now
2. If caller is a deacon/staff/lead-deacon: caller added to `assignedDeaconIds`
3. **Lead-deacon member(s) always auto-added to `assignedDeaconIds`** — ensures the lead
   deacon always has visibility on every proposed project regardless of who submitted it
4. Caller added to `workerIds` (non-deacon callers only — so they remain involved)
5. `status: 'proposed'`, `phase: 'discovery'`

**Request body:**
```json
{
  "title": "Roof repair after storm damage",
  "description": "Several shingles were blown off; leaking above the master bedroom.",
  "householdId": "<id>"
}
```

**Response:**
```json
{
  "message": "Project proposal submitted",
  "id": "<projectId>",
  "project": { ...project }
}
```

---

#### `GET /api/projects/:projectId`
Get a single project, enriched with related names.

**Auth:** `deacon`, `staff`, `worker` (worker: only if assigned)

**Confidential project guard:** if project has `visibility: confidential` and caller is not in
`assignedDeaconIds` and not `lead-deacon`/`admin`, return 403.

**Worker guard:** if caller is only a `worker` and `memberId` is not in `project.workerIds`, return 403.

**Confidential update handling:** API strips `text` from confidential updates for worker callers,
replacing with `{ ...update, text: null, redacted: true }`.

**Response:**
```json
{
  "project": { ...project, "requirements": [...], "documents": [...] },
  "household": {
    "lastName": "...",
    "address": { "street": "...", "city": "...", "state": "...", "zip": "..." },
    "primaryPhone": "..."
  },
  "assignedDeacons": [
    { "_id": "...", "firstName": "James", "lastName": "Hill" }
  ],
  "workers": [
    { "_id": "...", "firstName": "Bob", "lastName": "Carter" }
  ]
}
```

> **Note on address visibility:** `household.address` is returned to **all** assigned
> participants including workers — they need to know where to show up.
> `household.primaryPhone` is returned to deacon/staff only (hidden for workers —
> the assigned deacons handle household communication).
> The link to `household.html` is rendered in the UI for deacon/staff only.

---

#### `PATCH /api/projects/:projectId`
Update a project.

**Auth:** `deacon`, `staff`, `worker` (worker: requirements/documents only, if assigned)

**Writable fields by role:**

| Field | `deacon` / `staff` | `worker` |
|-------|---|---|
| `title`, `description` | ✅ | ❌ |
| `phase`, `status` | ✅ | ❌ |
| `visibility` | ✅ | ❌ |
| `assignedDeaconIds` | ✅ | ❌ |
| `workerIds` | ✅ | ❌ |
| `estimatedCost`, `needsApproval` | ✅ | ❌ |
| `communicationLink` | ✅ | ❌ |
| `requirements` | ✅ full edit | ✅ status + owner + notes on assigned projects |
| `documents` | ✅ add + remove | ✅ add only (on assigned projects) |

**Worker PATCH rule:** server only processes `requirements` and `documents` fields.
For `requirements`, only merges `status`, `owner`, and appended `notes` per item (by `_id`).
For `documents`, only appends new entries.

**Request body (deacon/staff — full):**
```json
{
  "phase": "preparation",
  "requirements": [
    { "_id": "<itemId>", "description": "2x6x8 PT lumber", "type": "material",
      "status": "open", "owner": "Bob Carter" }
  ]
}
```

**Request body (worker — requirements only):**
```json
{
  "requirements": [
    { "_id": "<existingItemId>", "status": "fulfilled", "owner": "Bob Carter",
      "notes": [{ "text": "Picked up 12 boards from Home Depot", "authorId": "<myId>" }] }
  ]
}
```

**Response:**
```json
{
  "message": "Project updated successfully",
  "id": "<projectId>",
  "project": { ...project }
}
```

---

#### `GET /api/households/:householdId/projects`
Get all projects for a household.

**Auth:** `deacon`, `staff`

**Confidential scoping:** returns only projects the caller is permitted to see — confidential
projects only included if caller is in `assignedDeaconIds`, or is `lead-deacon`/`admin`.

**Response:**
```json
{
  "householdId": "<id>",
  "projects": [ { ...project } ],
  "count": 3
}
```

---

### Project Updates (Discussion Log)

#### `GET /api/projects/:projectId/updates`
Get all updates, sorted most-recent first.

**Auth:** `deacon`, `staff`, `worker` (worker: only if assigned)

**Confidential handling:** confidential updates returned to workers have `text` stripped:
`{ ...update, text: null, redacted: true }`

**Response:**
```json
{
  "projectId": "<id>",
  "updates": [
    {
      "_id": "<updateId>",
      "projectId": "<id>",
      "authorId": "<memberId>",
      "author": { "firstName": "James", "lastName": "Hill" },
      "type": "status",
      "text": "Spoke with household — water heater model confirmed.",
      "confidential": false,
      "phaseSnapshot": "preparation",
      "createdAt": "2026-04-22T14:30:00.000Z"
    }
  ],
  "count": 7
}
```

---

#### `POST /api/projects/:projectId/updates`
Add a discussion update.

**Auth:** `deacon`, `staff`, `worker` (worker: only if assigned)

**Request body:**
```json
{
  "type": "note",
  "text": "Confirmed Saturday 9am work day.",
  "confidential": false
}
```

**Validation:**
- `type` must be one of: `note`, `status`, `blocker`, `resolved`
- For `worker` role: `type` must be `note`; `confidential` is forced `false`
- `text` must be non-empty
- `confidential` defaults to `false`; for `funding`-context discussions, default to `true`

**Server adds automatically:** `authorId` from JWT, `phaseSnapshot` from current project phase,
`createdAt` timestamp.

**Response:**
```json
{
  "message": "Update added successfully",
  "id": "<updateId>",
  "update": { ...update }
}
```

---

### Requirement Notes

#### `POST /api/projects/:projectId/requirements/:requirementId/notes`
Append a note to a specific requirement.

**Auth:** `deacon`, `staff`, `worker` (worker: only if assigned)

**Request body:**
```json
{
  "text": "Sourced from local lumber yard — will deliver Thursday."
}
```

**Server adds automatically:** `authorId` from JWT, `createdAt` timestamp, generated `_id`.

**Response:**
```json
{
  "message": "Note added",
  "requirementId": "<id>",
  "note": { "_id": "...", "text": "...", "authorId": "...", "createdAt": "..." }
}
```

---

### Report Extension

#### `GET /api/reports/summary` (existing — extend response)

Add a `projects` array to the existing summary response. Workers do not call this endpoint.

```json
{
  "summary": [ ...existing ],
  "projects": [
    {
      "project": { "_id": "...", "title": "...", "phase": "...", "status": "..." },
      "household": { "lastName": "Johnson", "primaryPhone": "555-1234" },
      "assignedDeacons": [ { "firstName": "James", "lastName": "Hill" } ],
      "lastUpdate": { "type": "note", "text": "...", "createdAt": "...", "author": { "firstName": "..." } }
    }
  ],
  "projectCount": 5
}
```

---

## Implementation Notes

### `verifyRole` must be awaited
`verifyRole` is async. Every route must `await verifyRole(c, [...])` before accessing `c.req.memberId` or `c.req.roles`.

### Worker scope guard pattern
```javascript
if (hasRole(c, 'worker') && !hasRole(c, 'deacon') && !hasRole(c, 'staff')) {
  if (!project.workerIds?.includes(c.req.memberId)) {
    return c.json({ error: 'Unauthorized access' }, 403);
  }
}
```

### `assignedDeaconIds` auto-assign on create/propose
```javascript
// Look up all members tagged 'lead-deacon'
const leadDeaconIds = (await membersCollection.find({ tags: { $contains: 'lead-deacon' } }))
  .map(m => m._id);
const assignedDeaconIds = Array.from(new Set([
  c.req.memberId,          // creator/proposer (if deacon)
  ...leadDeaconIds,        // always include lead-deacon(s)
  ...(body.assignedDeaconIds ?? [])
]));
```

### Requirement item IDs
Server generates a UUID for each new requirement item. Workers can only update existing items
by `_id` — they cannot add entirely new requirements.

### Confidential project scoping (server-side filter)
```javascript
// Applied to every project query for deacon/staff (not admin/lead-deacon)
const isPrivileged = hasRole(c, 'admin') || hasRole(c, 'lead-deacon');
if (!isPrivileged) {
  projects = projects.filter(p =>
    p.visibility !== 'confidential' ||
    p.assignedDeaconIds?.includes(c.req.memberId) ||
    p.workerIds?.includes(c.req.memberId)
  );
}
```

### Confidential update redaction
```javascript
const isWorkerOnly = hasRole(c, 'worker') && !hasRole(c, 'deacon') && !hasRole(c, 'staff');
const safeUpdate = isWorkerOnly && update.confidential
  ? { ...update, text: null, redacted: true }
  : update;
```

