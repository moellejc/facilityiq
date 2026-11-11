#!/usr/bin/env node
// Deprecated Next.js APIs and UI anti-patterns. Rules live in .cursor/guardrails.json.
import {
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
} from "./lib.mjs";

function scan(config, file, text) {
  const out = [];
  const client = isUseClient(text);
  for (const rule of config.deprecated) {
    if (!matchesAny(file, rule.files)) continue;
    if (rule.onlyWhen === "use-client" && !client) continue;
    const re = new RegExp(rule.pattern, "g");
    let match;
    while ((match = re.exec(text))) {
      out.push(
        finding(
          "error",
          rule.id,
          file,
          lineOf(text, match.index),
          rule.message,
          rule.skill,
          rule.standard,
        ),
      );
      if (match.index === re.lastIndex) re.lastIndex++;
    }
  }
  return out;
}

export function checkDeprecated(
  config = loadConfig(),
  files = changedFiles(config),
  readFn = read,
  useRatchet = true,
) {
  const out = [];
  for (const file of files) {
    if (!/\.(tsx?|jsx?|mjs)$/.test(file) && !file.endsWith(".env.example")) continue;
    const current = scan(config, file, readFn(file));
    out.push(
      ...(useRatchet
        ? ratchet(config, file, current, (text) => scan(config, file, text))
        : current),
    );
  }
  return out;
}

if (isCli(import.meta.url)) {
  const findings = checkDeprecated();
  console.log(renderFindings("Deprecated APIs and anti-patterns", findings));
  process.exit(findings.some((item) => item.level === "error") ? 1 : 0);
}
