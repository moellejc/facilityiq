import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { matchesAny } from "../guard/lib.mjs";
import { buildProposal, deprecatedEntry, insertDeprecated, parseFixture } from "./propose.mjs";
import { runDemo } from "./run-demo.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE_PATH = join(ROOT, "demo/drift-watcher/SIMULATED-unstable-cache-release.md");

function fixtureText() {
  return readFileSync(FIXTURE_PATH, "utf8");
}

test("rejects a note that is not marked SIMULATED", () => {
  assert.throws(
    () => parseFixture("unstable_cache is deprecated in favor of use cache.\n"),
    /SIMULATED/,
  );
});

test("rejects a fixture that claims to be a real deprecation", () => {
  const text = fixtureText().replaceAll("not a real Next.js deprecation", "a real deprecation");
  assert.throws(() => parseFixture(text), /not a real Next\.js deprecation/);
});

test("rejects simulated false and an id outside the simulated prefix", () => {
  const text = fixtureText();
  assert.throws(
    () => parseFixture(text.replace('"simulated": true', '"simulated": false')),
    /simulated/,
  );
  assert.throws(
    () => parseFixture(text.replace('"simulated-unstable-cache"', '"unstable-cache"')),
    /simulated-/,
  );
});

test("builds a deprecated entry that keeps the claim not verified", () => {
  const fixture = parseFixture(fixtureText());
  const entry = deprecatedEntry(fixture);
  assert.equal(entry.id, "simulated-unstable-cache");
  assert.equal(entry.skill, "nextjs-caching-and-revalidation");
  assert.deepEqual(entry.files, ["src/**"]);
  assert.equal(entry.standard, fixture.standard);
  assert.match(entry.pattern, /unstable_cache/);
  assert.match(entry.message, /SIMULATED/);
  assert.match(entry.message, /not verified/);
  assert.match(entry.message, /not a real Next\.js deprecation/);
  assert.match(entry.message, /No codemod/);
  assert.match(entry.message, /https:\/\/nextjs\.org\/docs\/app\/guides\/caching/);
  assert.match(
    entry.message,
    /node_modules\/next\/dist\/docs\/01-app\/03-api-reference\/04-functions\/unstable_cache\.md/,
  );
  assert.match(entry.message, /migrating it is optional/);
  assert.match(entry.message, /has been replaced by use cache in Next\.js 16/);
  assert.equal(new RegExp(entry.pattern).test("const x = unstable_cache(fn)"), true);
  assert.equal(new RegExp(entry.pattern).test("const x = stable_cache(fn)"), false);
});

test("appends the rule without rewriting other guardrails data", () => {
  const fixture = parseFixture(fixtureText());
  const entry = deprecatedEntry(fixture);
  const original = readFileSync(join(ROOT, ".cursor/guardrails.json"), "utf8");
  const before = JSON.parse(original);
  const next = insertDeprecated(original, entry);
  const after = JSON.parse(next);
  assert.deepEqual(after.importRules, before.importRules);
  assert.deepEqual(after.verifiedAgainst, before.verifiedAgainst);
  assert.deepEqual(after.scopes, before.scopes);
  assert.deepEqual(
    after.deprecated.slice(0, -1).map((rule) => rule.id),
    before.deprecated.map((rule) => rule.id),
  );
  assert.equal(after.deprecated.at(-1).id, entry.id);
  assert.equal(insertDeprecated(next, entry), next);
});

test("dry run writes the proposal and leaves the guard config unchanged", () => {
  const { root, guard, skill } = tempRepo();
  try {
    const result = runDemo({
      root,
      mode: "dry-run",
      applyAllowed: false,
      fixturePath: FIXTURE_PATH,
    });
    assert.equal(result.exitCode, 0);
    assert.match(result.summary, /SIMULATED/);
    assert.match(result.summary, /not verified/);
    assert.equal(readFileSync(join(root, ".cursor/guardrails.json"), "utf8"), guard);
    assert.equal(
      readFileSync(join(root, ".cursor/skills/nextjs-caching-and-revalidation/SKILL.md"), "utf8"),
      skill,
    );
    const diff = readFileSync(join(root, "demo/drift-watcher/SIMULATED.diff"), "utf8");
    const pr = readFileSync(join(root, "demo/drift-watcher/SAMPLE-PR.md"), "utf8");
    const saved = JSON.parse(
      readFileSync(join(root, "demo/drift-watcher/SIMULATED-deprecated-entry.json"), "utf8"),
    );
    assert.match(diff, /simulated-unstable-cache/);
    assert.match(diff, /SIMULATED drift-watcher proposal/);
    assert.doesNotMatch(diff, /^[-+].*keep-me/m);
    assert.match(pr, /SIMULATED/);
    assert.match(pr, /not verified/);
    assert.match(pr, /→ `main`/);
    assert.match(pr, /never merges/);
    assert.equal(saved.id, "simulated-unstable-cache");
    assert.match(saved.message, /not a real Next\.js deprecation/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("apply without DRIFT_WATCHER_APPLY leaves the guard config unchanged", () => {
  const { root, guard, skill } = tempRepo();
  try {
    const result = runDemo({ root, mode: "apply", applyAllowed: false, fixturePath: FIXTURE_PATH });
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /Refused to apply/);
    assert.equal(readFileSync(join(root, ".cursor/guardrails.json"), "utf8"), guard);
    assert.equal(
      readFileSync(join(root, ".cursor/skills/nextjs-caching-and-revalidation/SKILL.md"), "utf8"),
      skill,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("apply then revert restores the guard config and the skill", () => {
  const { root, guard, skill } = tempRepo();
  try {
    const applied = runDemo({ root, mode: "apply", applyAllowed: true, fixturePath: FIXTURE_PATH });
    assert.equal(applied.exitCode, 0);
    const guardApplied = readFileSync(join(root, ".cursor/guardrails.json"), "utf8");
    const skillApplied = readFileSync(
      join(root, ".cursor/skills/nextjs-caching-and-revalidation/SKILL.md"),
      "utf8",
    );
    assert.notEqual(guardApplied, guard);
    assert.match(skillApplied, /SIMULATED drift-watcher proposal/);
    assert.match(JSON.parse(guardApplied).deprecated.at(-1).message, /not verified/);
    const reverted = runDemo({ root, mode: "revert" });
    assert.equal(reverted.exitCode, 0);
    assert.equal(readFileSync(join(root, ".cursor/guardrails.json"), "utf8"), guard);
    assert.equal(
      readFileSync(join(root, ".cursor/skills/nextjs-caching-and-revalidation/SKILL.md"), "utf8"),
      skill,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("committed demo outputs match a fresh proposal", () => {
  const fixture = parseFixture(fixtureText());
  const proposal = buildProposal(
    fixture,
    readFileSync(join(ROOT, ".cursor/guardrails.json"), "utf8"),
    readFileSync(join(ROOT, fixture.skillFile), "utf8"),
  );
  assert.equal(
    readFileSync(join(ROOT, "demo/drift-watcher/SIMULATED.diff"), "utf8"),
    proposal.diff,
  );
  assert.equal(
    readFileSync(join(ROOT, "demo/drift-watcher/SAMPLE-PR.md"), "utf8"),
    proposal.prBody,
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(ROOT, "demo/drift-watcher/SIMULATED-deprecated-entry.json"), "utf8"),
    ),
    proposal.entry,
  );
});

test("infra scope allows the automation spec and the demo", () => {
  const config = JSON.parse(readFileSync(join(ROOT, ".cursor/guardrails.json"), "utf8"));
  for (const file of [
    "automations/nextjs-drift-watcher.md",
    "demo/drift-watcher/SIMULATED.diff",
    "scripts/drift-watcher/run-demo.mjs",
  ]) {
    assert.equal(matchesAny(file, config.scopes.infra.allow), true, file);
  }
});

test("the automation spec only opens pull requests and links the existing drift job", () => {
  const spec = readFileSync(join(ROOT, "automations/nextjs-drift-watcher.md"), "utf8");
  assert.match(spec, /SIMULATED/);
  assert.match(spec, /never merges/i);
  assert.match(spec, /never pushes to `main`/i);
  assert.match(spec, /targets `main`/);
  assert.match(spec, /Joe/);
  assert.match(spec, /\.github\/workflows\/guardrails\.yml/);
  assert.match(spec, /drift-check\.mjs/);
  assert.match(spec, /0 13 \* \* 1/);
  assert.match(spec, /not verified/);
  assert.match(spec, /Do not merge/);
  assert.match(spec, /`deprecated\[\]` only/);
  assert.match(spec, /has been replaced by `use cache` in Next\.js 16/);
  assert.match(spec, /does not write `verifiedAgainst\.next`/);
});

function tempRepo() {
  const root = mkdtempSync(join(tmpdir(), "drift-watcher-"));
  const skillDir = join(root, ".cursor/skills/nextjs-caching-and-revalidation");
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(join(root, "demo/drift-watcher"), { recursive: true });
  const guard = `{
  "importRules": [{ "id": "keep-me" }],
  "deprecated": [
    {
      "id": "gssp",
      "pattern": "\\\\bgetServerSideProps\\\\b",
      "files": ["src/**"],
      "message": "no",
      "skill": "facilityiq-nextjs-app-router",
      "standard": "x"
    }
  ]
}
`;
  const skill = "# Caching\n\nExisting fact.\n";
  writeFileSync(join(root, ".cursor/guardrails.json"), guard);
  writeFileSync(join(skillDir, "SKILL.md"), skill);
  return { root, guard, skill };
}
