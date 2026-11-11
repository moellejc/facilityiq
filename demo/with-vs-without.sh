#!/usr/bin/env bash
# DEMO FIXTURE. Compares one prompt in a checkout that has the FacilityIQ
# skills, guards, hooks, and AGENTS.md with a checkout that has those removed.
# Does not commit, push, or open a pull request. See demo/README.md.
#
# Live agent: runs only when CURSOR_API_KEY (or CURSOR_SERVICE_ACCOUNT_KEY)
# is set in the environment AND the `agent` CLI is on PATH. The key is never
# printed and never passed as an argument. Otherwise this script prints
# instructions and labels the live agent "not verified".
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

cleanup() {
  local status=$?
  if [[ "$keep" == "1" ]]; then
    echo
    echo "DEMO_KEEP_WORKTREES=1, so the worktrees were left in place:"
    echo "  with setup:    ${with_wt}"
    echo "  without setup: ${without_wt}"
    echo "Remove them with:"
    echo "  git worktree remove --force ${with_wt}"
    echo "  git worktree remove --force ${without_wt}"
    exit "$status"
  fi
  git worktree remove --force "$with_wt" >/dev/null 2>&1 || true
  git worktree remove --force "$without_wt" >/dev/null 2>&1 || true
  rm -rf "$base"
  exit "$status"
}
trap cleanup EXIT

echo "FacilityIQ demo: same prompt with vs without setup."
echo "Not product code. The live agent is opt-in and is not part of CI."
echo "Prompt file: demo/prompt.md"
echo

git worktree add --detach "$with_wt" HEAD >/dev/null
git worktree add --detach "$without_wt" HEAD >/dev/null

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

echo "=== checkouts (verified by this script) ==="
report_setup "with-setup" "$with_wt"
report_setup "without-setup" "$without_wt"

key_present=0
if [[ -n "${CURSOR_API_KEY:-}" || -n "${CURSOR_SERVICE_ACCOUNT_KEY:-}" ]]; then
  key_present=1
fi

echo "=== live agent ==="
if [[ "$key_present" -eq 0 ]]; then
  cat <<'EOF'
Live agent: not verified.
No CURSOR_API_KEY or CURSOR_SERVICE_ACCOUNT_KEY in the environment.
This script does not read a key from the repository.

To run the same prompt in both checkouts:

  1. Install the Cursor CLI: curl https://cursor.com/install -fsS | bash
     Docs: https://cursor.com/docs/cli/headless
  2. Export CURSOR_API_KEY in your shell. Do not commit it. Do not pass it
     with --api-key (that puts the secret on the command line).
  3. Re-run: bash demo/with-vs-without.sh

The script then runs, in each worktree, with the text of demo/prompt.md:

  agent -p --force --trust --output-format text --workspace <worktree> "<prompt text>"

demo/ is removed from both worktrees first, so the bad-change fixture is not visible to the agent. The script then runs node scripts/guard/pre-pr.mjs on the files each agent changed.

The Cloud Agents API (POST https://api.cursor.com/v1/agents) launches against
a remote git ref and can open a pull request. It cannot see a locally stripped
worktree, so this comparison uses the local CLI only. This script does not
call that API.

Set DEMO_KEEP_WORKTREES=1 to inspect the two checkouts instead of deleting them.
EOF
  echo
  echo "Guard comparison of agent output: not verified (no live-agent edits to scan)."
  exit 0
fi

if ! command -v agent >/dev/null 2>&1; then
  cat <<'EOF'
Live agent: not verified.
A Cursor API key is set in the environment, but the `agent` CLI is not on PATH.
The key was not printed and was not passed on the command line.
Install: curl https://cursor.com/install -fsS | bash
Docs: https://cursor.com/docs/cli/headless
Then re-run: bash demo/with-vs-without.sh
EOF
  echo
  echo "Guard comparison of agent output: not verified (CLI missing)."
  exit 0
fi

run_agent() {
  local label="$1"
  local wt="$2"
  echo "--- agent ${label} ---"
  (
    cd "$wt"
    if [[ -z "${CURSOR_API_KEY:-}" && -n "${CURSOR_SERVICE_ACCOUNT_KEY:-}" ]]; then
      export CURSOR_API_KEY="$CURSOR_SERVICE_ACCOUNT_KEY"
    fi
    agent -p --force --trust --output-format text --workspace "$wt" "$(cat "$PROMPT_FILE")"
  )
  echo
}

echo "Live agent: running the Cursor CLI in both worktrees. Output below is from this run."
run_agent "with-setup" "$with_wt"
run_agent "without-setup" "$without_wt"

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
  local joined
  local out
  echo "=== guard on ${label} ==="
  if [[ -z "$files" ]]; then
    echo "(no product edits; guard not run)"
    echo
    return 0
  fi
  if [[ ! -f "$wt/.cursor/guardrails.json" ]]; then
    mkdir -p "$wt/.cursor"
    cp "$ROOT/.cursor/guardrails.json" "$wt/.cursor/guardrails.json"
    copied=1
  fi
  joined="$(printf '%s\n' "$files" | paste -sd, -)"
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
  if [[ "$copied" -eq 1 ]]; then
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
