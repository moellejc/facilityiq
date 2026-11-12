---
name: facilityiq-documentation-updates
description: Standards for keeping FacilityIQ documentation in sync — which in-repo doc owns which contract (ARCHITECTURE, KPI_FORMULAS, SCENARIOS, README, .env.example), when docs must change with code, keeping Notion standards and project skills aligned, and accuracy rules. Use when updating docs, changing a convention, formula, route, env var, or setup step, or editing skills and AGENTS.md.
---

# Documentation Updates (FacilityIQ)

Source: Notion Engineering Standards hub ("Living in-repo companions"), SDLC §2–3.

## Who owns what

| Doc                                        | Owns                                                                                    | Update when                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/ARCHITECTURE.md`                     | System shape, stack, tenancy, data model, routes, repo layout, phases                   | New route, table, top-level folder, phase change, architectural decision |
| `docs/KPI_FORMULAS.md`                     | Every KPI's numerator, denominator, units, aggregation, missing/zero behavior           | Any KPI added or changed                                                 |
| `docs/SCENARIOS.md`                        | Scenario formulas, assumptions, limitations                                             | Any scenario kind or projection change                                   |
| `README.md`                                | Local setup, compose, migrate/seed, demo users, seed strategy, scripts                  | Setup, scripts, seed contents, demo accounts change                      |
| `.env.example`                             | Every env var with comment                                                              | Any env var added/changed/removed                                        |
| `AGENTS.md`                                | Agent entry point and skill routing                                                     | Skills added, renamed, or removed                                        |
| `.cursor/skills/*`                         | Condensed standards per domain/workflow                                                 | Notion standard or repo convention changes                               |
| `.cursor/rules/*`                          | File-pattern hard rules                                                                 | A hard rule changes                                                      |
| Notion "FacilityIQ Engineering Standards"  | Company standards (source of truth for skills)                                          | Standards decisions                                                      |
| `automations/*.md`, `bot/approval-flow.md` | Slack → Linear → Cloud Agent → PR spec and human gates. A spec is not a live automation | When that flow, a gate, or where status is posted changes                |

## Rules

- Docs change in the **same PR** as the code that changes the contract.
- Notion, in-repo docs, and skills must not contradict. If they do, fix the in-repo doc/skill in the change and flag the Notion page that needs updating (or update it if you have access and the user agrees). Never silently pick one.
- Code-derived skill sections are marked as such; when Notion adds a standard for that area, replace the code-derived text with the standard.
- Examples must be accurate against current code — verify paths, function names, and commands exist.
- No time-sensitive claims ("as of last week"); no claims of deployments, published images, or passing CI that weren't observed.
- Keep docs-only PRs separate from feature work when they're substantial.
- `AGENTS.md` contains an auto-generated Next.js block between `BEGIN/END:nextjs-agent-rules` markers — don't edit inside it.

## Verify

`pnpm format:check` passes (CI checks Markdown too). Links and file references resolve.
