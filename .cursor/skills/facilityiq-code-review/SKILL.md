---
name: facilityiq-code-review
description: FacilityIQ code review checklist — the review-rejection prevention table (tenancy, authorization, layering, deterministic money, secrets, lists, atomicity, migrations, App Router patterns, UI states, 3D, coverage, scope, caching) and how to write review feedback. Use when reviewing a FacilityIQ pull request or diff, self-reviewing before a PR, or when asked for a code review.
---

# Code Review (FacilityIQ)

Source: Notion SDLC §4, §10; Coding Conventions §17. These are architecture-based prevention rules, not records of past rejections.

Reviewers (human or agent) must understand the change. Generated code or green lint is not a review.

## Process

1. Read the PR description: intent, acceptance criteria, risk callouts, evidence. Missing evidence is itself a finding.
2. Map touched files to domain skills (see `AGENTS.md`) and read the relevant ones.
3. Walk the checklist. Mark rows N/A only if genuinely not applicable.
4. For security-sensitive diffs, also run `facilityiq-security-review`.

## Checklist

| Risk                                            | Check                                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing org filter / cross-tenant nested lookup | Every repository call takes trusted `organizationId`; nested resources join to parent; inside `withTenant`; org A/B tests for list/count/get/update/delete/files |
| Authorization only in UI                        | `assertRole` in service; viewer can't mutate; finance fields need `finance:read`; tested via service/route directly                                              |
| Fat route/component, duplicate rule             | No Drizzle in routes/components; formulas in `src/lib/*`; Server Actions call the same service                                                                   |
| LLM money, fake KPI, estimate as fact           | Deterministic TS/SQL; observed vs projected separate; `null` + `unavailableReason` not `0`; works without `AI_API_KEY`                                           |
| Secrets / internal errors to client             | Server-only modules; no `NEXT_PUBLIC_` secrets; `{ error: { code, message } }`; logs redacted                                                                    |
| Unbounded / unstable lists                      | `limit` ≤ 100; scoped filtered `total`; allowlisted sort + stable tie-break                                                                                      |
| Partial writes / duplicate retries              | Service-owned transaction; idempotency policy; stale version → 409                                                                                               |
| Applied migration rewritten                     | Only new files in `src/db/migrations`; applies to clean DB; seed deterministic                                                                                   |
| Client-only page / async Client Component       | `'use client'` on smallest leaf; no async client render                                                                                                          |
| `next/head` / Pages Router patterns             | App Router metadata only                                                                                                                                         |
| Blank dashboard / swallowed failures            | All six data states; async event errors handled                                                                                                                  |
| 3D churn, leaks, zero-painted gaps              | Client dynamic wrapper; instancing; refs; disposal; distinct no-data color                                                                                       |
| Missing regression / misleading green           | Behavior tests; bug fix regression failed first; exact results incl. skips                                                                                       |
| Unreviewable scope / style churn                | One concern; no unrelated renames/formatting                                                                                                                     |
| Cross-org / stale cache                         | Keys include org/facility/filters/permission; invalidation documented                                                                                            |
| Docs drift                                      | `docs/*`, `README.md`, `.env.example`, skills updated with contract changes                                                                                      |

## Feedback format

- 🔴 **Blocking** — violates a standard above, security issue, or missing required test/evidence. Cite the rule and file/line.
- 🟡 **Should fix** — maintainability or convention issue that isn't a hard rule.
- 🟢 **Optional** — suggestion.

State what you verified (ran tests? read which files?) and what you didn't. When an actual PR is rejected, record the permalink, concern, preventive rule, and regression check so Notion §17 can be updated with real history.

The opened-PR automation in `automations/pr-guardrail-review.md` asks the reviewer to apply this checklist inside one guardrail comment. That automation is not live until Joe creates it in the Cursor UI. It does not approve or merge.
