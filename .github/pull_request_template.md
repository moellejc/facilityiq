<!-- Canonical body: GitFlow section 9.2. The Guard checkbox is the only addition. Target main until develop exists. Do not create develop. -->

## Summary

<1–3 sentences: what changed and why.>

## Linear issue

FAIQ-<n>: <link>

## Type and GitFlow target

- Type: feat | fix | hotfix | chore | docs | refactor | test | release
- Branch → base: <branch> → <develop | main | rc/vX.Y.Z>

## Changes

- DB / migrations: <new migration files, or none>
- API / services / repositories: <...>
- UI: <...>
- Worker: <...>
- Config / env: <new env vars documented in .env.example, or none>

## Tenancy and roles impact

- Org scoping / RLS: <every new query takes organizationId; RLS policies changed? or none>
- Roles affected: <org_admin | operations_manager | finance_manager | viewer; viewer stays read-only>

## Tests actually run

Check only what ran on this branch, with the command and result.

- [ ] Guard: pnpm guard — <result>
- [ ] Format: pnpm format:check — <result>
- [ ] Lint: pnpm lint — <result>
- [ ] Typecheck: pnpm typecheck — <result>
- [ ] Unit: pnpm test:unit — <result>
- [ ] Migrate: pnpm db:migrate — <result>
- [ ] Integration: pnpm test:integration — <result>
- [ ] Build: pnpm build — <result>
- [ ] E2E: <committed e2e command> — <result>

Skipped / not run / failed (with reason): <...>

## Demo video

<Link or embed of a real recording of the running app, with role and seed used.
Or: "Not possible because <reason>.">

## Screenshots (optional)

<...>

## Risk and rollback

- Migration reversibility: <reversible / forward-fix only / none>
- Feature flag: <flag name and default, or none>
- Rollback: <revert this PR / redeploy previous tag vX.Y.Z>

## Security and privacy notes

<auth, sessions, RLS, uploads, signed URLs, PII, logging; or none>

## Release notes

<One user-facing sentence, or "none".>

## Checklist

- [ ] No secrets, tokens, or credentials committed
- [ ] Coding Conventions followed (layering, tenant scoping, server-side roles, deterministic KPI and money math)
- [ ] Docs updated if contracts or formulas changed (docs/ARCHITECTURE.md, docs/KPI_FORMULAS.md, docs/SCENARIOS.md, README.md), or N/A
- [ ] Back-merge needed (hotfix or RC fix): <PR links>, or N/A
