# Proposal 5: Generic File Attachment Feature

> **Status: Separate Feature — Not MVP**
>
> File uploads are a distinct feature that attaches to the projects feature and extends
> to the entire app (members, households, contacts, requirements, etc.). It must not
> block project tracking MVP delivery.

---

## Goal

Allow users to upload files through the ActSix app and attach them to any entity
(projects, requirements, members, households, contacts). Files must be validated for
safety before being viewable by others. Target cost: **< $0.01 per file**.

---

## S3 Storage Structure

All files are stored in the app's existing S3 bucket:

```
files/{fileId}/{fileName}.{ext}
```

- `fileId` is a logical grouping key (UUID) — multiple files can share a fileId
- Each entity that can have attachments carries a `fileId` field referencing a group
- A project might have a primary `fileId` plus individual `requirement.fileId` per item
- The path is **not** entity-typed — files are generic and attached via metadata

### Path Separation from Projects

Old design used `projects/{projectId}/{filename}.{ext}`. **This is replaced by
`files/{fileId}/{fileName}.{ext}`** to decouple the storage location from the entity type.

---

## Sengo Collection: `files`

```javascript
{
  _id: String,            // UUID — file metadata identifier (= fileId for single-file groups)

  fileId: String,         // Logical group this file belongs to (attach point on entities)
  fileName: String,       // Original filename as uploaded
  fileType: String,       // MIME type (e.g. 'image/jpeg', 'application/pdf')
  fileExt: String,        // Extension without dot (e.g. 'jpg', 'pdf')
  s3Key: String,          // Full S3 key path: files/{fileId}/{fileName}.{ext}
  sizeBytes: Number,      // File size in bytes

  uploadedBy: String,     // Member._id of uploader
  uploadedAt: String,     // ISO date string

  // Safety gate
  safetyStatus: String,   // Enum: 'pending' | 'approved' | 'rejected' | 'quarantined'
  safetyCheckedAt: String, // ISO date string (when scan/review completed)
  safetyMethod: String,   // Enum: 'clamav' | 'bedrock' | 'manual' | 'admin-bypass'
  safetyNotes: String,    // Optional. Rejection reason, threat type, etc.

  // Attachment metadata
  attachedTo: {
    entityType: String,   // Enum: 'project' | 'requirement' | 'member' | 'household' | 'contact'
    entityId: String      // The _id of the attached entity
  }
}
```

---

## Upload Flow

### Step 1 — Client requests a presigned URL

```
POST /api/files/upload-url
Body: { fileName, fileType, attachedTo: { entityType, entityId } }
Response: { uploadUrl, fileId, s3Key }
```

The server:
1. Validates the caller has permission to attach to the target entity
2. Generates a UUID as `fileId`
3. Constructs the S3 key: `files/{fileId}/{sanitized-fileName}`
4. Creates a presigned `PUT` URL (expires 5 minutes)
5. Inserts a `files` record with `safetyStatus: 'pending'`
6. Returns the presigned URL + fileId to the client

### Step 2 — Client uploads directly to S3

Client `PUT`s the file binary directly to the presigned S3 URL.
**File goes to a quarantine prefix first:** `quarantine/files/{fileId}/{fileName}`.

### Step 3 — Safety scan (async, via S3 event or Lambda trigger)

After upload, a Lambda trigger fires on the quarantine prefix and runs safety validation.
On pass: file is copied to `files/{fileId}/{fileName}` and record is updated to `approved`.
On fail: record is set to `rejected`/`quarantined`, file deleted from quarantine.

### Step 4 — Client polls or gets status

```
GET /api/files/:fileId/status
Response: { fileId, safetyStatus, fileName, uploadedAt }
```

Client polls until `safetyStatus !== 'pending'`, then shows the file or an error.

---

## Safety Validation Options

### Option A: ClamAV on Lambda (Recommended for MVP)

**How it works:**
1. Package ClamAV binary + virus definitions as a Lambda Layer
2. S3 event notification triggers Lambda on new quarantine object
3. Lambda downloads the file to `/tmp/`, runs `clamdscan`, evaluates result
4. Pass → move file to main prefix, set `safetyStatus: approved`
5. Fail → delete file, set `safetyStatus: rejected`, log threat name

**Cost:** Lambda execution at 512MB/3s ≈ $0.0003/scan. ClamAV definitions update daily
via a separate scheduled Lambda. Effectively **< $0.001 per file** for the volume this
app will see.

**Pros:** Open source, no per-call API cost, well-established, detects viruses/malware.
**Cons:** Not an AI-based content moderation — won't catch inappropriate images.

**Recommended OSS reference:** `upsidelab/clamav-lambda` or bucket-antivirus-function.

---

### Option B: AWS Bedrock Image Moderation (Images Only)

**How it works:**
1. Lambda trigger downloads file from quarantine
2. Calls Bedrock with Claude Haiku or Amazon Titan Image Moderation
3. Evaluates response for harmful content flags
4. Pass → move file to main prefix

**Cost:** Claude Haiku input token cost for a moderation prompt ≈ $0.00025 per call.
Amazon Rekognition content moderation (non-Bedrock) = $0.001 per image.

**Pros:** Catches CSAM, violence, adult content in images.
**Cons:** Only useful for images; overkill for PDFs and plans files; adds latency.

---

### Option C: Hybrid — **CHOSEN**

1. ClamAV scan **all** files on upload (virus/malware)
2. Rekognition moderation scan **images only** (`image/jpeg`, `image/png`, etc.)
3. Manual admin review queue for anything that passes automated scan but looks suspicious

**Estimated cost:** < $0.002 per image file, < $0.001 per non-image file.

---

### Option D: Admin Approval Queue (Minimal Fallback)

Files go to `safetyStatus: pending` and appear in an admin review queue. A staff member
or lead-deacon must approve each file before it becomes publicly viewable. No automated
scanning. Zero cloud cost but requires manual effort.

Use as fallback if Lambda setup is blocked; can be replaced with automation later.

---

## Permissions

| Action | Roles |
|--------|-------|
| Upload a file | Any authenticated member (to permitted entities) |
| View an approved file (presigned GET URL) | Any member who can view the entity it's attached to |
| View a pending/rejected file | Uploader + `admin` only |
| Delete a file | `deacon`, `staff`, or original uploader |
| Approve a file (manual review override) | **`admin` only** |

Workers can upload to their assigned projects and requirements.
Workers cannot view files on entities they are not assigned to.
Household members can upload to their own household entity.

---

## Entity Integration

Every entity that can hold files adds a `fileId` field:

```javascript
// On a project
{ ..., "fileId": "<uuid>", ... }

// On a requirement item
{ ..., "requirements": [ { "_id": "...", "fileId": "<uuid>", ... } ] }

// On a member record
{ ..., "fileId": "<uuid>", ... }
```

To list all files for an entity:
```
GET /api/files?entityType=project&entityId=<projectId>
```

---

## Implementation Checklist (Post-MVP)

- [ ] Install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- [ ] Create `src/api/files.js` with `registerFileRoutes(app)`
- [ ] `POST /api/files/upload-url` — generate presigned PUT URL, insert pending record
- [ ] S3 event → Lambda trigger on quarantine prefix upload
- [ ] ClamAV Lambda layer (Option A) OR Rekognition call (Option B)
- [ ] Lambda moves/deletes file, updates `files` Sengo record
- [ ] `GET /api/files/:fileId/status` — polling endpoint
- [ ] `GET /api/files/:fileId/view-url` — presigned GET URL (approved files only)
- [ ] `GET /api/files?entityType=X&entityId=Y` — list files for an entity
- [ ] `DELETE /api/files/:fileId` — remove file + S3 object
- [ ] Admin approval queue page (`site/file-approvals.html`)
- [ ] Integrate file list UI into project-detail, household, member pages
- [ ] Update `src/util/helpers.js` cache invalidation for `files` collection
