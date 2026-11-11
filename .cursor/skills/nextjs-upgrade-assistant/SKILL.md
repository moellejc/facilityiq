---
name: nextjs-upgrade-assistant
description: Upgrade FacilityIQ's Next.js by reading the release notes, running the official codemod, updating .cursor/guardrails.json deprecated rules and the affected skills, and opening a PR. Use for a Next.js version bump. Never merge. Lockfile and verify commands stay in facilityiq-dependency-upgrades.
---

# Next.js upgrade assistant

Current install: **next@16.4.5** and **eslint-config-next@16.4.5** (`package.json`). `verifiedAgainst.next` in `.cursor/guardrails.json` is `"16"`. One Next.js upgrade per PR. No feature work in that PR (`facilityiq-dependency-upgrades`).

Do not merge, push to `main`, or force-push. Open the PR and stop. A human merges.

## 1. Read the release notes

Read the target tag on GitHub (`https://github.com/vercel/next.js/releases/tag/vX.Y.Z`) and the matching guide under [Upgrading](https://nextjs.org/docs/app/guides/upgrading). Inside the 16 line, start with [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).

Then read the version-matched tree at `node_modules/next/dist/docs/` for the version you are installing. The version 16 guide tells agents to prefer that tree over a downloaded copy. nextjs.org tracks current stable and can move ahead of the pin. If the site and the installed tree disagree, the installed tree wins. Mark any claim you could not confirm in either place.

The 16.4.6 tag (2026-11-09) is a bugfix backport and does not list API changes. Re-check before assuming it is still the latest stable. **Unverified:** anything in a 16.5 canary. Do not install `next@canary` unless the ticket asks for a canary.

## 2. Run the official codemod

Use the command the release notes name. Do not hand-edit a migration the codemod covers.

On 16.1.0 and later, including this repo, the documented update command is:

```bash
pnpm next upgrade
```

Source: [Upgrading](https://nextjs.org/docs/app/getting-started/upgrading). Versions before 16.1.0 need `pnpm dlx @next/codemod@canary upgrade latest` instead. This repo is past that.

The codemod package is the same tool, with an explicit target:

```bash
pnpm dlx @next/codemod@canary upgrade <revision>
```

`<revision>` is `patch`, `minor`, `major`, a dist-tag, or an exact version such as `16.4.6`. `--dry` previews a single transform and does not edit. Source: [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods).

The `upgrade` codemod does not run every migration. If synchronous `params`, `searchParams`, `cookies()`, `headers()`, or `draftMode()` remain, also run:

```bash
pnpm dlx @next/codemod@canary next-async-request-api .
```

Source: [version 16](https://nextjs.org/docs/app/guides/upgrading/version-16). Other transforms named in that guide and the codemods page include the `middleware` to `proxy` rename and `next-lint-to-eslint-cli`. Run one only when the notes say it applies. Do not invent a transform name.

`pnpm next upgrade` and `npx next@canary upgrade --agent=latest` can hand the rest of the migration to an agent ([upgrade with a coding agent](https://nextjs.org/docs/app/guides/upgrading/agent-upgrade)). That does not waive this skill: the agent still opens a PR and does not merge.

Dependency installs need `GUARD_ALLOW_DEPS=1`. Say so in the PR. Do not commit `node_modules`.

## 3. Update the deprecated list and the skills

In the same PR, edit `.cursor/guardrails.json` so the rules match the notes you just read:

- `deprecated[]`: add a rule for an API the notes deprecate, or remove one the notes say is gone. Each entry keeps `id`, `pattern`, `files`, `message`, `skill`, and `standard`. The message names the doc URL and the codemod that fixes it.
- `skill` must be a real directory under `.cursor/skills/<name>/SKILL.md`. `pnpm guard:drift` fails when it is missing.
- `verifiedAgainst.next` is a prefix. Drift fails when the installed version does not start with it. Change the prefix only after you have re-read the notes for that version. Do not widen it to hide drift.
- Do not delete a finding to make `pnpm guard` pass. Do not edit `scripts/guard/**` unless a deprecation cannot be expressed as data. That edit is a separate infra review.

The file is protected. A diff that touches it together with `package.json` is an infra change: `GUARD_SCOPE=infra`. A product file in the same diff keeps the scope on `default` and the guard will reject the protected edit (`docs/guardrails.md`).

Update every skill whose facts changed. At minimum, check this skill, `nextjs-app-router-route`, `nextjs-server-action-vs-route-handler`, `nextjs-caching-and-revalidation`, `facilityiq-nextjs-app-router`, `facilityiq-api-routes`, `facilityiq-client-state-and-caching`, and the Next.js row in `facilityiq-dependency-upgrades`. Leave any `AGENTS.md` block between `BEGIN:nextjs-agent-rules` and `END:nextjs-agent-rules` alone (`facilityiq-documentation-updates`). The current `AGENTS.md` has no such block.

## 4. Open the PR and stop

Verify with the commands in `facilityiq-dependency-upgrades` (format, lint, typecheck, unit, migrate, integration, build) plus `pnpm guard:test`, `pnpm guard:drift`, and `pnpm guard`. Report the ones that actually ran.

PR target: `main` until `develop` exists. Say that in the GitFlow section. Title shape: `chore(deps): upgrade Next.js to X.Y.Z [FAIQ-<n>]`.

Never merge. Never push to `main`.

## Guard rules this procedure maintains

The `deprecated` ids today: `gssp`, `next-router`, `next-head`, `legacy-image`, `sync-params`, `async-client`, `public-secret`, `raw-error-to-client`, `adhoc-tofixed`. What they reject is in `nextjs-app-router-route` and `docs/guardrails.md`.

Import rules (`client-imports-server`, `route-or-page-imports-db`, `route-imports-repository`, `ui-imports-repository`, `repository-imports-service`) are not the deprecated list. Update one only when the release notes change that boundary, and update the skill named on the rule in the same PR.
