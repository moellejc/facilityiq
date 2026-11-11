# SIMULATED Next.js note: `unstable_cache` discouraged in favor of "use cache"

> **SIMULATED.** This is not a Next.js release and not a real Next.js deprecation.
> The claim in the JSON block is **not verified**. Do not merge it into `.cursor/guardrails.json`.

The drift watcher demo reads this file and proposes a deprecated-list entry plus a skill note. The live guard config stays unchanged unless you opt in. See `demo/drift-watcher/README.md`.

## What was actually checked

On 2026-11-11 the previous-model caching guide still documents `unstable_cache` for non-`fetch` functions, including a sample that imports it from `next/cache`.

Source: https://nextjs.org/docs/app/guides/caching

That page is current-stable documentation and can move ahead of the installed pin (`next@16.4.5`).

The installed tree for that pin was read in this repo. `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` says: we recommend opting into Cache Components and replacing `unstable_cache` with the `use cache` directive. `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` says existing `unstable_cache` caching keeps working, migrating it is optional, and it continues to work with Cache Components. That is a recommendation, not a deprecation. Whether Next.js 16.4.5 deprecates `unstable_cache` is **not verified**. This fixture does not turn the recommendation into a guard rule.

## Machine-readable claim

```json
{
  "simulated": true,
  "label": "SIMULATED",
  "id": "simulated-unstable-cache",
  "api": "unstable_cache",
  "replacement": "\"use cache\"",
  "pattern": "\\bunstable_cache\\b",
  "files": ["src/**"],
  "skill": "nextjs-caching-and-revalidation",
  "skillFile": ".cursor/skills/nextjs-caching-and-revalidation/SKILL.md",
  "standard": "SIMULATED fixture only. Not a Coding Conventions rule.",
  "claim": "unstable_cache is discouraged in favor of \"use cache\"",
  "claimStatus": "not verified",
  "codemod": null,
  "verifiedContrast": {
    "statement": "The previous-model caching guide still documents unstable_cache for non-fetch functions.",
    "url": "https://nextjs.org/docs/app/guides/caching",
    "checked": "2026-11-11"
  },
  "installed": {
    "recommendation": "Installed next@16.4.5 API reference recommends replacing unstable_cache with the use cache directive.",
    "recommendationPath": "node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md",
    "stillWorks": "Installed next@16.4.5 migration guide says existing unstable_cache caching keeps working and migrating it is optional.",
    "stillWorksPath": "node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md"
  }
}
```
