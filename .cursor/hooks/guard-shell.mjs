// beforeShellExecution. Reads hook JSON on stdin and answers allow, ask, or deny.
// Cursor runs this; CI only tests the script with sample JSON. GitFlow §5.5 and §7.
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { command = "" } = JSON.parse(raw || "{}");

const DENY = [
  [/\bgit\s+push\b[^\n]*(--force|-f\b)/, "Force-push is denied (GitFlow §7)."],
  [
    /\bgh\s+pr\s+merge\b/,
    "Agents do not merge. A human merges after review (GitFlow §5.5, SDLC §3).",
  ],
  [
    /\bgit\s+tag\b|\bgh\s+release\s+create\b/,
    "Agents do not create tags or releases (GitFlow §5.5).",
  ],
  [/\bgit\s+push\b[^\n]*\btags?\b/, "Agents do not push tags (GitFlow §5.5)."],
  [
    /\bworkflow_dispatch\b|\bgh\s+workflow\s+run\b/,
    "Agents do not dispatch deploys (GitFlow §5.5).",
  ],
  [
    /\b(cat|less|more|head|tail)\b[^\n]*\.env(?!\.example)\b|\bprintenv\b/,
    "Do not print environment secrets (Coding Conventions §8).",
  ],
  [
    /\bcurl\b|\bwget\b/,
    "curl and wget are denied for agent shells. Use the package manager for dependencies.",
  ],
  [/\brm\s+-rf\s+(\/|~|\.\s*$)/, "Destructive delete of a root path is denied."],
];
const ASK = [
  [
    /\bpnpm\s+(add|remove|install(?!\s+--frozen-lockfile))\b/,
    "Dependency changes need a human (Coding Conventions §2).",
  ],
  [
    /\bdrizzle-kit\s+(push|drop)\b/,
    "Schema changes ship as versioned migrations, never push or drop (Coding Conventions §4).",
  ],
];

const hit = (rules) => rules.find(([pattern]) => pattern.test(command));
const deny = hit(DENY);
if (deny) {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: deny[1],
      agent_message: `Blocked by FacilityIQ guardrails: ${deny[1]}`,
    }),
  );
  process.exit(0);
}
const ask = hit(ASK);
process.stdout.write(
  JSON.stringify(
    ask
      ? { permission: "ask", user_message: ask[1], agent_message: ask[1] }
      : { permission: "allow" },
  ),
);
