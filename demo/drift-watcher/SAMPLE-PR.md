<!-- SIMULATED. Not a real Next.js deprecation. Claim status: not verified. -->

## Summary

SIMULATED dry run of the Next.js drift watcher. The fixture claims `unstable_cache` is discouraged in favor of "use cache". That claim is **not verified** and is not a real Next.js deprecation. The diff adds one deprecated-list entry and a skill note so a reviewer can see the shape of a watcher pull request.

## Linear issue

FAIQ-34: https://linear.app/acme-ai/issue/FAIQ-34

## Type and GitFlow target

- Type: chore
- Branch → base: `chore/nextjs-drift-simulated-unstable-cache` → `main`
- `develop` does not exist. This pull request targets `main` until a maintainer adds `develop` (known GitFlow deviation).
- The watcher only opens pull requests. It never merges, never pushes to `main`, and never force-pushes.

## Changes

- DB / migrations: none
- API / services / repositories: none
- UI: none
- Worker: none
- Config / env: none
- `.cursor/guardrails.json`: append deprecated id `simulated-unstable-cache`. The deprecated-API list is the `deprecated` array in that file.
- `.cursor/skills/nextjs-caching-and-revalidation/SKILL.md`: append the SIMULATED section from the diff.

## Tenancy and roles impact

- Org scoping / RLS: none
- Roles affected: none

## Tests actually run

The dry-run script writes this body. It does not run the CI suite. A live watcher run fills these boxes only for commands it actually ran.

- [ ] Guard: not run by the dry-run script
- [x] Demo: `node scripts/drift-watcher/run-demo.mjs` — writes this body and leaves `.cursor/guardrails.json` unchanged

Skipped / not run / failed (with reason): format, lint, typecheck, unit, migrate, integration, and e2e are outside this sample body.

## Demo video

The dry run is `node scripts/drift-watcher/run-demo.mjs`. See `demo/drift-watcher/README.md`.

## Screenshots (optional)

none

## Risk and rollback

- Migration reversibility: none
- Feature flag: none
- Rollback: close the pull request. An explicit demo apply is reverted with `node scripts/drift-watcher/run-demo.mjs --revert`.

## Security and privacy notes

none. The fixture is SIMULATED and contains no secrets.

## Release notes

none. SIMULATED internal demo.

## Checklist

- [x] No secrets, tokens, or credentials committed
- [x] SIMULATED is in this body
- [x] The deprecation claim is marked not verified
- [x] The verified contrast cites https://nextjs.org/docs/app/guides/caching
- [x] Back-merge needed: N/A

## Source note

Verified contrast (2026-11-11): The previous-model caching guide still documents unstable_cache for non-fetch functions. Source: https://nextjs.org/docs/app/guides/caching

This API has been replaced by use cache in Next.js 16. Installed next@16.4.5 API reference recommends replacing unstable_cache with the use cache directive. Path: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md. Installed next@16.4.5 migration guide says existing unstable_cache caching keeps working and migrating it is optional. Path: node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md.

Deprecated entry message: SIMULATED fixture, not a real Next.js deprecation (not verified). The fixture discourages unstable_cache in favor of "use cache". No codemod: this is not a real migration. The previous-model caching guide still documents unstable_cache for non-fetch functions. Source: https://nextjs.org/docs/app/guides/caching This API has been replaced by use cache in Next.js 16. Installed next@16.4.5 API reference recommends replacing unstable_cache with the use cache directive. Path: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md. Installed next@16.4.5 migration guide says existing unstable_cache caching keeps working and migrating it is optional. Path: node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md.
