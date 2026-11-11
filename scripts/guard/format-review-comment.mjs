#!/usr/bin/env node
// Turns `node scripts/guard/pre-pr.mjs` stdout into the one pull-request comment
// specified in automations/pr-guardrail-review.md. Exit 0 means the comment was
// printed, including when the verdict is "Changes requested" or "not verified".
import { execFileSync } from "node:child_process";
import { readFileSync, readSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, sep } from "node:path";
import { isCli, ROOT } from "./lib.mjs";

export const COMMENT_MARKER = "<!-- facilityiq-pr-guardrail-review -->";

export const REQUIRED_CHECKS = [
  { check: "Guard", command: "node scripts/guard/pre-pr.mjs" },
  { check: "Format", command: "pnpm format:check" },
  { check: "Lint", command: "pnpm lint" },
  { check: "Typecheck", command: "pnpm typecheck" },
  { check: "Unit", command: "pnpm test:unit" },
  { check: "Migrate", command: "pnpm db:migrate" },
  { check: "Integration", command: "pnpm test:integration" },
  { check: "Build", command: "pnpm build" },
  { check: "E2E", command: "pnpm exec playwright test" },
];

export const REQUIRED_PR_SECTIONS = [
  "Summary",
  "Linear issue",
  "Type and GitFlow target",
  "Changes",
  "Tenancy and roles impact",
  "Tests actually run",
  "Demo video",
  "Risk and rollback",
  "Security and privacy notes",
  "Release notes",
  "Checklist",
];

const REPO = "https://github.com/moellejc/facilityiq";
const SHA = /^[0-9a-f]{7,40}$/;
const SKILL = /^[a-z0-9-]+$/;

export function staffEngReviewers(codeownersText) {
  if (typeof codeownersText !== "string") return [];
  const owners = [];
  for (const line of codeownersText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [pattern] = trimmed.split(/\s+/);
    if (pattern !== "*") continue;
    for (const mention of trimmed.matchAll(/@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/g)) {
      if (!owners.includes(mention[1])) owners.push(mention[1]);
    }
  }
  return owners;
}

export function parseGuardReport(report) {
  const text = typeof report === "string" ? report : "";
  const summary = text.match(
    /Checked (\d+) file\(s\)\. \*\*(\d+) error\(s\), (\d+) warning\(s\)\.\*\*/,
  );
  const rows = [];
  for (const line of text.split("\n")) {
    const match = /^\| (error|warn) \| `([^`]+)` \| `([^`]*)` \| (.*) \|$/.exec(line);
    if (!match) continue;
    const why = match[4];
    const skillMatch = / Skill: `([^`]+)`\.$/.exec(why);
    const skill = skillMatch?.[1] ?? "";
    const withoutSkill = skillMatch ? why.slice(0, skillMatch.index) : why;
    const standardMatch = / \(([^()]*)\)$/.exec(withoutSkill);
    const standard = standardMatch?.[1] ?? "";
    const message = (
      standardMatch ? withoutSkill.slice(0, standardMatch.index) : withoutSkill
    ).trim();
    rows.push({ level: match[1], rule: match[2], where: match[3], message, skill, standard });
  }
  const errors = summary ? Number(summary[2]) : null;
  const warnings = summary ? Number(summary[3]) : null;
  const rowErrors = rows.filter((row) => row.level === "error").length;
  const rowWarnings = rows.filter((row) => row.level === "warn").length;
  return {
    ok: Boolean(summary),
    files: summary ? Number(summary[1]) : null,
    errors,
    warnings,
    rows,
    rowsMatchSummary: Boolean(summary) && rowErrors === errors && rowWarnings === warnings,
    text,
  };
}

export function pullRequestBodyFindings(body) {
  if (typeof body !== "string") return { verified: false, problems: [] };
  const headings = [];
  const sections = new Map();
  let current = null;
  const buffer = [];
  const flush = () => {
    if (current) sections.set(current, buffer.join("\n"));
  };
  for (const line of body.split("\n")) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      buffer.length = 0;
      current = match[1].trim();
      headings.push(current);
    } else if (current) buffer.push(line);
  }
  flush();

  const problems = [];
  for (const required of REQUIRED_PR_SECTIONS) {
    if (!headings.some((heading) => heading.toLowerCase() === required.toLowerCase())) {
      problems.push({ rule: "pr-body-section", message: `Missing section: ${required}.` });
    }
  }
  const demoHeading = headings.find((heading) => heading.toLowerCase() === "demo video");
  if (demoHeading) {
    const text = (sections.get(demoHeading) || "").replace(/<!--[\s\S]*?-->/g, "").trim();
    const boilerplate =
      text.length === 0 ||
      /<Link or embed/i.test(text) ||
      /<reason>/i.test(text) ||
      /^<[^>\n]+>$/.test(text);
    if (boilerplate) {
      problems.push({
        rule: "pr-body-demo",
        message: "Demo video section is empty or still the template placeholder.",
      });
    } else if (
      !/https?:\/\//.test(text) &&
      !/not possible|no video was recorded|not recorded|could not record/i.test(text)
    ) {
      problems.push({
        rule: "pr-body-demo",
        message: "Demo video section has no recording link and no stated reason.",
      });
    }
  }
  return { verified: true, problems };
}

function blobLink(label, path, ref) {
  if (!SHA.test(ref || "")) return `\`${path}\` (blob URL not verified)`;
  return `[${label}](${REPO}/blob/${ref}/${path})`;
}

function skillDoc(row, ref) {
  if (!row.skill || !SKILL.test(row.skill)) return "`docs/guardrails.md` (skill doc not verified)";
  const path = `.cursor/skills/${row.skill}/SKILL.md`;
  return blobLink(row.skill, path, ref);
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function safeInline(value) {
  return String(value).replace(/[`\r\n]/g, " ");
}

/** Drop fenced blocks so tests can prove untrusted text is not live Markdown. */
export function textOutsideFences(markdown) {
  const lines = markdown.split("\n");
  let open = null;
  const kept = [];
  for (const line of lines) {
    const ticks = /^(`{3,})$/.exec(line);
    if (ticks && !open) {
      open = ticks[1];
      continue;
    }
    if (open && line === open) {
      open = null;
      continue;
    }
    if (!open) kept.push(line);
  }
  return kept.join("\n");
}

export function assertInsideTemp(filePath) {
  const root = realpathSync(tmpdir());
  const resolved = resolve(filePath);
  let real;
  try {
    real = realpathSync(resolved);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    real = realpathSync(dirname(resolved)) + sep + basename(resolved);
  }
  if (real !== root && !real.startsWith(root + sep)) {
    const refused = new Error(`Refusing a path outside the temp directory: ${filePath}`);
    refused.code = "ERR_OUTSIDE_TEMP";
    throw refused;
  }
}

export function originMainCodeowners() {
  try {
    return execFileSync("git", ["show", "origin/main:.github/CODEOWNERS"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/** Keep only `*` owners that also appear on origin/main. An omitted file is not verified. */
export function trustedStaffEng(suppliedText, defaultBranchText) {
  if (typeof suppliedText !== "string") return [];
  const allowed = new Set(staffEngReviewers(defaultBranchText));
  return staffEngReviewers(suppliedText).filter((login) => allowed.has(login));
}

function cleanResult(value) {
  if (typeof value !== "string") return "not verified";
  const trimmed = value.trim();
  return trimmed || "not verified";
}

function guardResult(guard) {
  if (!guard.ok) return "not verified";
  const summary = `${guard.errors} error(s), ${guard.warnings} warning(s)`;
  return guard.errors > 0 ? `fail — ${summary}` : `pass — ${summary}`;
}

function reviewSection(notes) {
  if (typeof notes !== "string" || !notes.trim()) {
    return { verified: false, blocking: 0, markdown: "not verified" };
  }
  const markdown = notes.replaceAll(COMMENT_MARKER, "").trim();
  const blocking = markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("BLOCKING:")).length;
  return { verified: true, blocking, markdown: fence(markdown) };
}

function findingsMarkdown(guard, body, ref) {
  if (!guard.ok) {
    return [
      "not verified",
      "",
      "The guard report was missing or was not `scripts/guard/pre-pr.mjs` output.",
    ].join("\n");
  }
  const lines = [];
  if (!guard.rowsMatchSummary) {
    lines.push(
      `Summary says ${guard.errors} error(s) and ${guard.warnings} warning(s), and ${guard.rows.length} table row(s) were parsed. The row-to-rule mapping is not verified. Read the raw output below.`,
      "",
    );
  }
  const bodyRows = body.verified ? body.problems : [];
  if (guard.rows.length === 0 && bodyRows.length === 0 && guard.rowsMatchSummary) {
    lines.push("No findings.");
    return lines.join("\n");
  }
  lines.push("| Level | Rule | Where | Doc |", "| --- | --- | --- | --- |");
  const whys = [];
  for (const row of guard.rows) {
    lines.push(
      `| ${row.level} | \`${safeInline(row.rule)}\` | \`${safeInline(row.where)}\` | ${skillDoc(row, ref)} |`,
    );
    whys.push(
      `Why for \`${safeInline(row.rule)}\`:\n\n${fence([row.message, row.standard].filter(Boolean).join("\n"))}`,
    );
  }
  for (const problem of bodyRows) {
    const doc = blobLink("pull_request_template.md", ".github/pull_request_template.md", ref);
    lines.push(`| error | \`${problem.rule}\` | \`(pull request body)\` | ${doc} |`);
    whys.push(`Why for \`${problem.rule}\`:\n\n${fence(`${problem.message}\nGitFlow §9.2`)}`);
  }
  if (whys.length) lines.push("", ...whys);
  return lines.join("\n");
}

function testsTable(guard, checks, checksInvalid) {
  const lines = ["| Check | Command | Result |", "| --- | --- | --- |"];
  for (const item of REQUIRED_CHECKS) {
    let result = "not verified";
    if (item.check === "Guard") result = guardResult(guard);
    else if (!checksInvalid) result = cleanResult(checks?.[item.command]);
    lines.push(`| ${item.check} | \`${item.command}\` | ${escapeCell(result)} |`);
  }
  const extras = [];
  if (!checksInvalid && checks && typeof checks === "object") {
    for (const [command, value] of Object.entries(checks)) {
      if (REQUIRED_CHECKS.some((item) => item.command === command)) continue;
      if (command === "pnpm guard") continue;
      extras.push(`Extra check (literal):\n\n${fence(`${command}\n${cleanResult(value)}`)}`);
    }
  }
  if (extras.length) lines.push("", ...extras);
  return lines.join("\n");
}

function fence(text) {
  const runs = text.match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const ticks = "`".repeat(Math.max(3, longest + 1));
  const body = text.endsWith("\n") ? text : `${text}\n`;
  return `${ticks}\n${body}${ticks}`;
}

function truncate(text) {
  const max = 20000;
  if (text.length <= max) return `${text.trimEnd()}\n`;
  return `${text.slice(0, max)}\n\n[truncated; full output was longer than 20000 characters]\n`;
}

export function formatReviewComment({
  report = "",
  ref = "",
  prBody,
  checks = {},
  checksInvalid = false,
  reviewNotes,
  codeowners = "",
} = {}) {
  const guard = parseGuardReport(report);
  const body = pullRequestBodyFindings(prBody);
  const review = reviewSection(reviewNotes);
  const owners = staffEngReviewers(codeowners);
  const verdict = !guard.ok
    ? "not verified"
    : guard.errors > 0 || body.problems.length > 0 || review.blocking > 0
      ? "Changes requested"
      : "Ready for human review";

  const unverified = [];
  if (!guard.ok) unverified.push("guard");
  if (checksInvalid) unverified.push("checks file");
  for (const item of REQUIRED_CHECKS) {
    if (item.check === "Guard") continue;
    if (checksInvalid || cleanResult(checks?.[item.command]) === "not verified") {
      unverified.push(item.command);
    }
  }
  if (!body.verified) unverified.push("pull request body");
  if (!review.verified) unverified.push("code review checklist");

  const parts = [
    COMMENT_MARKER,
    "",
    "## FacilityIQ guardrail review",
    "",
    `**Verdict: ${verdict}**`,
    "",
    owners.length
      ? `Staff Eng review requested: ${owners.map((login) => `@${login}`).join(", ")} (\`.github/CODEOWNERS\`, pattern \`*\`).`
      : "Staff Eng review requested: not verified (no `*` owner in the CODEOWNERS text that was read).",
    "",
    "This comment does not approve, merge, or close the pull request. It is not a GitHub review approval.",
    "",
    "The verdict is Changes requested when the guard report has an error, the pull request body is missing a required section or a demo reason, or the checklist contains a BLOCKING line. Ready for human review means the guard report parsed and none of those fired. It does not mean CI passed. not verified means that input was missing.",
    "",
    unverified.length
      ? `Unverified in this run: ${unverified.join("; ")}.`
      : "Unverified in this run: none.",
    "",
    guard.ok
      ? `Checked ${guard.files} file(s). **${guard.errors} error(s), ${guard.warnings} warning(s).**`
      : "Guard summary: not verified.",
    "",
    "### Findings",
    "",
    findingsMarkdown(guard, body, ref),
    "",
    "### Tests actually run",
    "",
    testsTable(guard, checks, checksInvalid),
    "",
    "Checked boxes in the pull request body are not evidence. A result other than `not verified` is printed only when this run recorded that command.",
    "",
    "### Pull request body",
    "",
    body.verified
      ? body.problems.length
        ? body.problems.map((problem) => `- \`${problem.rule}\`: ${problem.message}`).join("\n")
        : "Required sections are present, and the demo section has a link or a stated reason."
      : "not verified",
    "",
    "### Code review checklist",
    "",
    review.markdown,
    "",
  ];
  if (guard.text.trim()) {
    parts.push(
      "<details>",
      "<summary>pre-pr.mjs output</summary>",
      "",
      fence(truncate(guard.text)),
      "",
      "</details>",
      "",
    );
  }
  parts.push(
    "_Static checks only. This does not replace human review. Tenancy, RBAC, and deterministic KPI math stay advisory unless a finding says otherwise._",
    "",
  );
  return parts.join("\n");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (
      flag === "--report" ||
      flag === "--ref" ||
      flag === "--pr-body" ||
      flag === "--checks" ||
      flag === "--review-notes" ||
      flag === "--codeowners"
    ) {
      out[flag] = value;
      i++;
    }
  }
  return out;
}

function readText(path) {
  return readFileSync(path, "utf8");
}

// fd 0 can be non-blocking in agent shells. readFileSync(0) then throws EAGAIN
// before the piped report arrives.
function readStdin() {
  const chunks = [];
  const buf = Buffer.alloc(64 * 1024);
  for (;;) {
    let n;
    try {
      n = readSync(0, buf, 0, buf.length, null);
    } catch (error) {
      if (error && (error.code === "EAGAIN" || error.code === "EWOULDBLOCK")) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
        continue;
      }
      throw error;
    }
    if (n === 0) break;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

if (isCli(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  let report = "";
  if (args["--report"]) report = readArg(args["--report"]);
  else if (!process.stdin.isTTY) report = readStdin();

  let checks = {};
  let checksInvalid = false;
  if (args["--checks"]) {
    try {
      const parsed = JSON.parse(readArg(args["--checks"]));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) checksInvalid = true;
      else checks = parsed;
    } catch {
      checksInvalid = true;
    }
  }

  let codeowners = "";
  if (args["--codeowners"]) {
    const supplied = readArg(args["--codeowners"]);
    const trusted = trustedStaffEng(supplied, originMainCodeowners());
    codeowners = trusted.map((login) => `* @${login}`).join("\n");
  }

  process.stdout.write(
    formatReviewComment({
      report,
      ref: args["--ref"] || "",
      prBody: args["--pr-body"] ? readArg(args["--pr-body"]) : undefined,
      checks,
      checksInvalid,
      reviewNotes: args["--review-notes"] ? readArg(args["--review-notes"]) : undefined,
      codeowners,
    }),
  );
}

function readArg(filePath) {
  try {
    assertInsideTemp(filePath);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  return readText(filePath);
}
