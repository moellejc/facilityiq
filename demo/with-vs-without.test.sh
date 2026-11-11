#!/usr/bin/env bash
# Demo-fixture regression for the live-agent gate. Uses a fake `agent` binary.
# Does not call the real Cursor CLI and does not use a real key.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE="src/app/(dashboard)/finance/cost-by-category/page.tsx"
fail() {
  echo "FAIL: $*" >&2
  exit 1
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"; rm -f "$ROOT/$PAGE"' EXIT

cat >"$tmp/agent" <<'EOF'
#!/usr/bin/env bash
log="__AGENT_LOG__"
workspace=""
prev=""
for arg in "$@"; do
  if [[ "$prev" == "--workspace" ]]; then
    workspace="$arg"
  fi
  prev="$arg"
done
{
  printf 'ARGS:'
  printf ' %q' "$@"
  printf '\n'
  if [[ -n "${CANARY_SECRET:-}" ]]; then
    echo "CANARY:set"
  else
    echo "CANARY:unset"
  fi
  if [[ -n "${CURSOR_API_KEY:-}" ]]; then
    echo "API_KEY:set"
  else
    echo "API_KEY:unset"
  fi
  if [[ -n "${CURSOR_SERVICE_ACCOUNT_KEY:-}" ]]; then
    echo "SERVICE_KEY:set"
  else
    echo "SERVICE_KEY:unset"
  fi
  echo "HOME:${HOME:-}"
  if [[ -n "$workspace" && -f "$workspace/.cursor/hooks.json" && -d "$workspace/.cursor/hooks" ]]; then
    echo "HOOKS:present"
  else
    echo "HOOKS:absent"
  fi
  if [[ -n "$workspace" ]]; then
    echo "REMOTES:$(git -C "$workspace" remote -v)"
    echo "WORKTREES:$(git -C "$workspace" worktree list)"
    mkdir -p "$workspace/src"
    printf 'export const a = 1\n' >"$workspace/src/ok.ts"
    printf 'export const b = 1\n' >"$workspace/src/comma,name.ts"
  fi
} >>"$log"
EOF
sed -i "s|__AGENT_LOG__|$tmp/agent.log|" "$tmp/agent"
chmod +x "$tmp/agent"

run_case() {
  local name="$1"
  shift
  : >"$tmp/agent.log"
  local out="$tmp/${name}.out"
  set +e
  env -i \
    PATH="$tmp:${PATH}" \
    HOME="${HOME}" \
    TMPDIR="${TMPDIR:-/tmp}" \
    LANG="${LANG:-C.UTF-8}" \
    "$@" \
    bash "$ROOT/demo/with-vs-without.sh" >"$out" 2>&1
  local code=$?
  set -e
  cp "$tmp/agent.log" "$tmp/${name}.log"
  echo "$code" >"$tmp/${name}.code"
  printf '%s\n' "$out"
}

echo "case: no key"
out="$(run_case nokey)"
[[ "$(cat "$tmp/nokey.code")" -eq 0 ]] || fail "no-key exit $(cat "$tmp/nokey.code")"
[[ ! -s "$tmp/nokey.log" ]] || fail "no-key executed agent"
grep -q "Live agent: not verified." "$out" || fail "no-key missing not-verified"
echo "  ok"

echo "case: key without DEMO_RUN_AGENT"
out="$(run_case keyonly CURSOR_API_KEY=synthetic-key CANARY_SECRET=canary-value)"
[[ "$(cat "$tmp/keyonly.code")" -eq 0 ]] || fail "key-only exit $(cat "$tmp/keyonly.code")"
[[ ! -s "$tmp/keyonly.log" ]] || fail "key-only executed agent"
grep -q "DEMO_RUN_AGENT is not 1" "$out" || fail "key-only missing arming message"
grep -q "synthetic-key" "$out" && fail "key-only printed the key"
grep -q "canary-value" "$out" && fail "key-only printed the canary"
echo "  ok"

echo "case: armed with a service-account key"
out="$(run_case armed DEMO_RUN_AGENT=1 CURSOR_SERVICE_ACCOUNT_KEY=synthetic-sa CANARY_SECRET=canary-value)"
[[ "$(cat "$tmp/armed.code")" -eq 0 ]] || fail "armed exit $(cat "$tmp/armed.code") — see $out"
[[ "$(grep -c '^ARGS:' "$tmp/armed.log")" -eq 2 ]] || fail "armed did not exec agent twice"
grep -q -- '--sandbox' "$tmp/armed.log" || fail "argv missing --sandbox"
grep -q 'enabled' "$tmp/armed.log" || fail "argv missing sandbox enabled"
grep -q 'CANARY:set' "$tmp/armed.log" && fail "canary leaked into the child"
grep -q 'CANARY:unset' "$tmp/armed.log" || fail "canary line missing"
grep -q 'SERVICE_KEY:set' "$tmp/armed.log" && fail "service-account key was forwarded"
grep -q 'API_KEY:set' "$tmp/armed.log" || fail "CURSOR_API_KEY was not set in the child"
grep -q 'HOOKS:absent' "$tmp/armed.log" && fail "live agent ran without hooks"
grep -q 'HOOKS:present' "$tmp/armed.log" || fail "hooks were not present"
grep -q "synthetic-sa" "$out" && fail "armed run printed the key"
grep -q "canary-value" "$out" && fail "armed run printed the canary"
grep -q "Skipping unsafe path: src/comma,name.ts" "$out" || fail "unsafe path was not skipped"
grep -q "$ROOT" "$tmp/armed.log" && fail "agent log contains the primary checkout path"
# The child HOME must not be this developer's home directory.
while IFS= read -r line; do
  [[ "$line" == HOME:* ]] || continue
  home="${line#HOME:}"
  [[ "$home" != "$HOME" ]] || fail "child HOME is the parent HOME"
  [[ -n "$home" ]] || fail "child HOME is empty"
done <"$tmp/armed.log"
echo "  ok"

echo "case: run-guard-demo refuses an existing fixture path"
mkdir -p "$(dirname "$ROOT/$PAGE")"
: >"$ROOT/$PAGE"
set +e
bash "$ROOT/demo/run-guard-demo.sh" >"$tmp/refuse.out" 2>&1
refuse_code=$?
set -e
rm -f "$ROOT/$PAGE"
[[ "$refuse_code" -eq 2 ]] || fail "run-guard-demo exit $refuse_code, expected 2"
grep -q "Refusing to run" "$tmp/refuse.out" || fail "run-guard-demo did not refuse"
[[ ! -e "$ROOT/$PAGE" ]] || fail "fixture path left behind"
echo "  ok"

echo "with-vs-without checks passed"
