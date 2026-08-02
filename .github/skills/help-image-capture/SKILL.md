---
name: help-image-capture
description: >
  **WORKFLOW SKILL** — Make/remake help screenshots for ActSix app with Playwright.
  USE FOR: new screenshots for new behavior doc; remake after UI change; add new page screenshots.
  RUNS: npm run help:screenshots
  MODIFIES: site/help/images/*.png, test/e2e/screenshots/*.spec.js, site/help/CAPTURE_GUIDE.md
  NOT FOR: run main e2e tests; debug app bugs.
---

# Help Image Capture

## Overview

Screenshots from Playwright project. Reuses e2e server (S3 sim, fake mailer). Seeds **fixed demo people** — same names, no real member data.

Config: `test/e2e/playwright.screenshots.config.js`
Helpers: `test/e2e/screenshots/capture-helpers.js`
Specs: `test/e2e/screenshots/*.spec.js`
Output: `site/help/images/`

## Privacy Rule

**All screenshots use demo data only.**
`seedDemoData(request)` in `capture-helpers.js` makes fixed people.
Never log in as test user. Never screenshot data from `seedWorkflowScenario`.

## Quality Rule

Help screenshots must be good, real examples.
- No placeholder text spam.
- Use short, specific notes.
- List/table examples: 3-6 rows good.
- Names/summaries unique if UI expects.
- Examples fit role.

If backend data makes duplicates, stub API in spec with fixed data.

## Run Capture

`npm run help:screenshots`

This:
1. Starts test server.
2. Specs call `seedDemoData()` to clear and re-seed.
3. Go to page.
4. `highlightElement()` on key UI.
5. `takeHelpScreenshot()` saves to `site/help/images/`.

## Complete-List Workflow

When asked "generate images" or "do complete list", run this workflow.

### 1) Preflight Check

`site/help/CAPTURE_GUIDE.md` is the true list.
Check for missing/orphan images with node scripts.
Verify behavior markdown refs with node script.
```

### 2) Execute Full Capture

Run the full suite, not single specs, for release-quality help documentation:

```bash
npm run help:screenshots
```

### 3) Postflight Validation

Re-run both inventory checks. Do not consider capture complete until:
- No `missing` images
- No `orphan` images
- No `missingInBeh` references
- No `extraInBeh` references

---

## Mismatch Taxonomy

- `missing`: listed in `CAPTURE_GUIDE.md` but not present in `site/help/images`
- `orphan`: present in `site/help/images` but not listed in `CAPTURE_GUIDE.md`
- `missingInBeh`: expected image not referenced by any `site/help/behaviors/*.md`
- `extraInBeh`: behavior doc references image not in canonical guide

Resolve all four mismatch classes before finishing.

---

## Image Naming Convention

`<page-key>-<action>.png`

Examples:
- `login-email-form.png` — login page, email entry step
- `household-record-contact.png` — household page, record contact button highlighted
- `members-filter-tags.png` — members page, tag filter dropdown open

---

## Adding a New Screenshot

1. Open `site/help/CAPTURE_GUIDE.md` and add a row:
   | `filename.png` | `test/e2e/screenshots/page.spec.js` | State to show | Key element to highlight |

2. Open the relevant spec file (or create one following the pattern):
   ```javascript
   test('capture <action>', async ({ page, request }) => {
     await seedDemoData(request);
     await loginAsEmail(page, 'demo-deacon@help.test');
     await page.goto('/page.html');

     await highlightElement(page, page.locator('#target-button'), 'orange');
     await takeHelpScreenshot(page, 'page-action.png');
   });
   ```

3. Run `npm run help:screenshots`.
4. Re-run preflight/postflight checks and keep guide/spec/behavior references in sync.

---

## Highlight Conventions

Use `highlightElement(page, locator, color)` to add a colored overlay:

| Color | Use for |
|---|---|
| `'orange'` | Buttons being clicked (default) |
| `'blue'` | Form fields to fill in |
| `'green'` | Output areas / results to notice |

The highlight is a `<div>` overlay injected via `page.evaluate()`. It is removed on the next
navigation. For static screenshots it persists until the screenshot is taken.

---

## Re-capturing After UI Changes

1. Identify which behavior `.md` file section changed.
2. Find the screenshot filename from `![...](../images/<filename>.png)` in the `.md` file.
3. Check `site/help/CAPTURE_GUIDE.md` for the spec file and element to highlight.
4. Update the spec if selectors or page flow changed.
  - Also update fixture/example data if the current screenshot contains repetitive or low-quality examples.
5. Run `npm run help:screenshots`.
6. Re-run inventory checks and resolve any guide/behavior/image mismatches.

---

## Selector Robustness Rule (Required)

Any element that is highlighted in a screenshot must be asserted visible first.

```javascript
const target = page.locator('#someTarget');
await expect(target).toBeVisible();
await highlightElement(page, target, 'orange');
```

Why: silent fallbacks can produce screenshots without the intended highlighted affordance.

If selectors become flaky, fix selectors in the spec to match current page ids/roles and keep the assertion.

---

## Capture Helpers API

```javascript
// capture-helpers.js exports

// Seed deterministic demo data (idempotent — clears old demo data first)
await seedDemoData(request);

// Highlight a UI element with a colored overlay
// color: 'orange' | 'blue' | 'green' (default: 'orange')
await highlightElement(page, locator, color);

// Take a screenshot and save to site/help/images/<filename>
await takeHelpScreenshot(page, filename);
```

---

## Troubleshooting

**Screenshot is blank / page hasn't loaded:**
- Increase wait time: add `await page.waitForLoadState('networkidle')` before `highlightElement`.

**Demo data not showing (list is empty):**
- `seedDemoData()` may have failed. Check the test output for API errors.
- Verify `GENERATION_API_KEY=test-generation-key` is set (it is in the screenshots config).

**Highlight not visible:**
- The locator may not match the current UI. Prefer `await expect(locator).toBeVisible()` before highlighting.
- If assertion fails, update the selector to the current stable id/role and re-run `npm run help:screenshots`.

**Screenshot shows duplicate rows or repetitive summaries:**
- Do not accept the screenshot as-is.
- Replace live/accumulated data with deterministic API stubs in the screenshot spec.
- Add assertions for row count and uniqueness before `takeHelpScreenshot()`.

**CI: screenshots not committed:**
- Screenshots are committed as part of the help system (they are static assets).
- After changing any behavior `.md` file visually, re-run `npm run help:screenshots` and commit the new `.png` files.

---

## Done Criteria

Capture work is complete only when all conditions are met:
1. `npm run help:screenshots` passes.
2. `CAPTURE_GUIDE.md` expected list equals `site/help/images/*.png` exactly.
3. Behavior references are synchronized with the expected list.
4. Any changed screenshot files are intentionally regenerated and reviewed.
5. Example quality checks pass: realistic wording, no obvious repetition, and deduplicated rows where appropriate.
