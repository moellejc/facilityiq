# Approval flow: who starts, who checks, who merges

Personas, human gates, and the status view for FacilityIQ delivery. The step-by-step sequence and the sequence diagram live in [`automations/slack-linear-agent-pr.md`](../automations/slack-linear-agent-pr.md). This file is the gate contract. It does not create bots, Cursor Automations, or GitHub settings.

Linear issue: [FAIQ-35](https://linear.app/acme-ai/issue/FAIQ-35/chore-document-the-slack-linear-cloud-agent-pr-flow-with-status-in).

Notion page that should link here (not edited by this change): [Guardrails & Automations](https://app.notion.com/p/415dfbf62ea3815c9f3cf14f3ff9565b).

## What is specified vs what was observed

| Claim                                                                                                                | Status                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three roles below: PM bot files the issue, Staff Eng bot launches the agent, a human merges                          | Specified. PM bot presence in Slack is **not verified** on this change.                                                                                                                                                       |
| FacilityIQ: Staff Eng has posted Linear links, Cloud Agent links, PR links, and a demo in `#facilityiq-new-features` | Observed in a read-only Slack capture on Tue Nov 10, 2026. This change did not re-query Slack.                                                                                                                                |
| PM, Tester, and Security Guard bots                                                                                  | **Not found** in that Nov 10 capture. Not re-checked here.                                                                                                                                                                    |
| A distinct "approve the plan" reply before any code                                                                  | **Not found** in that capture. G1 below is a design, not a live control.                                                                                                                                                      |
| Backlog-first intake                                                                                                 | Written rule. Advisory. Not mechanically enforced (`docs/guardrails.md`).                                                                                                                                                     |
| Agents never merge and never push to `main`                                                                          | Process rule. The helper script refuses `workOnCurrentBranch: true`. The shell hook denies `gh pr merge` and force-push. A plain `git push` of `main` is **not** a hook match. GitHub branch protection was **not verified**. |
| Slack posting from a Cursor Automation                                                                               | **not verified**. Spec only. Joe creates automations in the Cursor UI.                                                                                                                                                        |
| `scripts/cursor-api/launch-agent.mjs` against a live key                                                             | **UNTESTED**.                                                                                                                                                                                                                 |

## Personas

The three actors in this flow are the PM bot, the Staff Eng bot, and a human approver. QA, DevOps, and Security are human review roles from the same gate list. Their bots were not found in the Nov 10 Slack capture.

| Persona          | Starts                                                                                                    | Steers                                                                            | Checks (status view)                                                                      | Approves (human gate)                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| PM bot           | Files the FAIQ issue in **Backlog** before implementation is requested. Asks Staff Eng to start `FAIQ-n`. | Replies in the same Slack thread when scope changes.                              | Linear status, the Slack thread, and the PR link.                                         | G1. Approves the plan before implementation. This gate is **not verified** as something the Staff Eng bot enforces. |
| Staff Eng bot    | After the issue exists, launches a Cloud Agent on a GitFlow branch that includes the issue id.            | Sends follow-up prompts (the helper's `steer` subcommand).                        | Posts the agent URL, then the PR link and demo, back to Linear and the same Slack thread. | Does not approve merge, tag, or deploy.                                                                             |
| Human approver   | Can also be the person who posts the original Slack request.                                              | Tells Staff Eng to proceed, or asks for changes.                                  | Reads the Slack thread, the Linear issue, the PR, and the demo.                           | G3. The only actor who approves and merges.                                                                         |
| QA (human)       | Asks for the tester checks on the open PR.                                                                | Adds acceptance cases.                                                            | PR body: checks that actually ran, demo, role notes.                                      | G2. Signs off behavior. A QA bot was **not found** in the Nov 10 capture.                                           |
| DevOps (human)   | Asks whether the PR is deployable.                                                                        | Asks for an infra-scoped change (`GUARD_SCOPE=infra` or the `scope:infra` label). | GitHub Actions plus the mocked deploy gate in `guardrails.yml`.                           | G3, with the human approver. Dispatching a deploy is human-only. The deploy gate does not deploy.                   |
| Security (human) | Named when auth, RLS, uploads, or secrets are touched.                                                    | Requests changes.                                                                 | PR security notes and any `protected-path` or `new-dependency` guard finding.             | G4. Approves exceptions by name.                                                                                    |

## Gates

A gate is a human decision. An agent may prepare the artifact. An agent may not take the approving action.

- **G1 plan approval.** Intended shape: Staff Eng launches the Cloud Agent in plan mode (`mode: "plan"` on `POST /v1/agents`, which the public API docs describe as explore-and-draft, no implementation). Nothing is coded until a human replies in the Slack thread or moves the Linear issue to In Progress. **not verified** that FacilityIQ: Staff Eng accepts "plan only". The Nov 10 capture did not show a separate plan-approval message. If plan mode is not available, the fallback gate is: the bot may open a PR, and nothing merges without human review.
- **G2 behavior sign-off.** A human checks the PR evidence: tests that actually ran, the demo recording, and tenant or role impact. Missing data stays `null` with `unavailableReason`. This gate is review, not a script.
- **G3 merge and deploy.** A human merges. Agents do not run `gh pr merge`, do not push tags, do not dispatch workflows, and do not push to `main` or `develop`. `.cursor/hooks/guard-shell.mjs` denies `gh pr merge`, tags, workflow dispatch, and force-push inside a Cursor session. That hook is **not verified** inside GitHub Actions (`docs/guardrails.md`). The hook does not match a normal `git push` of `main`. `scripts/cursor-api/launch-agent.mjs` has no merge command and always sends `workOnCurrentBranch: false`.
- **G4 security exception.** A `protected-path` or `new-dependency` finding needs a named human (`GUARD_SCOPE=infra` or `GUARD_ALLOW_DEPS=1` with the `deps-approved` label). Agents do not weaken `.cursor/guardrails.json` to clear a finding.

## Status view

Use the surfaces that already exist. Do not build a new status UI for this flow.

1. **Slack thread** in `#facilityiq-new-features` (channel id `C0CFXPUJCK0` in the Nov 10 capture). Staff Eng posts when work starts (Linear link and Cloud Agent link) and when the PR is ready (PR link, what changed, checks that ran, demo). Replying in that same thread is the status view. Posting from a Cursor Automation, as opposed to the Staff Eng bot, is **not verified**.
2. **Linear issue** on team FacilityIQ. Status moves Backlog → In Progress when the branch exists → In Review when the PR is open → Done only after a human merges and the acceptance criteria are met. The PR link and the demo are attached to the issue. A saved view named "FacilityIQ: In flight" was **not verified**.
3. **Optional CLI.** `node scripts/cursor-api/launch-agent.mjs status <bc-id>` prints agent and run status from the Cloud Agents API. **UNTESTED** against a live key. It is not a dashboard.

## Honest limits

- Plan-then-approve uses the public Cloud Agents API field `mode`. Confirm on a live agent before calling G1 enforced. Until then, say: a human reviews the PR, and agents do not merge.
- Backlog-first is how PM files the issue. Guards do not fail a PR because the issue skipped Backlog. The Nov 10 capture shows FAIQ-28 created already In Progress. That is the gap this rule is written to close, and it is still advisory.
- `develop` does not exist. Do not create it. Pull requests target `main`, or a stacked parent branch, until a maintainer adds `develop`. Say that in the PR's GitFlow section.
- The public API default (`workOnCurrentBranch: false`) pushes a new `cursor/…` branch based on `startingRef`. A prompt can ask for `feature/faiq-<n>-<slug>`. Whether the platform honors that name is **not verified**. `workOnCurrentBranch: true` would push onto `startingRef` and is forbidden, including when `startingRef` is `main`.
