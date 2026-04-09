---
name: help-docs
description: >
  **WORKFLOW SKILL** — Maintain the help documentation system for the ActSix Deacon Care app.
  USE FOR: adding new behavior docs for new features; updating existing behavior docs after UI changes;
  adding a new page to the help system; verifying behavior file accuracy against site source code;
  checking which roles have access to which features before writing help content.
  ALWAYS: verify behavior file content against site/*-page.js AND src/api/ endpoint role checks before writing.
  NEVER: mention features not available to the current user's role in a help file; add a behavior to
  help-config.json for a role without first verifying the role is permitted in source code.
  DO NOT USE FOR: general coding tasks; debugging runtime errors; adding new site features.
---

# Help Documentation Maintenance

## System Architecture

The help system uses **composable behavior files**: each user action has its own `.md` file under
`site/help/behaviors/`. The file `site/help/help-config.json` is the **single source of truth**
for which behaviors appear for each page and role combination.

```
site/
  help.html             — Help viewer shell page
  help-page.js          — Fetches config, filters by role, renders behaviors
  help.css              — Help viewer styles
  help/
    help-config.json    — Page → behaviors → roles mapping
    behaviors/          — One .md file per user action
    images/             — Screenshots (see CAPTURE_GUIDE.md)
    CAPTURE_GUIDE.md    — Screenshot capture instructions
```

`help-config.json` structure:
```json
{
  "page-key": [
    { "file": "behavior-name.md", "roles": ["deacon", "staff", "helper"] }
  ]
}
```
- `page-key` = HTML filename without `.html` (e.g., `members`, `household`, `login`)
- `"*"` in `roles` = visible to all users, including unauthenticated (login page)
- Role tokens: `"deacon"`, `"staff"`, `"helper"`, `"*"` (null/regular member only sees `"*"` behaviors)

---

## Role System

Roles are determined by `member.tags` in the database. Auth sets `req.role` from the JWT.

| Config token | Member tag | Notes |
|---|---|---|
| `"deacon"` | `deacon` | Full access including contact history and assignments |
| `"staff"` | `staff` | Admin; **CANNOT** create/update deacon assignments |
| `"helper"` | `helper` | H.E.L.P. program; **CAN** create assignments; **CANNOT** see contact history |
| `"*"` | (any) | Always shown; used for login page and universal features |

**Verified constraints — do not change without re-checking source:**

| Behavior | Roles | Source file to verify |
|---|---|---|
| `assign-deacons-form.md` | `["deacon","helper"]` only | `src/api/assignments.js` – `verifyRole(c, ['deacon','helper'])` |
| `view-contact-history.md` | `["deacon","staff"]` only | `src/api/contacts.js` – household contacts endpoint |
| `set-member-tags.md` | `["deacon","staff","helper"]` | `src/api/members.js` – tag write check |
| `view-members-list.md` | `["deacon","staff","helper"]` | `src/api/households.js` – requires authenticated role |

---

## Adding a New Behavior File

1. **Verify accuracy first** — before writing any step:
   - Read `site/<page>-page.js` to see the actual UI flow and what buttons/fields exist
   - Read `src/api/<resource>.js` and find all `verifyRole()` calls for this action
   - Confirm the roles you plan to list are exactly those in `verifyRole()`

2. **Create the file** at `site/help/behaviors/<behavior-name>.md`:
   ```markdown
   ## Action Title

   Brief one-sentence description of what this action does.

   1. Navigate to the [Page Name] page.
   2. Click the **Button Label** button.
      ![Screenshot description](../images/page-action.png)
   3. Fill in the fields...
   4. Click **Save**.
   ```

3. **Add to config** — open `site/help/help-config.json` and add an entry under the relevant page key:
   ```json
   { "file": "behavior-name.md", "roles": ["deacon", "staff"] }
   ```
   Place it in the order you want it to appear on the help page.

4. **Add a screenshot row** to `site/help/CAPTURE_GUIDE.md`.

5. **Generate the screenshot**: run `npm run help:screenshots`
   (See `.github/skills/help-image-capture/SKILL.md` for the full screenshot workflow.)

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
