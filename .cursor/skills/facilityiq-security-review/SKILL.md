---
name: facilityiq-security-review
description: FacilityIQ security review checklist for security-sensitive changes — authentication, sessions, membership and roles, tenant isolation and RLS, uploads and signed URLs, secrets, error disclosure, rate limiting, audit logging, LLM boundaries, and caching scope. Use when a change touches auth, sessions, permissions, RLS, repositories, uploads, signed URLs, env/secrets, AI providers, or caching, or when asked for a security review.
---

# Security Review (FacilityIQ)

Source: Notion SDLC §4, §6; Coding Conventions §6–8, §12, §17.

Generated code or a green lint run is **not** a security review. Read the diff and trace each data path.

## When required

Any change touching: `src/lib/auth`, `src/proxy.ts`, `src/server/services/context.ts`, `src/lib/permissions`, `src/server/repositories`, `src/db/tenant.ts`, RLS migrations, `src/lib/storage`, `/api/uploads`, env/secrets, `src/lib/ai`, caching/revalidation, or the worker.

## Checklist

**Identity and sessions**

- [ ] Database sessions (revocable); revoked membership denied on next request
- [ ] Passwords Argon2id; no plaintext or weak hashing; no credentials logged
- [ ] Auth and upload routes rate-limited

**Authorization**

- [ ] Every service entry calls `assertRole`; not only UI or proxy
- [ ] `viewer` cannot mutate (layouts, scenarios, settings, uploads)
- [ ] Cost/ROI fields only with `finance:read` (DTOs, heatmaps, caches)
- [ ] Client-supplied `organizationId` never trusted; membership resolved server-side

**Tenant isolation**

- [ ] Every repository query/count/join filters by trusted `organizationId`
- [ ] Nested resources verified through their parent
- [ ] Tenant work inside `withTenant`; app uses `facilityiq_app` role
- [ ] Worker handlers (BYPASSRLS) filter by job org explicitly
- [ ] Cross-org access returns the same 404 as missing

**Files**

- [ ] Keys built with `objectKey` under `orgs/{orgId}/`; buckets private
- [ ] Signed URLs short-lived and re-authorized on every read
- [ ] Type/size/name validated server-side

**Data exposure**

- [ ] Errors use `{ error: { code, message } }`; no SQL, stacks, or internal messages
- [ ] No `NEXT_PUBLIC_` secrets; server modules `server-only`; client imports don't pull server code
- [ ] Logs redact secrets and sensitive payloads

**Integrity and audit**

- [ ] Administrative changes (members, roles, settings, layout restores) audit-logged in the same transaction
- [ ] Multi-table writes atomic; idempotency on retryable operations

**AI and caching**

- [ ] LLM output Zod-validated, language-only, cannot mutate; app works without `AI_API_KEY`
- [ ] Cache keys include org/facility/filters/permission; no cross-tenant or cross-role reuse

## Evidence

Each checked item should map to a test (`facilityiq-integration-testing`) or a specific code reference in the PR description. List anything unverified explicitly.
