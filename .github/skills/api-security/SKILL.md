---
name: api-security
description: >
  **WORKFLOW SKILL** — Write secure API route handlers for ActSix. Covers the multi-role
  JWT auth system, verifyRole (ASYNC — MUST be awaited or every request is authorized),
  hasRole (sync — use after verifyRole), worker scope guards, confidential data redaction,
  and Sengo connection via safeCollection* wrappers only. USE FOR: writing any new
  src/api/*.js route; adding role checks to an existing endpoint; understanding why an auth
  check is failing; designing access rules for a new feature. ALWAYS: await verifyRole before
  any DB access; guard worker access with hasRole after verifyRole; never access the DB
  directly — safeCollection* from helpers.js only; normalizePayload before any insert/update.
  NEVER: skip verifyRole on any authenticated endpoint; trust client-supplied memberId or
  role fields; use hasRole as the primary auth check (verifyRole first).
  DO NOT USE FOR: Sengo query operators (use sengo-queries skill); frontend/CSS work
  (use site-frontend skill).
---

# API Security Skill

## Auth System Overview

ActSix uses email OTP → JWT stored in an `actsix` cookie and/or `Authorization` header.
Auth middleware (in `src/auth/email-login.js`, `oidc.js`, `cognito.js`) validates the JWT
and sets two properties on every Hono request context:

```javascript
c.req.memberId  // string  — the authenticated member's _id
c.req.roles     // string[] — all roles this member holds
```

---

## Role System — "Hats" Model

Roles are **a list** — a member can hold multiple roles simultaneously.
Roles are derived from the member's `tags` array in the database.

### `generateToken` (auth.js)

```javascript
const ROLE_TAGS = ['lead-deacon', 'deacon', 'staff', 'helper', 'worker'];
// 'admin' is also extracted — members with an 'admin' tag get the admin role
const roles = ROLE_TAGS.filter(r => tags.includes(r));
```

Tags are applied by a deacon/staff member on the member record. Adding a tag to a member
record automatically gives them that role on their next login (JWT is refreshed).

### Role table

| Role | Who | Special powers |
|------|-----|----------------|
| `admin` | App administrator | Satisfies ALL role checks; only role that can approve uploaded files |
| `lead-deacon` | Travis (ministry lead) | Also a deacon — satisfies all deacon/staff checks; auto-assigned to all proposed projects |
| `deacon` | Deacon ministry | Full project CRUD; propose for any household |
| `staff` | Church staff | Full project CRUD |
| `worker` | Volunteers + household members | Scoped to assigned projects only |
| `helper` | H.E.L.P. ministry | **No access to any project endpoints** |

**`admin` is a superuser** — it satisfies ANY `verifyRole` call automatically.
**`lead-deacon` is also a deacon** — only list `lead-deacon` explicitly in access rules
when the action is exclusive to that role (e.g., auto-assignment on proposals).

---

## `verifyRole` — MUST BE AWAITED

```javascript
import { verifyRole, hasRole } from '../auth/auth.js';

export default function registerProjectRoutes(app) {
  app.get('/api/projects', async (c) => {
    // ✅ CORRECT — awaited
    if (!await verifyRole(c, ['deacon', 'staff', 'worker'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    // c.req.memberId and c.req.roles are now guaranteed populated
  });
}
```

### Why forgetting `await` is catastrophic

`verifyRole` returns a Promise. Without `await`, the `if` branch evaluates the Promise
object as truthy — meaning **every request is authorized** regardless of who called it.
This is the single most common security bug. There is no linter warning for it.

`verifyRole` also:
- Does a DB fallback if `c.req.roles` is empty but `c.req.memberId` exists
- Refreshes the JWT cookie when roles have changed
- Returns `true` automatically for `admin` role regardless of `requiredRoles`

---

## `hasRole` — Sync, Use AFTER `verifyRole`

```javascript
// src/auth/auth.js
export function hasRole(c, role) {
  return Array.isArray(c.req.roles) && c.req.roles.includes(role);
}
```

`hasRole` checks only `c.req.roles` in memory — **no DB lookup**.
Use it inside route handlers after `verifyRole` has already confirmed auth:

```javascript
app.patch('/api/projects/:id', async (c) => {
  if (!await verifyRole(c, ['deacon', 'staff', 'worker'])) {
    return c.json({ error: 'Unauthorized access' }, 403);
  }

  const isWorkerOnly = hasRole(c, 'worker')
    && !hasRole(c, 'deacon')
    && !hasRole(c, 'staff')
    && !hasRole(c, 'admin');

  // ... restrict writable fields based on isWorkerOnly
});
```

---

## Worker Scope Guard Pattern

Workers can only access projects they are assigned to. Apply after fetching the project:

```javascript
const project = await safeCollectionFindOne('projects', { _id: projectId });
if (!project) return c.json({ error: 'Project not found' }, 404);

const isWorkerOnly = hasRole(c, 'worker')
  && !hasRole(c, 'deacon')
  && !hasRole(c, 'staff')
  && !hasRole(c, 'admin');

if (isWorkerOnly && !project.workerIds?.includes(c.req.memberId)) {
  return c.json({ error: 'Unauthorized access' }, 403);
}
```

---

## Confidential Project Visibility

Projects with `visibility: 'confidential'` must be hidden from deacons/staff who are
not assigned. Apply this filter after every project list query:

```javascript
function canSeeProject(project, memberId, roles) {
  if (roles.includes('admin') || roles.includes('lead-deacon')) return true;
  if (project.visibility !== 'confidential') return true;
  return project.assignedDeaconIds?.includes(memberId)
      || project.workerIds?.includes(memberId);
}

const visible = projects.filter(p => canSeeProject(p, c.req.memberId, c.req.roles));
```

---

## Confidential Update Redaction

`project-updates` documents have `confidential: boolean`.
Workers must not receive the text of confidential updates:

```javascript
const isWorkerOnly = hasRole(c, 'worker')
  && !hasRole(c, 'deacon')
  && !hasRole(c, 'staff')
  && !hasRole(c, 'admin');

const safeUpdates = updates.map(u =>
  isWorkerOnly && u.confidential
    ? { ...u, text: null, redacted: true }
    : u
);
```

---

## Route File Structure

```javascript
// src/api/new-feature.js
import { getLogger } from '../util/logger.js';
import {
  safeCollectionFind,
  safeCollectionFindOne,
  safeCollectionInsert,
  safeCollectionUpdate,
} from '../util/helpers.js';
import { verifyRole, hasRole } from '../auth/auth.js';
import { randomUUID } from 'crypto';

const VALID_STATUSES = ['active', 'completed'];

function normalizeNewFeaturePayload(body) {
  const missingFields = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) missingFields.push('title');
  if (missingFields.length > 0) {
    return { error: `Missing required field(s): ${missingFields.join(', ')}` };
  }
  return { data: { title } };
}

export default function registerNewFeatureRoutes(app) {
  app.get('/api/new-feature', async (c) => {
    if (!await verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    const items = await safeCollectionFind('new-feature');
    return c.json({ items, count: items.length });
  });

  app.post('/api/new-feature', async (c) => {
    if (!await verifyRole(c, ['deacon', 'staff'])) {
      return c.json({ error: 'Unauthorized access' }, 403);
    }
    const body = await c.req.json();
    const { error, data } = normalizeNewFeaturePayload(body);
    if (error) return c.json({ error }, 400);

    const newDoc = {
      _id: randomUUID(),
      ...data,
      createdBy: c.req.memberId,
      createdAt: new Date().toISOString(),
    };
    await safeCollectionInsert('new-feature', newDoc);
    return c.json({ message: 'Created successfully', id: newDoc._id, item: newDoc }, 201);
  });
}
```

### Registering routes in `src/api.js`

```javascript
import registerNewFeatureRoutes from './api/new-feature.js';
// ...
registerNewFeatureRoutes(app);
```

---

## `normalizePayload` Pattern

Every POST/PATCH handler must use a `normalize*Payload(body)` function:

1. Trim and validate all string fields
2. Return `{ error: '...' }` on any validation failure
3. Return `{ data: { ...cleaned } }` on success
4. Never pass raw `body` directly to `safeCollectionInsert/Update`

Reference: `normalizeContactPayload()` in `src/api/contacts.js`.

---

## `GET /api/me` Endpoint

This endpoint is already registered in `src/api.js`. It returns the authenticated
member's ID and roles — used by all page scripts for role detection:

```json
{
  "memberId": "<id>",
  "roles": ["deacon", "lead-deacon"]
}
```

---

## Key Constraints Summary

| Concern | Rule |
|---------|------|
| `verifyRole` async | **MUST `await`** — omitting `await` authorizes every request |
| `hasRole` scope | Only use AFTER `verifyRole`; does not hit DB |
| DB access | **Only via `safeCollection*`** from `helpers.js` — never `db.collection()` in route files |
| Worker isolation | `project.workerIds.includes(c.req.memberId)` before any data access |
| Confidential projects | Filter by `visibility` + assigned arrays on every list response |
| Confidential updates | Redact `text` → `null, redacted: true` for worker-only callers |
| Member IDs | Always use `c.req.memberId` — never trust a client-supplied memberId for ownership |
| `admin` | Satisfies ALL role checks; only admin can approve uploaded files |
| `lead-deacon` | Also a deacon — only list in `verifyRole` when the action is exclusive to that role |
| `helper` | **No access to project endpoints** — never include in project `verifyRole` calls |
