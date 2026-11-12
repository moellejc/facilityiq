// Shared helpers for FacilityIQ guards. Pure Node (no dependencies) so CI can run
// them before pnpm install. Rules live in .cursor/guardrails.json.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ROOT = process.env.GUARD_ROOT || process.cwd();

/** Rule file root. Defaults to ROOT. The PR review sets this to origin/main's tree so a diff cannot rewrite the rules it is judged by. */
export function configRoot() {
  return process.env.GUARD_CONFIG || ROOT;
}

export function loadConfig() {
  return JSON.parse(readFileSync(join(configRoot(), ".cursor/guardrails.json"), "utf8"));
}

export function isCli(metaUrl) {
  if (!process.argv[1]) return false;
  return metaUrl === pathToFileURL(process.argv[1]).href;
}

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (".+^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(path));

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/**
 * Infra-only diffs (workflows, guards, docs) use the infra scope so a guardrail
 * change is not blocked by its own protected-path rule. A diff that also touches
 * product code stays on the default scope, and protected files then fail.
 * GUARD_SCOPE=infra|default|finance-route still wins when a human sets it.
 */
export function resolveScope(config, files, env = process.env) {
  const requested = env.GUARD_SCOPE;
  if (requested && requested !== "auto") return requested;
  const infraAllow = config.scopes?.infra?.allow ?? [];
  if (files.length > 0 && files.every((file) => matchesAny(file, infraAllow))) return "infra";
  return "default";
}

/** Files changed on this branch vs base, plus staged, unstaged, and untracked. Deleted files excluded. */
export function changedFiles(config) {
  if (process.env.GUARD_FILES) return process.env.GUARD_FILES.split(",").filter(Boolean);
  if (process.env.GUARD_BASELINE === "1") {
    return git(["ls-files", "-z", "--", "src"])
      .split("\0")
      .filter((file) => /\.(tsx?|jsx?|mjs)$/.test(file) || file.endsWith(".env.example"));
  }
  const base = process.env.GUARD_BASE || config.base || "origin/main";
  const sets = [
    git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]),
    git(["diff", "--name-only", "--diff-filter=ACMR"]),
    git(["diff", "--name-only", "--diff-filter=ACMR", "--cached"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(sets.join("\n").split("\n").filter(Boolean))].filter(
    (file) => file !== ".guard-report.md" && existsSync(join(ROOT, file)),
  );
}

export function baseFileText(filePath, config) {
  const base = process.env.GUARD_BASE || config.base || "origin/main";
  return git(["show", `${base}:${filePath}`]);
}

export const read = (filePath) => readFileSync(join(ROOT, filePath), "utf8");

export const isUseClient = (text) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(text);

export function finding(level, rule, file, line, message, skill, standard, snippet = "") {
  return { level, rule, file, line, message, skill, standard, snippet };
}

export function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

/** Normalized source line containing index. The ratchet fingerprints a hit as rule + this line. */
export function sourceLine(text, index) {
  const from = index > 0 ? index - 1 : 0;
  const start = text.lastIndexOf("\n", from) + 1;
  const end = text.indexOf("\n", index);
  return text
    .slice(start, end === -1 ? text.length : end)
    .trim()
    .replace(/\s+/g, " ");
}

export function renderFindings(title, findings) {
  if (!findings.length) return `### ${title}\nNo findings.\n`;
  const rows = findings
    .map((item) => {
      const where = `\`${item.file}${item.line ? ":" + item.line : ""}\``;
      const why = [
        item.message,
        item.standard ? `(${item.standard})` : "",
        item.skill ? `Skill: \`${item.skill}\`.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const mark = item.level === "error" ? "error" : "warn";
      return `| ${mark} | \`${item.rule}\` | ${where} | ${why} |`;
    })
    .join("\n");
  const mark = findings.some((item) => item.level === "error") ? "fail" : "warn";
  return `### ${mark}: ${title}\n| Level | Rule | Where | Why / fix |\n|---|---|---|---|\n${rows}\n`;
}

/** Fingerprint is rule + source line, so a new line cannot hide behind an old one of the same rule. */
function findingFingerprint(item) {
  return `${item.rule}\0${item.snippet ?? ""}`;
}

export function ratchetFindings(current, baseFindings) {
  const baseline = new Map();
  for (const item of baseFindings) {
    const key = findingFingerprint(item);
    baseline.set(key, (baseline.get(key) ?? 0) + 1);
  }
  const seen = new Map();
  const keep = [];
  for (const item of current) {
    const key = findingFingerprint(item);
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    if (occurrence > (baseline.get(key) ?? 0)) keep.push(item);
  }
  return keep;
}

export function ratchet(config, file, current, findBase) {
  if (process.env.GUARD_NO_RATCHET === "1") return current;
  const baseText = baseFileText(file, config);
  if (!baseText) return current;
  return ratchetFindings(current, findBase(baseText));
}
