#!/usr/bin/env node
// Cursor Cloud Agents API (v1, public beta).
// UNTESTED against a live CURSOR_API_KEY. Local tests never call api.cursor.com.
// Request shape taken from https://cursor.com/docs/cloud-agent/api/endpoints
// on 2026-11-11. The API is a public beta and can change.
//
// The key is read only from the CURSOR_API_KEY environment variable.
// Do not pass it as an argument. This file never prints it.
// .env.example documents the name and leaves it commented out.
// The Next.js app, worker, Compose, and CI do not read it.
//
//   node scripts/cursor-api/launch-agent.mjs --help
//   CURSOR_API_KEY=... node scripts/cursor-api/launch-agent.mjs launch FAIQ-35 "text" [--agent] [--ref branch]
//   CURSOR_API_KEY=... node scripts/cursor-api/launch-agent.mjs status bc-...
//   CURSOR_API_KEY=... node scripts/cursor-api/launch-agent.mjs steer bc-... "follow-up"
//
// launch defaults to mode "plan" and autoCreatePR false.
// --agent is only for after a human approved the plan. It sets mode "agent"
// and autoCreatePR true. It still does not merge.
// workOnCurrentBranch is always false so the documented API behavior is a new
// branch, not a push onto startingRef (default main, because develop does not exist).

import { Buffer } from "node:buffer";
import { pathToFileURL } from "node:url";

const API = "https://api.cursor.com";
const REPO = "https://github.com/moellejc/facilityiq";
const TICKET_RE = /^FAIQ-\d+$/;
const AGENT_RE = /^bc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_RE = /^run-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PR_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/;
const AGENT_STATUS = new Set(["ACTIVE", "IDLE", "ARCHIVED"]);
const RUN_STATUS = new Set([
  "CREATING",
  "RUNNING",
  "WAITING_FOR_BACKGROUND_WORK",
  "FINISHED",
  "ERROR",
  "CANCELLED",
  "EXPIRED",
]);

export function usage() {
  return [
    "UNTESTED against a live CURSOR_API_KEY. This command does not merge.",
    "Set CURSOR_API_KEY in the environment. Never commit it and never pass it as an argument.",
    "",
    '  launch FAIQ-<n> "<ticket text>" [--agent] [--ref <branch>]',
    "  status <bc-id>",
    '  steer <bc-id> "<prompt>"',
    "",
    "Default mode is plan (no pull request). --agent opens a PR and still does not merge.",
    "startingRef defaults to main because develop does not exist. --ref does not push onto that branch.",
  ].join("\n");
}

export function redact(text, secret) {
  const value = String(text);
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
}

export function assertStartingRef(ref) {
  if (typeof ref !== "string" || ref.length < 1 || ref.length > 200) {
    throw new Error("starting ref must be a branch name, 1–200 characters");
  }
  if (
    ref.includes("..") ||
    ref.startsWith("-") ||
    ref.startsWith("/") ||
    ref.includes("//") ||
    /[\s:@]/.test(ref)
  ) {
    throw new Error("starting ref must be a branch name, not a URL or a flag");
  }
  return ref;
}

export function assertTicket(ticket) {
  if (!TICKET_RE.test(ticket ?? "")) throw new Error("ticket must look like FAIQ-35");
  return ticket;
}

export function assertAgentId(id) {
  if (!AGENT_RE.test(id ?? "")) throw new Error("agent id must look like bc-<uuid>");
  return id;
}

export function assertRunId(id) {
  if (!RUN_RE.test(id ?? "")) throw new Error("run id must look like run-<uuid>");
  return id;
}

export function runPath(agentId, latestRunId) {
  const agent = assertAgentId(agentId);
  if (latestRunId == null || latestRunId === "") return null;
  const runId = assertRunId(latestRunId);
  return `/v1/agents/${agent}/runs/${runId}`;
}

function allowId(value, pattern) {
  return pattern.test(value ?? "") ? value : null;
}

function assertText(text) {
  if (typeof text !== "string" || text.trim() === "" || text.startsWith("--")) {
    throw new Error("ticket text is required");
  }
  if (text.length > 20000) throw new Error("ticket text is too long");
  return text.trim();
}

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") return { help: true };
  if (cmd === "launch") {
    let agentMode = false;
    let startingRef = "main";
    const positionals = [];
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === "--agent") agentMode = true;
      else if (arg === "--ref") {
        const next = rest[++i];
        if (!next) throw new Error("--ref needs a branch name");
        startingRef = assertStartingRef(next);
      } else if (arg.startsWith("--")) throw new Error(`unknown flag ${arg}`);
      else positionals.push(arg);
    }
    if (positionals.length !== 2) throw new Error("launch needs FAIQ-<n> and the ticket text");
    return {
      cmd,
      ticket: assertTicket(positionals[0]),
      text: assertText(positionals[1]),
      agentMode,
      startingRef,
    };
  }
  if (cmd === "status") {
    if (rest.length !== 1) throw new Error("status needs one agent id");
    return { cmd, agentId: assertAgentId(rest[0]) };
  }
  if (cmd === "steer") {
    if (rest.length !== 2) throw new Error("steer needs an agent id and a prompt");
    return { cmd, agentId: assertAgentId(rest[0]), text: assertText(rest[1]) };
  }
  throw new Error("commands: launch | status | steer");
}

export function buildLaunchBody({ ticket, text, agentMode = false, startingRef = "main" }) {
  const id = assertTicket(ticket);
  const ref = assertStartingRef(startingRef);
  const task = assertText(text);
  const mode = agentMode ? "agent" : "plan";
  const branch = `feature/${id.toLowerCase()}-<slug>`;
  const modeLine = agentMode
    ? "Mode is agent. The caller asserts a human approved the plan. If that approval did not happen, stop without editing."
    : "Mode is plan. Explore and draft a plan. Do not edit files and do not open a pull request on this run.";
  const prompt = [
    `Ticket ${id}.`,
    task,
    "",
    "Follow AGENTS.md and the FacilityIQ skills that match the files you touch.",
    "Backlog-first Linear intake is the written rule and is not mechanically enforced.",
    modeLine,
    `GitFlow branch: ${branch}, starting from ${ref}.`,
    "This repository has no develop branch. Do not create it. The PR base is main, or the stacked parent named in the ticket. Say that deviation in the PR.",
    "The Cloud Agents API may still open a cursor/<name> branch. If it does, keep that name and record the deviation. Do not force-push.",
    "Never push to main or develop. Never merge, tag, or dispatch a deploy. A human merges.",
    "Run the checks the change requires. Record a real demo, or say why a video is not possible. Do not invent one.",
    "Put the PR link on the Linear issue when a PR exists. Do not read or print secrets.",
  ].join("\n");

  return {
    name: `${id}: ${mode}`.slice(0, 100),
    prompt: { text: prompt },
    repos: [{ url: REPO, startingRef: ref }],
    mode,
    autoCreatePR: agentMode === true,
    workOnCurrentBranch: false,
  };
}

export function launchSummary(out, body) {
  const agentId = allowId(out?.agent?.id, AGENT_RE);
  const runId = allowId(out?.run?.id, RUN_RE);
  const url =
    agentId && out?.agent?.url === `https://cursor.com/agents/${agentId}` ? out.agent.url : null;
  return {
    untested: true,
    agent: agentId,
    url,
    run: runId,
    mode: body?.mode === "plan" || body?.mode === "agent" ? body.mode : null,
    workOnCurrentBranch: false,
    autoCreatePR: body?.autoCreatePR === true,
  };
}

export function statusSummary(agent, run) {
  const prs = Array.isArray(run?.git?.branches)
    ? run.git.branches
        .map((branch) => branch?.prUrl)
        .filter((url) => typeof url === "string" && PR_RE.test(url))
    : [];
  return {
    untested: true,
    agent: AGENT_STATUS.has(agent?.status) ? agent.status : null,
    run: RUN_STATUS.has(run?.status) ? run.status : null,
    pr: prs,
    summary: typeof run?.result === "string" ? run.result.slice(0, 500) : null,
  };
}

export function steerSummary(payload) {
  const delivery =
    payload?.delivery === "steered" || payload?.delivery === "queued" ? payload.delivery : null;
  return {
    untested: true,
    delivery,
    runId: allowId(payload?.runId, RUN_RE),
  };
}

export function toPrintedJson(value, key) {
  return redact(JSON.stringify(value, null, 2), key);
}

export async function call(method, path, body, key, fetchImpl = fetch) {
  if (body?.workOnCurrentBranch === true) {
    throw new Error("refusing to send workOnCurrentBranch true");
  }
  if (typeof path !== "string" || !path.startsWith("/v1/") || path.includes("..")) {
    throw new Error("refusing a path outside /v1/");
  }
  let response;
  try {
    response = await fetchImpl(API + path, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${method} ${path} -> request failed: ${redact(message, key)}`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${redact(text, key)}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} -> response was not JSON`);
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const key = process.env.CURSOR_API_KEY;
    console.error(redact(error instanceof Error ? error.message : String(error), key));
    console.error(redact(usage(), key));
    process.exit(2);
  }
  if (parsed.help) {
    console.log(usage());
    return;
  }

  const key = process.env.CURSOR_API_KEY;
  if (!key) {
    console.error("Set CURSOR_API_KEY (never commit it).");
    process.exit(2);
  }

  try {
    if (parsed.cmd === "launch") {
      const body = buildLaunchBody(parsed);
      const out = await call("POST", "/v1/agents", body, key);
      console.log(toPrintedJson(launchSummary(out, body), key));
      return;
    }
    if (parsed.cmd === "status") {
      const agent = await call("GET", `/v1/agents/${parsed.agentId}`, undefined, key);
      const path = runPath(parsed.agentId, agent.latestRunId);
      const run = path ? await call("GET", path, undefined, key) : {};
      console.log(toPrintedJson(statusSummary(agent, run), key));
      return;
    }
    const steered = await call(
      "POST",
      `/v1/agents/${parsed.agentId}/runs`,
      { prompt: { text: parsed.text }, delivery: "steer" },
      key,
    );
    console.log(toPrintedJson(steerSummary(steered), key));
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : String(error), key));
    process.exit(1);
  }
}

function isCli(metaUrl) {
  if (!process.argv[1]) return false;
  return metaUrl === pathToFileURL(process.argv[1]).href;
}

if (isCli(import.meta.url)) {
  main().catch((error) => {
    console.error(
      redact(error instanceof Error ? error.message : String(error), process.env.CURSOR_API_KEY),
    );
    process.exit(1);
  });
}
