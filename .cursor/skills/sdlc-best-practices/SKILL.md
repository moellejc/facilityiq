---
name: facilityiq-sdlc-best-practices
description: FacilityIQ SDLC best practices — definition of done, small PRs, phases, baseline vs projected, migrations, security, and demo integrity. Use when planning work, opening PRs, or finishing a phase.
---

# FacilityIQ SDLC best practices

## Product shape

Ship vertical slices that leave `pnpm dev` / `docker compose up --build` runnable. Prefer real list/get and calculated metrics over fake JSON. Pages that are not ready should say so rather than invent KPIs.

Canonical docs: `docs/ARCHITECTURE.md`, `docs/KPI_FORMULAS.md`, `docs/SCENARIOS.md`, root `README.md`, root `AGENTS.md`.

## Definition of done

A change is done only when:

1. **Behavior** matches the phase goal and does not break earlier accepted phases.
2. **Layering** is respected (thin UI/handlers; services + lib; org-scoped repositories).
3. **Server enforcement** of auth, membership, and roles is in place (not UI-only).
4. **Tests** for the touched risk area exist and were **actually run** (`lint`, `typecheck`, unit; integration when DB/API/tenancy involved).
5. **Docs** updated when formulas, env vars, or operator how-tos change.
6. **No secrets** committed; `.env.example` updated for new config.
7. **Migrations** are additive; applied SQL is never rewritten.

## Pull requests

- Keep PRs **small and focused** (one concern: feature slice, docs/skills, CI, etc.).
- Title/body state intent, test commands run, and any intentional gaps.
- Do not merge unless the human asks. Docs-only and skills-only PRs should not mix product feature work.
- Prefer branching from current `main` with a clear prefix (e.g. `cursor/…`).

## Phased delivery (do not regress)

| Phase | Outcome (accepted unless revisiting) |
| --- | --- |
| 1 | Foundation: schema, Auth.js, shell, seed, Compose, CI |
| 2 | Interactive 3D twin from Postgres |
| 3 | Deterministic analytics + heatmaps |
| 4 | Insights (rules always; optional LLM language only) |
| 5 | Scenario projections/APIs (editor UI may still be deferred) |
| 6 | Uploads, Playwright suite, Docker/CI polish |

Do not reimplement accepted phases. Do not start Phase 6 work inside a docs/skills PR.

## Domain quality bars

- **Missing ≠ zero** for samples and KPIs.
- **Baseline (observed) vs projected (modeled)** remain visually and structurally distinct; estimated dollars labeled as estimates.
- Works **without `AI_API_KEY`**. LLM never computes money or writes SQL/mutations.
- Demo seed stays deterministic for business keys; document the demo password in README only.
- 3D: `ssr: false` via client loader; InstancedMesh for dense racks/pallets.

## Security SDLC

- Argon2id passwords; database sessions revocable by deleting the session row.
- RLS + repository filters; worker `BYPASSRLS` is intentional for cross-tenant job dequeue — do not copy that into the app role.
- Rate-limit auth-sensitive paths when extending auth; audit administrative changes when adding admin mutations.
- Least-privilege GitHub Actions permissions.

## Operational honesty

- Report features, files, migrations, tests run (with results), limitations, and next steps when finishing a phase.
- If a check did not run, say so. Never claim green CI or tests without evidence.
