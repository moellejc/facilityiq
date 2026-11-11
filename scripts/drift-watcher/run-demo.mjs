#!/usr/bin/env node
// Dry run of the Next.js drift watcher against the SIMULATED fixture.
// Default: write demo/drift-watcher outputs only.
// Edit .cursor/guardrails.json only with --apply and DRIFT_WATCHER_APPLY=1.
import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildProposal, parseFixture } from "./propose.mjs";

const FIXTURE_REL = "demo/drift-watcher/SIMULATED-unstable-cache-release.md";
const DIFF_REL = "demo/drift-watcher/SIMULATED.diff";
const ENTRY_REL = "demo/drift-watcher/SIMULATED-deprecated-entry.json";
const PR_REL = "demo/drift-watcher/SAMPLE-PR.md";
const MANIFEST_REL = "demo/drift-watcher/.apply-manifest.json";
const GUARD_REL = ".cursor/guardrails.json";
const SKILL_FILE = /^\.cursor\/skills\/[a-z0-9-]+\/SKILL\.md$/;
const NOFOLLOW = constants.O_NOFOLLOW ?? 0;

function assertInside(root, rel) {
  if (typeof rel !== "string" || rel.length === 0 || rel.includes("\0") || isAbsolute(rel)) {
    throw new Error(`Refused path ${rel}`);
  }
  const rootResolved = resolve(root);
  const target = resolve(rootResolved, rel);
  const relToRoot = relative(rootResolved, target);
  if (
    relToRoot === "" ||
    relToRoot === ".." ||
    relToRoot.startsWith(`..${sep}`) ||
    isAbsolute(relToRoot)
  ) {
    throw new Error(`Refused path ${rel}`);
  }
  return { rel: relToRoot.split(sep).join("/"), target };
}

function ensureRealDirectory(root, rel) {
  const checked = assertInside(root, rel);
  let stat;
  try {
    stat = lstatSync(checked.target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    mkdirSync(checked.target);
    stat = lstatSync(checked.target);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Refused directory ${checked.rel}`);
  }
}

function prepareWrite(root, rel, allow) {
  const checked = assertInside(root, rel);
  if (!allow(checked.rel)) throw new Error(`Refused path ${checked.rel}`);
  const parentRel = checked.rel.split("/").slice(0, -1).join("/");
  if (parentRel) {
    const parent = assertInside(root, parentRel);
    const parentStat = lstatSync(parent.target);
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw new Error(`Refused directory ${parent.rel}`);
    }
  }
  try {
    const stat = lstatSync(checked.target);
    if (stat.isSymbolicLink()) throw new Error(`Refused symlink ${checked.rel}`);
    if (!stat.isFile()) throw new Error(`Refused non-file ${checked.rel}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return checked;
}

function writePrepared(checked, text) {
  const fd = openSync(
    checked.target,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | NOFOLLOW,
    0o644,
  );
  try {
    writeFileSync(fd, text);
  } catch (error) {
    if (error.code === "ELOOP") throw new Error(`Refused symlink ${checked.rel}`);
    throw error;
  } finally {
    closeSync(fd);
  }
}

function readRegular(root, rel, allow) {
  const checked = prepareWrite(root, rel, allow);
  let fd;
  try {
    fd = openSync(checked.target, constants.O_RDONLY | NOFOLLOW);
  } catch (error) {
    if (error.code === "ELOOP") throw new Error(`Refused symlink ${checked.rel}`);
    throw error;
  }
  try {
    return readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
}

function allowOutput(rel) {
  return rel === DIFF_REL || rel === ENTRY_REL || rel === PR_REL;
}

function allowLive(rel) {
  return rel === GUARD_REL || SKILL_FILE.test(rel);
}

function allowManifest(rel) {
  return rel === MANIFEST_REL;
}

export function runDemo({
  root,
  mode = "dry-run",
  applyAllowed = false,
  fixturePath = join(root, FIXTURE_REL),
} = {}) {
  if (mode === "revert") return revert(root);
  const fixture = parseFixture(readFileSync(fixturePath, "utf8"));
  const guardBefore = readRegular(root, GUARD_REL, allowLive);
  const skillBefore = readRegular(root, fixture.skillFile, allowLive);
  const proposal = buildProposal(fixture, guardBefore, skillBefore);
  ensureRealDirectory(root, "demo");
  ensureRealDirectory(root, "demo/drift-watcher");
  const outputs = [
    prepareWrite(root, DIFF_REL, allowOutput),
    prepareWrite(root, ENTRY_REL, allowOutput),
    prepareWrite(root, PR_REL, allowOutput),
  ];
  writePrepared(outputs[0], proposal.diff);
  writePrepared(outputs[1], `${JSON.stringify(proposal.entry, null, 2)}\n`);
  writePrepared(outputs[2], proposal.prBody);

  if (mode === "dry-run") {
    const guardAfter = readRegular(root, GUARD_REL, allowLive);
    const skillAfter = readRegular(root, fixture.skillFile, allowLive);
    if (guardAfter !== guardBefore || skillAfter !== skillBefore) {
      throw new Error("Dry run edited a live guard or skill file.");
    }
    return {
      exitCode: 0,
      summary: [
        "SIMULATED dry run. Not a real Next.js deprecation.",
        "Claim status: not verified.",
        `Left ${GUARD_REL} unchanged.`,
        `Left ${fixture.skillFile} unchanged.`,
        `Wrote ${DIFF_REL}`,
        `Wrote ${ENTRY_REL}`,
        `Wrote ${PR_REL}`,
      ].join("\n"),
    };
  }

  if (mode !== "apply") throw new Error(`Unknown mode ${mode}`);
  if (!applyAllowed) {
    return {
      exitCode: 1,
      summary: [
        "Refused to apply. Set DRIFT_WATCHER_APPLY=1 to edit the live files.",
        `Left ${GUARD_REL} unchanged.`,
        `Left ${fixture.skillFile} unchanged.`,
        "The SIMULATED diff is still only under demo/drift-watcher/.",
      ].join("\n"),
    };
  }
  if (existsSync(join(root, MANIFEST_REL))) {
    return {
      exitCode: 1,
      summary: "Already applied. Run --revert before applying again.",
    };
  }
  const manifestBody = `${JSON.stringify(
    {
      simulated: true,
      label: "SIMULATED",
      files: {
        [GUARD_REL]: guardBefore,
        [fixture.skillFile]: skillBefore,
      },
    },
    null,
    2,
  )}\n`;
  const writes = [
    { checked: prepareWrite(root, MANIFEST_REL, allowManifest), text: manifestBody },
    { checked: prepareWrite(root, GUARD_REL, allowLive), text: proposal.guardrailsText },
    { checked: prepareWrite(root, fixture.skillFile, allowLive), text: proposal.skillText },
  ];
  for (const item of writes) writePrepared(item.checked, item.text);
  return {
    exitCode: 0,
    summary: [
      "SIMULATED apply. Not a real Next.js deprecation.",
      `Updated ${GUARD_REL} and ${fixture.skillFile}.`,
      "Revert with: node scripts/drift-watcher/run-demo.mjs --revert",
    ].join("\n"),
  };
}

function revert(root) {
  const manifestPath = join(root, MANIFEST_REL);
  if (!existsSync(manifestPath)) {
    return {
      exitCode: 1,
      summary: "Nothing to revert. No apply manifest.",
    };
  }
  const manifest = JSON.parse(readRegular(root, MANIFEST_REL, allowManifest));
  if (manifest.label !== "SIMULATED" || manifest.simulated !== true) {
    throw new Error("Apply manifest is not marked SIMULATED.");
  }
  if (
    manifest.files == null ||
    typeof manifest.files !== "object" ||
    Array.isArray(manifest.files)
  ) {
    throw new Error("Apply manifest files must be an object.");
  }
  const writes = Object.entries(manifest.files).map(([rel, text]) => {
    if (typeof text !== "string") throw new Error(`Refused path ${rel}`);
    return { checked: prepareWrite(root, rel, allowLive), text };
  });
  for (const item of writes) writePrepared(item.checked, item.text);
  rmSync(manifestPath);
  return {
    exitCode: 0,
    summary: `Reverted ${Object.keys(manifest.files).join(", ")}.`,
  };
}

function isCli(metaUrl) {
  if (!process.argv[1]) return false;
  return metaUrl === pathToFileURL(process.argv[1]).href;
}

if (isCli(import.meta.url)) {
  const mode = process.argv.includes("--revert")
    ? "revert"
    : process.argv.includes("--apply")
      ? "apply"
      : "dry-run";
  try {
    const result = runDemo({
      root: process.cwd(),
      mode,
      applyAllowed: process.env.DRIFT_WATCHER_APPLY === "1",
    });
    console.log(result.summary);
    process.exit(result.exitCode);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
