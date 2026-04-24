# Proposal 2: Sengo Database Schema — Projects Feature

## Design Principles

1. **Follow existing patterns** — same `_id`, `createdAt`, `updatedAt`, `createdBy` conventions
   used in `households`, `members`, `contacts`, `assignments`
2. **Keep project document reasonable** — updates (discussion log) go in a separate
   `project-updates` collection; requirements and documents are embedded arrays in the project
   document because they are co-read and co-edited with the project itself
3. **Designed for growth** — optional fields like `approvedBy`, `estimatedCost`, `workerIds`
   are included now even if not fully surfaced in the MVP UI
4. **Cache invalidation** — writes to `projects` and `project-updates` must be added to the
   `safeCollectionInsert` / `safeCollectionUpdate` cache-invalidation list alongside `contacts`

---

## Role Reference

| Tag / JWT role | Who | Notes |
|---|---|---|
| `admin` | App administrator (you) | Superuser — all access, file approval, can test everything |
| `lead-deacon` | Travis (ministry lead) | All access + funding/approval authority |
| `deacon` | Deacon ministry members | Full project access; `lead-deacon` satisfies all `deacon` checks |
| `staff` | Church admin staff | Full project access |
| `worker` | Project volunteers + household members on the project | Scoped to assigned projects only |
| `helper` | H.E.L.P. ministry | **Not involved in projects** |

**Roles are a list (array), not a single winner.** A person can hold multiple roles simultaneously
(e.g., a deacon who is also a worker on someone else's project). The JWT `roles` field is an array.

`admin` satisfies all role checks — it is the superuser role.
`lead-deacon` satisfies all `deacon` and `staff` checks automatically.
In most access rules, `lead-deacon` is not called out separately — they are also a `deacon`.

---

## Collection: `projects`

```javascript
{
  _id: String,             // UUID — unique project identifier

  // Core identity
  title: String,           // Required. Short label, e.g. "Replace water heater"
  description: String,     // Required. What the need is and what will be done

  // Visibility
  visibility: String,      // Enum: 'public' | 'confidential'. Default 'public'.
                           // 'confidential': only visible to assignedDeaconIds, workerIds,
                           //                 lead-deacon, and admin. Does not appear in
                           //                 general project lists for unassigned deacons/staff.
                           // Example: a benevolence project only the benevolence team sees.

  // Household link
  householdId: String,     // Required. Reference to households._id

  // Phase & status
  phase: String,           // Required. Enum (see Phase Values below)
  status: String,          // Required. Enum (see Status Values below)

  // People
  assignedDeaconIds: [String], // Array of Member._id with 'deacon' or 'lead-deacon' tag.
                               // Creator is auto-added as first entry.
                               // Assigned deacons may edit project metadata.
  workerIds: [String],         // Member IDs of assigned workers (deacons, household members,
                               // or community volunteers). Any deacon can add workers.

  // Funding (optional, used in Funding phase and Approval flow)
  estimatedCost: Number,   // Optional. Estimated cost in dollars
  actualCost: Number,      // Optional. Final actual cost (post-implementation)
  needsApproval: Boolean,  // Default false. Set true if budget approval required
  approvedBy: String,      // Optional. Member._id who approved the budget
  approvedAt: String,      // Optional. ISO date string of approval

  // External coordination (optional)
  communicationLink: String, // Optional. WhatsApp, GroupMe, phone list, etc.

  // Requirements list (replaces materials list — see Requirements below)
  requirements: [
    {
      _id: String,          // Generated UUID
      type: String,         // Enum: 'material' | 'plans' | 'funding' | 'labor' | 'permit' | 'other'
      description: String,  // Required. What is needed (e.g. "2x6x8 pressure treated lumber")
      status: String,       // Enum: 'open' | 'blocked' | 'fulfilled'
      owner: String,        // Free text: person, team, vendor, or city office responsible
      notes: [              // Threaded notes — append only
        {
          _id: String,      // Generated UUID
          text: String,     // Note content
          authorId: String, // Member._id
          createdAt: String // ISO date string
        }
      ]
    }
  ],

  // Documents — file references (see Proposal 5: Files Feature for upload details)
  documents: [
    {
      _id: String,          // Generated UUID
      fileId: String,       // Reference to the `files` collection (see Proposal 5)
      label: String,        // Human-readable label (e.g. "Deck framing plan")
      type: String,         // Enum: 'plan' | 'photo' | 'invoice' | 'other'
      addedBy: String,      // Member._id
      addedAt: String       // ISO date string
    }
  ],

  // Proposal tracking
  proposedBy: String,      // Optional. Member._id of the person who submitted the proposal
                           // (may be a deacon, staff, or a non-deacon household member)
  proposedAt: String,      // Optional. ISO date string

  // Audit
  createdBy: String,       // Member._id of creator
  createdAt: String,       // ISO date string
  updatedAt: String        // ISO date string (updated on any field change)
}
```

### Phase Values
```
'discovery'      — Need identified, initial information gathering
'vetting'        — Eligibility and feasibility assessment
'funding'        — Cost estimation, budget, and payment source
'preparation'    — Planning: requirements, workers, schedule
'implementation' — Active work underway
'completed'      — Project finished
'cancelled'      — Closed without completion
```

`discovery`, `vetting`, `funding`, and `preparation` are **not enforced in order** and may run
in parallel. `implementation`, `completed`, `cancelled` are terminal.

### Status Values
```
'proposed'  — Project submitted (by deacon or household member), pending deacon acceptance.
               Lead-deacon is always in assignedDeaconIds for visibility.
'active'    — Project is being worked
'on-hold'   — Paused, awaiting something
'completed' — Finished (aligned with phase = 'completed')
'cancelled' — Cancelled (aligned with phase = 'cancelled')
```

### Requirement Status Values
```
'open'      — Requirement identified but not yet fulfilled
'blocked'   — Something is preventing this requirement from being met
'fulfilled' — Requirement has been met; project may proceed
```

When all requirements are `fulfilled`, the UI shows an "All requirements met — ready to proceed"
banner. This is a UI convenience only — not an enforced gate on phase changes.

### Requirement Type Values
```
'material' — Physical materials needed (lumber, paint, tools, etc.)
'plans'    — Drawings, permits, specs, or other documentation
'funding'  — Money or budget approval
'labor'    — People needed for specific work
'permit'   — Government or HOA permit / approval
'other'    — Anything else
```

---

## Collection: `project-updates`

Append-only discussion log for a project. Kept separate to avoid large embedded arrays
for active projects with many notes.

```javascript
{
  _id: String,

  projectId: String,    // Required. Reference to projects._id
  authorId: String,     // Required. Member._id of the person posting the update

  type: String,         // Required. Enum: 'note' | 'status' | 'blocker' | 'resolved'
  text: String,         // Required. Free-text note or explanation
  confidential: Boolean, // Default false. True = visible to deacon/staff/lead-deacon only.
                         // Funding-category discussions default to true.

  phaseSnapshot: String, // Phase at time of update (snapshot, not authoritative)
  createdAt: String      // ISO date string
}
```

### Update Type Values
```
'note'     — General update, discussion, or progress note
'status'   — Explains a phase/status change
'blocker'  — Something preventing progress
'resolved' — A blocker has been cleared
```

### Confidentiality Rules
- All updates have a `confidential` flag (default `false`)
- Workers see only non-confidential updates
- Any update in the context of a `funding` requirement defaults to `confidential: true`
- Deacon/staff/lead-deacon can mark any update confidential at post time
- Confidential update text is **never returned to workers** by the API
  (the update itself may be visible as a placeholder "confidential update" entry
   so workers can see activity happened)

---

## Indexing Strategy

- `projects`: `householdId`, `phase`, `status`, `assignedDeaconIds`, `workerIds`, `createdAt`, `updatedAt`
- `project-updates`: `projectId`, `authorId`, `createdAt`, `confidential`

---

## Relationship to Existing Collections

```
households       ←——  projects.householdId              (one household → many projects)
members          ←——  projects.assignedDeaconIds[]       (many deacons → many led projects)
members          ←——  projects.workerIds[]               (many members → many projects)
members          ←——  project-updates.authorId           (one member → many updates)
projects         ←——  project-updates.projectId          (one project → many updates)
files            ←——  projects.documents[].fileId        (see Proposal 5)
```

---

## Cache Invalidation

```javascript
// In src/util/helpers.js safeCollectionInsert and safeCollectionUpdate:
['members', 'contacts', 'assignments', 'households', 'projects', 'project-updates', 'files']
```

---

## Future Schema Extensions (Post-MVP)

```javascript
referredTo: String,        // External org/ministry name if redirected
referralContact: String,
checklistItems: [{         // Per-phase tasks
  phase: String,
  text: String,
  completed: Boolean,
  completedBy: String,
  completedAt: String
}]
```


## Design Principles

1. **Follow existing patterns** — same `_id`, `createdAt`, `updatedAt`, `createdBy` conventions
   used in `households`, `members`, `contacts`, `assignments`
2. **Keep project document reasonable** — updates (discussion log) go in a separate
   `project-updates` collection; materials and documents are embedded arrays in the project
   document because they are co-read and co-edited with the project itself
3. **Designed for growth** — optional fields like `approvedBy`, `estimatedCost`, `workerIds`
   are included now even if not fully surfaced in the MVP UI
4. **Cache invalidation** — writes to `projects` and `project-updates` must be added to the
   `safeCollectionInsert` / `safeCollectionUpdate` cache-invalidation list alongside `contacts`

---

## Role Reference

| Tag / JWT role | Who | Notes |
|---|---|---|
| `deacon` | Deacon ministry members | Full project access |
| `staff` | Church admin staff | Full project access |
| `worker` | Project volunteers | Scoped to assigned projects only |
| `helper` | H.E.L.P. ministry | **Not involved in projects** |

The `worker` tag must be added to the JWT role chain in `src/auth/auth.js`
`generateToken()`. Current chain: `deacon > staff > helper > null`.
**Updated chain: `deacon > staff > helper > worker > null`.**
If a person has both `deacon` and `worker` tags, they receive the `deacon` JWT role.

---

## Collection: `projects`

```javascript
{
  _id: String,             // ObjectId — unique project identifier

  // Core identity
  title: String,           // Required. Short label, e.g. "Replace water heater"
  description: String,     // Required. What the need is and what will be done

  // Household link
  householdId: String,     // Required. Reference to households._id

  // Phase & status
  phase: String,           // Required. Enum (see Phase Values below)
  status: String,          // Required. Enum (see Status Values below)

  // People
  leadDeaconId: String,    // Required. Member._id with 'deacon' tag
  workerIds: [String],     // Optional. Member IDs of assigned volunteers (any tag)

  // Funding (optional, used in Funding phase and Approval flow)
  estimatedCost: Number,   // Optional. Estimated cost in dollars
  actualCost: Number,      // Optional. Final actual cost (post-implementation)
  needsApproval: Boolean,  // Default false. Set true if budget approval required
  approvedBy: String,      // Optional. Member._id who approved the budget
  approvedAt: String,      // Optional. ISO date string of approval

  // External coordination (optional)
  communicationLink: String, // Optional. WhatsApp link, GroupMe, Discord, phone list, etc.

  // Materials list (editable by deacon/staff/assigned worker)
  materials: [
    {
      _id: String,          // Generated UUID for this item (enables targeted PATCH)
      description: String,  // Required. What the item is (e.g. "2x6x8 pressure treated lumber")
      quantity: Number,     // Required. How many
      unit: String,         // Required. Unit of measure (e.g. "boards", "gallons", "sheets")
      estimatedCost: Number, // Optional. Per-item estimated cost
      status: String,       // Enum: 'needed' | 'sourced' | 'obtained' | 'used'
      providedBy: String,   // Optional. Member._id of worker supplying this item
      notes: String         // Optional. Free text (e.g. "Home Depot SKU 123456")
    }
  ],

  // Project documents (editable by deacon/staff/assigned worker)
  documents: [
    {
      _id: String,          // Generated UUID for this item
      label: String,        // Required. Human-readable label (e.g. "Deck framing plan")
      url: String,          // Required. External URL (Google Drive, Dropbox, etc.)
      type: String,         // Enum: 'plan' | 'photo' | 'invoice' | 'other'
      uploadedBy: String,   // Member._id of the person who added this
      uploadedAt: String    // ISO date string
    }
  ],

  // Audit
  createdBy: String,       // Member._id of creator
  createdAt: String,       // ISO date string
  updatedAt: String        // ISO date string (updated on any field change)
}
```

### Phase Values
```
'discovery'     — Need identified, initial information gathering
'vetting'       — Eligibility and feasibility assessment
'funding'       — Cost estimation, budget, and payment source
'preparation'   — Planning: materials, tools, workers, schedule
'implementation'— Active work underway
'complete'      — Project finished
'cancelled'     — Closed without completion
```

Note: `discovery`, `vetting`, `funding`, and `preparation` are **not enforced in order**
and may run in parallel. `implementation` and beyond are terminal phases.

### Status Values
```
'active'    — Project is being worked
'on-hold'   — Paused, awaiting something
'complete'  — Finished (aligned with phase = 'complete')
'cancelled' — Cancelled (aligned with phase = 'cancelled')
```

### Material Item Status Values
```
'needed'   — Item identified but not yet sourced
'sourced'  — Someone has committed to providing or purchasing it
'obtained' — Item is physically in hand / at the job site
'used'     — Item has been consumed/installed in the project
```

---

## Collection: `project-updates`

Append-only discussion log for a project. Kept separate to avoid large embedded arrays
for active projects with many notes.

```javascript
{
  _id: String,       // ObjectId

  projectId: String, // Required. Reference to projects._id
  authorId: String,  // Required. Member._id of the person posting the update

  type: String,      // Required. Enum: 'note' | 'status' | 'blocker' | 'resolved'
  text: String,      // Required. Free-text note or explanation

  // Optional snapshot — helps reconstruct timeline without re-querying the project
  phaseSnapshot: String,  // Phase at time of update (snapshot, not authoritative)

  createdAt: String  // ISO date string
}
```

### Update Type Values
```
'note'     — General update, discussion, or progress note
'status'   — Explains a phase/status change
'blocker'  — Something preventing progress
'resolved' — A blocker has been cleared
```

---

## Indexing Strategy

Since Sengo uses S3-backed document storage, these fields should be indexed:

- `projects`: `householdId`, `phase`, `status`, `leadDeaconId`, `workerIds`, `createdAt`, `updatedAt`
- `project-updates`: `projectId`, `authorId`, `createdAt`

The `workerIds` index is important because worker-role API queries must efficiently filter
projects to only those containing the caller's member ID.

---

## Relationship to Existing Collections

```
households       ←——  projects.householdId           (one household → many projects)
members          ←——  projects.leadDeaconId           (one deacon → many led projects)
members          ←——  projects.workerIds[]            (many members → many projects)
members          ←——  projects.materials[].providedBy (member volunteers a material item)
members          ←——  project-updates.authorId        (one member → many updates)
projects         ←——  project-updates.projectId       (one project → many updates)
```

---

## Cache Invalidation

Add `'projects'` and `'project-updates'` to the invalidation check list in
`src/util/helpers.js` `safeCollectionInsert` and `safeCollectionUpdate`:

```javascript
// Current line in helpers.js (safeCollectionInsert and safeCollectionUpdate):
if (!options.skipCacheInvalidation && ['members', 'contacts', 'assignments', 'households'].includes(collectionName)) {

// Updated:
if (!options.skipCacheInvalidation && ['members', 'contacts', 'assignments', 'households', 'projects', 'project-updates'].includes(collectionName)) {
```

---

## Future Schema Extensions (Post-MVP)

```javascript
// Post-MVP fields — do not implement in MVP
referredTo: String,        // External org/ministry name if redirected
referralContact: String,   // Contact info for the referral
checklistItems: [{         // Per-phase tasks
  phase: String,
  text: String,
  completed: Boolean,
  completedBy: String,
  completedAt: String
}]
// Note: documents.url will evolve to support direct S3 upload (key + presigned URL)
// when that feature is added. The schema shape is already compatible.
```
