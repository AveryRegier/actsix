# Copilot Instructions

Use Muninn DB continuously during agent work in this repository.

## Muninn Startup And Availability

Do not rely on the user to start Muninn manually.

- At the start of each session (or before first memory operation), verify availability with `muninn_status` (MCP tool) or `muninn status` (CLI).
- If unavailable, start it automatically with `muninn start`, then re-check with `muninn status`.
- If startup still fails, run `muninn logs --no-follow`, capture the error, and report a concise unblock message.
- Only ask the user to intervene after automatic start and log collection both fail.

Recommended fallback flow:
1. Check: `muninn status`
2. Start: `muninn start`
3. Verify: `muninn status`
4. Diagnose on failure: `muninn logs --no-follow`

## Required Memory Writes

Write to Muninn on every user prompt, or immediately after meaningful progress, and include atomic entries for:

- Decisions made and rationale
- Problems found, defects discovered, and root-cause insights
- Lessons learned and implementation insights likely to help future work
- Project goals, structure, and constraints discovered during exploration
- Deferred items: tech debt, postponed features, known issues, and follow-up work
- Handoff context another agent would need to continue safely and quickly

## Required Memory Reads Before Risky Work

Read from Muninn before proceeding when uncertainty, risk, or ambiguity is present, including:

- Sticky situations or tradeoff-heavy choices
- Architecture or implementation decisions that could have long-term impact
- Cases where goals, conventions, or prior decisions need confirmation
- Work in unfamiliar areas where relevant prior context may already exist

## Memory Quality Rules

- Store memories as atomic, concise entries
- Prefer clear tags/types and link related memories (decision <-> issue <-> follow-up)
- Update lifecycle state as work progresses (active/blocked/completed/archived)
- Record contradictions or superseded decisions explicitly

## Scope Guidance

Capture anything that is likely to help future agents, including defects, open issues, deferred work, and constraints that shape implementation choices.

## Workflow Skills — Required Before Coding

**Before writing code in the following areas, invoke or read the corresponding skill:**

| Task | Skill to invoke |
|------|----------------|
| Writing any `src/api/*.js` route | **api-security** skill |
| Writing any Sengo query (`safeCollection*`) | **sengo** skill |
| Writing `site/*.html` or `site/*-page.js` | **site-frontend** skill |
| Writing `test/e2e/` specs | **e2e-tests** skill |
| Editing help docs or `help-config.json` | **help-docs** skill |
| Capturing help screenshots | **help-image-capture** skill |

Skill files are in `.github/skills/<skill-name>/SKILL.md`.

**Non-negotiable rules enforced by the skills:**
- `verifyRole` is **async — MUST be `await`ed** on every route handler; omitting `await` authorizes all requests regardless of role
- `c.req.roles` is an **array** (`string[]`) — use `hasRole(c, 'role')` after `verifyRole`; never use `c.req.role` (old single-string pattern is gone)
- Sengo: use only operators/commands documented in the `sengo` skill references; if a feature is unsupported, rewrite with a supported query pattern
- All page JavaScript in `site/*-page.js` files — never inline `<script>` logic blocks in HTML
- Use `GET /api/me` for role detection in frontend — never parse JWT client-side

---



The app has a user-facing help system at `/help.html?page=<key>`. It is driven by composable
behavior markdown files in `site/help/behaviors/` and a role-access config at `site/help/help-config.json`.

**To maintain help content** — use the `help-docs` skill (`.github/skills/help-docs/SKILL.md`):
- Adding/updating behavior `.md` files
- Updating `help-config.json` role mappings
- Verifying accuracy against `site/*-page.js` and `src/api/` source

**To regenerate screenshots** — use the `help-image-capture` skill (`.github/skills/help-image-capture/SKILL.md`):
- Run `npm run help:screenshots` to capture/re-capture all images
- All images use demo personas (no real member data)
- Screenshot specs live in `test/e2e/screenshots/`

**Key rules:**
- Never show a behavior to a role that cannot perform it — `help-config.json` roles arrays are authoritative
- Verify role constraints in `src/api/` `verifyRole()` calls before writing or editing behavior files
- Staff cannot assign deacons (`assign-deacons-form.md` is `deacon` + `helper` only)
- Helper cannot view contact history (`view-contact-history.md` is `deacon` + `staff` only)
