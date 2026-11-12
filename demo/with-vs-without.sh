#!/usr/bin/env bash
# DEMO FIXTURE. Compares one prompt in a checkout that has the FacilityIQ
# skills, guards, hooks, and AGENTS.md with a checkout that has those removed.
# Does not commit, push, or open a pull request. See demo/README.md.
#
# Live agent: not started by a key alone. Requires DEMO_RUN_AGENT=1, a key in
# the environment, and the agent CLI. The child gets a scrubbed environment,
# --sandbox enabled, and the repo's fail-closed hooks on both checkouts.
# The key is never printed and never passed as an argument.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=doc-map.sh
source "$ROOT/demo/doc-map.sh"

PROMPT_FILE="$ROOT/demo/prompt.md"
base="$(mktemp -d)"
with_wt="$base/with-setup"
without_wt="$base/without-setup"
keep="${DEMO_KEEP_WORKTREES:-0}"
agent_home=""

cleanup() {
  local status=$?
  if [[ -n "$agent_home" ]]; then
    rm -rf "$agent_home"
  fi
  if [[ "$keep" == "1" ]]; then
    echo
    echo "DEMO_KEEP_WORKTREES=1, so the checkouts were left in place:"
    echo "  with setup:    ${with_wt}"
    echo "  without setup: ${without_wt}"
    echo "Remove them with: rm -rf ${base}"
    exit "$status"
  fi
  rm -rf "$base"
  exit "$status"
}
trap cleanup EXIT

echo "FacilityIQ demo: same prompt with vs without setup."
echo "Not product code. The live agent is opt-in and is not part of CI."
echo "Prompt file: demo/prompt.md"
echo

# Separate clones, not linked worktrees, so the agent cannot see this
# checkout through git worktree list. The origin remote is removed so the
# clone config does not keep this checkout's path.
make_checkout() {
  local dest="$1"
  git clone --local --quiet "$ROOT" "$dest"
  git -C "$dest" remote remove origin
}

make_checkout "$with_wt"
make_checkout "$without_wt"

# The bad-change fixture would bias both agents. Remove it from both trees
# so the only difference is skills, guards, hooks, and AGENTS.md.
rm -rf "$with_wt/demo" "$without_wt/demo"

strip_setup() {
  local wt="$1"
  rm -rf \
    "$wt/.cursor/skills" \
    "$wt/.cursor/hooks" \
    "$wt/scripts/guard"
  rm -f \
    "$wt/AGENTS.md" \
    "$wt/.cursor/hooks.json" \
    "$wt/.cursor/guardrails.json"
}

# Shell and read hooks are fail-closed. The stop hook runs the guard and, on
# failure, tells the agent to fix every error. The stripped checkout has no
# scripts/guard, so that stop hook must stay off or the comparison is not
# "without guards".
restore_safety_hooks() {
  local wt="$1"
  mkdir -p "$wt/.cursor/hooks"
  cp "$ROOT/.cursor/hooks/guard-shell.mjs" "$wt/.cursor/hooks/guard-shell.mjs"
  cp "$ROOT/.cursor/hooks/guard-read.mjs" "$wt/.cursor/hooks/guard-read.mjs"
  cat >"$wt/.cursor/hooks.json" <<'EOF'
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "node .cursor/hooks/guard-shell.mjs", "failClosed": true, "timeout": 10 }
    ],
    "beforeReadFile": [
      { "command": "node .cursor/hooks/guard-read.mjs", "failClosed": true, "timeout": 10 }
    ]
  }
}
EOF
}

strip_setup "$without_wt"

report_setup() {
  local label="$1"
  local wt="$2"
  local path
  echo "setup ${label}:"
  for path in AGENTS.md .cursor/skills .cursor/hooks .cursor/hooks.json .cursor/guardrails.json scripts/guard; do
    if [[ -e "$wt/$path" ]]; then
      echo "  present: ${path}"
    else
      echo "  absent:  ${path}"
    fi
  done
  if [[ -d "$wt/.cursor/rules" ]]; then
    echo "  present: .cursor/rules (intentionally not stripped; both trees keep the rules)"
  fi
  echo
}

echo "=== checkouts (verified by this script, before any live agent) ==="
report_setup "with-setup" "$with_wt"
report_setup "without-setup" "$without_wt"

key_present=0
if [[ -n "${CURSOR_API_KEY:-}" || -n "${CURSOR_SERVICE_ACCOUNT_KEY:-}" ]]; then
  key_present=1
fi
armed=0
if [[ "${DEMO_RUN_AGENT:-}" == "1" ]]; then
  armed=1
fi

print_not_verified() {
  cat <<'EOF'
Live agent: not verified.
This script does not read a key from the repository, and a key already in
the environment is not permission to start the agent.

To run the same prompt in both checkouts:

  1. Install the Cursor CLI: curl https://cursor.com/install -fsS | bash
     Docs: https://cursor.com/docs/cli/headless
  2. Export CURSOR_API_KEY in your shell. Do not commit it. Do not pass it
     with --api-key (that puts the secret on the command line).
  3. Re-run: DEMO_RUN_AGENT=1 bash demo/with-vs-without.sh

DEMO_RUN_AGENT=1 is required in addition to the key. The agent is then
started with --sandbox enabled and a scrubbed environment (PATH, a temporary
HOME, TMPDIR, LANG, and CURSOR_API_KEY only). Fail-closed shell and read
hooks are restored on the stripped checkout before that command. The stop
hook is not, because that checkout has no guard scripts. Skills, AGENTS.md,
guardrails.json, and scripts/guard stay absent there.

The Cloud Agents API (POST https://api.cursor.com/v1/agents) launches against
a remote git ref and can open a pull request. It cannot see a locally stripped
checkout, so this comparison uses the local CLI only. This script does not
call that API.

Set DEMO_KEEP_WORKTREES=1 to inspect the two checkouts instead of deleting them.
EOF
}

echo "=== live agent ==="
if [[ "$armed" -eq 0 || "$key_present" -eq 0 ]]; then
  if [[ "$armed" -eq 0 && "$key_present" -eq 1 ]]; then
    echo "A Cursor API key is set, but DEMO_RUN_AGENT is not 1. The agent was not started."
  elif [[ "$key_present" -eq 0 ]]; then
    echo "No CURSOR_API_KEY or CURSOR_SERVICE_ACCOUNT_KEY in the environment."
  fi
  print_not_verified
  echo
  echo "Guard comparison of agent output: not verified (no live-agent edits to scan)."
  exit 0
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "Live agent: not verified."
  echo "DEMO_RUN_AGENT=1 and a Cursor API key are set, but the agent CLI is not on PATH."
  echo "The key was not printed and was not passed on the command line."
  echo "Install: curl https://cursor.com/install -fsS | bash"
  echo "Docs: https://cursor.com/docs/cli/headless"
  echo
  echo "Guard comparison of agent output: not verified (CLI missing)."
  exit 0
fi

echo "Restoring fail-closed shell and read hooks before the live agent."
echo "The stop hook stays off without-setup. Skills, AGENTS.md, guardrails.json, and scripts/guard stay stripped there."
restore_safety_hooks "$without_wt"
if [[ ! -f "$with_wt/.cursor/hooks.json" || ! -d "$with_wt/.cursor/hooks" || ! -f "$without_wt/.cursor/hooks.json" || ! -d "$without_wt/.cursor/hooks" ]]; then
  echo "Refusing to start the agent: fail-closed hooks are missing from a checkout." >&2
  exit 1
fi
echo "=== checkouts the live agent will see ==="
report_setup "with-setup" "$with_wt"
report_setup "without-setup" "$without_wt"

run_agent() {
  local label="$1"
  local wt="$2"
  local agent_key="${CURSOR_API_KEY:-}"
  if [[ -z "$agent_key" ]]; then
    agent_key="${CURSOR_SERVICE_ACCOUNT_KEY:-}"
  fi
  if [[ ! -f "$wt/.cursor/hooks.json" || ! -d "$wt/.cursor/hooks" ]]; then
    echo "Refusing to run the live agent in ${label}: fail-closed hooks are missing." >&2
    exit 1
  fi
  echo "--- agent ${label} ---"
  agent_home="$(mktemp -d)"
  # env -i drops every parent variable, including unrelated secrets.
  # Only CURSOR_API_KEY is forwarded, never as an argv token.
  env -i \
    HOME="$agent_home" \
    PATH="$PATH" \
    TMPDIR="${TMPDIR:-/tmp}" \
    LANG="${LANG:-C.UTF-8}" \
    CURSOR_API_KEY="$agent_key" \
    agent -p --force --trust --sandbox enabled --output-format text --workspace "$wt" "$(cat "$PROMPT_FILE")"
  rm -rf "$agent_home"
  agent_home=""
  echo
}

echo "Live agent: running the Cursor CLI in both checkouts. Output below is from this run."
run_agent "with-setup" "$with_wt"
run_agent "without-setup" "$without_wt"

# A relative path the guard may read. Reject commas (GUARD_FILES splits on
# them), absolute paths, and any '..' segment. Also reject a symlink anywhere
# on the path so a later unsandboxed read or write cannot leave the checkout.
is_safe_relpath() {
  local path="$1"
  [[ -n "$path" ]] || return 1
  [[ "$path" != /* ]] || return 1
  [[ "$path" != *","* ]] || return 1
  [[ "$path" != *".."* ]] || return 1
  [[ "$path" != *$'\n'* && "$path" != *$'\r'* ]] || return 1
  return 0
}

path_stays_in_checkout() {
  local root="$1" rel="$2" acc part rest
  is_safe_relpath "$rel" || return 1
  [[ -L "$root" ]] && return 1
  acc="$root"
  rest="$rel"
  while [[ -n "$rest" ]]; do
    part="${rest%%/*}"
    if [[ "$rest" == */* ]]; then
      rest="${rest#*/}"
    else
      rest=""
    fi
    [[ -n "$part" && "$part" != "." ]] || continue
    acc="${acc}/${part}"
    if [[ -L "$acc" ]]; then
      return 1
    fi
  done
  return 0
}

# Setup deletions are ours, not the agent's. Ignore them when collecting edits.
product_changes() {
  local wt="$1"
  local line path
  git -C "$wt" status --porcelain=v1 -uall | while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    path="${line:3}"
    path="${path#\"}"
    path="${path%\"}"
    case "$path" in
      AGENTS.md | .cursor/skills | .cursor/skills/* | .cursor/hooks | .cursor/hooks/* | .cursor/hooks.json | .cursor/guardrails.json | scripts/guard | scripts/guard/* | demo | demo/*)
        continue
        ;;
    esac
    if ! path_stays_in_checkout "$wt" "$path"; then
      echo "Skipping unsafe path: ${path}" >&2
      continue
    fi
    printf '%s\n' "$path"
  done
}

echo "=== agent edits ==="
with_files="$(product_changes "$with_wt" || true)"
without_files="$(product_changes "$without_wt" || true)"
echo "with-setup files:"
if [[ -n "$with_files" ]]; then
  echo "$with_files"
else
  echo "(none)"
fi
echo "without-setup files:"
if [[ -n "$without_files" ]]; then
  echo "$without_files"
else
  echo "(none)"
fi
echo

if [[ -z "$with_files" && -z "$without_files" ]]; then
  echo "Guard comparison of agent output: not verified (the CLI exited without leaving edits)."
  exit 0
fi

run_guard_on() {
  local label="$1"
  local wt="$2"
  local files="$3"
  local copied=0
  local joined=""
  local path
  local out
  echo "=== guard on ${label} ==="
  if [[ -z "$files" ]]; then
    echo "(no product edits; guard not run)"
    echo
    return 0
  fi
  if [[ -L "$wt" || -L "$wt/.cursor" || -L "$wt/.cursor/guardrails.json" ]]; then
    echo "Refusing to write guardrails.json: path escapes the checkout through a symlink." >&2
    echo
    return 0
  fi
  if [[ ! -f "$wt/.cursor/guardrails.json" ]]; then
    if [[ ! -d "$wt/.cursor" ]]; then
      mkdir "$wt/.cursor"
    fi
    if [[ -L "$wt/.cursor" ]]; then
      echo "Refusing to write guardrails.json: path escapes the checkout through a symlink." >&2
      echo
      return 0
    fi
    cp "$ROOT/.cursor/guardrails.json" "$wt/.cursor/guardrails.json"
    copied=1
  fi
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    if ! path_stays_in_checkout "$wt" "$path"; then
      echo "Skipping unsafe path: ${path}" >&2
      continue
    fi
    if [[ -n "$joined" ]]; then
      joined="${joined},${path}"
    else
      joined="$path"
    fi
  done <<<"$files"
  if [[ -z "$joined" ]]; then
    echo "(no safe paths to scan)"
    echo
    if [[ "$copied" -eq 1 && ! -L "$wt/.cursor" && ! -L "$wt/.cursor/guardrails.json" ]]; then
      rm -f "$wt/.cursor/guardrails.json"
    fi
    return 0
  fi
  out="$(mktemp)"
  set +e
  GUARD_ROOT="$wt" GUARD_FILES="$joined" node "$ROOT/scripts/guard/pre-pr.mjs" >"$out"
  local code=$?
  set -e
  cat "$out"
  echo "exit: ${code}"
  echo
  echo "=== ${label}: finding -> rule -> doc ==="
  print_findings_with_docs "$out"
  echo
  if [[ "$copied" -eq 1 && ! -L "$wt/.cursor" && ! -L "$wt/.cursor/guardrails.json" ]]; then
    rm -f "$wt/.cursor/guardrails.json"
  fi
  cp "$out" "$base/${label}.guard.txt"
  rm -f "$out"
}

run_guard_on "with-setup" "$with_wt" "$with_files"
run_guard_on "without-setup" "$without_wt" "$without_files"

echo "=== where the guard results differ ==="
if [[ -f "$base/with-setup.guard.txt" && -f "$base/without-setup.guard.txt" ]]; then
  awk -F'|' '/^\| (error|warn) / { gsub(/`/, "", $3); gsub(/ /, "", $3); print $3 }' \
    "$base/with-setup.guard.txt" | sort -u >"$base/with.rules"
  awk -F'|' '/^\| (error|warn) / { gsub(/`/, "", $3); gsub(/ /, "", $3); print $3 }' \
    "$base/without-setup.guard.txt" | sort -u >"$base/without.rules"
  echo "rules only on with-setup:"
  comm -23 "$base/with.rules" "$base/without.rules" || true
  echo "rules only on without-setup:"
  comm -13 "$base/with.rules" "$base/without.rules" || true
  echo "rules on both:"
  comm -12 "$base/with.rules" "$base/without.rules" || true
else
  echo "One side had no product edits, so there is no pair of guard reports to diff."
  echo "See the file lists and the guard section above."
fi
echo
echo "Live agent: this run invoked the Cursor CLI. The transcript above is the result."
