---
name: help-docs
description: >
  **WORKFLOW SKILL** — Maintain help docs for ActSix app.
  USE FOR: add/update behavior docs; add new help page; verify doc accuracy vs source;
  check role access before write.
  ALWAYS: verify behavior vs `site/*-page.js` AND `src/api/` role checks.
  NEVER: show features to wrong role; add behavior to `help-config.json` for role not allowed in code.
  NOT FOR: general code; debug runtime errors; add site features.
---

# Help Doc Maintenance

## System Parts

Help system use **composable behavior files**: each user action has own `.md` file in
`site/help/behaviors/`. File `site/help/help-config.json` is **truth**
for what behaviors show for each page/role.

`help-config.json` structure:
- `page-key`: HTML file name, no `.html` (e.g., `members`, `household`)
- `"*"` in `roles`: show to all, even not logged in (login page)
- Role tokens: `"deacon"`, `"staff"`, `"helper"`, `"*"` (regular member see `"*"` only)

## Roles

Roles from `member.tags` in DB. Auth sets `req.role` from JWT.

| Config token | Member tag | Notes |
|---|---|---|
| `"deacon"` | `deacon` | Full access, contact history, assignments |
| `"staff"` | `staff` | Admin; **NO** create/update deacon assignments |
| `"helper"` | `helper` | H.E.L.P. program; **CAN** create assignments; **NO** see contact history |
| `"*"` | (any) | Always show; for login page, universal features |

**Verified Rules — check source before change:**

| Behavior | Roles | Verify File |
|---|---|---|
| `assign-deacons-form.md` | `["deacon","helper"]` | `src/api/assignments.js` – `verifyRole(c, ['deacon','helper'])` |
| `view-contact-history.md` | `["deacon","staff"]` | `src/api/contacts.js` – household contacts endpoint |
| `set-member-tags.md` | `["deacon","staff","helper"]` | `src/api/members.js` – tag write check |
| `view-members-list.md` | `["deacon","staff","helper"]` | `src/api/households.js` – need auth role |

---

## Add New Behavior File

1. **Check first**:
   - Read `site/<page>-page.js` for UI flow, buttons, fields.
   - Read `src/api/<resource>.js`, find all `verifyRole()` for this action.
   - Confirm roles match `verifyRole()`.

2. **Create file** at `site/help/behaviors/<behavior-name>.md`.

3. **Add to config** `site/help/help-config.json`. Add entry under page key. Order matters.

4. **Add screenshot row** to `site/help/CAPTURE_GUIDE.md`.

5. **Make screenshot**: `npm run help:screenshots`
   (See `help-image-capture` skill for full workflow.)

---

## Updating Existing Content

1. Read the current `.md` file.
2. Read the current `site/<page>-page.js` — identify what changed in the UI.
3. If role access changed: re-check `src/api/` `verifyRole()` calls and update `help-config.json`.
4. Update the `.md` steps to match the new UI.
5. If UI layout changed visually: re-capture screenshots (`npm run help:screenshots`).

---

## Adding a New Page to the Help System

1. Confirm the page filename (e.g., `new-feature.html`).
2. Read `site/new-feature-page.js` and `src/api/` to identify all actions and their roles.
3. Create behavior `.md` files for each action.
4. Add a new key `"new-feature"` to `help-config.json` with the behavior list.
5. The nav `?` link is set dynamically by `site/site-nav.js` — no nav changes needed.

---

## Content Conventions

- **Headings**: `## Title` as the section heading (rendered as separator in help.html)
- **Steps**: use numbered lists for sequential actions; bullets for options or tips
- **Screenshots**: `![Alt text](../images/<filename>.png)` — filename matches CAPTURE_GUIDE row
- **Login doc**: always end with exactly:
  > "If you did not receive a code or cannot access your email, contact your site administrator."
- **Privacy**: never include real names, real email addresses, or real member data
- **Role discipline**: never describe an action in a file when that file's `roles` array wouldn't include the reader's role — the config prevents loading, but be consistent in the content too

### Example Quality Standards (Required)

- Use realistic, specific examples that model good ministry documentation habits.
- Avoid repetitive filler phrases and low-information notes.
- Keep examples concise but concrete: include context and next step when relevant.
- If screenshots or examples show repeated rows/names due to test-data accumulation, coordinate with the screenshot skill to use deterministic deduplicated fixture data.
- Ensure all examples are role-appropriate and do not imply permissions a role does not have.

---

## Role Verification Workflow

When unsure which roles can perform an action, run this check:

```bash
# Find verifyRole calls in the API file
grep -n "verifyRole" src/api/<resource>.js
```

Or use `grep_search` in the agent to search for "verifyRole" in the relevant `src/api/` file.
The roles array passed to `verifyRole()` is the authoritative list.

---

## Quality Checklist Before Committing

- [ ] Behavior file content matches current `site/*-page.js` (verified by reading)
- [ ] `help-config.json` roles match `verifyRole()` in `src/api/*.js`
- [ ] No cross-role content leakage (each file only describes what its roles can do)
- [ ] Screenshot file referenced in `.md` exists in `site/help/images/`
- [ ] CAPTURE_GUIDE.md row added if new screenshot
- [ ] `npm run e2e -- --grep help` passes (or `npm run e2e`)
- [ ] Examples are realistic and non-repetitive (no placeholder copy repeated across rows/steps)
- [ ] Screenshots used by docs show deduplicated, readable sample data for the demonstrated behavior
