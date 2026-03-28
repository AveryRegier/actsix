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
