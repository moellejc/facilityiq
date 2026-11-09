---
name: facilityiq-pr-readiness
description: Pre-PR gate for FacilityIQ — run the CI-equivalent local checks, confirm definition of done, write the required PR description, and produce the increment report. Use before declaring work done, before opening or updating a pull request, or when writing a PR description or progress report.
---

# PR Readiness (FacilityIQ)

Source: Notion SDLC Best Practices §2–3, §9–10; CI Process §2, §6.

## 1. Run the CI-equivalent checks

Mirror `.github/workflows/ci.yml` in order and record each result:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm db:migrate          # needs PostgreSQL 16
pnpm test:integration    # needs DATABASE_URL_TEST
pnpm build
pnpm exec playwright test  # only if tests/e2e has *.spec.ts
```

If a check can't run locally, say so explicitly — never report it as passed. Lint and build do not prove tenancy, authorization, or coverage.

## 2. Self-review

Run `facilityiq-code-review` against your own diff. If the change touches auth, tenancy, files, secrets, AI, or caching, also run `facilityiq-security-review`.

## 3. Definition of done

- [ ] Working behavior end to end
- [ ] Tests actually run, results recorded
- [ ] New versioned migration if schema changed
- [ ] Living docs updated (`facilityiq-documentation-updates`)
- [ ] Required checks green
- [ ] One concern; no unrelated formatting/renames

## 4. PR description

```markdown
## What and why

[What changed and why. Link the issue/requirement.]

## Acceptance criteria

- [ ] ...

## How

[Approach. Touched: schema/migrations, services/repositories, routes, client/server boundaries.]

## Risk callouts

- Permissions / RLS / file access: [changes or "none"]
- Cache scope / invalidation: [changes or "none"]
- Worker / retry / idempotency: [changes or "none"]
- Observed vs projected / money math: [changes or "none"]

## Evidence

- Screenshots / interaction notes: [if UI; never in place of working behavior]
- Checks run:
  - pnpm format:check — pass
  - pnpm lint — pass
  - pnpm typecheck — pass
  - pnpm test:unit — N passed
  - pnpm test:integration — N passed / not run (reason)
  - pnpm build — pass
  - Playwright — skipped (no specs) / N passed
- Regression test: [name; confirmed failing before fix] (bug fixes)
- Tenant/role coverage: [tests]
- No-AI-key check: [if insights touched]

## Docs updated

[List, or "none needed" with reason]
```

## 5. Increment report (to the user)

1. What shipped
2. Files and migrations changed
3. Tests actually run, with results
4. Known limitations
5. Next steps

Never claim a GitHub repo, published image, or deployment exists unless verified.
