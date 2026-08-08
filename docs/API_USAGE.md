# ActSix API Reference

This document describes what each API endpoint is used for and the input/output forms it supports.

## Conventions

- Base path: `/api`
- Content type: JSON unless noted
- Path params are shown as `:paramName`
- Common error forms:
  - `{ "error": "..." }`
  - `{ "error": "...", "message": "..." }`

## Health

### `GET /api`
- Use: API health/status ping.
- Input:
  - None.
- Output (200):
  - `{ message, status, timestamp }`

## Members

### `GET /api/members`
- Use: List all non-deceased members.
- Input:
  - None.
- Output (200):
  - `{ members: Member[], count: number }`

### `GET /api/households/:householdId/members`
- Use: List members for one household.
- Input:
  - Path: `householdId`.
- Output (200):
  - `{ members: Member[], count: number }`

### `GET /api/members/:id`
- Use: Get one member.
- Input:
  - Path: `id`.
- Output:
  - 200: `{ member: Member }`
  - 404: `{ error: "Member not found", message }`

### `POST /api/members`
- Use: Create a member (and optionally create a household when `householdId` is omitted).
- Input (JSON body):
  - Required: `firstName`, `lastName`, `relationship`, `gender`.
  - Optional: `householdId`, `tags`, `age`, `birthDate`, `temporaryAddress`, other member fields.
  - Validation rules include:
    - `relationship` in `head|spouse|child|other`
    - `gender` in `male|female`
    - cannot provide both `age` and `birthDate`
    - `temporaryAddress` requires valid location/date fields when provided
- Output:
  - 200: `{ message, id, member }`
  - 400: validation error form

### `PUT /api/members/:id`
- Use: Update an existing member.
- Input:
  - Path: `id`.
  - JSON body: full member update payload; same main validation rules as create.
- Output:
  - 200: `{ message, member }`
  - 400/404: validation/not found error form

### `PUT /api/members/:id/temporary-address`
- Use: Set or replace a member's temporary address.
- Input:
  - Path: `id`.
  - JSON body: `{ temporaryAddress }` where `temporaryAddress` includes:
    - `locationId`, `startDate`, optional `endDate`, `roomNumber`, `notes`, `isActive`
- Output:
  - 200: `{ message, member }`
  - 400/404: error form

### `DELETE /api/members/:id/temporary-address`
- Use: Clear a member's temporary address.
- Input:
  - Path: `id`.
- Output:
  - 200: `{ message, member }`
  - 404: missing member or no temporary address

### `GET /api/members/:id/temporary-address-history`
- Use: Return current temporary address plus placeholder history array.
- Input:
  - Path: `id`.
- Output (200):
  - `{ memberId, currentTemporaryAddress, history }`

### `GET /api/temporary-locations/active`
- Use: List members currently marked with active temporary addresses, enriched with location info.
- Input:
  - None.
- Output (200):
  - `{ members: ActiveTemporaryLocationMember[], count: number }`

### `GET /api/tags`
- Use: Get valid member tag catalog.
- Input:
  - None.
- Output (200):
  - `{ tags: TagDefinition[] }`

## Households

### `GET /api/households`
- Use: List households.
- Input:
  - None.
- Output (200):
  - `{ households: Household[], count: number }`

### `GET /api/households/:householdId`
- Use: Get one household.
- Input:
  - Path: `householdId`.
- Output:
  - 200: `Household` (raw object, not wrapped)
  - not found branch may return `{ error: "Household not found" }`

### `POST /api/households`
- Use: Create household.
- Input (JSON body):
  - Required: `lastName`
  - Optional: `address`, `primaryPhone`, `email`, `notes`, other household fields
- Output:
  - 200: `{ message, id, household }`
  - 400: validation error form

### `PATCH /api/households/:householdId`
- Use: Update household profile fields.
- Input:
  - Path: `householdId`
  - JSON body: requires `lastName`; supports `address`, `primaryPhone`, `email`, `notes`
- Output:
  - 200: `{ message, householdId }`
  - 400: validation or no-change form

## Deacons And Participants

### `GET /api/deacons`
- Use: List members tagged as deacons, with optional extra role tags.
- Input:
  - Query: `add` (comma-separated tags, for example `elder,staff`)
- Output (200):
  - `{ deacons: Member[], count: number }`

### `GET /api/participants`
- Use: List event/contact participants from role-tagged members and caller household members.
- Input:
  - None.
- Output (200):
  - `{ participants: Participant[], count: number }`

### `GET /api/deacons/:deaconMemberId/quickContacts`
- Use: Fast household contact summary for one deacon's active assignments.
- Input:
  - Path: `deaconMemberId`
- Output (200):
  - `{ quickContacts: QuickContact[] }`

## Assignments

### `GET /api/assignments`
- Use: List assignment records.
- Input:
  - None.
- Output (200):
  - `{ assignments: Assignment[], count: number }`

### `POST /api/assignments`
- Use: Create one deacon-household assignment.
- Input (JSON body):
  - Required: `deaconMemberId`, `householdId`
  - Optional: `isActive` (defaults true), plus passthrough fields
- Output:
  - 200: `{ message, id, assignment }`
  - 400: validation error form

### `GET /api/deacons/:deaconMemberId/assignments`
- Use: List assignments for one deacon.
- Input:
  - Path: `deaconMemberId`
- Output (200):
  - `{ deaconMemberId, assignments: Assignment[], count: number }`

### `GET /api/households/:householdId/assignments`
- Use: Get active assignments for a household, enriched with deacon member info.
- Input:
  - Path: `householdId`
- Output (200):
  - `{ householdId, assignments: AssignmentWithDeacon[], count: number }`

### `POST /api/households/:householdId/assignments`
- Use: Replace active assignment set for a household.
- Input:
  - Path: `householdId`
  - JSON body: `{ deaconIds: string[] }`
- Output:
  - 200: `{ message, assignments }`

## Contacts And Reports

### `GET /api/contacts`
- Use: List all contact log entries.
- Input:
  - None.
- Output (200):
  - `{ contacts: Contact[], count: number }`

### `GET /api/contacts/needs`
- Use: Return members/contacts needing follow-up (stale or flagged), filtered to assigned households.
- Input:
  - None.
- Output (200):
  - `{ contacts: ContactNeed[], count: number }`

### `GET /api/contacts/:contactId`
- Use: Fetch one contact log.
- Input:
  - Path: `contactId`
- Output:
  - 200: `{ contact }`
  - 404: `{ error: "Contact not found" }`

### `POST /api/contacts`
- Use: Create contact log.
- Input (JSON body):
  - Required: `memberId`, `deaconId`, `contactType`, `summary`, `contactDate`
  - `memberId` and `deaconId` may be single value or array; normalized to arrays
  - `contactType` must be one of `phone|visit|church|text|voicemail|note`
  - Optional: `followUpRequired`
- Output:
  - 200: `{ message, id, contact }`
  - 400: validation error form

### `PATCH /api/contacts/:contactId`
- Use: Update a contact log.
- Input:
  - Path: `contactId`
  - JSON body: same shape/rules as create
- Output:
  - 200: `{ message, id, contact }`
  - 400/404: validation/not found

### `GET /api/households/:householdId/contacts`
- Use: List all contacts touching members in one household, newest first.
- Input:
  - Path: `householdId`
- Output:
  - 200: `{ contacts: ContactWithContactedBy[], count: number }`
  - 404: household missing or no members

### `OPTIONS /api/reports/summary`
- Use: Lightweight cache freshness check for report summary.
- Input:
  - Optional header: `If-Modified-Since`
- Output:
  - 304: unchanged
  - 200: cache exists and has `Last-Modified`
  - 404: no cache available

### `GET /api/reports/summary`
- Use: Return household-level contact summary report (from cache or regenerated).
- Input:
  - Optional header: `If-Modified-Since`
- Output:
  - 200: `{ summary: SummaryItem[] }`
  - 304: unchanged

## Common Locations

### `GET /api/common-locations`
- Use: List active common locations (hospital, nursing home, etc.).
- Input:
  - None.
- Output (200):
  - `{ locations: CommonLocation[], count: number }`

### `GET /api/common-locations/:id`
- Use: Get one location by id.
- Input:
  - Path: `id`
- Output:
  - 200: `{ location }`
  - 404: not found or soft-deleted

### `POST /api/common-locations`
- Use: Create location.
- Input (JSON body):
  - Required: `name`, `type`, `address`
  - `type` must be `hospital|nursing_home|assisted_living|rehab`
  - `address` requires `street`, `city`, 2-letter `state`, `zipCode`
  - Optional: `phone`, `website`, `visitingHours`
- Output:
  - 201: `{ success: true, locationId, location }`
  - 400: validation error form

### `PUT /api/common-locations/:id`
- Use: Update location.
- Input:
  - Path: `id`
  - JSON body: partial fields from create payload
- Output:
  - 200: `{ success: true, location }`

### `DELETE /api/common-locations/:id`
- Use: Soft-delete a location (`isActive = false`).
- Input:
  - Path: `id`
- Output:
  - 200: `{ success: true }`
  - 400: already deleted or still used by members

## Events

### `POST /api/events/types`
- Use: Create or update event-type configuration.
- Input (JSON body):
  - Required: `eventType`
  - Optional configurable fields:
    - `title`
    - `allowedRoles: string[]`
    - `assignmentRoles: string[]`
    - `assigneeRoles: string[]`
    - `quickAddAssigneeRole`
    - `allowQuickAddAssignee`
    - `requiredGender` (`male|female`)
    - `defaultPositions: PositionDefinition[]`
    - `scheduleDependencies: { eventType, offsetMinutes, uniquePer }[]`
    - `isActive`, `isSchedulable`
- Output:
  - 200: `{ message: "Event type saved", eventType }`

### `GET /api/events/types`
- Use: List schedulable event types for caller role.
- Input:
  - None.
- Output (200):
  - `{ eventTypes: { eventType, title, defaultPositionCount }[], count }`

### `GET /api/events`
- Use: List scheduled calendar events visible to caller.
- Input:
  - Query:
    - Optional `eventType`
    - Optional `serviceDate` (`YYYY-MM-DD`)
- Output:
  - 200: `{ events: EventView[], count }`
  - 400: invalid `eventType`
  - 403: role cannot view requested type

### `POST /api/events`
- Use: Schedule one or more event slots.
- Input (JSON body):
  - Required:
    - `eventType`
    - `serviceDate` (`YYYY-MM-DD`)
    - One of:
      - `serviceTime` (`HH:mm`)
      - `serviceTimes` (`HH:mm[]`)
  - Optional: `title`, `positions`, `eventSubtype`
- Output:
  - 200:
    - `{ message, id, event, events, autoScheduledEvents, count, autoScheduledCount }`
  - 400: validation/duplicate

### `GET /api/events/:eventId`
- Use: Get event details plus signups for one calendar slot.
- Input:
  - Path: `eventId`
- Output:
  - 200: `{ event: EventView, signups: EventSignup[], signupCount }`
  - 404: event not found

### `GET /api/events/:eventId/assignments`
- Use: Get assignment board for one event (positions, candidates, management flags).
- Input:
  - Path: `eventId`
- Output (200):
  - `{ event, canManageAssignments, assignmentCandidates, assigneeRoles, quickAddAssigneeRole, allowQuickAddAssignee, requiredGender, openPositions, filledPositions }`

### `GET /api/member/assignments`
- Use: Get future events with the current member's signup record for each event.
- Input:
  - None.
- Output:
  - 200: `Array<{ event, definition, signup }>`
  - 401: unauthorized when member context missing

### `GET /api/event-assignments`
- Use: Return event assignment snapshot for one service date.
- Input:
  - Query: required `serviceDate` (`YYYY-MM-DD`)
- Output:
  - 200: `Array<{ event, positions, filledPositions, openPositions, status, eventType }>`
  - 400: missing query

### `PUT /api/events/:eventId/assignments`
- Use: Save leadership assignments for event positions.
- Input:
  - Path: `eventId`
  - JSON body:
    - `assignments: Array<{ positionId: string, memberId: string | null }>`
- Output:
  - 200: `{ message, event, canManageAssignments, assignmentCandidates, assigneeRoles, quickAddAssigneeRole, allowQuickAddAssignee, requiredGender, openPositions, filledPositions }`
  - 400: invalid position/member

### `PUT /api/events/:eventId/signup`
- Use: Simple self availability toggle endpoint for current member.
- Primary use: sign-ups page "Available/Unavailable" buttons.
- Input:
  - Path: `eventId`
  - JSON body: `{ isAvailable: boolean }`
- Output:
  - 200: `{ message: "Availability updated successfully" }`
  - 400: invalid `isAvailable`

### `POST /api/events/:eventId/assignment-candidates`
- Use: Quick-add a new member candidate (and household) for assignments.
- Input:
  - Path: `eventId`
  - JSON body:
    - Name via either:
      - `firstName` and `lastName`, or
      - `fullName` (must include first and last)
    - Optional: `role`, `gender`
- Output:
  - 200: `{ message: "Assignment candidate created", candidate }`
  - 400: missing name/gender or quick-add disabled

## Core Shape Notes

- `Member` typically includes identity/contact plus: `_id`, `householdId`, `tags`, `gender`, `relationship`, `createdAt`, `updatedAt`.
- `Household` typically includes `_id`, `lastName`, `address`, contact fields, timestamps.
- `EventView` includes:
  - `_id`, `calendarId`, `eventId`, `eventType`, `title`
  - `serviceDate`, `serviceTime`
  - `positions: Position[]`
  - `status` (color and fill counts)
  - `neededCount`, `criticalPositionIds`, timestamps
- `Position` includes:
  - `positionId`, `label`, `note`, `priority`, `isCritical`, `allowSelfSignup`, `assignedMemberId`
- `EventSignup` includes:
  - `_id`, `calendarId`, `eventId`, `eventType`, `memberId`
  - `positionId`, `assignedPositionId`, `isAvailable`, `assignmentOptOut`, `unavailableReason`, timestamps
