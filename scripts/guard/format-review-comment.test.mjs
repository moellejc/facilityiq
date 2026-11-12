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
  originMainCodeowners,
  parseGuardReport,
  pullRequestBodyFindings,
  staffEngReviewers,
  textOutsideFences,
  trustedStaffEng,
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

test("a standard that contains parentheses is not absorbed into the message", () => {
  const parsed = parseGuardReport(
    reportFor([
      {
        level: "error",
        rule: "legacy-image",
        file: "src/a.tsx",
        line: 1,
        message: "Legacy image component. Use next/image.",
        skill: "facilityiq-ui-design-system",
        standard: "Coding Conventions §17 (Pages Router leftovers)",
      },
      {
        level: "warn",
        rule: "tenancy-test-missing",
        file: "src/server/repositories",
        line: 0,
        message: "Advisory: a repository changed.",
        skill: "facilityiq-multi-tenancy-rls",
        standard: "Coding Conventions §7; Unit Test Standards §2 and §4 (advisory)",
      },
    ]),
  );
  const image = parsed.rows.find((row) => row.rule === "legacy-image");
  assert.equal(image.standard, "Coding Conventions §17 (Pages Router leftovers)");
  assert.equal(image.message, "Legacy image component. Use next/image.");
  const tenancy = parsed.rows.find((row) => row.rule === "tenancy-test-missing");
  assert.equal(tenancy.standard, "Coding Conventions §7; Unit Test Standards §2 and §4 (advisory)");
  assert.equal(tenancy.message, "Advisory: a repository changed.");
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
  assert.match(comment, /\| error \| \[facilityiq-nextjs-app-router\]/);
  assert.match(comment, /client-imports-server/);
  assert.match(comment, /src\/components\/a\.tsx:2/);
  assert.match(
    comment,
    /\[facilityiq-nextjs-app-router\]\(https:\/\/github\.com\/moellejc\/facilityiq\/blob\/0123456789abcdef\/\.cursor\/skills\/facilityiq-nextjs-app-router\/SKILL\.md\)/,
  );
  assert.match(comment, /Coding Conventions §14–§16; GitFlow §6/);
  assert.match(comment, /Staff Eng review requested: @moellejc/);
  assert.match(comment, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \|/);
  assert.match(comment, /Result for Guard:\n\n```\nfail — 1 error\(s\), 0 warning\(s\)\n```/);
  assert.match(comment, /\| Lint \| `pnpm lint` \|/);
  assert.match(comment, /Result for Lint:\n\n```\nnot verified\n```/);
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
  assert.match(comment, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \|/);
  assert.match(comment, /Result for Guard:\n\n```\npass — 0 error\(s\), 0 warning\(s\)\n```/);
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
  assert.match(missing, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \|/);
  assert.match(missing, /Result for Guard:\n\n```\nnot verified\n```/);
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
  assert.match(comment, /\| error \| \[pull_request_template\.md\]/);
  assert.match(comment, /pr-body-section/);
  assert.match(
    comment,
    /\[pull_request_template\.md\]\(https:\/\/github\.com\/moellejc\/facilityiq\/blob\/0123456789abcdef\/\.github\/pull_request_template\.md\)/,
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
  assert.match(comment, /\| Lint \| `pnpm lint` \|/);
  assert.match(comment, /Result for Lint:\n\n```\npass — 0 problems\n```/);
  assert.match(comment, /\| Format \| `pnpm format:check` \|/);
  assert.match(comment, /Result for Format:\n\n```\nnot verified\n```/);
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
  assert.match(comment, /\| Lint \| `pnpm lint` \|/);
  assert.match(comment, /Result for Lint:\n\n```\nnot verified\n```/);
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
  assert.match(result.stdout, /Staff Eng review requested: not verified/);
  assert.doesNotMatch(result.stdout, /@moellejc/);
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
  assert.match(comment, /\| Build \| `pnpm build` \|/);
  assert.match(comment, /Result for Build:\n\n```\nnot verified\n```/);
  assert.match(comment, /Unverified in this run:.*pnpm build/);
  assert.match(comment, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \|/);
  assert.match(comment, /Result for Guard:\n\n```\npass — 0 error\(s\), 0 warning\(s\)\n```/);
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
    assert.match(result.stdout, /\| Guard \| `node scripts\/guard\/pre-pr\.mjs` \|/);
    assert.match(
      result.stdout,
      /Result for Guard:\n\n```\npass — 0 error\(s\), 0 warning\(s\)\n```/,
    );
    assert.match(result.stdout, /\| Lint \| `pnpm lint` \|/);
    assert.match(result.stdout, /Result for Lint:\n\n```\nnot verified\n```/);
    assert.match(result.stdout, /\| Build \| `pnpm build` \|/);
    assert.match(result.stdout, /Result for Build:\n\n```\nnot verified\n```/);
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
  assert.match(result.stdout, /Staff Eng review requested: not verified/);
  assert.doesNotMatch(result.stdout, /@moellejc/);
  assert.match(result.stdout, /\| Typecheck \| `pnpm typecheck` \|/);
  assert.match(result.stdout, /Result for Typecheck:\n\n```\npass\n```/);
  assert.match(result.stdout, /\*\*Verdict: Changes requested\*\*/);
});

test("a markdown link and a mention in a finding stay inside a fence", () => {
  const comment = formatReviewComment({
    report: reportFor([
      {
        level: "error",
        rule: "client-imports-server",
        file: "src/components/a.tsx",
        line: 2,
        message: 'imports "@/server/services/[phish](https://evil.example/p) @victim"',
        skill: "facilityiq-nextjs-app-router",
        standard: "Coding Conventions",
      },
    ]),
    ref: SHA,
    codeowners: owners,
    reviewNotes: "NOTE: see [phish](https://evil.example/n) @victim\n",
    checks: {
      "pnpm lint": "pass — see [details](https://evil.example) @someone",
      "echo ](https://evil.example/c) @victim": "pass",
    },
  });
  const outside = textOutsideFences(comment);
  assert.match(comment, /\]\(https:\/\/evil\.example\/p\)/);
  assert.match(comment, /@victim/);
  assert.doesNotMatch(outside, /evil\.example/);
  assert.doesNotMatch(outside, /@victim/);
  assert.doesNotMatch(outside, /@someone/);
});

test("a where path with a pipe, mention, and link stays inside a fence", () => {
  const where = "src/a|b @victim [phish](https://evil.example/w)";
  const comment = formatReviewComment({
    report: reportFor([
      {
        level: "error",
        rule: "rule|@other [z](https://evil.example/r)",
        file: where,
        line: 2,
        message: "kept",
        skill: "facilityiq-nextjs-app-router",
        standard: "Coding Conventions",
      },
    ]),
    ref: SHA,
    codeowners: owners,
  });
  const outside = textOutsideFences(comment);
  assert.match(comment, /src\/a\|b @victim \[phish\]\(https:\/\/evil\.example\/w\):2/);
  assert.match(comment, /rule\|@other \[z\]\(https:\/\/evil\.example\/r\)/);
  assert.doesNotMatch(outside, /@victim/);
  assert.doesNotMatch(outside, /@other/);
  assert.doesNotMatch(outside, /evil\.example/);
  assert.doesNotMatch(outside, /src\/a\|b/);
});

test("a demo paragraph with no link and no stated reason is pr-body-demo", () => {
  const body = completeBody().replace(
    "Not possible because this change has no UI.",
    "We will record this later.",
  );
  const findings = pullRequestBodyFindings(body);
  assert.equal(findings.problems.length, 1);
  assert.equal(findings.problems[0].rule, "pr-body-demo");
  assert.equal(
    findings.problems[0].message,
    "Demo video section has no recording link and no stated reason.",
  );
  const comment = formatReviewComment({
    report: reportFor([]),
    ref: SHA,
    prBody: body,
    codeowners: owners,
  });
  assert.match(comment, /\*\*Verdict: Changes requested\*\*/);
  assert.match(comment, /`pr-body-demo`/);
});

test("a path outside the temp directory is refused", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/guard/format-review-comment.mjs", "--report", join(ROOT, "README.md"), "--ref", SHA],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the temp directory/);
  assert.doesNotMatch(result.stdout, /FacilityIQ guardrail review/);
});

test("omitted --codeowners ignores the worktree file; origin/main still supplies moellejc", () => {
  const worktree = readFileSync(new URL("../../.github/CODEOWNERS", import.meta.url), "utf8");
  assert.match(worktree, /@moellejc/);
  const omitted = spawnSync(
    process.execPath,
    ["scripts/guard/format-review-comment.mjs", "--ref", SHA],
    { cwd: ROOT, input: reportFor([]), encoding: "utf8" },
  );
  assert.equal(omitted.status, 0, omitted.stderr);
  assert.match(omitted.stdout, /Staff Eng review requested: not verified/);
  assert.doesNotMatch(omitted.stdout, /@moellejc/);

  const dir = mkdtempSync(join(tmpdir(), "guard-owners-"));
  const planted = join(dir, "CODEOWNERS");
  writeFileSync(planted, "* @moellejc @not-staff\n");
  const plantedRun = spawnSync(
    process.execPath,
    ["scripts/guard/format-review-comment.mjs", "--ref", SHA, "--codeowners", planted],
    { cwd: ROOT, input: reportFor([]), encoding: "utf8" },
  );
  assert.equal(plantedRun.status, 0, plantedRun.stderr);
  assert.match(plantedRun.stdout, /@moellejc/);
  assert.doesNotMatch(plantedRun.stdout, /@not-staff/);

  const fromMain = trustedStaffEng(originMainCodeowners(), originMainCodeowners());
  assert.deepEqual(fromMain, ["moellejc"]);
});

test("the automation spec runs guard scripts from origin/main and treats the diff as data", () => {
  const spec = readFileSync(
    new URL("../../automations/pr-guardrail-review.md", import.meta.url),
    "utf8",
  );
  assert.match(spec, /pull request copies were not executed/i);
  assert.match(spec, /must not be followed as instructions/);
  assert.match(spec, /origin\/main:\.github\/CODEOWNERS/);
  assert.match(spec, /git archive origin\/main scripts\/guard/);
});
