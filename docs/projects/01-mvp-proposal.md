# Proposal 1: MVP — Project Tracking Core

## Goal

Enable deacons to create, track, and update ministry projects for households — replacing
ad-hoc spreadsheets or verbal coordination with a lightweight structured system that fits
the existing ActSix workflow.

## Roles Involved

This feature introduces a **new `worker` role** and a **`lead-deacon` role**.

> **Important:** `helper` is the H.E.L.P. ministry role. It is completely unrelated to
> physical ministry projects. `helper` has **no access** to any project endpoints.

| Role | Who | Scope |
|------|-----|-------|
| `lead-deacon` | Travis (ministry funding & benevolence lead) | All projects + funding authority + worker add |
| `deacon` | Deacon ministry members | Full project management; all projects; auto-assigned on create |
| `staff` | Church admin staff | Full project management; all projects |
| `worker` | Project volunteers **and** household members on the project | Only their assigned projects |

### Multi-Role Model ("Hats")

**Roles are a list, not a single winner.** A member can wear multiple hats simultaneously.
The JWT `roles` field is an array of all role tags the member holds.

Examples:
- Travis holds `['lead-deacon', 'deacon']` — gets both capabilities
- A household member volunteering on their own repair holds `['worker']`
- A deacon helping on another household's project holds `['deacon', 'worker']`

Roles are generated from member tags (`tags: ['deacon', 'worker']` → `roles: ['deacon', 'worker']`).

### `lead-deacon` Role Details

- The lead deacon (Travis) manages the deacon ministry's budget and benevolence funding
- Has authority to approve project costs, manage funding phase discussions
- Is **not** the same as an "assigned deacon" on a specific project
- Satisfies all `deacon` and `staff` checks in access rules

### `worker` Role Details

Workers are congregation members, household members, or community volunteers who physically
help with projects (labor, materials, trades). They need a focused view of only their work.

A worker:
- Can see only projects where their `memberId` is in `workerIds`
- Can view project details, requirements, and documents
- Can add non-confidential discussion notes to their assigned projects
- Can add and update requirements (mark items fulfilled, add notes)
- Can add documents to their assigned projects
- **Cannot** see confidential updates (e.g., funding discussions)
- **Cannot** see household contact history or sensitive member data
- **Cannot** create or edit project metadata (title, phase, status, cost)

### Who Can Be a Worker

Any deacon can assign any member as a worker. This includes:
- Deacons or members from the congregation
- Household members living in the affected home (e.g., the head of household volunteering
  to help with their own repair)
- Community volunteers without a full deacon/staff role

Household members who are system users can also **self-propose** a project for their own
household. They are added to `workerIds` automatically on proposal submission.

## What the MVP Includes

### Project Lifecycle
- Create a project linked to a specific household
- Assign multiple deacons as project leaders (`assignedDeaconIds[]`); creator is auto-added first
- **Lead deacon is always auto-assigned** to `assignedDeaconIds` on any new or proposed project,
  ensuring they always have visibility on incoming work
- **Deacons** can propose a project for **any household** — no restriction
- **Non-deacon members** (workers, plain members) can **only propose for their own household**
  (data privacy — non-deacons must not access records for households they don't belong to)
- Proposals create `status: proposed`, `phase: discovery`; deacon accepts/adopts to make active
- Set and update the current phase:
  - `discovery` — need identified, initial information gathering
  - `vetting` — verifying person/need eligibility and project feasibility
  - `funding` — assessing cost, budget availability, and who will pay
  - `preparation` — planning requirements, workers, schedule
  - `implementation` — active work underway
  - `completed` — project finished
  - `cancelled` — project closed without completion
- Phases prior to `implementation` are **not enforced in order** — they can be set freely
- Set project status: `proposed`, `active`, `on-hold`, `completed`, `cancelled`

### Project Details (deacon / staff only to edit)
- Title (short name for the project)
- Description (what the need is; what work will be done)
- Linked household (required)
- Assigned deacons (multiple — array; all have equal edit rights)
- Workers (list of member IDs — any member, including household members)
- Estimated cost (optional number)
- Whether budget approval is needed (boolean flag)
- Free-text communication link (optional — WhatsApp link, GroupMe, phone list, etc.)

### Requirements (deacon / staff / assigned worker can edit)

**Requirements replace the old "materials list" concept.** They track anything the project
needs in order to proceed, not just physical materials. Requirements are entirely optional —
projects can proceed without them. They exist for the team's convenience.

Each requirement:
- **Description** — what is needed (e.g., "2×6×8 pressure-treated lumber", "budget approval")
- **Type** — `material` | `plans` | `funding` | `labor` | `permit` | `other`
- **Status** — `open` | `blocked` | `fulfilled`
- **Owner** — free text: person, vendor, agency responsible for fulfilling it
- **Notes** — threaded list: `[{ text, authorId, createdAt }]` — append only

When all requirements are `fulfilled` the UI shows an "all clear" banner — a convenience
indicator, not a gating mechanism. Projects can advance phases without all requirements met.

### Project Documents

Documents are attached via the **Files feature** (Proposal 5). The MVP UI allows linking
documents by label and type. In MVP, documents may be external URLs. Full S3 upload with
safety validation is a separate planned feature.

### Confidential Communications

All updates have a `confidential` flag (default `false`). When set:
- Workers **never** see the full text of confidential updates
- Confidential updates appear as a placeholder ("Confidential update — deacon/staff only")
  so workers can see activity happened without seeing the content
- Any update posted in a `funding`-context discussion defaults to `confidential: true`
- Any deacon or staff member may mark an update confidential at post time

### Project Updates / Discussion (deacon / staff / assigned worker)
- Any assigned participant can post a text update on a project
- Update types: `note` | `status` | `blocker` | `resolved`
- Deacon/staff can mark any update confidential

### Project List
- Deacons and staff see all active projects (default filter)
- Workers see only their assigned projects
- Filter by phase, status, assigned deacon, or household
- Sortable by last update, phase, or household name

### Household Integration
- Projects panel appears on the household detail page (`household.html`)
- Shows active projects with phase badge and last-update summary
- Link to create a new project pre-filled with the household
- Shown to: `deacon`, `staff` only (workers have no access to `household.html`)

### Monthly Report Integration
- Projects appear in a section of the existing reports summary
  with phase, assigned deacons, and last update

---

## What the MVP Explicitly Excludes

- Real-time messaging / in-app chat forum (covered by free-text `communicationLink`)
- Email notifications to workers on project changes
- Budget approval workflow (the `needsApproval` flag is stored but no approval UI in MVP)
- Planning Center integration for membership vetting
- External referral tracking (other ministries/organizations)
- In-app S3 file upload — **this is Proposal 5, a separate feature**
- Mobile push notifications

---

## Success Criteria

1. A deacon can create a project for a household in under 2 minutes
2. Any deacon can see all active projects and their current phase at a glance
3. A deacon or worker can add a discussion note to their project
4. A household member can submit a project proposal through the system
5. Workers only see non-confidential updates; funding discussions stay private
6. The monthly report includes a projects section with current status

---

## Future Growth Points (Post-MVP)

These are designed into the schema but not surfaced in the MVP UI:

- **Approval workflow** — lead deacon or staff approves cost over a threshold
- **Worker notifications** — email to all `workerIds` when a new update is posted
- **Phase checklists** — per-phase tasks that must be completed before moving on
- **Referral tracking** — log when a need is redirected to another org/ministry
- **Budget reporting** — project cost rolled into the deacon ministry financial reports
- **File upload** — in-app photo/file upload with safety validation (Proposal 5)

- Create a project linked to a specific household
- Assign a lead deacon (responsible for the project)
- Set and update the current phase:
  - `discovery` — need identified, initial information gathering
  - `vetting` — verifying person/need eligibility and project feasibility
  - `funding` — assessing cost, budget availability, and who will pay
  - `preparation` — planning materials, tools, workers, schedule
  - `implementation` — active work underway
  - `complete` — project finished
  - `cancelled` — project closed without completion
- Phases prior to `implementation` are **not enforced in order** — they can be set freely
- Set project status: `active`, `on-hold`, `complete`, `cancelled`

### Project Details (deacon / staff only to edit)
- Title (short name for the project)
- Description (what the need is; what work will be done)
- Linked household (required)
- Lead deacon (required)
- Workers (list of member IDs — any congregation member, not just deacons)
- Estimated cost (optional number)
- Whether budget approval is needed (boolean flag)
- Free-text communication link (optional — WhatsApp link, GroupMe, phone list, etc.)

### Materials List (deacon / staff / assigned worker can edit)
Each project has an embedded list of materials needed:
- Description (what the item is)
- Quantity and unit (e.g., "8 sheets", "2 gallons")
- Estimated cost per item (optional)
- Status: `needed` → `sourced` → `obtained` → `used`
- `providedBy` — member ID of the worker who is supplying this item (optional)
- Notes (optional free text)

Workers can update material item status and mark themselves as provider.
Deacons and staff can add/remove/edit any material item.

### Project Documents (deacon / staff / assigned worker can add)
Each project holds a list of linked documents:
- Label (e.g., "Deck framing plan", "Lowe's receipt", "Before photo")
- URL (link to Google Drive, S3, or any external document)
- Type: `plan` | `photo` | `invoice` | `other`
- Uploaded by (member ID) and uploaded at (timestamp)

Workers can add documents to their assigned projects.
Deacons and staff can add or remove documents from any project.

### Project Updates / Discussion (deacon / staff / assigned worker)
- Any assigned participant can post a text update on a project
- Each update records: author, timestamp, free-text note, and type tag:
  - `note` — general update or discussion
  - `status` — phase or status change explanation (deacon/staff only in practice)
  - `blocker` — something preventing progress
  - `resolved` — a blocker is cleared

### Project List
- Deacons and staff see all active projects (default filter)
- Workers see only their assigned projects
- Filter by phase, status, assigned deacon, or household
- Sortable by last update, phase, or household name

### Household Integration
- Projects panel appears on the household detail page (`household.html`)
- Shows active projects with phase badge and last-update summary
- Link to create a new project pre-filled with the household
- Shown to: `deacon`, `staff` only (workers have no access to `household.html`)

### Monthly Report Integration
- Projects appear in a section of the existing reports summary
  with phase, lead deacon, and last update

---

## What the MVP Explicitly Excludes

- Real-time messaging / in-app chat forum (covered by free-text `communicationLink`)
- Email notifications to workers on project changes
- Budget approval workflow (the `needsApproval` flag is stored but no approval UI in MVP)
- Planning Center integration for membership vetting
- External referral tracking (other ministries/organizations)
- Direct S3 file upload from the app (document links are external URLs in MVP)
- Mobile push notifications

---

## Success Criteria

1. A deacon can create a project for a household in under 2 minutes
2. Any deacon can see all active projects and their current phase at a glance
3. A deacon or worker can add a discussion note to their project
4. A worker assigned to a project can view the materials list and mark items they will provide
5. The monthly report includes a projects section with current status

---

## Future Growth Points (Post-MVP)

These are designed into the schema but not surfaced in the MVP UI:

- **Approval workflow** — lead deacon or staff approves cost over a threshold
- **Worker notifications** — email to all `workerIds` when a new update is posted
- **Phase checklists** — per-phase tasks that must be completed before moving on
- **Referral tracking** — log when a need is redirected to another org/ministry
- **Budget reporting** — project cost rolled into the deacon ministry financial reports
- **Direct S3 upload** — in-app photo/file upload instead of external URL links
