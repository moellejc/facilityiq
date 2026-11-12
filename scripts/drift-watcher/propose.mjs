// Pure proposal builder for the SIMULATED Next.js drift-watcher demo.
// Default callers write under demo/drift-watcher/ only.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const START = "<!-- SIMULATED drift-watcher proposal: not a real Next.js deprecation -->";
const END = "<!-- /SIMULATED drift-watcher proposal -->";

const SKILL_FILE = /^\.cursor\/skills\/[a-z0-9-]+\/SKILL\.md$/;

export function parseFixture(markdown) {
  if (typeof markdown !== "string" || !markdown.includes("SIMULATED")) {
    throw new Error("Fixture text must include SIMULATED.");
  }
  if (!/not a real Next\.js deprecation/i.test(markdown)) {
    throw new Error("Fixture text must say it is not a real Next.js deprecation.");
  }
  if (!markdown.includes("not verified")) {
    throw new Error('Fixture text must mark the claim "not verified".');
  }
  const fence = markdown.match(/```json\s*([\s\S]*?)```/);
  if (!fence) throw new Error("Fixture needs one json code fence.");
  let data;
  try {
    data = JSON.parse(fence[1]);
  } catch (error) {
    throw new Error(`Fixture JSON is invalid: ${error.message}`);
  }
  assertFixture(data);
  return data;
}

function assertFixture(data) {
  if (data.simulated !== true) throw new Error("Fixture simulated must be true.");
  if (data.label !== "SIMULATED") throw new Error("Fixture label must be SIMULATED.");
  if (typeof data.id !== "string" || !data.id.startsWith("simulated-")) {
    throw new Error('Fixture id must start with "simulated-".');
  }
  for (const key of ["api", "replacement", "pattern", "skill", "standard", "claim"]) {
    if (typeof data[key] !== "string" || data[key].length === 0) {
      throw new Error(`Fixture ${key} must be a non-empty string.`);
    }
  }
  if (!Array.isArray(data.files) || data.files.length === 0) {
    throw new Error("Fixture files must be a non-empty array.");
  }
  if (!SKILL_FILE.test(data.skillFile)) {
    throw new Error("Fixture skillFile must be .cursor/skills/<name>/SKILL.md.");
  }
  if (!data.skillFile.endsWith(`/${data.skill}/SKILL.md`)) {
    throw new Error("Fixture skillFile must match skill.");
  }
  if (data.claimStatus !== "not verified") {
    throw new Error('Fixture claimStatus must be "not verified".');
  }
  if (data.codemod !== null) {
    throw new Error("A SIMULATED fixture has no codemod.");
  }
  const url = data.verifiedContrast?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("Fixture verifiedContrast.url must be an https URL.");
  }
  if (typeof data.verifiedContrast?.statement !== "string" || !data.verifiedContrast.statement) {
    throw new Error("Fixture verifiedContrast.statement is required.");
  }
  if (!data.pattern.includes(data.api)) {
    throw new Error("Fixture pattern must mention the API name.");
  }
  if (data.installed != null) {
    for (const key of [
      "replacedSentence",
      "recommendation",
      "recommendationPath",
      "stillWorks",
      "stillWorksPath",
    ]) {
      if (typeof data.installed[key] !== "string" || data.installed[key].length === 0) {
        throw new Error(`Fixture installed.${key} must be a non-empty string.`);
      }
    }
  }
}

function installedNote(fixture) {
  if (!fixture.installed) {
    return "Installed-tree comparison (node_modules/next/dist/docs/): not verified.";
  }
  const note = fixture.installed;
  return `${note.replacedSentence} ${note.recommendation} Path: ${note.recommendationPath}. ${note.stillWorks} Path: ${note.stillWorksPath}.`;
}

export function deprecatedEntry(fixture) {
  const url = fixture.verifiedContrast.url;
  const message = [
    "SIMULATED fixture, not a real Next.js deprecation (not verified).",
    `The fixture discourages ${fixture.api} in favor of ${fixture.replacement}.`,
    "No codemod: this is not a real migration.",
    `${fixture.verifiedContrast.statement} Source: ${url}`,
    installedNote(fixture),
  ].join(" ");
  return {
    id: fixture.id,
    pattern: fixture.pattern,
    files: fixture.files,
    message,
    skill: fixture.skill,
    standard: fixture.standard,
  };
}

export function skillSection(fixture) {
  const checked = fixture.verifiedContrast.checked
    ? ` (page fetched ${fixture.verifiedContrast.checked})`
    : "";
  return `${START}

## SIMULATED drift-watcher proposal

This section is a dry-run proposal from \`demo/drift-watcher/\`. It is **SIMULATED** and **not verified**. It is not a real Next.js deprecation, and it is not FacilityIQ guidance.

The fixture claims \`${fixture.api}\` is discouraged in favor of ${fixture.replacement}. That claim is **not verified**.

Verified contrast: ${fixture.verifiedContrast.statement} Source: ${fixture.verifiedContrast.url}${checked}.

No codemod applies. Leave Cache Components off. Do not add \`"use cache"\` because of this fixture.

${installedNote(fixture)} The installed API page and the migration guide disagree, and the public guide still documents the API. The watcher quotes all three and does not add a live \`deprecated[]\` entry for that disagreement. The fixture's guard-rule claim stays **not verified**.

${END}
`;
}

export function insertDeprecated(guardrailsText, entry) {
  const config = JSON.parse(guardrailsText);
  if (!Array.isArray(config.deprecated)) throw new Error("deprecated array missing");
  if (config.deprecated.some((rule) => rule.id === entry.id)) return guardrailsText;
  const { close } = findDeprecatedArrayEnd(guardrailsText);
  const indented = renderDeprecatedEntry(entry);
  const head = guardrailsText.slice(0, close).replace(/\s*$/, "");
  const tail = guardrailsText.slice(close);
  const newline = guardrailsText.includes("\r\n") ? "\r\n" : "\n";
  let next;
  if (head.endsWith("}")) next = `${head},${newline}${indented}${newline}  ${tail}`;
  else if (head.endsWith("[")) next = `${head}${newline}${indented}${newline}  ${tail}`;
  else throw new Error("deprecated array did not end with an object");
  const parsed = JSON.parse(next);
  const ids = parsed.deprecated.map((rule) => rule.id);
  if (ids.at(-1) !== entry.id) throw new Error("inserted entry was not last");
  if (ids.filter((id) => id === entry.id).length !== 1) throw new Error("duplicate id");
  return next;
}

function renderDeprecatedEntry(entry) {
  const files = `[${entry.files.map((file) => JSON.stringify(file)).join(", ")}]`;
  return [
    "    {",
    `      "id": ${JSON.stringify(entry.id)},`,
    `      "pattern": ${JSON.stringify(entry.pattern)},`,
    `      "files": ${files},`,
    `      "message": ${JSON.stringify(entry.message)},`,
    `      "skill": ${JSON.stringify(entry.skill)},`,
    `      "standard": ${JSON.stringify(entry.standard)}`,
    "    }",
  ].join("\n");
}

function findDeprecatedArrayEnd(text) {
  const key = text.indexOf('\n  "deprecated"');
  if (key < 0) throw new Error("deprecated key missing");
  const open = text.indexOf("[", key);
  if (open < 0) throw new Error("deprecated array missing");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return { open, close: i };
    }
  }
  throw new Error("deprecated array is unterminated");
}

export function upsertSkillSection(skillText, section) {
  const block = section.endsWith("\n") ? section : `${section}\n`;
  const start = skillText.indexOf(START);
  const end = skillText.indexOf(END);
  if (start >= 0 && end > start) {
    const head = skillText.slice(0, start).replace(/\n+$/, "\n");
    const after = skillText.slice(end + END.length).replace(/^\n/, "");
    return `${head}\n${block}${after}`;
  }
  const base = skillText.endsWith("\n") ? skillText : `${skillText}\n`;
  return `${base}\n${block}`;
}

export function samplePrBody(fixture, entry) {
  const url = fixture.verifiedContrast.url;
  return `<!-- SIMULATED. Not a real Next.js deprecation. Claim status: not verified. -->

## Summary

SIMULATED dry run of the Next.js drift watcher. The fixture claims \`${fixture.api}\` is discouraged in favor of ${fixture.replacement}. That claim is **not verified** and is not a real Next.js deprecation. The diff adds one deprecated-list entry and a skill note so a reviewer can see the shape of a watcher pull request.

## Linear issue

FAIQ-34: https://linear.app/acme-ai/issue/FAIQ-34

## Type and GitFlow target

- Type: chore
- Branch → base: \`chore/nextjs-drift-simulated-unstable-cache\` → \`main\`
- \`develop\` does not exist. This pull request targets \`main\` until a maintainer adds \`develop\` (known GitFlow deviation).
- The watcher only opens pull requests. It never merges, never pushes to \`main\`, and never force-pushes.

## Changes

- DB / migrations: none
- API / services / repositories: none
- UI: none
- Worker: none
- Config / env: none
- \`.cursor/guardrails.json\`: append deprecated id \`${entry.id}\`. The deprecated-API list is the \`deprecated\` array in that file.
- \`${fixture.skillFile}\`: append the SIMULATED section from the diff.

## Tenancy and roles impact

- Org scoping / RLS: none
- Roles affected: none

## Tests actually run

The dry-run script writes this body. It does not run the CI suite. A live watcher run fills these boxes only for commands it actually ran.

- [ ] Guard: not run by the dry-run script
- [x] Demo: \`node scripts/drift-watcher/run-demo.mjs\` — writes this body and leaves \`.cursor/guardrails.json\` unchanged

Skipped / not run / failed (with reason): format, lint, typecheck, unit, migrate, integration, and e2e are outside this sample body.

## Demo video

The dry run is \`node scripts/drift-watcher/run-demo.mjs\`. See \`demo/drift-watcher/README.md\`.

## Screenshots (optional)

none

## Risk and rollback

- Migration reversibility: none
- Feature flag: none
- Rollback: close the pull request. An explicit demo apply is reverted with \`node scripts/drift-watcher/run-demo.mjs --revert\`.

## Security and privacy notes

none. The fixture is SIMULATED and contains no secrets.

## Release notes

none. SIMULATED internal demo.

## Checklist

- [x] No secrets, tokens, or credentials committed
- [x] SIMULATED is in this body
- [x] The deprecation claim is marked not verified
- [x] The verified contrast cites ${url}
- [x] Back-merge needed: N/A

## Source note

Verified contrast (${fixture.verifiedContrast.checked ?? "date not recorded"}): ${fixture.verifiedContrast.statement} Source: ${url}

${installedNote(fixture)}

Deprecated entry message: ${entry.message}
`;
}

export function unifiedDiff(relPath, before, after) {
  if (before === after) return "";
  const dir = mkdtempSync(join(tmpdir(), "drift-diff-"));
  const a = join(dir, "before");
  const b = join(dir, "after");
  try {
    writeFileSync(a, before);
    writeFileSync(b, after);
    const result = spawnSync(
      "diff",
      ["-u", "--label", `a/${relPath}`, "--label", `b/${relPath}`, a, b],
      { encoding: "utf8" },
    );
    if (result.status !== 1) {
      throw new Error(result.stderr || `diff exited ${result.status}`);
    }
    return `diff --git a/${relPath} b/${relPath}\n${result.stdout}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function buildProposal(fixture, guardrailsText, skillText) {
  const entry = deprecatedEntry(fixture);
  const nextGuard = insertDeprecated(guardrailsText, entry);
  const nextSkill = upsertSkillSection(skillText, skillSection(fixture));
  const diff = [
    unifiedDiff(".cursor/guardrails.json", guardrailsText, nextGuard),
    unifiedDiff(fixture.skillFile, skillText, nextSkill),
  ]
    .filter(Boolean)
    .join("");
  return {
    entry,
    guardrailsText: nextGuard,
    skillText: nextSkill,
    prBody: samplePrBody(fixture, entry),
    diff,
  };
}
