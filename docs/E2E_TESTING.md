# E2E Testing and MCP Workflow

This project uses Playwright browser tests against the real app server, with test-runtime simulation for S3 and email:

- Sengo query/store logic remains unchanged and in-path.
- AWS S3 transport is patched at test runtime to an in-memory bucket simulator.
- Email sending is patched at test runtime to an in-process fake mailbox.

No production application source code is modified for test simulation.

## Command contract for MCP

These commands are the stable contract for AI and MCP tools:

- `npm run e2e:mcp:smoke`
- `npm run e2e:mcp`
- `npm run e2e:mcp:coverage`
- `npm run e2e:artifacts`

Behavior:

- `e2e:mcp:smoke`: runs smoke tests, then writes artifact manifest.
- `e2e:mcp`: runs full Playwright suite, then writes artifact manifest.
- `e2e:mcp:coverage`: runs E2E coverage command, then writes artifact manifest.
- `e2e:artifacts`: writes `test-results/e2e-artifacts.json` with trace/video/screenshot/report pointers.

## Typical AI-followable run

1. Run smoke gate:
   - `npm run e2e:mcp:smoke`
2. If smoke passes, run full suite:
   - `npm run e2e:mcp`
3. If needed, run coverage pass:
   - `npm run e2e:mcp:coverage`
4. Read the artifact index:
   - `test-results/e2e-artifacts.json`

## Artifact locations

Primary output files and folders:

- Playwright HTML report: `test/e2e/playwright-report/index.html`
- Test results and traces: `test-results/`
- Fake mailbox capture: `test-results/fake-mailbox.json`
- E2E artifact manifest: `test-results/e2e-artifacts.json`
- E2E coverage report (when produced): `coverage/e2e/index.html`
- Unit coverage report: `coverage/index.html`

## What the artifact manifest contains

`test-results/e2e-artifacts.json` includes:

- timestamp of generation
- canonical run commands for MCP
- report entry points
- latest traces/videos/screenshots with relative paths
- fake mailbox file path (if present)
- unit coverage summary snapshot (if present)

This allows AI tools to quickly locate trace zips and failure evidence without scanning directories.

## Validation gates used in phased work

For each completed test phase, run:

1. `npm run e2e:mcp:smoke`
2. `npm run e2e:mcp`
3. `npm run e2e:mcp:coverage`
4. `npm run test:coverage`

Then commit with validation and coverage results in the commit message.

## CI quality gates

CI workflow: `.github/workflows/e2e-simulator-ci.yml`

Jobs:

- `smoke-and-unit` on pull requests and main pushes
   - clones sibling `sengo` and `clox` repos for local file dependencies
   - runs `npm run test:coverage`
   - runs `npm run coverage:check` (threshold gate)
   - runs `npm run e2e:mcp:smoke`
   - uploads `test-results`, Playwright report, and coverage artifacts

- `full-e2e` on schedule, workflow_dispatch, and main branch
   - runs full `npm run e2e:mcp`
   - runs `npm run e2e:mcp:coverage`
   - uploads traces/videos/screenshots and E2E coverage artifacts

Default coverage thresholds for `coverage:check`:

- statements >= 15%
- branches >= 70%
- functions >= 20%
- lines >= 15%

Thresholds can be overridden with env vars:

- `COVERAGE_MIN_STATEMENTS`
- `COVERAGE_MIN_BRANCHES`
- `COVERAGE_MIN_FUNCTIONS`
- `COVERAGE_MIN_LINES`

## Notes on E2E coverage

Current `e2e:coverage` command is wired and reliable as an execution gate. In this environment, reported totals may appear as 0/0 depending on process-level instrumentation behavior under Playwright orchestration. The manifest still captures artifacts and report locations for failure analysis.
