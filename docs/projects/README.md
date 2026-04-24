# ActSix Projects Feature — Design Documents

This folder contains design proposals and working docs for the Projects tracking feature.

## Overview

Projects are structured ministry efforts the deacons undertake on behalf of households in need.
A project moves through lifecycle phases (Discovery → Vetting → Funding → Preparation → Implementation)
and requires coordination among deacons, workers, and sometimes external teams.

## Documents

| File | Contents | Status |
|------|----------|--------|
| `01-mvp-proposal.md` | MVP scope, roles, goals, and exclusions | ✅ Current |
| `02-database-schema.md` | Sengo collection schemas for MVP and future growth | ✅ Current |
| `03-site-structure.md` | New HTML pages and page-JS responsibilities | ⚠️ Partially stale (materials references remain) |
| `04-api-design.md` | REST API endpoints, payloads, and role access rules | ✅ Current |
| `05-file-upload-feature.md` | Generic file attachment system design (separate feature) | ✅ Current |

## Key Decisions (Summary)

### Roles

- **`helper` is NOT involved in projects** — `helper` is the H.E.L.P. ministry role (unrelated)
- **Roles are a list ("hats")** — a person can hold `['deacon', 'worker']` simultaneously; JWT `roles` is an array
- **`lead-deacon`** — Travis; manages ministry-level funding; satisfies all `deacon`/`staff` checks
- **`worker`** — new role for volunteers AND household members participating in their own project
- Any deacon can add a worker; **deacons can propose for any household**; non-deacon members can only propose for their own household (data privacy)
- **All proposed projects auto-assign the lead-deacon** to `assignedDeaconIds` for guaranteed visibility
- The proposing deacon is also auto-assigned; non-deacon proposers are added to `workerIds`

### Data Model

- Projects are **household-centric** — every project links to exactly one `householdId`
- **`assignedDeaconIds[]`** replaces the old `leadDeaconId` (single) — multiple deacons can co-lead
- Creator is **auto-added** as the first `assignedDeaconId`
- **Requirements** replace the old "materials list" — optional convenience feature (material, plans, funding, labor, permit, other)
- Requirement notes are **threaded**: `[{ _id, text, authorId, createdAt }]`
- Updates have a **`confidential: boolean` flag** — funding-context discussions default to `confidential: true`
- Workers never receive confidential update text from the API (placeholder entry shown instead)

### Files

- File uploads are a **separate feature** (`05-file-upload-feature.md`) — not MVP
- S3 path: `files/{fileId}/{fileName}.{ext}` (generic, not entity-typed)
- Files attach to any entity via a `fileId` field; metadata in a `files` Sengo collection
- Safety validation options: ClamAV Lambda (recommended), Rekognition (images), or admin queue
- Target cost: < $0.01 per file

### Architecture

- Phase progression is **flexible, not enforced** — the first four phases may occur in any order
- Updates/notes are in a **separate `project-updates` collection** — append-only audit trail
- Cost details are optional and visible to deacon/staff; hidden from workers
- MVP excludes real-time messaging; a free-text `communicationLink` covers coordination


This folder contains design proposals and working docs for the Projects tracking feature.

## Overview

Projects are structured ministry efforts the deacons undertake on behalf of households in need.
A project moves through lifecycle phases (Discovery → Vetting → Funding → Preparation → Implementation)
and requires coordination among deacons, workers, and sometimes external teams.

## Documents

| File | Contents |
|------|----------|
| `01-mvp-proposal.md` | MVP scope, goals, and what is explicitly out of scope |
| `02-database-schema.md` | Sengo collection schemas for MVP and future growth |
| `03-site-structure.md` | New HTML pages and page-JS responsibilities |
| `04-api-design.md` | REST API endpoints, payloads, and role access rules |

## Key Decisions (Summary)

- Projects are **household-centric** — every project links to exactly one `householdId`
- Phase progression is **flexible, not enforced** — the first four phases (Discovery, Vetting,
  Funding, Preparation) may occur in any order or in parallel; Implementation is always last
- Deacons are **members with a `deacon` tag** (same pattern as existing assignments)
- Updates/notes are stored in a **separate `project-updates` collection** to keep the project
  document small and support an append-only audit trail
- Cost details are **optional** and gated behind the lead deacon / staff approval flow
- MVP deliberately excludes real-time messaging (WhatsApp/Discord integration, in-app forum);
  a free-text `communicationLink` field covers that coordination point until the app grows into it
