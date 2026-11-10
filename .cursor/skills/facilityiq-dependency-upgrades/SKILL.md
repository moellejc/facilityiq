---
name: facilityiq-dependency-upgrades
description: Workflow for adding or upgrading FacilityIQ dependencies with pnpm — lockfile rules, grouping related packages, Next.js / Auth.js / Drizzle / Three.js / Zod upgrade checks, adding test tooling, and security audit reporting. Use when adding a package, upgrading dependencies, bumping Next.js or other frameworks, or resolving vulnerability alerts in FacilityIQ.
---

# Dependency Upgrades (FacilityIQ)

Source: Notion Coding Conventions §2, CI Process §1–3.

## Rules

- **pnpm only** (`packageManager: pnpm@10.x`, via Corepack). Never add npm/yarn lockfiles.
- `pnpm-lock.yaml` is committed; `pnpm install --frozen-lockfile` must pass.
- Current stable, mutually compatible versions. Most core deps are pinned exactly — keep that style for framework packages.
- One ecosystem per PR. Don't mix upgrades with features.
- New dependencies need a reason: check whether existing deps already cover the need. A new state library, ORM, or UI kit requires an architecture decision.

## Upgrade groups

| Group      | Packages                                                                           | Extra checks                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js    | `next`, `eslint-config-next`, `react`, `react-dom`, `@types/react*`                | Read release/migration notes and `node_modules/next/dist/docs/`; re-check `proxy.ts`, async `params`/`searchParams`, caching model in `next.config.ts`, segment config, `next typegen`; regenerated `AGENTS.md` block |
| Auth       | `next-auth`, `@auth/drizzle-adapter`                                               | Sessions, sign-in, revocation; `facilityiq-auth-and-permissions` tests                                                                                                                                                |
| Database   | `drizzle-orm`, `drizzle-kit`, `pg`                                                 | `pnpm db:generate` produces **no** unexpected migration diff; migrations apply to empty DB; integration suite                                                                                                         |
| 3D         | `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `three-stdlib` | Twin loads, instancing, disposal, controls                                                                                                                                                                            |
| Validation | `zod`                                                                              | Schema behavior, error codes, `z.infer` types                                                                                                                                                                         |
| UI         | `radix-ui`, `shadcn`, `tailwindcss`, `recharts`, `lucide-react`                    | Visual check of shell, cards, charts                                                                                                                                                                                  |
| Tooling    | `vitest`, `eslint`, `prettier`, `typescript`, `tsx`                                | Configs still load; no mass reformat in the same PR                                                                                                                                                                   |

## Adding test tooling

`@playwright/test` and React Testing Library are part of the standard stack but not installed. Adding them: add dev deps, config file, and CI wiring together; first Playwright spec makes the CI smoke step mandatory (`facilityiq-e2e-testing`, `facilityiq-ci-cd`).

## Verify

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck \
  && pnpm test:unit && pnpm db:migrate && pnpm test:integration && pnpm build
pnpm audit --audit-level=high
```

Also run `docker compose up --build` for framework/runtime upgrades. Report audit results honestly (CI's audit and Trivy scans are non-blocking, so call out new high/critical findings explicitly).
