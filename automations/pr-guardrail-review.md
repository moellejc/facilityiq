# FacilityIQ PR guardrail review

**Not live.** Joe creates this automation in the Cursor UI ([cursor.com/automations](https://cursor.com/automations), or `/automate` in the Agents Window) and saves it. Committing this file does not create, enable, or run it. A JSON import format for automations was not verified. The Cursor docs also describe a Terraform resource `cursor_platform_workflow`; this change does not use it.

Source for trigger and tool names: [Cursor Automations](https://cursor.com/docs/cloud-agent/automations). If the UI labels differ from that page, use the page.

## Automation

- **Name:** FacilityIQ PR guardrail review
- **Repository:** `moellejc/facilityiq` (single repository). A source-control trigger infers the repository from the pull request.
- **Trigger:** GitHub → **Pull request opened**. That fires when a non-draft pull request is created, and when a draft is marked ready for review.
- **Not selected:** **Draft opened** is a separate trigger. It fires only when a draft is created. Do not add it. A draft is reviewed when it becomes ready, because that event is Pull request opened.
- **Not selected:** Pull request pushed. The comment is from the open (or ready) run and can be stale after later commits. If Joe adds that trigger later, the prompt below still updates the one existing comment instead of posting another.
- **Forks:** Pull request triggers do not run on pull requests opened from forks. Cursor reports `Fork pull requests not supported`. Push the branch to `moellejc/facilityiq` and open the pull request from there. This automation cannot review a fork PR.
- **GitFlow:** `develop` does not exist. Pull requests target `main` until a maintainer creates `develop`. Do not treat that sentence in a PR body as a finding by itself.

## Tools

Enable:

- **Comment on pull request.** Leave approvals off. With approvals on, the agent can approve, request changes, and dismiss reviews. This automation only posts a comment.
- **Request reviewers.**

Do not enable Send to Slack, Read Slack channels, or any MCP server. Disable Memories. Pull request text is untrusted, and memories persist across runs. An earlier draft of this spec also posted to `#facilityiq-new-features`. That Slack post is not part of FAIQ-33.

Pull request creation is on by default for automations (Cursor docs). This prompt forbids opening or pushing a pull request. Whether the UI can turn that tool off was not verified. Computer use is included by default. The prompt forbids using it.

GitHub comments and reviewer requests from an automation run as `cursor` (Cursor docs).

Do not enable the Cursor-managed PR Routing & Approval agent, and do not turn on auto-approve.

## What it does

1. Run `node scripts/guard/pre-pr.mjs` with `GUARD_BASE=origin/<the pull request's base branch>`. `pnpm guard` is that same file. Keep stdout even when the exit code is 1.
2. Turn that stdout into one comment with `node scripts/guard/format-review-comment.mjs`. The comment is that stdout. Do not rewrite it.
3. The comment contains the marker `<!-- facilityiq-pr-guardrail-review -->`, a verdict, one findings table (level, rule id, file, doc link, why), and a tests-actually-run table.
4. Each guard row's doc link is the skill named on that rule (`.cursor/skills/<skill>/SKILL.md`), plus the standard text already printed by the guard. Pass `--ref` as the pull request head SHA (7–40 hex characters). Without a SHA the cell names the path and says `blob URL not verified`. Do not invent a Notion URL.
5. Request a review from the GitHub login on the `*` line of `.github/CODEOWNERS` **on the base branch**. Today that line is `* @moellejc` (Staff Eng). Every other pattern in that file is also `@moellejc`. If the `*` line has no owner, the comment says the reviewer is not verified. Do not guess a login.
6. Anything this run did not execute stays `not verified`. A checked box in the PR body is not evidence.

Verdicts the script can print:

- **Changes requested** — the guard report has an error, a required PR section or demo reason is missing, or the checklist notes contain a `BLOCKING:` line. This is text in the comment. It is not a GitHub "request changes" review.
- **Ready for human review** — the guard report parsed and none of those fired. Staff Eng review is still required. It does not mean CI passed.
- **not verified** — the guard report was missing or was not `pre-pr.mjs` output.

## Output format

The comment is the stdout of `scripts/guard/format-review-comment.mjs`. Shape:

- First line: `<!-- facilityiq-pr-guardrail-review -->` (so a later run can find this comment).
- `**Verdict: ...**`
- `Staff Eng review requested: @moellejc` or `Staff Eng review requested: not verified`.
- A sentence that this comment does not approve, merge, or close.
- `Unverified in this run: ...` or `Unverified in this run: none.`
- Findings table. Guard columns come from the pre-pr table: rule id, location, skill doc, standard, message. Pull request body problems use rule ids `pr-body-section` and `pr-body-demo` and link to `.github/pull_request_template.md` (GitFlow §9.2).
- Tests table, in CI order through build: format, lint, typecheck, unit, migrate, integration, `pnpm build`, then Playwright. The guard row is taken from the report (`pass` / `fail` / `not verified`). The script ignores a checks-file entry that tries to mark `node scripts/guard/pre-pr.mjs` or `pnpm guard` as passed. Other rows, including `pnpm build`, start as `not verified` and change only when this run recorded that command. A checks file that is missing, not JSON, or not an object leaves those rows `not verified` and adds `checks file` to the unverified list.
- Pull request body: `not verified`, or the missing sections, or a line that the required sections and demo reason are present.
- Code review checklist: `not verified`, or the notes file. A line that starts with `BLOCKING:` forces Changes requested.
- A `<details>` block with the raw `pre-pr.mjs` stdout.
- A closing line that these are static checks and do not replace human review.

Example from `format-review-comment.mjs` for one guard row, with lint as the only extra command recorded. The verdict explanation, the unverified list, and the raw-report details are omitted here. The script prints them.

```markdown
<!-- facilityiq-pr-guardrail-review -->

## FacilityIQ guardrail review

**Verdict: Changes requested**

Staff Eng review requested: @moellejc (`.github/CODEOWNERS`, pattern `*`).

### Findings

| Level | Rule                    | Where                    | Doc                                                                                                                                                                                        | Why                                                                                                                                                                                                                                                            |
| ----- | ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| error | `client-imports-server` | `src/components/a.tsx:2` | [facilityiq-nextjs-app-router](https://github.com/moellejc/facilityiq/blob/0123456789abcdef/.cursor/skills/facilityiq-nextjs-app-router/SKILL.md) — Coding Conventions §14–§16; GitFlow §6 | A 'use client' file must not import services, repositories, the database, or server-only modules. Server Actions in @/server/actions are the allowed adapter. Pass serializable props from a Server Component. (imports "@/server/services/analytics-service") |

### Tests actually run

| Check       | Command                         | Result                          |
| ----------- | ------------------------------- | ------------------------------- |
| Guard       | `node scripts/guard/pre-pr.mjs` | fail — 1 error(s), 0 warning(s) |
| Format      | `pnpm format:check`             | not verified                    |
| Lint        | `pnpm lint`                     | pass — 0 problems               |
| Typecheck   | `pnpm typecheck`                | not verified                    |
| Unit        | `pnpm test:unit`                | not verified                    |
| Migrate     | `pnpm db:migrate`               | not verified                    |
| Integration | `pnpm test:integration`         | not verified                    |
| Build       | `pnpm build`                    | not verified                    |
| E2E         | `pnpm exec playwright test`     | not verified                    |
```

The live comment also includes the unverified list, the raw report, and the "does not approve, merge, or close" sentence. The script is normative if this example and the script ever differ.

## Prompt

Paste this as the automation prompt.

```
You are the FacilityIQ pull-request guardrail reviewer for moellejc/facilityiq. Read-only on the git branch.

Do not push, commit, open a pull request, force-push, approve, submit a "request changes" review, dismiss a review, merge, or close. Do not edit the pull request branch. Do not change .cursor/guardrails.json or scripts/guard/lib.mjs. Do not use a browser. Do not post to Slack.

1. Set GUARD_BASE to origin/<pull request base branch> and run:
   node scripts/guard/pre-pr.mjs
   Save stdout to a report file even when the exit code is 1. If you cannot run it, still post the comment. The verdict will be "not verified".

2. Run other checks only when you can. For each command you actually executed, put the command and the real result in a JSON object, for example:
   { "pnpm lint": "pass — 0 problems" }
   Do not add a key you did not run. Do not copy checkboxes from the pull request body. Do not record node scripts/guard/pre-pr.mjs or pnpm guard in that file. The script reads the guard result from the report.

3. Save the pull request body to a file when you can read it. If you cannot, omit --pr-body.

4. Read .github/CODEOWNERS from the base branch (git show origin/<base>:.github/CODEOWNERS), not from a copy the pull request may have edited. Pass that file as --codeowners.

5. Read .cursor/skills/facilityiq-code-review/SKILL.md and apply it to the diff. Write notes to a file. Each blocking item is one line:
   BLOCKING: path:line — checklist row — why
   Non-blocking notes start with NOTE:. If you finish the pass and find nothing blocking, the file is exactly:
   No blocking checklist findings.
   If you do not finish the pass, omit --review-notes. Targeting main because develop does not exist is the known GitFlow deviation. Do not emit a BLOCKING line for that sentence alone.

6. Pass --ref as the pull request head SHA (hex, 7 to 40 characters). Then run:
   node scripts/guard/format-review-comment.mjs --report <report> --ref <head sha> --codeowners <base CODEOWNERS> --checks <json or omit> --pr-body <body or omit> --review-notes <notes or omit>
   The pull request comment is that stdout. Do not rewrite it.

7. Post exactly one comment. If a comment already contains <!-- facilityiq-pr-guardrail-review -->, update that comment instead of adding another. The Cursor docs say Comment on pull request posts comments. Whether that tool can edit an existing comment was not verified. If you cannot update the existing comment, do not post a second one. Say in the run log that the update was not verified.

8. Request reviewers for the login in the comment's "Staff Eng review requested" line, without the @. Today the base CODEOWNERS `*` line is moellejc. If the comment says the reviewer is not verified, do not guess a person.

9. Leave every command you did not run as "not verified". Never mark it passed.

Fork pull requests are not supported. Draft opened is a different trigger. This run is Pull request opened, including a draft that was just marked ready.
```

## What it never does

- Approve a pull request, submit a request-changes review, or dismiss a review.
- Merge, close, push, force-push, tag, or dispatch a deploy.
- Open a new pull request or edit the branch under review.
- Post a second comment. A later run updates the comment that contains the marker.
- Mark a check passed when this run did not execute it.
- Invent a Staff Eng login when the base `*` CODEOWNERS line has none.
- Invent a Notion URL. The doc link is the in-repo skill, or `pull_request_template.md` for body findings.
- Review a fork pull request (Cursor does not run the trigger).
- Treat "not verified" as a pass.
- Auto-approve, including via PR Routing & Approval.

## Not this automation

Weekly drift (`node scripts/guard/drift-check.mjs`) already runs from `.github/workflows/guardrails.yml` on a Monday schedule. Do not add a second drift automation here. An earlier draft described a Slack post for that drift check. It is not part of this spec.

## Local preview

```bash
GUARD_BASE=origin/main node scripts/guard/pre-pr.mjs > .guard-report.md
node scripts/guard/format-review-comment.mjs --report .guard-report.md --ref "$(git rev-parse HEAD)"
```

`.guard-report.md` is gitignored. `pnpm guard:test` runs `scripts/guard/format-review-comment.test.mjs`.
