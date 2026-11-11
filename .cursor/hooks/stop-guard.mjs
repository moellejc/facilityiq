// stop hook. When the agent finishes, run the pre-PR guard. On failure, send the report
// back so the agent fixes it before a human sees it. loop_limit in hooks.json caps retries.
// GUARD_SCOPE=auto lets an infra-only change pass and keeps product diffs on the default scope.
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || "{}");
if (input.status && input.status !== "completed") process.exit(0);

const result = spawnSync("node", ["scripts/guard/pre-pr.mjs"], {
  encoding: "utf8",
  env: { ...process.env, GUARD_SCOPE: process.env.GUARD_SCOPE || "auto" },
});
if (result.status === 0) {
  process.stdout.write("{}");
} else {
  const report = (result.stdout || result.stderr || "pre-PR guard failed to run").slice(0, 6000);
  process.stdout.write(
    JSON.stringify({
      followup_message: `The pre-PR guard failed. Fix every error, then stop. Do not weaken .cursor/guardrails.json to make it pass.\n\n${report}`,
    }),
  );
}
