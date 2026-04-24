---
name: sengo-queries
description: >
  **WORKFLOW SKILL** — Write correct Sengo database queries for ActSix. Sengo is a custom
  S3-backed NoSQL store with a MongoDB-like API but significant limitations that cause SILENT
  FAILURES. USE FOR: writing any safeCollection* call; deciding how to filter or search
  records; designing a new collection; understanding why a query silently returns no results.
  ALWAYS: use safeCollection* wrappers from helpers.js (never call db directly in API files);
  post-process results in JavaScript when Sengo cannot express the filter; use $set only for
  updates (no $push/$pull/$inc). NEVER: use $or, $and, $regex, $exists, $gt/$lt, aggregations,
  or sort on find() — these silently return empty results without any error.
  DO NOT USE FOR: general JavaScript logic; API route structure (use api-security skill).
---

# Sengo Query Skill

## What Sengo Is

Sengo is a custom S3-backed document store accessed via a MongoDB-like JavaScript driver.
Documents are stored as S3 objects (one per document). Every `find()` is a full collection
scan — there are no secondary indexes. Unsupported query operators **silently return empty
results** rather than throwing — this is the most common source of hard-to-debug bugs.

**Client setup (do not modify):**

```javascript
// src/util/sengoClient.js
const db = sengoClient.db(process.env.S3_BUCKET || 'deacon-care-system');
```

---

## The Only Wrappers You Should Use in API Code

**Never call `db.collection()` directly in `src/api/*.js`.**
Always import from `src/util/helpers.js`:

```javascript
import {
  safeCollectionFind,    // Returns array (empty array on error, never throws)
  safeCollectionFindOne, // Returns single doc or null
  safeCollectionInsert,  // Inserts doc with retry on ETag conflict
  safeCollectionUpdate,  // Updates doc with retry on ETag conflict
  getCache,              // Read from cache collection
  setCache,              // Write to cache collection
  deleteCache,           // Invalidate a cache key
} from '../util/helpers.js';
```

`safeCollectionFind` and `safeCollectionFindOne` **never throw** — they return `[]` / `null`
on error. This is intentional. Log separately if you need a trace.

---

## Supported Query Operators (Safe to Use)

```javascript
// Simple equality — works
{ _id: 'abc123' }
{ householdId: 'hh-1' }
{ isActive: true }
{ status: 'active' }

// Multiple equality fields — implicit AND — works
{ householdId: 'hh-1', isActive: true }

// $in: field is scalar, match if value is one of listed values — works
{ _id: { $in: ['id1', 'id2', 'id3'] } }
{ status: { $in: ['active', 'proposed'] } }

// $in: field is an array, match if array contains any of the listed values — works
{ tags: { $in: ['deacon', 'staff'] } }
{ assignedDeaconIds: { $in: [memberId] } }

// Dot-notation for nested object fields — works
{ 'temporaryAddress.isActive': true }
{ 'address.city': 'Des Moines' }
```

### `findOne` with sort option

`safeCollectionFindOne` accepts an options object with `sort`:

```javascript
// Most recent contact for a member — works
const latest = await safeCollectionFindOne(
  'contacts',
  { memberId: { $in: [memberId] } },
  { sort: { contactDate: -1 } }
);
```

> **`find()` does NOT support sort.** The sort option is silently ignored on `find()`.
> Post-process with `.sort()` in JavaScript:
> ```javascript
> const sorted = updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
> ```

---

## Operators That DO NOT WORK — Silent Failures

These operators either return empty results or are silently ignored.
**Do not use them.** Post-process in JavaScript instead.

| Operator | Behavior | Workaround |
|----------|----------|------------|
| `$or` | **Silent empty result** | Fetch broader set, filter with JS `.filter()` |
| `$and` | **Silent empty result** | Use implicit AND (multiple fields in query object) |
| `$ne` | **Silent empty result** | Fetch all, JS `.filter(x => x.field !== val)` |
| `$gt` / `$lt` / `$gte` / `$lte` | **Silent empty result** | Fetch all, JS date/number compare |
| `$regex` | **Silent empty result** | Fetch all, JS `String.includes()` or `.match()` |
| `$exists` | **Silent empty result** | Fetch all, JS `'field' in doc` |
| Sort on `find()` | **Silently ignored** | Post-sort: `results.sort((a, b) => ...)` |
| Aggregation pipelines | **Not supported** | Manual grouping in JS |
| Cross-collection joins | **Not supported** | Parallel `safeCollectionFind` + JS merge |
| `$push` / `$pull` / `$inc` / `$unset` | **Not supported** | Fetch, modify in JS, `$set` whole field |

### Example: replacing `$or`

```javascript
// WRONG — $or silently returns nothing
const results = await safeCollectionFind('projects', {
  $or: [{ status: 'active' }, { status: 'proposed' }]
});

// CORRECT — fetch all, filter in JS
const all = await safeCollectionFind('projects');
const results = all.filter(p => p.status === 'active' || p.status === 'proposed');
```

### Example: replacing `$ne`

```javascript
// WRONG — $ne silently returns nothing
const active = await safeCollectionFind('projects', { status: { $ne: 'completed' } });

// CORRECT
const all = await safeCollectionFind('projects');
const active = all.filter(p => p.status !== 'completed');
```

### Example: replacing `$gt` (date comparison)

```javascript
// WRONG — $gt silently returns nothing
const recent = await safeCollectionFind('contacts', {
  contactDate: { $gt: '2026-01-01' }
});

// CORRECT
const all = await safeCollectionFind('contacts');
const recent = all.filter(c => c.contactDate > '2026-01-01');
```

---

## Updating Documents

`safeCollectionUpdate` uses Sengo's optimistic concurrency (ETag-based `If-Match`).
It retries 3 times with exponential backoff on `ConditionalRequestConflict`.

**Supported update operators: `$set` only.**

```javascript
// Update scalar fields
await safeCollectionUpdate(
  'projects',
  { _id: projectId },
  { $set: { status: 'completed', updatedAt: new Date().toISOString() } }
);
```

To append to an array (no `$push`) — fetch, modify, `$set`:

```javascript
const project = await safeCollectionFindOne('projects', { _id: projectId });
const updatedRequirements = [...(project.requirements || []), newRequirement];
await safeCollectionUpdate(
  'projects',
  { _id: projectId },
  { $set: { requirements: updatedRequirements, updatedAt: new Date().toISOString() } }
);
```

To remove from an array (no `$pull`) — fetch, filter, `$set`:

```javascript
const project = await safeCollectionFindOne('projects', { _id: projectId });
const filtered = project.workerIds.filter(id => id !== workerIdToRemove);
await safeCollectionUpdate('projects', { _id: projectId }, {
  $set: { workerIds: filtered, updatedAt: new Date().toISOString() }
});
```

---

## Inserting Documents

```javascript
import { randomUUID } from 'crypto';

await safeCollectionInsert('projects', {
  _id: randomUUID(),    // Must be a string; becomes the S3 object key
  title: 'Replace water heater',
  householdId,
  createdAt: new Date().toISOString(),
  // ...all other fields with their defaults
});
```

`_id` is required and must be unique. Use `randomUUID()` for new documents.
`safeCollectionInsert` throws after 3 failed retries on ETag conflict — wrap callers
in try/catch when a 500 response is acceptable.

---

## Cache Invalidation

Writes to these collections automatically invalidate the `reports_summary` cache:
`members`, `contacts`, `assignments`, `households`, `projects`, `project-updates`

To skip invalidation (e.g., validation code updates during login):

```javascript
await safeCollectionUpdate('members', query, update, { skipCacheInvalidation: true });
```

---

## Performance: Parallel Fetches

Every `safeCollectionFind` is a full S3 prefix scan. Minimize wall time with `Promise.all`:

```javascript
// GOOD — parallel
const [households, members, assignments] = await Promise.all([
  safeCollectionFind('households', { _id: { $in: householdIds } }),
  safeCollectionFind('members', { householdId: { $in: householdIds } }),
  safeCollectionFind('assignments', { householdId: { $in: householdIds }, isActive: true }),
]);

// BAD — sequential (3x slower)
const households = await safeCollectionFind('households', ...);
const members = await safeCollectionFind('members', ...);
```

---

## Known Footguns

1. **`safeCollectionFind` always returns an array** — even when you expect one item.
   Always index `[0]` or use `safeCollectionFindOne`.

2. **Empty query `{}` returns ALL documents.** Avoid in hot paths; use `safeCollectionFindOne`
   when you need a single doc by `_id`.

3. **`_id` must be a string.** Sengo uses `_id` as the S3 object key. Integer or object
   IDs will cause unexpected behavior.

4. **`$in` behavior differs by field type:**
   - Scalar field: matches docs where the field equals any listed value
   - Array field: matches docs where the array contains any listed value
   Know which case you're in.

5. **No transactions.** Two concurrent Lambda invocations can interleave reads and writes.
   The retry logic in `safeCollectionInsert/Update` handles the common ETag conflict case.
   Do not design flows requiring atomic multi-document operations.

6. **Sort on `find()` is silently ignored.** Always sort in JavaScript after the call.
