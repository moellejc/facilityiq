// Tests for the guards themselves. Run: node --test scripts/guard/guards.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { checkBoundaries } from "./boundaries.mjs";
import { checkDeprecated } from "./deprecated-apis.mjs";
import { driftProblems } from "./drift-check.mjs";
import { loadConfig, ratchetFindings } from "./lib.mjs";
import { checkTestStrength } from "./test-strength.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function repoFile(file) {
  return new URL(`../../${file}`, import.meta.url);
}

process.env.GUARD_NO_RATCHET = "1";
const config = loadConfig();
const files = (map) => ({ list: Object.keys(map), read: (file) => map[file] });

test("flags Pages Router APIs and sync params in an App Router page", () => {
  const { list, read } = files({
    "src/app/(dashboard)/finance/x/page.tsx": `import { useRouter } from "next/router";\nexport async function getServerSideProps() {}\nexport default function P({ params }: { params: { id: string } }) { return null }`,
  });
  const rules = checkDeprecated(config, list, read, false)
    .map((item) => item.rule)
    .sort();
  assert.deepEqual(rules, ["gssp", "next-router", "sync-params"]);
});

test("does not flag a correct Next 16 page", () => {
  const { list, read } = files({
    "src/app/(dashboard)/finance/x/page.tsx": `export default async function P({ searchParams }: { searchParams: Promise<{ from?: string }> }) { await searchParams; return null }`,
  });
  assert.equal(checkDeprecated(config, list, read, false).length, 0);
});

test("async default export is only an error in a use client file", () => {
  const server = files({
    "src/components/a.tsx": `export default async function A() { return null }`,
  });
  const client = files({
    "src/components/a.tsx": `"use client";\nexport default async function A() { return null }`,
  });
  assert.equal(checkDeprecated(config, server.list, server.read, false).length, 0);
  assert.equal(checkDeprecated(config, client.list, client.read, false).length, 1);
});

test("client component may import a Server Action but not a service", () => {
  const ok = files({
    "src/components/a.tsx": `"use client";\nimport { go } from "@/server/actions/session";`,
  });
  const bad = files({
    "src/components/a.tsx": `"use client";\nimport { go } from "@/server/services/analytics-service";`,
  });
  assert.equal(checkBoundaries(config, ok.list, ok.read, {}).length, 0);
  assert.equal(checkBoundaries(config, bad.list, bad.read, {})[0].rule, "client-imports-server");
});

test("a page that imports @/db or @/db/schema is a boundary error", () => {
  const page = files({
    "src/app/(dashboard)/x/page.tsx": `import { db } from "@/db";\nimport { financialMetrics } from "@/db/schema";\nexport default function P() { return null }\n`,
  });
  const hits = checkBoundaries(config, page.list, page.read, { GUARD_SCOPE: "default" }).filter(
    (item) => item.rule === "route-or-page-imports-db",
  );
  assert.equal(hits.length, 2);
});

test("a page that imports a repository is a boundary error", () => {
  const page = files({
    "src/app/(dashboard)/x/page.tsx": `import { listAreas } from "@/server/repositories/facilities";\nexport default function P() { return null }\n`,
  });
  const rules = checkBoundaries(config, page.list, page.read, { GUARD_SCOPE: "default" }).map(
    (item) => item.rule,
  );
  assert.ok(rules.includes("ui-imports-repository"));
});

test("protected paths and out-of-scope files are blocked", () => {
  const sample = files({ ".github/workflows/ci.yml": "", "src/lib/auth/index.ts": "" });
  const rules = checkBoundaries(config, sample.list, sample.read, { GUARD_SCOPE: "finance-route" })
    .map((item) => item.rule)
    .sort();
  assert.deepEqual(rules, ["outside-scope", "protected-path"]);
});

test("infra-only diffs resolve to infra; a product file keeps protected paths blocked", () => {
  const infra = files({ ".github/workflows/ci.yml": "name: CI\n" });
  assert.equal(checkBoundaries(config, infra.list, infra.read, { GUARD_SCOPE: "auto" }).length, 0);
  const mixed = files({
    ".github/workflows/ci.yml": "name: CI\n",
    "src/lib/format.ts": "export const a = 1\n",
  });
  const rules = checkBoundaries(config, mixed.list, mixed.read, { GUARD_SCOPE: "auto" }).map(
    (item) => item.rule,
  );
  assert.ok(rules.includes("protected-path"));
});

test("unknown scope fails closed", () => {
  const result = checkBoundaries(config, [], () => "", { GUARD_SCOPE: "nope" });
  assert.equal(result[0].rule, "unknown-scope");
});

test("finance-route includes the shared analytics view and breadcrumb shell, and excludes API routes", () => {
  const allow = config.scopes["finance-route"].allow;
  assert.ok(allow.includes("src/components/dashboard/facility-analytics.tsx"));
  assert.ok(allow.includes("src/components/layout/app-shell.tsx"));
  assert.equal(
    allow.some((glob) => glob === "src/app/api/**" || glob === "src/app/**"),
    false,
  );

  const inScope = files({
    "src/components/dashboard/facility-analytics.tsx": "export const a = 1\n",
    "src/components/layout/app-shell.tsx": "export const b = 1\n",
  });
  const inRules = checkBoundaries(config, inScope.list, inScope.read, {
    GUARD_SCOPE: "finance-route",
  }).map((item) => item.rule);
  assert.equal(inRules.includes("outside-scope"), false);

  const api = files({
    "src/app/api/finance/route.ts": "export function GET() { return null }\n",
  });
  const apiRules = checkBoundaries(config, api.list, api.read, {
    GUARD_SCOPE: "finance-route",
  }).map((item) => item.rule);
  assert.ok(apiRules.includes("outside-scope"));
});

test("a server component cannot import @/db, drizzle-orm, or pg", () => {
  const component = files({
    "src/components/finance/cost-table.tsx": `import { db } from "@/db";\nimport { sql } from "drizzle-orm";\nimport pg from "pg";\nexport function CostTable() { return null }\n`,
  });
  const hits = checkBoundaries(config, component.list, component.read, {
    GUARD_SCOPE: "default",
  }).filter((item) => item.rule === "component-imports-db");
  assert.equal(hits.length, 3);
});

test("no current component file imports @/db, drizzle-orm, or pg", () => {
  const rule = config.importRules.find((item) => item.id === "component-imports-db");
  assert.ok(rule, "component-imports-db is not configured");
  const listed = execFileSync("git", ["ls-files", "-z", "--", "src/components"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => /\.(tsx?|jsx?)$/.test(file));
  const offenders = [];
  for (const file of listed) {
    const hits = checkBoundaries(config, [file], (path) => readFileSync(repoFile(path), "utf8"), {
      GUARD_SCOPE: "default",
    }).filter((item) => item.rule === "component-imports-db");
    if (hits.length) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("a new or changed dependency fails unless GUARD_ALLOW_DEPS=1", () => {
  const base = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const unchanged = checkBoundaries(config, ["package.json"], () => JSON.stringify(base), {
    GUARD_SCOPE: "infra",
  }).filter((item) => item.rule === "new-dependency");
  assert.equal(unchanged.length, 0);

  const changed = JSON.parse(JSON.stringify(base));
  changed.dependencies = {
    ...changed.dependencies,
    next: "99.0.0",
    "example-new-dep": "1.2.3",
  };
  const readPkg = () => JSON.stringify(changed);
  const blocked = checkBoundaries(config, ["package.json"], readPkg, {
    GUARD_SCOPE: "infra",
  }).filter((item) => item.rule === "new-dependency");
  assert.ok(blocked.some((item) => item.message.includes("dependencies.next@99.0.0")));
  assert.ok(blocked.some((item) => item.message.includes("dependencies.example-new-dep@1.2.3")));
  const allowed = checkBoundaries(config, ["package.json"], readPkg, {
    GUARD_SCOPE: "infra",
    GUARD_ALLOW_DEPS: "1",
  }).filter((item) => item.rule === "new-dependency");
  assert.equal(allowed.length, 0);
});

test("drift check fails on a verifiedAgainst mismatch and on a missing skill", () => {
  const mismatch = driftProblems(
    { verifiedAgainst: { next: "15" }, deprecated: [], importRules: [] },
    { dependencies: { next: "16.4.0" }, devDependencies: {} },
  );
  assert.ok(mismatch.some((problem) => problem.includes("next") && problem.includes("16.4.0")));

  const aligned = driftProblems(
    { verifiedAgainst: { next: "16" }, deprecated: [], importRules: [] },
    { dependencies: { next: "^16.4.0" }, devDependencies: {} },
  );
  assert.deepEqual(aligned, []);

  const missing = driftProblems(
    {
      verifiedAgainst: {},
      deprecated: [{ skill: "facilityiq-not-a-real-skill" }],
      importRules: [{ skill: "facilityiq-unit-testing" }],
    },
    { dependencies: {}, devDependencies: {} },
  );
  assert.deepEqual(missing, ['Rule references missing skill "facilityiq-not-a-real-skill".']);
});

test("a worker change without a test fails logic-without-tests", () => {
  const only = files({ "worker/index.ts": "export const run = () => 1\n" });
  assert.equal(checkTestStrength(config, only.list, only.read)[0].rule, "logic-without-tests");
});

test("logic change without a test fails; assertion-free test fails; .only fails", () => {
  const logicOnly = files({ "src/lib/analytics/cost.ts": "export const a = 1" });
  assert.equal(
    checkTestStrength(config, logicOnly.list, logicOnly.read)[0].rule,
    "logic-without-tests",
  );

  const withTests = files({
    "src/lib/analytics/cost.ts": "export const a = 1",
    "tests/unit/cost.test.ts": `it.only("x", () => { expect(1).toBe(1) });\nit("no assert", () => { const a = 1 });`,
  });
  const rules = checkTestStrength(config, withTests.list, withTests.read)
    .map((item) => item.rule)
    .sort();
  assert.ok(rules.includes("focused-or-skipped-only"));
  assert.ok(rules.includes("no-assertion"));
});

test("a strong test passes", () => {
  const withTests = files({
    "src/lib/analytics/cost.ts": "export const a = 1",
    "tests/unit/cost.test.ts": `it("sums labor", () => { expect(sum([1, 2])).toBe(3) });`,
  });
  assert.equal(
    checkTestStrength(config, withTests.list, withTests.read).filter(
      (item) => item.level === "error",
    ).length,
    0,
  );
});

test("identical fingerprints stay quiet and one extra copy of the same fingerprint is reported", () => {
  const base = [
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" },
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" },
  ];
  const same = [
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" },
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" },
  ];
  const more = [...same, { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" }];
  assert.equal(ratchetFindings(same, base).length, 0);
  assert.equal(ratchetFindings(more, base).length, 1);
});

test("a hit that replaces an earlier one fails the ratchet", () => {
  const base = [
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);" },
    { rule: "adhoc-tofixed", snippet: "const b = (2).toFixed(2);" },
  ];
  const replaced = [
    { rule: "adhoc-tofixed", snippet: "const c = (3).toFixed(2);" },
    { rule: "adhoc-tofixed", snippet: "const b = (2).toFixed(2);" },
  ];
  const kept = ratchetFindings(replaced, base);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].snippet, "const c = (3).toFixed(2);");
});

test("a hit inserted above the baseline hits is the one reported", () => {
  const base = [
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);", line: 10 },
    { rule: "adhoc-tofixed", snippet: "const b = (2).toFixed(2);", line: 11 },
  ];
  const inserted = [
    { rule: "adhoc-tofixed", snippet: "const c = (3).toFixed(2);", line: 9 },
    { rule: "adhoc-tofixed", snippet: "const a = (1).toFixed(2);", line: 11 },
    { rule: "adhoc-tofixed", snippet: "const b = (2).toFixed(2);", line: 12 },
  ];
  const kept = ratchetFindings(inserted, base);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].line, 9);
  assert.equal(kept[0].snippet, "const c = (3).toFixed(2);");
});

test("ci.yml does not pin a pnpm version beside packageManager", () => {
  const yml = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(pkg.packageManager, /^pnpm@\d+\.\d+\.\d+/);
  const step = yml.split("pnpm/action-setup")[1].split("- name:")[0];
  assert.doesNotMatch(step, /\n\s*version:/);
});

test("deploy grants packages:write only on the image job", () => {
  const yml = readFileSync(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const workflowPerms = yml.split(/^jobs:/m)[0];
  assert.match(workflowPerms, /permissions:\n {2}contents: read\n/);
  assert.doesNotMatch(workflowPerms, /packages:\s*write/);
  const image = yml.split(/^ {2}image:\n/m)[1].split(/^ {2}staging:\n/m)[0];
  assert.match(image, /packages:\s*write/);
  assert.doesNotMatch(yml.split(/^ {2}staging:\n/m)[1], /packages:\s*write/);
});

test("deploy image scan pins trivy-action v0.36.0", () => {
  const yml = readFileSync(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const uses = [...yml.matchAll(/^\s*uses:\s*(\S+)/gm)].map((match) => match[1]);
  // v0.28.0 installs aquasecurity/setup-trivy@v0.2.1. That tag no longer exists,
  // so the image job fails during action resolution before any step runs.
  // v0.36.0 pins setup-trivy to commit 3fb12ec (tag v0.2.6), which still resolves.
  assert.deepEqual(
    uses.filter((ref) => ref.startsWith("aquasecurity/trivy-action@")),
    ["aquasecurity/trivy-action@v0.36.0"],
  );
  assert.equal(uses.includes("aquasecurity/setup-trivy@v0.2.1"), false);
});

test("unchanged baseline debt is silent and one new hit is reported", () => {
  const script = `
    import { readFileSync } from "node:fs";
    import { checkDeprecated } from "./scripts/guard/deprecated-apis.mjs";
    import { checkBoundaries } from "./scripts/guard/boundaries.mjs";
    const config = JSON.parse(readFileSync(".cursor/guardrails.json", "utf8"));
    const ui = "src/components/charts/metric-charts.tsx";
    const uiText = readFileSync(ui, "utf8");
    const sameUi = checkDeprecated(config, [ui], () => uiText, true);
    if (sameUi.length !== 0) {
      console.error("expected no new toFixed findings", sameUi);
      process.exit(2);
    }
    const moreUi = checkDeprecated(config, [ui], () => uiText + "\\nconst n = (1).toFixed(2);\\n", true);
    if (!moreUi.some((item) => item.rule === "adhoc-tofixed")) process.exit(3);
    const route = "src/app/api/facilities/[id]/route.ts";
    const routeText = readFileSync(route, "utf8");
    const sameRoute = checkBoundaries(config, [route], () => routeText);
    if (sameRoute.some((item) => item.rule === "route-imports-repository")) {
      console.error(sameRoute);
      process.exit(4);
    }
    const extra = routeText + "\\nimport { extra } from \\"@/server/repositories/facilities\\";\\n";
    const moreRoute = checkBoundaries(config, [route], () => extra);
    if (moreRoute.filter((item) => item.rule === "route-imports-repository").length !== 1) process.exit(5);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: ROOT,
    env: {
      ...process.env,
      GUARD_NO_RATCHET: "0",
      GUARD_BASE: "origin/main",
      GUARD_SCOPE: "default",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

function runHook(script, input) {
  const result = spawnSync(process.execPath, [script], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("shell hook denies force-push, merge, and curl, and allows a normal push", () => {
  assert.equal(
    runHook(".cursor/hooks/guard-shell.mjs", { command: "git push --force origin main" })
      .permission,
    "deny",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-shell.mjs", { command: "gh pr merge 12" }).permission,
    "deny",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-shell.mjs", { command: "curl https://example.com" }).permission,
    "deny",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-shell.mjs", { command: "git push -u origin HEAD" }).permission,
    "allow",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-shell.mjs", { command: "pnpm install --frozen-lockfile" })
      .permission,
    "allow",
  );
});

test("replacing a baselined toFixed and inserting one above the old hits are both reported", () => {
  const script = `
    import { readFileSync } from "node:fs";
    import { checkDeprecated } from "./scripts/guard/deprecated-apis.mjs";
    const config = JSON.parse(readFileSync(".cursor/guardrails.json", "utf8"));
    const ui = "src/components/charts/metric-charts.tsx";
    const uiText = readFileSync(ui, "utf8");
    const replaced = uiText.replace(".toFixed(1)", ".toFixed(4)");
    const replacedHits = checkDeprecated(config, [ui], () => replaced, true).filter(
      (item) => item.rule === "adhoc-tofixed",
    );
    if (replacedHits.length !== 1 || !String(replacedHits[0].snippet).includes("toFixed(4)")) {
      console.error("replaced", replacedHits);
      process.exit(2);
    }
    const inserted = uiText.replace(
      '"use client";\\n',
      '"use client";\\nconst extra = (9).toFixed(3);\\n',
    );
    const insertedHits = checkDeprecated(config, [ui], () => inserted, true).filter(
      (item) => item.rule === "adhoc-tofixed",
    );
    if (insertedHits.length !== 1 || !String(insertedHits[0].snippet).includes("toFixed(3)")) {
      console.error("inserted", insertedHits);
      process.exit(3);
    }
    const baselineLine = uiText.split("\\n").findIndex((line) => line.includes(".toFixed(")) + 1;
    if (insertedHits[0].line >= baselineLine) {
      console.error("reported a baseline line", insertedHits[0].line, baselineLine);
      process.exit(4);
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: ROOT,
    env: {
      ...process.env,
      GUARD_NO_RATCHET: "0",
      GUARD_BASE: "origin/main",
      GUARD_SCOPE: "default",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("stop hook sends a follow-up when the guard fails and stays quiet when it passes", () => {
  const fail = spawnSync(process.execPath, [".cursor/hooks/stop-guard.mjs"], {
    cwd: ROOT,
    input: JSON.stringify({ status: "completed" }),
    encoding: "utf8",
    env: {
      ...process.env,
      GUARD_FILES: "src/components/charts/metric-charts.tsx",
      GUARD_NO_RATCHET: "1",
      GUARD_SCOPE: "default",
    },
  });
  assert.equal(fail.status, 0, fail.stderr);
  const body = JSON.parse(fail.stdout);
  assert.match(body.followup_message, /pre-PR guard failed/);
  assert.match(body.followup_message, /adhoc-tofixed/);

  const pass = spawnSync(process.execPath, [".cursor/hooks/stop-guard.mjs"], {
    cwd: ROOT,
    input: JSON.stringify({ status: "completed" }),
    encoding: "utf8",
    env: {
      ...process.env,
      GUARD_FILES: "README.md",
      GUARD_NO_RATCHET: "1",
      GUARD_SCOPE: "default",
    },
  });
  assert.equal(pass.status, 0, pass.stderr);
  assert.deepEqual(JSON.parse(pass.stdout), {});
});

test("read hook denies .env and allows .env.example", () => {
  assert.equal(
    runHook(".cursor/hooks/guard-read.mjs", { file_path: "/repo/.env" }).permission,
    "deny",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-read.mjs", { file_path: "/repo/.env.local" }).permission,
    "deny",
  );
  assert.equal(
    runHook(".cursor/hooks/guard-read.mjs", { file_path: "/repo/.env.example" }).permission,
    "allow",
  );
});
