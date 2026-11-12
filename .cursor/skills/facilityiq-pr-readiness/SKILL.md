---
name: facilityiq-pr-readiness
description: Pre-PR gate for FacilityIQ — run the CI-equivalent local checks, confirm definition of done, write the required PR description, and produce the increment report. Use before declaring work done, before opening or updating a pull request, or when writing a PR description or progress report.
---

# PR Readiness (FacilityIQ)

Source: Notion SDLC Best Practices §2–3, §9–10; CI Process §2, §6.

## 1. Run the CI-equivalent checks

Mirror `.github/workflows/ci.yml`, and run `pnpm guard` (`.github/workflows/guardrails.yml`) as well. Record each result. The PR body is `.github/pull_request_template.md`, which lists these commands in the "Tests actually run" section:

```bash
pnpm install --frozen-lockfile
pnpm guard                 # or: node scripts/guard/pre-pr.mjs
pnpm guard:test            # guard self-tests, when the guard itself changed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm db:migrate            # needs PostgreSQL 16
pnpm test:integration      # needs DATABASE_URL_TEST
pnpm build
pnpm exec playwright test  # only if tests/e2e has *.spec.ts
```

Tick a box only for a command that ran, and write the command and the result. If a check did not run, leave its box unchecked and say so under "Skipped / not run / failed". Never report a check as passed when it did not run. That includes `pnpm guard`. Lint and build do not prove tenancy, authorization, or coverage.

## 2. Self-review

Run `facilityiq-code-review` against your own diff. If the change touches auth, tenancy, files, secrets, AI, or caching, also run `facilityiq-security-review`.

## 3. Definition of done

- [ ] Working behavior end to end
- [ ] `pnpm guard` ran, or the report says it did not
- [ ] Tests actually run, results recorded
- [ ] New versioned migration if schema changed
- [ ] Living docs updated (`facilityiq-documentation-updates`)
- [ ] Required checks green
- [ ] One concern; no unrelated formatting/renames

## 4. PR description

Write the body from `.github/pull_request_template.md` (GitFlow §9.2). Do not substitute a different outline. `develop` does not exist; say in the GitFlow target section that the PR targets `main`.

Fill every section in that file:

- Summary
- Linear issue
- Type and GitFlow target
- Changes
- Tenancy and roles impact
- Tests actually run — include `pnpm guard`. Check a box only if that command ran. If it did not run, leave the box unchecked and say why.
- Demo video
- Screenshots (optional)
- Risk and rollback
- Security and privacy notes
- Release notes
- Checklist

For a bug fix, name the regression test and that it failed before the fix.

## 5. Increment report (to the user)

1. What shipped
2. Files and migrations changed
3. Tests actually run, with results
4. Known limitations
5. Next steps

Never claim a GitHub repo, published image, or deployment exists unless verified.
