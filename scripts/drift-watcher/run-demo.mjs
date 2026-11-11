#!/usr/bin/env node
// Dry run of the Next.js drift watcher against the SIMULATED fixture.
// Default: write demo/drift-watcher outputs only.
// Edit .cursor/guardrails.json only with --apply and DRIFT_WATCHER_APPLY=1.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildProposal, parseFixture } from "./propose.mjs";

const FIXTURE_REL = "demo/drift-watcher/SIMULATED-unstable-cache-release.md";
const DIFF_REL = "demo/drift-watcher/SIMULATED.diff";
const ENTRY_REL = "demo/drift-watcher/SIMULATED-deprecated-entry.json";
const PR_REL = "demo/drift-watcher/SAMPLE-PR.md";
const MANIFEST_REL = "demo/drift-watcher/.apply-manifest.json";
const GUARD_REL = ".cursor/guardrails.json";

export function runDemo({
  root,
  mode = "dry-run",
  applyAllowed = false,
  fixturePath = join(root, FIXTURE_REL),
} = {}) {
  if (mode === "revert") return revert(root);
  const fixture = parseFixture(readFileSync(fixturePath, "utf8"));
  const guardPath = join(root, GUARD_REL);
  const skillPath = join(root, fixture.skillFile);
  const guardBefore = readFileSync(guardPath, "utf8");
  const skillBefore = readFileSync(skillPath, "utf8");
  const proposal = buildProposal(fixture, guardBefore, skillBefore);
  const outDir = join(root, "demo/drift-watcher");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, DIFF_REL), proposal.diff);
  writeFileSync(join(root, ENTRY_REL), `${JSON.stringify(proposal.entry, null, 2)}\n`);
  writeFileSync(join(root, PR_REL), proposal.prBody);

  if (mode === "dry-run") {
    const guardAfter = readFileSync(guardPath, "utf8");
    const skillAfter = readFileSync(skillPath, "utf8");
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
  const manifestPath = join(root, MANIFEST_REL);
  if (existsSync(manifestPath)) {
    return {
      exitCode: 1,
      summary: "Already applied. Run --revert before applying again.",
    };
  }
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
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
    )}\n`,
  );
  writeFileSync(guardPath, proposal.guardrailsText);
  writeFileSync(skillPath, proposal.skillText);
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
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.label !== "SIMULATED" || manifest.simulated !== true) {
    throw new Error("Apply manifest is not marked SIMULATED.");
  }
  for (const [rel, text] of Object.entries(manifest.files)) {
    writeFileSync(join(root, rel), text);
  }
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
