#!/usr/bin/env node
// One command for developers, the stop hook, and CI: pnpm guard
// Prints a markdown report and exits 1 on any error. GUARD_BASELINE=1 inventories
// existing src debt and always exits 0.
import { writeFileSync } from "node:fs";
import { checkBoundaries } from "./boundaries.mjs";
import { checkDeprecated } from "./deprecated-apis.mjs";
import { changedFiles, isCli, loadConfig, renderFindings, resolveScope } from "./lib.mjs";
import { checkTestStrength } from "./test-strength.mjs";

export function buildReport(config = loadConfig(), files = changedFiles(config)) {
  const baseline = process.env.GUARD_BASELINE === "1";
  const sections = [
    [`Boundaries (scope: ${resolveScope(config, files)})`, checkBoundaries(config, files)],
    ["Deprecated APIs and anti-patterns", checkDeprecated(config, files)],
    ["Test strength", baseline ? [] : checkTestStrength(config, files)],
  ];
  const flat = sections.flatMap(([, findings]) => findings);
  const errors = flat.filter((item) => item.level === "error").length;
  const warns = flat.filter((item) => item.level === "warn").length;
  const intro = baseline
    ? "Baseline inventory of current `src` (ratchet off, test-strength skipped). This command exits 0. It does not fail CI."
    : "New violations only. A finding that already exists on the base branch is not reported again.";
  const report = [
    "## FacilityIQ pre-PR guard",
    intro,
    `Checked ${files.length} file(s). **${errors} error(s), ${warns} warning(s).**`,
    "",
    ...sections.map(([title, findings]) => renderFindings(title, findings)),
    "_Static checks only. This does not replace format, lint, typecheck, unit or integration tests, or human review. Tenancy, RBAC, deterministic KPI math, and Linear Backlog-first intake are advisory._",
  ].join("\n");
  return { report, errors };
}

if (isCli(import.meta.url)) {
  const { report, errors } = buildReport();
  console.log(report);
  try {
    writeFileSync(".guard-report.md", report + "\n");
  } catch {
    // A read-only checkout can still print the report.
  }
  const fail = process.env.GUARD_BASELINE === "1" ? false : errors > 0;
  process.exit(fail ? 1 : 0);
}
