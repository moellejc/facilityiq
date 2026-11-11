#!/usr/bin/env node
// Boundary guard: allowed paths, protected paths, import layering, new dependencies.
import {
  baseFileText,
  changedFiles,
  finding,
  isCli,
  isUseClient,
  lineOf,
  loadConfig,
  matchesAny,
  ratchet,
  read,
  renderFindings,
  resolveScope,
} from "./lib.mjs";

const IMPORT_RE =
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

export function checkBoundaries(
  config = loadConfig(),
  files = changedFiles(config),
  readFn = read,
  env = process.env,
) {
  const out = [];
  const scopeName = resolveScope(config, files, env);
  const scope = config.scopes[scopeName];
  if (!scope) {
    return [
      finding(
        "error",
        "unknown-scope",
        "(env)",
        0,
        `GUARD_SCOPE="${scopeName}" is not defined in .cursor/guardrails.json`,
        "facilityiq-coding-conventions",
        "guard config",
      ),
    ];
  }

  for (const file of files) {
    if (matchesAny(file, config.protected) && scopeName !== "infra") {
      out.push(
        finding(
          "error",
          "protected-path",
          file,
          0,
          "Protected path. Set GUARD_SCOPE=infra for a reviewed infra change. Do not weaken this file from a product task.",
          "facilityiq-ci-cd",
          "CI Process §1; Coding Conventions §8; GitFlow §6",
        ),
      );
      continue;
    }
    if (!matchesAny(file, scope.allow)) {
      out.push(
        finding(
          "error",
          "outside-scope",
          file,
          0,
          `Outside the allowed paths for scope "${scopeName}". Split the change, or set a wider GUARD_SCOPE that already exists in .cursor/guardrails.json.`,
          "facilityiq-coding-conventions",
          "SDLC Best Practices §3",
        ),
      );
    }
  }

  const scanImports = (file, text) => {
    const found = [];
    const client = isUseClient(text);
    for (const rule of config.importRules) {
      const applies =
        rule.appliesTo === "use-client"
          ? client
          : Array.isArray(rule.appliesTo) && matchesAny(file, rule.appliesTo);
      if (!applies) continue;
      const re = new RegExp(IMPORT_RE.source, "g");
      let match;
      while ((match = re.exec(text))) {
        const spec = match[1] || match[2] || match[3];
        if (rule.forbid.some((pattern) => new RegExp(pattern).test(spec))) {
          found.push(
            finding(
              "error",
              rule.id,
              file,
              lineOf(text, match.index),
              `${rule.message} (imports "${spec}")`,
              rule.skill,
              rule.standard,
            ),
          );
        }
      }
    }
    return found;
  };

  for (const file of files.filter((item) => /\.(tsx?|jsx?)$/.test(item))) {
    out.push(
      ...ratchet(config, file, scanImports(file, readFn(file)), (text) => scanImports(file, text)),
    );
  }

  if (files.includes("package.json") && env.GUARD_ALLOW_DEPS !== "1") {
    const before = JSON.parse(baseFileText("package.json", config) || "{}");
    const after = JSON.parse(readFn("package.json"));
    for (const key of ["dependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries(after[key] ?? {})) {
        if ((before[key] ?? {})[name] !== version) {
          out.push(
            finding(
              "error",
              "new-dependency",
              "package.json",
              0,
              `${key}.${name}@${version} is new or changed. ${config.newDependencyPolicy}`,
              "facilityiq-dependency-upgrades",
              "Coding Conventions §2",
            ),
          );
        }
      }
    }
  }
  return out;
}

if (isCli(import.meta.url)) {
  const findings = checkBoundaries();
  console.log(
    renderFindings(`Boundaries (scope: ${resolveScope(loadConfig(), changedFiles())})`, findings),
  );
  process.exit(findings.some((item) => item.level === "error") ? 1 : 0);
}
