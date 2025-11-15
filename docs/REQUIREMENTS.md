# Deacon Care System — Requirements (actSix)

This document centralizes the functional and non-functional requirements for the Deacon Care System (code name: `actSix`). Requirements were moved here from `PLAN.md` and `UPDATES_SUMMARY.md` to keep a single source of truth.

Format: items prefixed with "MUST" are mandatory requirements. Items prefixed with "SHOULD" are recommended but not strictly mandatory.

## High-level

- MUST: The system MUST allow deacons to record contact attempts and their outcomes for assigned members (identity, needs, conversation notes, date/time).
- MUST: The system MUST make the current status and needs of each member quickly viewable as a living document (fast lookup, simple UI summary).
- MUST: The app MUST be accessible via phone and computer (responsive UI / mobile-friendly).
- MUST: The system MUST provide authenticated access to protect member data (login / session or federated login).
- SHOULD: The system SHOULD provide social or OIDC login options for convenience.
- SHOULD: The system SHOULD allow deacons to view a quick list of assigned or recently-interacted members for quick access.

## Cost & operational constraints

- MUST: Data storage SHOULD be inexpensive and scalable; the implementation MUST use cost-effective storage (S3 via the `sengo` client is the recommended approach).
- SHOULD: The overall monthly operating cost SHOULD target under $10/month (design goal).
- SHOULD: The runtime SHOULD be serverless-friendly (single Lambda or small Node server) to minimize always-on costs.
- SHOULD: The system SHOULD minimize dependencies and external paid services to reduce ongoing costs.

## Member & household management

- MUST: Households MUST be represented as a document grouping members (household-level metadata and contact methods).
- MUST: `lastName` MUST be present on household records to support primary indexing/search.
- SHOULD: Household address, primary phone, email, and notes SHOULD be stored when available (these fields may be optional).
- MUST: Each member record MUST contain at minimum: `firstName`, `lastName`, and a reference to a `householdId`.
- MUST: Member records MUST include a `relationship` field (example values: `head`, `spouse`, `child`, `other`).
- MUST: Member records MUST include `gender` and the system MUST normalize gender values (existing dataset expects `male` or `female`).
- MUST: Tags MUST be supported in member records (tags replace old rigid status). Tags MUST be stored as an array of strings.
- SHOULD: The system SHOULD support a standard set of commonly used tags (examples: `member`, `attender`, `in-small-group`, `shut-in`, `cancer`, `long-term-needs`, `widow`, `widower`, `married`, `deceased`) while allowing additional custom tags.
- MUST: The system MUST accept either `age` OR `birthDate` for a member (mutually exclusive when both are provided); both fields are optional but only one should be populated for a single record.
- MUST: There MUST be at least one reachable phone number per household (may be stored at household level or at least one member level phone).
- MUST: The system MUST allow adding, updating, and removing members and households and MUST capture a brief audit trail for such events (who/when/what changed) or at minimum be able to summarize change events.

## Deacon contact recording and workflow

- MUST: Deacons MUST be able to record a contact log entry containing: member reference, contact datetime, contact method (phone/visit), summary notes, and any identified needs.
- MUST: The system MUST associate contact logs with member records and make them discoverable in the member's detail view.
- MUST: The system MUST support assigning subsets of members to specific deacons (assignee mapping) so each deacon can quickly see their list.
- MUST: The system MUST support a monthly review workflow: deacons MUST be able to produce or view a list of members requiring review and confirm contact status during meetings.
- SHOULD: The system SHOULD provide short, friendly UI flows for quick in-field entry (minimal typing, large touch targets).

## Reporting

- MUST: The system MUST provide a living status view that summarizes current needs and tags for quick at-a-glance awareness.
- SHOULD: The system SHOULD provide filtering by tag, household, assigned deacon, and date range for contact logs.
- SHOULD: The system SHOULD support exporting or printing a meeting-ready report summarizing assignments and recent contact activity (PDF or printable HTML recommended).
- SHOULD: The system SHOULD surface counts and summaries (e.g., number of shut-ins, urgent needs) to aid meetings and prioritization.

## Security & privacy

- MUST: Sensitive member data MUST be protected in transit (HTTPS) and at rest according to the deployment platform's best practices (S3 protections, least-privilege IAM roles).
- MUST: The system MUST require authenticated access for write operations and SHOULD restrict read access to authorized users.
- SHOULD: Personal identifying details and contact info SHOULD only be visible to logged-in deacons of the organization.

## Non-functional

- SHOULD: The application SHOULD be responsive and usable on low-bandwidth mobile connections.
- SHOULD: The application SHOULD have low cold-start overhead if deployed as a Lambda function.
- SHOULD: The system SHOULD be test-covered for its core workflows (member CRUD, contact logs, authentication).

---
Source: requirements and updates originally recorded in `docs/PLAN.md` and `docs/UPDATES_SUMMARY.md` were consolidated into this file on request. This file is now the authoritative source for MUST/SHOULD statements.
