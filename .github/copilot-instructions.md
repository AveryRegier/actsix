# Copilot Instructions

Always use Muninn DB.

## Muninn Lifecycle

1.  `muninn status` (MCP tool) or `muninn status` (CLI) to check.
2.  If down, `muninn start`.
3.  If start fails, `muninn logs --no-follow` to diagnose.
4.  Only ask user for help if auto-start fails.

## Memory Writes

Write to Muninn often. Include:
- Decisions & rationale
- Problems & insights
- Lessons learned
- Project goals & constraints
- Deferred work (tech debt, etc.)
- Handoff context

## Memory Reads

Read from Muninn before risky work, or when uncertain about:
- Tradeoffs
- Architecture
- Goals or conventions

## E2E Testing

- **NEVER mock API calls in E2E tests** (`test/e2e/specs/`). Tests must hit a live, data-seeded server.
- **NEVER perform direct API calls in E2E specs** (`test/e2e/specs/`): no `page.request.*`, no injected `request` fixture HTTP setup/assertions, and no helper wrappers around direct API requests.
- If a test violates policy, do a **surgical edit**: remove or rewrite only the violating tests/lines. **Do not delete whole spec files** unless explicitly requested.
- Use `s3Simulator` and its seeding utilities (`seedWorkflowScenario`, `seedDemoData`) for test setup.
- API mocking (`page.route()`) is ONLY for screenshot tests (`test/e2e/screenshots/`).

## Help System

- Help content is in `site/help/behaviors/` and `site/help/help-config.json`.
- Use `help-docs` skill to edit content.
- Use `help-image-capture` skill to regenerate screenshots (`npm run help:screenshots`).
- **Rule:** Role access in `help-config.json` must match API role checks in `src/api/`. Verify before editing.


<!-- caveman-begin -->
## Caveman mode (always on)

Respond terse like smart caveman. All technical substance stay. Only fluff die.

The full ruleset and intensity levels live in this workspace's caveman skill:

  skills/caveman/SKILL.md

Default intensity: `full`. Switch with `/caveman lite|full|ultra|wenyan`.
Stop with: "stop caveman" / "normal mode" / "deactivate caveman".

Auto-Clarity: drop caveman for security warnings, irreversible action
confirmations, multi-step sequences where fragments risk misread, or when
user is confused or repeating. Resume after.

Boundaries: code, commit messages, and PR descriptions stay normal prose.

Use /caveman skill to compact conversations.
<!-- caveman-end -->
