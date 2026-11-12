#!/usr/bin/env node
// Weekly check: guardrails still match installed Next/React/Drizzle, and every rule names a real skill.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isCli, loadConfig, ROOT } from "./lib.mjs";

export function driftProblems(
  config = loadConfig(),
  packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")),
) {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const problems = [];
  for (const [name, verified] of Object.entries(config.verifiedAgainst)) {
    const installed = (deps[name] || "").replace(/^[^\d]*/, "");
    if (!installed)
      problems.push(`${name} is no longer a dependency; remove it from verifiedAgainst.`);
    else if (!installed.startsWith(verified)) {
      problems.push(
        `${name} is ${installed} but guardrails were verified against ${verified}. Re-read the release notes, update rules and skills, then bump verifiedAgainst.`,
      );
    }
  }
  const skills = new Set(
    [...config.deprecated, ...config.importRules].map((rule) => rule.skill).filter(Boolean),
  );
  for (const skill of skills) {
    if (!existsSync(join(ROOT, `.cursor/skills/${skill}/SKILL.md`))) {
      problems.push(`Rule references missing skill "${skill}".`);
    }
  }
  return problems;
}

if (isCli(import.meta.url)) {
  const problems = driftProblems();
  if (problems.length) {
    console.log("## Guardrails drift\n" + problems.map((problem) => `- ${problem}`).join("\n"));
    process.exit(1);
  }
  console.log("Guardrails match installed framework versions and every rule's skill exists.");
}
