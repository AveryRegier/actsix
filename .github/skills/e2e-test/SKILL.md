---
name: e2e-test
description: >
  **WORKFLOW SKILL** — Write and maintain end-to-end Playwright tests for the ActSix app.
  USE FOR: adding new e2e specs; extending scenario seed helpers; verifying full user journeys;
  debugging failing e2e tests; running the e2e suite.
  ALWAYS: use the sengo S3 simulator (never real AWS); seed test data via the generation API key;
  tag smoke tests with @smoke; import page helpers from test/e2e/support/.
  NEVER: set USE_S3_SIMULATOR=0 in e2e configs; connect to real S3 or real email in tests;
  commit .env.e2e files with real credentials.
  DO NOT USE FOR: unit tests (use vitest); help screenshot capture (use help-image-capture skill).
---

# E2E Test Authoring

## Overview

All e2e tests run through Playwright against a real server instance. The server is started by the
Playwright config using the S3 bucket simulator and the fake mailer — both are always active.
No real AWS credentials or real email are required or used.

```
test/
  e2e/
    playwright.config.js          — Main e2e config (always uses simulator)
    playwright.screenshots.config.js — Screenshot capture config (same simulator setup)
    specs/                        — Spec files (the actual tests)
    support/
      workflow-helpers.js         — Seed helpers and loginAsEmail()
      browser-coverage.js         — Extended test fixture with CDP coverage
      global-setup.js             — Mailbox reset, coverage dir creation
      global-teardown.js          — Coverage finalization
  harness/
    s3-sim-bootstrap.mjs          — Patches S3Client.prototype.send at server startup
    s3-bucket-simulator.js        — In-memory S3 bucket implementation
    fake-mailbox.js               — In-process email capture
    seed-data.js                  — Demo persona seed data (used by screenshot specs)
```

---

## Simulator Setup

The sengo S3 simulator is loaded via Node.js `--import` flag:

```
node --import ./test/harness/s3-sim-bootstrap.mjs src/server.js
```

This patches `S3Client.prototype.send` before any app code runs.  The environment variable
`USE_S3_SIMULATOR=1` must be set for the patch to activate; both Playwright configs set this
unconditionally and it **must not** be overridden to `0`.

Similarly, `USE_FAKE_MAILER=1` activates the in-process fake mailbox so login codes can be
read synchronously from `test-results/fake-mailbox.json`.

---

## Running Tests

```bash
# All e2e tests (then writes artifact manifest)
npm run e2e:mcp

# Smoke tests only (fast gate — tag specs with @smoke)
npm run e2e:mcp:smoke

# E2E with server-side coverage
npm run e2e:mcp:coverage

# Inspect the artifact manifest (traces, reports, mailbox path)
cat test-results/e2e-artifacts.json
```

---

## Writing a New Spec

Place the file in `test/e2e/specs/<name>.spec.js`.

### Minimal browser test

```javascript
import { test, expect } from '../support/browser-coverage.js';

test('loads the members page after login @smoke', async ({ page, request }) => {
  const { deaconEmail } = await seedWorkflowScenario(request);
  await loginAsEmail(page, deaconEmail);
  await page.goto('/members.html');
  await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();
});
```

### Minimal API-only test

```javascript
import { test, expect } from '@playwright/test';

test('creates and reads a household via API @smoke', async ({ request }) => {
  const createRes = await request.post('/api/households', {
    headers: { 'content-type': 'application/json', 'x-api-key': 'test-generation-key' },
    data: { lastName: `Test-${Date.now()}` },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json();
  expect(id).toBeTruthy();
});
```

---

## Seed Helpers

Import from `test/e2e/support/workflow-helpers.js`:

| Helper | Creates | Returns |
|---|---|---|
| `seedWorkflowScenario(request)` | deacon, target household + member, assignment, contact | `{ deaconEmail, targetHouseholdId, targetMemberId, … }` |
| `seedMemberTagsScenario(request)` | deacon, visible/editable member, widow, deceased member | `{ deaconEmail, editableMemberId, widowMemberId, … }` |
| `seedTemporaryAddressScenario(request, opts)` | deacon, household, member, common location | `{ deaconEmail, householdId, memberId, locationId, … }` |
| `seedCommonLocationCrudScenario(request)` | staff, household, member | `{ staffEmail, staffMemberId, … }` |
| `seedStaffScenario(request)` | staff member only | `{ staffEmail, staffMemberId, … }` |
| `seedHelperScenario(request)` | helper member only | `{ helperEmail, helperMemberId, … }` |
| `loginAsEmail(page, email)` | — | Navigates to login, submits email, reads code from fake mailbox |

All seed helpers use timestamp-suffixed names (e.g. `DeaconHH-1714000000000`) and the
`x-api-key: test-generation-key` header. They never share state between test runs.

### Low-level API helpers

```javascript
import { apiPost, apiGet } from '../support/workflow-helpers.js';

const res = await apiPost(request, '/api/households', { lastName: 'Smith' });
const list = await apiGet(request, '/api/households');
```

---

## Login Flow

`loginAsEmail(page, email)` handles the full OTP login cycle:

1. Navigates to `/email-login.html`
2. Fills the email field
3. Clicks **Send Validation Code**
4. Polls the fake mailbox until the code appears (max 10 s)
5. Fills the code field and clicks **Validate Code**
6. Asserts redirect to `/`

The fake mailbox is reset at the start of each `loginAsEmail` call.

---

## Smoke Tags

Tag any fast, critical-path test with `@smoke`:

```javascript
test('loads login page @smoke', async ({ page }) => { … });
```

Smoke tests run in CI on every PR via `npm run e2e:mcp:smoke`.  Full suite runs on schedule
and on `main` pushes.

---

## Coverage

The main e2e config supports server-side V8 coverage when `NODE_V8_COVERAGE` is set.
Run via `npm run e2e:coverage` (set automatically).  Browser coverage uses Chrome DevTools
Protocol (CDP) and is collected through `test/e2e/support/browser-coverage.js`.

---

## Quality Checklist Before Committing

- [ ] Test uses simulator-backed server (no real S3, no real email)
- [ ] Seed data is timestamp-unique and does not leak across test runs
- [ ] Fast critical-path assertions tagged `@smoke`
- [ ] `npm run e2e:mcp:smoke` passes
- [ ] `npm run e2e:mcp` passes
- [ ] No `USE_S3_SIMULATOR=0` anywhere in test configs
