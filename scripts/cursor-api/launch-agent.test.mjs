import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertRunId,
  assertStartingRef,
  buildLaunchBody,
  call,
  parseArgs,
  redact,
  runPath,
  statusSummary,
  steerSummary,
  toPrintedJson,
} from "./launch-agent.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "launch-agent.mjs");
const SECRET = "cursor_test_key_do_not_leak";

function run(args, key) {
  const env = { ...process.env };
  delete env.CURSOR_API_KEY;
  if (key !== undefined) env.CURSOR_API_KEY = key;
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env });
}

test("plan launch never pushes the starting ref and does not open a PR", () => {
  const body = buildLaunchBody({
    ticket: "FAIQ-35",
    text: "Document the flow",
    agentMode: false,
    startingRef: "main",
  });
  assert.equal(body.mode, "plan");
  assert.equal(body.autoCreatePR, false);
  assert.equal(body.workOnCurrentBranch, false);
  assert.deepEqual(Object.keys(body).sort(), [
    "autoCreatePR",
    "mode",
    "name",
    "prompt",
    "repos",
    "workOnCurrentBranch",
  ]);
  assert.deepEqual(body.repos, [
    { url: "https://github.com/moellejc/facilityiq", startingRef: "main" },
  ]);
  assert.match(body.prompt.text, /feature\/faiq-35-<slug>/);
  assert.match(body.prompt.text, /Do not edit files/);
  assert.match(body.prompt.text, /Never merge/);
  assert.equal(JSON.stringify(body).includes("CURSOR_API_KEY"), false);
  assert.equal(JSON.stringify(body).includes("envVars"), false);
});

test("agent mode still refuses workOnCurrentBranch and says to stop without approval", () => {
  const body = buildLaunchBody({
    ticket: "FAIQ-35",
    text: "Document the flow",
    agentMode: true,
    startingRef: "feature/faiq-12-scenario-compare",
  });
  assert.equal(body.mode, "agent");
  assert.equal(body.autoCreatePR, true);
  assert.equal(body.workOnCurrentBranch, false);
  assert.equal(body.repos[0].startingRef, "feature/faiq-12-scenario-compare");
  assert.match(body.prompt.text, /stop without editing/);
});

test("rejects tickets, refs, and flags that could retarget the push", () => {
  assert.throws(() => buildLaunchBody({ ticket: "FAIQ", text: "x" }), /FAIQ-35/);
  assert.throws(() => assertStartingRef("https://evil.example/repo"), /branch name/);
  assert.throws(() => assertStartingRef("../main"), /branch name/);
  assert.throws(() => assertStartingRef("--force"), /branch name/);
  assert.throws(
    () => parseArgs(["launch", "FAIQ-35", "text", "--on-current-branch"]),
    /unknown flag/,
  );
  assert.deepEqual(parseArgs(["launch", "FAIQ-35", "text", "--agent", "--ref", "feature/parent"]), {
    cmd: "launch",
    ticket: "FAIQ-35",
    text: "text",
    agentMode: true,
    startingRef: "feature/parent",
  });
});

test("redacts the key if an error body echoes it", () => {
  assert.equal(
    redact(`unauthorized ${SECRET} trailing`, SECRET),
    "unauthorized [redacted] trailing",
  );
});

test("help does not need a key and says the command is untested", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /UNTESTED/);
  assert.equal(result.stdout.includes(SECRET), false);
  assert.equal(result.stderr.includes(SECRET), false);
});

test("a real command without a key exits 2 and does not call the network", () => {
  const result = run(["launch", "FAIQ-35", "Document the flow"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Set CURSOR_API_KEY/);
  assert.equal(result.stdout.includes("api.cursor.com"), false);
  assert.equal(result.stderr.includes("api.cursor.com"), false);
});

const AGENT = "bc-00000000-0000-0000-0000-000000000001";
const RUN = "run-00000000-0000-0000-0000-000000000001";

test("call redacts an error body and does not fetch when workOnCurrentBranch is true", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: false, status: 500, text: async () => `leaked ${SECRET}` };
  };
  await assert.rejects(
    () => call("POST", "/v1/agents", { workOnCurrentBranch: true }, SECRET, fetchImpl),
    /refusing to send workOnCurrentBranch true/,
  );
  assert.equal(calls, 0);

  await assert.rejects(
    () => call("GET", "/v1/agents/" + AGENT, undefined, SECRET, fetchImpl),
    (error) => {
      assert.equal(error.message.includes(SECRET), false);
      assert.match(error.message, /\[redacted\]/);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("a latestRunId that is not a run id is rejected and is not put in a URL", () => {
  assert.equal(runPath(AGENT, RUN), `/v1/agents/${AGENT}/runs/${RUN}`);
  assert.throws(() => runPath(AGENT, SECRET), /run id/);
  try {
    runPath(AGENT, SECRET);
  } catch (error) {
    assert.equal(error.message.includes(SECRET), false);
  }
  assert.throws(() => assertRunId("../etc/passwd"), /run id/);
});

test("steer and status success text drops unknown fields and redacts the key", () => {
  const steered = steerSummary({
    delivery: "steered",
    runId: RUN,
    extra: SECRET,
    prompt: { text: SECRET },
  });
  const steeredText = toPrintedJson(steered, SECRET);
  assert.equal(steeredText.includes(SECRET), false);
  assert.deepEqual(JSON.parse(steeredText), { untested: true, delivery: "steered", runId: RUN });

  const status = statusSummary(
    { status: "IDLE", latestRunId: SECRET, token: SECRET },
    {
      status: "FINISHED",
      result: `ready ${SECRET}`,
      git: {
        branches: [
          { prUrl: "https://github.com/moellejc/facilityiq/pull/4" },
          { prUrl: `https://github.com/moellejc/facilityiq/pull/4?key=${SECRET}` },
        ],
      },
    },
  );
  const statusText = toPrintedJson(status, SECRET);
  assert.equal(statusText.includes(SECRET), false);
  assert.match(statusText, /\[redacted\]/);
  assert.deepEqual(JSON.parse(statusText).pr, ["https://github.com/moellejc/facilityiq/pull/4"]);
  assert.equal(JSON.parse(statusText).agent, "IDLE");
});

test("invalid ids fail before any request and do not echo the key", () => {
  const badTicket = run(["launch", "not-a-ticket", "text"], SECRET);
  assert.equal(badTicket.status, 2);
  assert.equal(`${badTicket.stdout}${badTicket.stderr}`.includes(SECRET), false);

  const badAgent = run(["status", "bc-not-a-uuid"], SECRET);
  assert.equal(badAgent.status, 2);
  assert.match(badAgent.stderr, /agent id/);
  assert.equal(`${badAgent.stdout}${badAgent.stderr}`.includes(SECRET), false);
});
