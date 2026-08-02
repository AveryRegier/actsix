# E2E Testing Skill

Workflow for run, debug, fix Playwright E2E tests.

## Rules

1.  **No API Mocking**: E2E tests in `test/e2e/specs/` **no mock** API. Must run against live, data-seed server. True end-to-end check. Enforced by `.github/copilot-instructions.md`.
2.  **Use Simulators**:
    *   **Data**: Seed test data with `s3Simulator` via helpers in `test/e2e/support/workflow-helpers.js`. Test state must be predictable.
    *   **Email**: `fake-mailbox` catch and check emails (e.g., login codes).
3.  **Isolate & Verify**: Failed test? Run alone to speed up debug. Verify fix on single test, then run full suite.

## Workflow: Run/Debug

### 1. Run Suite

Run all E2E tests:
`npm run e2e`

### 2. Analyze Failures

Tests fail? Use Playwright report:
`npx playwright show-report test/e2e/playwright-report`

For one fail, trace is best tool. Copy `npx playwright show-trace ...` from output. See step-by-step record, network, DOM.

### 3. Guess Cause

From error, trace, video, find cause:
*   **Timeout on `waitForURL`**: Server error. Form post or API call fail, so no redirect. Check server logs, `src/api/` endpoint.
*   **`expect(locator).toContainText(...)` fail**: UI not show right content. Client-side render bug in `site/*.js` or bad data from API.
*   **`expect(response).toBeOK()` fail**: API call in test setup fail. Check `src/api/` endpoint, check request payload.

### 4. Isolate Test

Run one test file for fast feedback:
`npx playwright test test/e2e/specs/the-failing-file.spec.js`

Run one test by title with `-g`:
`npx playwright test -g "title of failing test"`

### 5. Fix

*   **Server Issue**: Check `src/api/` route. Add log to see request, find fail.
*   **Client Issue**: Check `site/` page script. Use dev tools in headed Playwright (`--headed`) to debug JS.
*   **Test Setup Issue**: Check test file, helpers in `test/e2e/support/`. Check data seed.

### 6. Verify Fix

Re-run isolated test. Pass? Good. Run full suite. Check for new bugs.
`npm run e2e`

## Key Files

*   **Tests**: `test/e2e/specs/`
*   **Helpers**: `test/e2e/support/workflow-helpers.js`
*   **S3 Sim**: `test/harness/s3-bucket-simulator.js`
*   **Sim Bootstrap**: `test/harness/s3-sim-bootstrap.mjs`
*   **Global Rules**: `.github/copilot-instructions.md`
