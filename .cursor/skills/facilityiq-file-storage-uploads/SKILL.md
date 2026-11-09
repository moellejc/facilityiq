---
name: facilityiq-file-storage-uploads
description: FacilityIQ object storage and file upload standards — S3-compatible client (MinIO locally), org-scoped object keys, private buckets, signed URLs re-checked on read, upload permissions and rate limits, uploaded_files metadata, and import jobs. Use when working in src/lib/storage, /api/uploads, uploaded_files, import_jobs, signed URLs, or 3D model files.
---

# File Storage and Uploads (FacilityIQ)

Source: Notion Coding Conventions §1, §7, §8, SDLC §6. Implementation detail **derived from current code**; signed uploads are a Phase 6 stub (`src/app/api/uploads/route.ts` returns 501). Security-sensitive — also run `facilityiq-security-review`.

## Storage client (`src/lib/storage/index.ts`)

- `createStorageClient()` — AWS SDK v3 `S3Client` configured from `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`. MinIO locally; S3/R2/GCS in production via env only.
- `ensureBucket()` — head/create `S3_BUCKET` (called by the worker at startup).
- `objectKey(organizationId, fileName)` — `orgs/{organizationId}/{sanitized}`. **Always** build keys with this (or a stricter variant); never accept a client-supplied key or path.

## Rules

- Buckets are **private**. No public-read objects.
- Uploads require `uploads:write` (viewer and finance can't upload) and are rate-limited.
- Validate file type, size, and name server-side before issuing an upload URL or accepting bytes.
- Persist metadata in `uploaded_files` with `organization_id` in the same transaction that authorizes the upload.
- **Every download / signed URL re-checks** the caller's org membership and the file's `organization_id` at request time. Short expiry on signed URLs.
- Nested access: a file linked to a facility/asset must be verified through that parent's org.
- Processing (imports, model conversion) goes through `import_jobs` / `background_jobs`, not the request — see `facilityiq-background-worker`.
- Never log signed URLs or credentials.
- Secrets only via env vars, documented in `.env.example`.

## Tests

Integration: org A cannot obtain a signed URL or metadata for org B's file (direct ID and via nested facility/asset); viewer upload rejected; oversized/invalid type rejected; key always under `orgs/{orgId}/`.
