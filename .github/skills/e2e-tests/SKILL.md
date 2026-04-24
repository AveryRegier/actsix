---
name: e2e-tests
description: >
  **WORKFLOW SKILL** — Write or update end-to-end (Playwright) tests for the ActSix app.
  USE FOR: adding new e2e test specs; extending seedWorkflowScenario for new entities; writing
  coverage for a new page or API flow; debugging flaky selectors; understanding the test
  harness setup. ALWAYS: import from browser-coverage.js not @playwright/test directly;
  seed fresh data with a timestamp stamp to avoid cross-test pollution; use apiPost/apiGet
  helpers for API calls from tests; the S3 simulator is ALWAYS active — never configure or
  disable it. NEVER: log in with real member credentials; share data between test files
  without explicit setup; set USE_S3_SIMULATOR=0 or bypass the simulator.
  DO NOT USE FOR: unit tests of individual functions; help screenshot capture (use help-image-capture skill).
---

# E2E Test Skill

## The S3 Simulator is Always On

**All e2e tests run against an in-process S3 simulator — never real AWS.**

This is wired automatically in `playwright.config.js`. The test server is started with:

```javascript
// test/e2e/playwright.config.js  (do not change)
webServer: {
  command: 'node --import ./test/harness/s3-sim-bootstrap.mjs src/server.js',
  env: {
    USE_S3_SIMULATOR: '1',    // always 1 — never override to 0
    USE_FAKE_MAILER: '1',
    S3_BUCKET: 'deacon-care-system-e2e',
    GENERATION_API_KEY: 'test-generation-key',
    JWT_SECRET: 'actsix-e2e-secret',
    // ...
  }
}
```

`--import ./test/harness/s3-sim-bootstrap.mjs` runs before server code and monkey-patches
`S3Client.prototype.send` so every Sengo call goes to the in-memory `S3BucketSimulator`
when `USE_S3_SIMULATOR=1`. This means:
- All Sengo reads/writes work exactly as in production
- No AWS credentials needed
- Data is isolated per test server process
- Tests are fast and deterministic

**You must never:**
- Set `USE_S3_SIMULATOR=0` in a test or env file
- Import `@aws-sdk/client-s3` directly in specs
- Call `db.collection()` directly in spec files (use `apiPost`/`apiGet` instead)

---

## How the Simulator Works

The simulator lives at `test/harness/s3-bucket-simulator.js`. It is an in-memory
`Map`-based store that handles the S3 commands Sengo uses:

| S3 Command | Simulator behaviour |
|-----------|-------------------|
| `PutObjectCommand` | Stores body string in `Map`; assigns a random ETag; throws `ConditionalRequestConflict` when conflict budget > 0 |
| `GetObjectCommand` | Returns `{ Body: Readable, ETag }` or throws `NoSuchKey` |
| `HeadObjectCommand` | Returns `{ ContentLength, ETag }` or throws `NoSuchKey` |
| `DeleteObjectCommand` | Removes entry; returns `{ DeleteMarker: bool }` |
| `ListObjectsV2Command` | Returns all keys matching `Prefix` |
| `CreateBucketCommand` | No-op (returns `{}`) |

The simulator is exposed globally for advanced tests:

```javascript
// Access the live simulator instance from a spec (server-side access via apiPost is preferred)
const sim = globalThis.__ACTSIX_S3SIM__;
```

### Conflict testing

To verify retry/backoff logic, inject ETag conflicts by setting env vars **before** the
test server starts (i.e., in `.env.e2e` or by running the suite with them set):

```bash
# All put operations conflict once
S3SIM_CONFLICT_COUNT=1 npm run e2e -- --grep "retry"

# Only puts to keys starting with 'projects/' conflict, once
S3SIM_CONFLICT_PREFIXES=projects/ S3SIM_CONFLICT_COUNT=1 npm run e2e
```

These are consumed by `S3BucketSimulator` constructor and decrement a budget; once the
budget is exhausted, subsequent puts succeed normally.

---

## Harness Architecture

```
test/
  harness/
    s3-sim-bootstrap.mjs      — Patches S3Client.prototype.send; sets globalThis.__ACTSIX_S3SIM__
    s3-bucket-simulator.js    — In-memory S3BucketSimulator class
    fake-mailbox.js           — In-memory email OTP store
    seed-data.js              — Direct Sengo seed helpers (unit tests only)
  e2e/
    playwright.config.js      — webServer command, env, timeout, coverage dir
    playwright.screenshots.config.js — Separate screenshot-only config
    support/
      browser-coverage.js     — ALWAYS import test/expect from here
      workflow-helpers.js     — apiPost, apiGet, loginAsEmail, seed* helpers
      global-setup.js         — Creates coverage dirs, resets mailbox; loads .env.e2e
      global-teardown.js      — Cleanup
    specs/                    — One .spec.js per page/feature
    screenshots/              — Screenshot capture specs (help-image-capture skill)
```

---

## Required Import

**ALWAYS** use the coverage wrapper — never import directly from `@playwright/test`:

```javascript
// CORRECT
import { test, expect } from '../support/browser-coverage.js';

// WRONG — breaks coverage tracking
import { test, expect } from '@playwright/test';
```

`browser-coverage.js` wraps Playwright's `test` to collect V8 coverage from the browser
after each test and write it to `.coverage/e2e-browser/raw/`. This is what populates
the UI coverage report.

---

## Core Helpers (`support/workflow-helpers.js`)

```javascript
import {
  apiGet,                          // Authenticated GET to API (x-api-key header)
  apiPost,                         // Authenticated POST to API
  loginAsEmail,                    // Full email OTP login flow (fake mailbox)
  seedWorkflowScenario,            // deacon + target household + contact + assignment
  seedMemberTagsScenario,          // deacon + target household with tag variety
  seedTemporaryAddressScenario,    // deacon + household + common location
  seedCommonLocationCrudScenario,  // staff + household for location CRUD
  seedStaffScenario,               // staff member only
  seedHelperScenario,              // helper member only
} from '../support/workflow-helpers.js';
```

All helpers use `apiPost`/`apiGet` internally — data goes through the API (and therefore
the S3 simulator) just as real users would.

### `seedWorkflowScenario(request)` — the standard seed

Creates a self-contained scenario:
- A deacon household + deacon member (`tags: ['deacon']`)
- A target household with address + target member (`tags: ['member', 'shut-in']`)
- An assignment linking the deacon to the target household
- A seeded contact record

```javascript
const scenario = await seedWorkflowScenario(request);
// Returns:
// {
//   stamp: 1714000000000,
//   deaconEmail: 'deacon-<stamp>@example.test',
//   deaconMemberId: '<id>',
//   targetHouseholdId: '<id>',
//   targetMemberId: '<id>',
//   targetMemberLastName: 'Member<stamp>',
//   targetLastName: 'TargetHH-<stamp>',
// }
```

**Use for:** any test requiring a logged-in deacon AND a household to act on.

### `loginAsEmail(page, email)`

Full OTP login flow — navigates to `/email-login.html`, fills email, intercepts the
OTP code from the fake-mailbox store, submits it, and waits for the redirect to `/`.

```javascript
await loginAsEmail(page, scenario.deaconEmail);
// page now has a valid JWT cookie
```

The fake mailbox resets at the start of every `loginAsEmail` call. The OTP server-side
is intercepted by `s3-sim-bootstrap.mjs` via `nodemailer` patching when `USE_FAKE_MAILER=1`.

### `apiPost(request, path, data)` / `apiGet(request, path)`

Authenticated HTTP calls using `x-api-key: test-generation-key`. This key bypasses
email OTP and generates a JWT for the provided data (used for seeding only).

```javascript
const res = await apiPost(request, '/api/projects', {
  title: 'Replace water heater',
  householdId: scenario.targetHouseholdId,
  phase: 'discovery',
  status: 'active',
});
expect(res.ok()).toBeTruthy();
const { id: projectId } = await res.json();

const listRes = await apiGet(request, '/api/projects');
const { projects } = await listRes.json();
```

---

## Writing a New Spec

### File location and naming

`test/e2e/specs/<page-or-feature>.spec.js`

Reference spec (`test/e2e/specs/storage-sim.spec.js`) — shows the minimal pattern
for verifying the simulator backs the full API round-trip:

```javascript
import { test, expect } from '../support/browser-coverage.js';
import { apiGet, apiPost, loginAsEmail, seedWorkflowScenario } from '../support/workflow-helpers.js';

test.describe('projects page', () => {

  test('shows empty state for deacon with no projects', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);
    await loginAsEmail(page, scenario.deaconEmail);

    await page.goto('/projects.html');
    await expect(page.locator('#projectsList')).toBeVisible();
  });

  test('creates project via API and shows it in list', async ({ page, request }) => {
    const scenario = await seedWorkflowScenario(request);

    const res = await apiPost(request, '/api/projects', {
      title: `Heater-${scenario.stamp}`,
      description: 'No hot water.',
      householdId: scenario.targetHouseholdId,
      phase: 'discovery',
      status: 'active',
    });
    expect(res.ok()).toBeTruthy();

    await loginAsEmail(page, scenario.deaconEmail);
    await page.goto('/projects.html');
    await expect(page.locator('#projectsList')).toContainText(`Heater-${scenario.stamp}`);
  });

});
```

### Data isolation rule

**Every test seeds its own data using the `stamp` from a scenario (or `Date.now()`).**
Never reuse data from another test or rely on test execution order.
The S3 simulator's in-memory store is shared for the whole test server process,
so timestamp-prefixed names are the only isolation mechanism.

```javascript
// All seed helpers provide a stamp automatically.
// If you create extra data, use the stamp:
const { stamp } = await seedWorkflowScenario(request);
await apiPost(request, '/api/projects', { title: `Repair-${stamp}`, ... });
```

---

## Selector Conventions

Prefer IDs and semantic roles over CSS class selectors:

```javascript
// Prefer
page.locator('#projectsList')
page.getByRole('button', { name: 'Add Project' })
page.getByLabel('Phase')

// Avoid (fragile)
page.locator('.project-card:nth-child(2) .phase-badge')
```

Use `await expect(locator).toBeVisible()` before interacting.
Never use `waitForTimeout()` — use `waitForLoadState()` or assertion polling instead.

---

## Role-Scoped Test Patterns

Create members with the appropriate `tags` via `apiPost`. The S3 simulator stores these
in-memory and the JWT system reads them on the next login:

```javascript
const stamp = Date.now();

// Worker
const workerEmail = `worker-${stamp}@example.test`;
await apiPost(request, '/api/members', {
  householdId: targetHouseholdId,
  firstName: 'Bob', lastName: `Worker${stamp}`,
  relationship: 'head', gender: 'male',
  email: workerEmail, tags: ['worker'],
});
await loginAsEmail(page, workerEmail);

// Lead-deacon
const leadEmail = `lead-${stamp}@example.test`;
await apiPost(request, '/api/members', {
  householdId: deaconHouseholdId,
  firstName: 'Lead', lastName: `Deacon${stamp}`,
  relationship: 'head', gender: 'male',
  email: leadEmail, tags: ['deacon', 'lead-deacon'],
});
await loginAsEmail(page, leadEmail);

// Admin
const adminEmail = `admin-${stamp}@example.test`;
const adminHHRes = await apiPost(request, '/api/households', { lastName: `AdminHH-${stamp}` });
const { id: adminHHId } = await adminHHRes.json();
await apiPost(request, '/api/members', {
  householdId: adminHHId,
  firstName: 'Admin', lastName: `User${stamp}`,
  relationship: 'head', gender: 'male',
  email: adminEmail, tags: ['admin'],
});
await loginAsEmail(page, adminEmail);
```

---

## Environment / Config Reference

`playwright.config.js` automatically sets all required env vars — you don't need to
set them manually for standard runs. For local overrides, copy `.env.e2e.example` to
`.env.e2e`; `global-setup.js` reads it at startup (only sets vars not already in env).

Key env vars (all set by `playwright.config.js` or `.env.e2e.example`):

| Var | Default | Purpose |
|-----|---------|---------|
| `USE_S3_SIMULATOR` | `1` | Must always be `1` for e2e tests |
| `USE_FAKE_MAILER` | `1` | Intercepts nodemailer; OTPs go to fake mailbox |
| `FAKE_MAILBOX_FILE` | `test-results/fake-mailbox.json` | Where OTPs are written |
| `S3_BUCKET` | `deacon-care-system-e2e` | Bucket name (cosmetic in sim) |
| `GENERATION_API_KEY` | `test-generation-key` | API key used by `apiPost`/`apiGet` |
| `JWT_SECRET` | `actsix-e2e-secret` | JWT signing secret |
| `E2E_PORT` | `3101` | Test server port |
| `S3SIM_CONFLICT_COUNT` | `0` | Conflict budget (0 = no conflicts) |
| `S3SIM_CONFLICT_PREFIXES` | `` | Key prefixes that consume conflict budget |

---

## Running Tests

```bash
npm run e2e                           # Full suite
npm run e2e -- --grep "project"       # Filter by test name
npm run e2e -- --grep "@smoke"        # Smoke tests only
```

---

## Done Criteria

A test file is complete when:
1. `test` and `expect` are imported from `../support/browser-coverage.js` (not `@playwright/test`).
2. No cross-test data dependencies — every test seeds its own timestamped data.
3. Login uses `loginAsEmail()` — never hardcoded cookies or JWTs.
4. No `USE_S3_SIMULATOR=0` anywhere — the simulator is always on.
5. `npm run e2e` passes without `--grep` restrictions.
