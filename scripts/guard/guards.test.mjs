// Tests for the guards themselves. Run: node --test scripts/guard/guards.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkBoundaries } from "./boundaries.mjs";
import { checkDeprecated } from "./deprecated-apis.mjs";
import { loadConfig, ratchetFindings } from "./lib.mjs";
import { checkTestStrength } from "./test-strength.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

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

test("ratchet keeps only the violations added above the baseline count", () => {
  const base = [{ rule: "adhoc-tofixed" }, { rule: "adhoc-tofixed" }];
  const same = [{ rule: "adhoc-tofixed" }, { rule: "adhoc-tofixed" }];
  const more = [...same, { rule: "adhoc-tofixed" }];
  assert.equal(ratchetFindings(same, base).length, 0);
  assert.equal(ratchetFindings(more, base).length, 1);
});

test("ci.yml does not pin a pnpm version beside packageManager", () => {
  const yml = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.match(pkg.packageManager, /^pnpm@\d+\.\d+\.\d+/);
  const step = yml.split("pnpm/action-setup")[1].split("- name:")[0];
  assert.doesNotMatch(step, /\n\s*version:/);
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
