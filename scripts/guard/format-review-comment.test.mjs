// Tests for the one-comment formatter. Run: node --test scripts/guard/format-review-comment.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMENT_MARKER,
  REQUIRED_CHECKS,
  formatReviewComment,
  parseGuardReport,
  pullRequestBodyFindings,
  staffEngReviewers,
} from "./format-review-comment.mjs";
import { loadConfig, matchesAny, renderFindings } from "./lib.mjs";
import { buildReport } from "./pre-pr.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SHA = "0123456789abcdef";

function reportFor(findings) {
  const errors = findings.filter((item) => item.level === "error").length;
  const warnings = findings.filter((item) => item.level === "warn").length;
  return [
    "## FacilityIQ pre-PR guard",
    "New violations only.",
    `Checked 1 file(s). **${errors} error(s), ${warnings} warning(s).**`,
    "",
    renderFindings("Boundaries", findings),
  ].join("\n");
}

const owners = "* @moellejc\n";

const clientError = {
  level: "error",
  rule: "client-imports-server",
  file: "src/components/a.tsx",
  line: 2,
  message:
    "A 'use client' file must not import services. (imports \"@/server/services/analytics-service\")",
  skill: "facilityiq-nextjs-app-router",
  standard: "Coding Conventions §14–§16; GitFlow §6",
};

function completeBody() {
  return [
    "## Summary",
    "Adds the review spec.",
    "## Linear issue",
    "FAIQ-33",
    "## Type and GitFlow target",
    "docs, feature branch to main once develop exists.",
    "## Changes",
    "Spec and formatter.",
    "## Tenancy and roles impact",
    "None.",
    "## Tests actually run",
    "See the table.",
    "## Demo video",
    "Not possible because this change has no UI.",
    "## Risk and rollback",
    "Revert the commit.",
    "## Security and privacy notes",
    "None.",
    "## Release notes",
    "none",
    "## Checklist",
    "- [ ] No secrets",
    "",
  ].join("\n");
}

test("an automation spec is inside the infra scope", () => {
  const allow = loadConfig().scopes.infra.allow;
  assert.equal(matchesAny("automations/pr-guardrail-review.md", allow), true);
});

test("parses a pre-pr table row into rule, skill, and standard", () => {
  const parsed = parseGuardReport(reportFor([clientError]));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.errors, 1);
  assert.equal(parsed.rows[0].rule, "client-imports-server");
  assert.equal(parsed.rows[0].skill, "facilityiq-nextjs-app-router");
  assert.equal(parsed.rows[0].standard, "Coding Conventions §14–§16; GitFlow §6");
  assert.match(parsed.rows[0].message, /imports "@\/server\/services\/analytics-service"/);
  assert.equal(parsed.rowsMatchSummary, true);
});

test("maps a guard error to its rule id and skill doc, and does not invent other results", () => {
  const comment = formatReviewComment({
    report: reportFor([clientError]),
    ref: SHA,
    checks: { "node scripts/guard/pre-pr.mjs": "pass", "pnpm guard": "pass" },
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /\| error \| `client-imports-server` \| `src\/components\/a\.tsx:2` \|/);
  assert.match(
    comment,
    /\[facilityiq-nextjs-app-router\]\(https:\/\/github\.com\/moellejc\/facilityiq\/blob\/0123456789abcdef\/\.cursor\/skills\/facilityiq-nextjs-app-router\/SKILL\.md\) — Coding Conventions §14–§16; GitFlow §6/,
  );
  assert.match(comment, /Staff Eng review requested: @moellejc/);
  assert.match(
    comment,
    /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \| fail — 1 error\(s\), 0 warning\(s\) \|/,
  );
  assert.match(comment, /\| Lint \| `pnpm lint` \| not verified \|/);
  assert.doesNotMatch(comment, /\| Extra \| `pnpm guard` \|/);
  assert.match(comment, /does not approve, merge, or close/);
  assert.equal(comment.split(COMMENT_MARKER).length - 1, 1);
  assert.doesNotMatch(comment, /\bApproved\b/);
});

test("a clean buildReport stays ready for human review and still requests Staff Eng", () => {
  const { report, errors } = buildReport(loadConfig(), []);
  assert.equal(errors, 0);
  const comment = formatReviewComment({ report, ref: SHA, codeowners: owners });
  assert.match(comment, /\*\*Verdict: Ready for human review\*\*/);
  assert.match(comment, /No findings\./);
  assert.match(
    comment,
    /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \| pass — 0 error\(s\), 0 warning\(s\) \|/,
  );
  assert.match(comment, /pull request body/);
  assert.match(comment, /code review checklist/);
  assert.match(comment, /### Pull request body\n\nnot verified/);
});

test("warnings do not request changes, and a missing guard report is not verified", () => {
  const warn = formatReviewComment({
    report: reportFor([
      {
        level: "warn",
        rule: "tenancy-test-missing",
        file: "src/server/repositories",
        line: 0,
        message: "Advisory: a repository changed.",
        skill: "facilityiq-multi-tenancy-rls",
        standard: "Coding Conventions §7",
      },
    ]),
    ref: SHA,
    codeowners: owners,
  });
  assert.match(warn, /\*\*Verdict: Ready for human review\*\*/);
  assert.match(warn, /\| warn \| `tenancy-test-missing` \|/);

  const missing = formatReviewComment({ report: "", codeowners: owners });
  assert.match(missing, /\*\*Verdict: not verified\*\*/);
  assert.match(missing, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \| not verified \|/);
  assert.match(missing, /### Findings\n\nnot verified/);
});

test("a summary that does not match parsed rows keeps the error verdict and says the mapping is not verified", () => {
  const comment = formatReviewComment({
    report: "Checked 1 file(s). **1 error(s), 0 warning(s).**\n",
    ref: SHA,
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /row-to-rule mapping is not verified/);
});

test("without a blob SHA the skill path is named and the URL is not verified", () => {
  const comment = formatReviewComment({
    report: reportFor([clientError]),
    ref: "feature/not-a-sha",
    codeowners: owners,
  });
  assert.match(
    comment,
    /`\.cursor\/skills\/facilityiq-nextjs-app-router\/SKILL\.md` \(blob URL not verified\)/,
  );
  assert.doesNotMatch(comment, /https:\/\/github\.com\/moellejc\/facilityiq\/blob\/feature/);
});

test("the wildcard CODEOWNERS owner is Staff Eng, and a missing star is not guessed", () => {
  const file = readFileSync(new URL("../../.github/CODEOWNERS", import.meta.url), "utf8");
  assert.deepEqual(staffEngReviewers(file), ["moellejc"]);
  const comment = formatReviewComment({
    report: reportFor([]),
    codeowners: "# note\n/src/db/migrations/ @moellejc\n",
  });
  assert.match(comment, /Staff Eng review requested: not verified/);
  assert.doesNotMatch(comment, /@moellejc/);
});

test("a missing required section requests changes and links the pull request template", () => {
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: "## Summary\n\nOnly one section.\n",
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /\| error \| `pr-body-section` \| `\(pull request body\)` \|/);
  assert.match(
    comment,
    /\[pull_request_template\.md\]\(https:\/\/github\.com\/moellejc\/facilityiq\/blob\/0123456789abcdef\/\.github\/pull_request_template\.md\) — GitFlow §9\.2/,
  );
  assert.match(comment, /Missing section: Demo video\./);
});

test("the unfilled pull request template demo is still a placeholder", () => {
  const template = readFileSync(
    new URL("../../.github/pull_request_template.md", import.meta.url),
    "utf8",
  );
  const findings = pullRequestBodyFindings(template);
  assert.ok(findings.problems.some((problem) => problem.rule === "pr-body-demo"));
  const checks = Object.fromEntries(
    REQUIRED_CHECKS.filter((item) => item.check !== "Guard").map((item) => [item.command, "pass"]),
  );
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: template,
    reviewNotes: "No blocking checklist findings.\n",
    checks,
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /`pr-body-demo`/);
  assert.match(comment, /template placeholder/);
});

test("a complete body with a stated demo reason is not a finding", () => {
  const findings = pullRequestBodyFindings(completeBody());
  assert.equal(findings.verified, true);
  assert.deepEqual(findings.problems, []);
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: completeBody(),
    reviewNotes: "No blocking checklist findings.\n",
    checks: { "pnpm lint": "pass — 0 problems" },
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Ready for human review\*\*/);
  assert.match(comment, /\| Lint \| `pnpm lint` \| pass — 0 problems \|/);
  assert.match(comment, /\| Format \| `pnpm format:check` \| not verified \|/);
  assert.match(comment, /No blocking checklist findings\./);
  assert.doesNotMatch(comment, /Unverified in this run:.*code review checklist/);
});

test("a checked body box does not count as a test that ran", () => {
  const body = completeBody().replace(
    "## Tests actually run\nSee the table.",
    "## Tests actually run\n- [x] Lint: pnpm lint — pass",
  );
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: body,
    codeowners: owners,
  });
  assert.match(comment, /\| Lint \| `pnpm lint` \| not verified \|/);
});

test("BLOCKING checklist lines request changes", () => {
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: completeBody(),
    reviewNotes:
      "BLOCKING: src/server/repositories/a.ts:4 — Missing org filter — no organizationId\n",
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /BLOCKING: src\/server\/repositories\/a\.ts:4/);
});

test("cli reads a report piped from another process", () => {
  const result = spawnSync(
    "bash",
    [
      "-lc",
      `node scripts/guard/pre-pr.mjs | node scripts/guard/format-review-comment.mjs --ref ${SHA}`,
    ],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, GUARD_FILES: "docs/guardrails.md" } },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\*\*Verdict: Ready for human review\*\*/);
  assert.match(result.stdout, /Staff Eng review requested: @moellejc/);
});

test("omitting pnpm build leaves that row not verified", () => {
  const checks = Object.fromEntries(
    REQUIRED_CHECKS.filter((item) => item.command !== "pnpm build").map((item) => [
      item.command,
      "pass",
    ]),
  );
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    checks,
    codeowners: owners,
  });
  assert.match(comment, /\| Build \| `pnpm build` \| not verified \|/);
  assert.match(comment, /Unverified in this run:.*pnpm build/);
  assert.match(
    comment,
    /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \| pass — 0 error\(s\), 0 warning\(s\) \|/,
  );
});

test("an unusable checks file does not mark rows passed", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-checks-"));
  const cases = [join(dir, "bad.json"), join(dir, "array.json"), join(dir, "missing.json")];
  writeFileSync(cases[0], "not json");
  writeFileSync(cases[1], '["pnpm lint"]\n');
  const report = reportFor([]);
  for (const checks of cases) {
    const result = spawnSync(
      process.execPath,
      ["scripts/guard/format-review-comment.mjs", "--ref", SHA, "--checks", checks],
      { cwd: ROOT, input: report, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \| pass — 0 error\(s\), 0 warning\(s\) \|/,
    );
    assert.match(result.stdout, /\| Lint \| `pnpm lint` \| not verified \|/);
    assert.match(result.stdout, /\| Build \| `pnpm build` \| not verified \|/);
    assert.match(result.stdout, /Unverified in this run:.*checks file/);
  }
});

test("cli prints one comment from a report on stdin", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-comment-"));
  const checks = join(dir, "checks.json");
  writeFileSync(checks, '{ "pnpm typecheck": "pass" }\n');
  const result = spawnSync(
    process.execPath,
    ["scripts/guard/format-review-comment.mjs", "--ref", SHA, "--checks", checks],
    { cwd: ROOT, input: reportFor([clientError]), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<!-- facilityiq-pr-guardrail-review -->/);
  assert.match(result.stdout, /Staff Eng review requested: @moellejc/);
  assert.match(result.stdout, /\| Typecheck \| `pnpm typecheck` \| pass \|/);
  assert.match(result.stdout, /\*\*Verdict: Changes requested\*\*/);
});
