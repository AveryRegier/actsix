 aZ # Traceability Matrix — Deacon Care System (actSix)

This file maps the formal requirements in `docs/REQUIREMENTS.md` to the current implementation (files, endpoints, helpers) and notes any gaps or recommendations.

Format: Requirement (short) -> Implementation files / endpoints -> Notes / gaps

## High-level

- Requirement: Allow deacons to record contact attempts and outcomes for assigned members
  - Implemented in: `src/api/contacts.js` (POST `/api/contacts`) — contact fields validated and stored.
  - Notes: contact model stored via `safeCollectionInsert('contacts', ...)` (see `src/helpers.js`, `src/sengoClient.js`).

- Requirement: Living document view of current member status/needs (fast lookup)
  - Implemented in: `src/api/reports/summary` (in `src/api/contacts.js`) — returns a summary per household including last contact and members.
  - Notes: This summary endpoint provides a meeting-ready aggregation; UI-level living document is provided by the `site/` static pages which hit these endpoints. Consider adding server-sent events or a dedicated cache for very fast access if needed.

- Requirement: Accessible via phone and computer (responsive UI)
  - Implemented in: `site/` static pages (HTML/CSS/JS) served by `src/server.js` / `src/lambda.js` via `src/api.js` routing.
  - Notes: Frontend is vanilla static assets; responsiveness is implemented in the site but may require review for low-bandwidth patterns.

- Requirement: Authenticated access for write operations
  - Implemented in: `src/auth.js` (JWT token generation/verification), `src/api/oidc.js` and `src/api/cognito.js` (login flows), and request middleware in those files that populates `c.req.memberId` and `c.req.role`.
  - Notes: `verifyRole` is used across route handlers to block unauthorized requests (see `members.js`, `households.js`, `contacts.js`, `assignments.js`). Some middleware contains TODOs and defensive `fixme` comments; review and harden token verification and cookie handling.

## Cost & operational constraints

- Requirement: Use cost-effective storage (S3 via `sengo` client)
  - Implemented in: `src/sengoClient.js` (initializes `sengo.SengoClient` and `db = sengoClient.db(process.env.S3_BUCKET)`), and used throughout via `src/helpers.js`.
  - Notes: This is the core of low-cost design; config via `S3_BUCKET` env var.

- Requirement: Serverless-friendly runtime (single Lambda or small Node server)
  - Implemented in: `src/lambda.js` (Lambda handler) and `src/server.js` (local server for dev).
  - Notes: `scripts/dist.cjs` and `scripts/deploy-cloudformation.ps1` are used to package and deploy.

## Member & household management

- Requirement: Household documents with `lastName` required
  - Implemented in: `src/api/households.js` (POST `/api/households` enforces `lastName`), `src/api/members.js` (member creation may create household if none provided).

- Requirement: Member record fields and validations (`firstName`, `lastName`, `householdId`, `relationship`, `gender`, tags, age/birthDate rules)
  - Implemented in: `src/api/members.js` (POST `/api/members`, PUT `/api/members/:id`) — validations for required fields, relationship values, gender values, tags whitelist, mutual exclusion of `age` and `birthDate`, age bounds.
  - Notes: Tag whitelist exists in code; update whitelist in code when adding new tags.

- Requirement: At least one reachable phone number per household
  - Implemented in: helper `validatePhoneRequirement` in `src/helpers.js` used by API validation logic (members/households flows reference it as appropriate).
  - Notes: Ensure callers actually call `validatePhoneRequirement` where necessary (some form validations use it; review all paths).

- Requirement: CRUD for members/households with audit info
  - Implemented in: `src/api/members.js` and `src/api/households.js` provide create/update endpoints and set `createdAt` / `updatedAt` fields.
  - Gap: A full audit trail (who/when/what for every change) is not currently implemented; only timestamps are recorded. Recommendation: add an `audit` collection or record `lastModifiedBy`/change history if strict auditing is required.

## Deacon contact recording and workflow

- Requirement: Contact log entry containing member reference, datetime, method, summary, needs
  - Implemented in: `src/api/contacts.js` (POST `/api/contacts`) — validates `memberId`, `deaconId`, `contactType`, `summary`, `contactDate`, and stores `followUpRequired`.

- Requirement: Associate contact logs with member detail view
  - Implemented in: `src/api/households/:householdId/contacts` (in `src/api/contacts.js`) — fetches members for a household and returns related contacts, augmented with `contactedBy` (deacon member details).

- Requirement: Assign subsets of members to deacons and deacon assignment listing
  - Implemented in: `src/api/assignments.js` (`/api/assignments`, `/api/deacons/:deaconMemberId/assignments`, `/api/households/:householdId/assignments`, and POST to update household assignments).

- Requirement: Monthly review workflow (produce list of members requiring review)
  - Implemented in: `src/api/contacts.js` `/api/contacts/needs` — aggregates contacts and filters by last contact date or followUpRequired; cross-references active assignments to include only assigned households.

## Reporting

- Requirement: Living status view and meeting-ready summaries
  - Implemented in: `src/api/contacts.js` `/api/reports/summary` — assembles households, members, assignments, last contact and summary; returns structured summary for UI consumption.

- Requirement: Filtering by tag/household/deacon/date range for contact logs
  - Partially implemented: endpoints accept query patterns via `safeCollectionFind`; explicit filter endpoints exist for household, deacon assignments, and `contacts/needs` provides a filtered set.
  - Gap: There is no single endpoint that accepts a full expressive filter query for UI filters; the UI composes multiple calls. Consider adding a `/api/reports/filter` endpoint that accepts filter criteria.

- Requirement: Export/print meeting reports (PDF/printable HTML)
  - Partially implemented: `/api/reports/summary` returns data suitable for building printable HTML. No server-side PDF generator is present. The site includes `site/` HTML designed for printing.

## Security & privacy

- Requirement: Protect data in transit and at rest; least-privilege
  - Implemented in: Design and deployment scripts (`cloudformation.yaml`, `scripts/deploy-cloudformation.ps1`) — intended to set up secure AWS resources; code uses HTTPS for external calls.
  - Notes: Ensure CloudFormation config enforces HTTPS, uses secure S3 bucket policies and least-privilege IAM roles — review templates before deployment.

- Requirement: Authenticated writes and restricted reads
  - Implemented in: `verifyRole` usage across route handlers (see `src/auth.js` and routes). OIDC/Cognito handlers (`src/api/oidc.js`, `src/api/cognito.js`) set cookies and tokens. Many routes check `verifyRole` early and return 403 if unauthorized.
  - Gap: Token verification has `fixme` comments in middleware — recommend an audit of cookie parsing and JWT verification flows.

## Non-functional & testing

- Requirement: Responsive on low-bandwidth and low cold-start overhead
  - Partially implemented: The site is static and small; Lambda cold-start characteristics depend on deployment package size. No explicit low-bandwidth optimization (e.g., image optimization, offline cache) is implemented in this repo.

- Requirement: Test coverage for core workflows
  - Implemented: `test/api.test.js` (exists) and `vitest` present in `package.json` scripts.
  - Gap: Coverage may be incomplete; recommend adding focused tests for mutual exclusion of age/birthDate, phone requirement, contact log creation, and report generation.

## Key implementation files (summary)

- API routes: `src/api/*.js` — `members.js`, `households.js`, `contacts.js`, `assignments.js`, `deacons.js`, `oidc.js`, `cognito.js`, `email-login.js`.
- Auth and tokens: `src/auth.js`, `src/api/oidc.js`, `src/api/cognito.js`.
- Storage client: `src/sengoClient.js` (S3 via sengo) and helpers in `src/helpers.js`.
- Server entrypoints: `src/server.js` (dev), `src/lambda.js` (production handler).
- Utilities: `src/logger.js`, `src/error.js`, `src/email.js` (email sending), `scripts/` (build/deploy helpers), `cloudformation.yaml` (infra).

## Recommendations / Next actions (prioritized)

3. Add explicit filter/report endpoints for complex UI filters and a printable HTML template or server-side PDF generator if desired.
4. Add targeted Vitest cases for: age/birthDate mutual exclusion, phone requirement validation, contact creation authorization, and report summary correctness.
5. Consider adding a small `.env.example` and a local seeding task that uses `scripts/generate_data.cjs` to populate dev data (useful for testing traceability mappings).
