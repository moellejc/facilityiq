# SIMULATED drift-watcher demo

This directory is a rehearsal of `automations/nextjs-drift-watcher.md`. It is **SIMULATED**. It is not a real Next.js deprecation. The claim that `unstable_cache` is discouraged in favor of `"use cache"` is **not verified**.

The weekly mechanical check already exists. It is the `drift` job in [`.github/workflows/guardrails.yml`](../../.github/workflows/guardrails.yml), scheduled `0 13 * * 1`, and it runs `node scripts/guard/drift-check.mjs`. This demo does not add another copy of that job.

## Dry run (default)

From the repo root:

```bash
node scripts/drift-watcher/run-demo.mjs
```

That reads `SIMULATED-unstable-cache-release.md` and writes three review artifacts:

| File                              | What it is                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `SIMULATED.diff`                  | Proposed edits to `.cursor/guardrails.json` and `nextjs-caching-and-revalidation` |
| `SIMULATED-deprecated-entry.json` | The deprecated-list entry the diff would append                                   |
| `SAMPLE-PR.md`                    | Sample pull request body, marked SIMULATED                                        |

The default command does not modify `.cursor/guardrails.json` or any skill. Those two files are the live guard config. The diff is the result to review. The script writes only those two live files, the apply manifest, and the three demo outputs above. It refuses a symlink and any other path.

`node --test scripts/drift-watcher/run-demo.test.mjs` checks that a fresh proposal matches the committed artifacts and that a dry run leaves the guard config unchanged.

## Apply and revert

Leave the live files alone unless you are showing the demo on a throwaway checkout.

```bash
DRIFT_WATCHER_APPLY=1 node scripts/drift-watcher/run-demo.mjs --apply
node scripts/drift-watcher/run-demo.mjs --revert
```

`--apply` without `DRIFT_WATCHER_APPLY=1` exits 1 and does not edit the live files. `--apply` writes `demo/drift-watcher/.apply-manifest.json` (gitignored) with the previous file contents. `--revert` restores those bytes and deletes the manifest. Do not commit an applied checkout.

`git apply demo/drift-watcher/SIMULATED.diff` is the same patch the script wrote. Prefer the script so the SIMULATED gate stays in front of the edit. If you do apply the patch by hand, revert it before you commit:

```bash
git apply -R demo/drift-watcher/SIMULATED.diff
```

## What a reviewer should see

The entry id is `simulated-unstable-cache`. The message says SIMULATED, not a real Next.js deprecation, not verified, and no codemod. Installed `next@16.4.5` says: This API has been replaced by `use cache` in Next.js 16 (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`). The migration guide says migrating is optional (`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`). The public guide still documents `unstable_cache`: https://nextjs.org/docs/app/guides/caching (fetched 2026-11-11). The watcher quotes all three and does not add a live `deprecated[]` entry.
