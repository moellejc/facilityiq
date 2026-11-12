#!/usr/bin/env node
// Test-strength check: logic changes need tests that can fail.
// Tenancy coverage is a warning only. It does not prove organization isolation.
import {
  changedFiles,
  finding,
  isCli,
  lineOf,
  loadConfig,
  matchesAny,
  read,
  renderFindings,
} from "./lib.mjs";

const LOGIC = [
  "src/server/services/**",
  "src/server/repositories/**",
  "src/lib/**",
  "src/app/api/**/route.ts",
  "src/server/actions/**",
  "worker/**",
];
const WEAK =
  /expect\(\s*(true|false|1|0)\s*\)\.(toBe|toEqual)\(\s*\1\s*\)|\.toBeDefined\(\)|\.toBeTruthy\(\)|\.not\.toThrow\(\)/g;

export function checkTestStrength(
  config = loadConfig(),
  files = changedFiles(config),
  readFn = read,
) {
  const out = [];
  const logic = files.filter((file) => matchesAny(file, LOGIC) && !file.endsWith(".d.ts"));
  const tests = files.filter((file) => /^tests\/.*\.test\.tsx?$/.test(file));

  if (logic.length && !tests.length) {
    out.push(
      finding(
        "error",
        "logic-without-tests",
        logic[0],
        0,
        `${logic.length} logic file(s) changed and no test file changed. Add or update a test that fails without this change.`,
        "facilityiq-unit-testing",
        "Unit Test Standards §2 and §7; SDLC Best Practices §2",
      ),
    );
  }
  if (
    files.some((file) => file.startsWith("src/server/repositories/")) &&
    !tests.some(
      (file) =>
        /isolation|rls|integration/.test(file) ||
        /other organi[sz]ation|orgB|organizationB/i.test(readFn(file)),
    )
  ) {
    out.push(
      finding(
        "warn",
        "tenancy-test-missing",
        "src/server/repositories",
        0,
        "Advisory: a repository changed and this diff has no obvious org A / org B assertion. Isolation is proved by integration tests, not by this guard.",
        "facilityiq-multi-tenancy-rls",
        "Coding Conventions §7; Unit Test Standards §2 and §4 (advisory)",
      ),
    );
  }

  for (const file of tests) {
    const text = readFn(file);
    for (const match of text.matchAll(/\b(it|test|describe)\.(only|skip|todo)\b/g)) {
      out.push(
        finding(
          "error",
          `focused-or-skipped-${match[2]}`,
          file,
          lineOf(text, match.index),
          "Focused or skipped tests hide failures. Remove them before review.",
          "facilityiq-unit-testing",
          "Unit Test Standards §5 and §7",
        ),
      );
    }
    const blocks = [...text.matchAll(/\b(?:it|test)\(\s*(['"`])(.+?)\1/g)];
    blocks.forEach((block, index) => {
      const end = blocks[index + 1]?.index ?? text.length;
      const body = text.slice(block.index, end);
      const line = lineOf(text, block.index);
      if (!/\bexpect\(|\.rejects\.|assert\w*\(/.test(body)) {
        out.push(
          finding(
            "error",
            "no-assertion",
            file,
            line,
            `Test "${block[2]}" has no assertion, so it cannot fail.`,
            "facilityiq-unit-testing",
            "Unit Test Standards §7",
          ),
        );
      } else {
        const weak = (body.match(WEAK) || []).length;
        const strong = (body.match(/\bexpect\(/g) || []).length - weak;
        if (weak > 0 && strong <= 0) {
          out.push(
            finding(
              "warn",
              "weak-assertion",
              file,
              line,
              `Test "${block[2]}" only asserts existence or truthiness. Assert the exact value, code, or null.`,
              "facilityiq-unit-testing",
              "Unit Test Standards §3 and §5 (advisory)",
            ),
          );
        }
      }
    });
  }
  return out;
}

if (isCli(import.meta.url)) {
  const findings = checkTestStrength();
  console.log(renderFindings("Test strength", findings));
  process.exit(findings.some((item) => item.level === "error") ? 1 : 0);
}
