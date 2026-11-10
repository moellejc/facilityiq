---
name: facilityiq-refactoring
description: Workflow for behavior-preserving FacilityIQ refactors and performance work — scoping, preserving layering and contracts, moving misplaced logic to its owning layer, proving no behavior change, and measuring performance. Use when refactoring, restructuring, renaming, splitting modules, cleaning up code, or optimizing performance in FacilityIQ.
---

# Refactoring and Performance (FacilityIQ)

Source: Notion SDLC §3, Coding Conventions §3, §13–14, §17.

## Rules

- **One concern per PR.** Don't mix refactors into features or bug fixes. Trivial style-only churn isn't welcome.
- **No behavior change** unless that's the stated purpose. Public API routes, DTO shapes, error codes, and permission outcomes stay identical.
- Preserve layering: route → service → repository → schema; pure libs for calculations. A refactor is the right time to move misplaced logic (Drizzle in a route, a formula in a component, a permission check only in UI) to its owner — load the matching domain skill.
- Don't add new layers, a second ORM, a global store, or microservices.
- New top-level locations require updating `docs/ARCHITECTURE.md`.
- Never edit applied migrations as part of a "cleanup".

## Workflow

```
Refactor progress:
- [ ] 1. State intent and scope
- [ ] 2. Baseline: run unit + integration suites, record results
- [ ] 3. Add characterization tests if coverage is thin
- [ ] 4. Refactor in small steps
- [ ] 5. Re-run suites; results must match
- [ ] 6. facilityiq-pr-readiness
```

- If coverage for the code being moved is thin, add behavior tests **before** refactoring.
- Splitting a service/repository: keep it in the same directory (`<domain>/` folder), re-export to keep import paths stable if many callers exist.
- Renames: update all references, docs, and skills that mention the old name.

## Performance work

- Measure before and after (query timings, `EXPLAIN ANALYZE`, bundle size, frame rate); include numbers in the PR.
- Correctness rules still hold: tenant scoping, `null` for missing data, deterministic money math, finance gating.
- Data: add indexes via a new migration; parallelize independent authorized reads; keep lists bounded.
- Client: shrink `'use client'` boundaries; avoid pulling server or heavy modules into the client bundle.
- 3D: `InstancedMesh`, geometry/material reuse, refs for frame state, disposal (`facilityiq-3d-digital-twin`).
- Any new persistent cache needs a documented scope/key/invalidation policy (`facilityiq-client-state-and-caching`).
