# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Architecture Layers

**Respect layer boundaries - do NOT bypass:**

- **Site** (`site/*.html`) - Static pages, client JS for display only
- **Form** (`src/form/*`) - POST handlers → call `/api/*` → redirect browser
- **API** (`src/api/*`) - JSON endpoints → business logic → `safeCollection*`
- **Auth** (`src/auth/*`) - Middleware sets `c.req.memberId`, `c.req.role`
- **Data** (`src/util/helpers.js`) - `safeCollection*` functions only

**Rules:**
- Form layer calls API layer (never direct DB)
- Form → API calls use HTTP with JWT in Authorization header
- API layer contains all validation and business logic
- Use `verifyRole(c, ['deacon','staff'])` for authorization
- Register routes: `export default function register*Routes(app)`

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
   ```bash
   npm run build:validate
   ```
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

