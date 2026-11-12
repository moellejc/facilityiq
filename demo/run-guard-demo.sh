#!/usr/bin/env bash
# DEMO FIXTURE. Do not apply demo/bad-change.patch or demo/fixed-change.patch
# to main, and do not commit the src files this script creates. The guard run
# happens in a throwaway worktree of origin/main and is deleted before exit.
# See demo/README.md. This script does not edit scripts/guard.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=doc-map.sh
source "$ROOT/demo/doc-map.sh"

PAGE="src/app/(dashboard)/finance/cost-by-category/page.tsx"
CHART="src/components/finance/cost-chart.tsx"
BAD_PATCH="$ROOT/demo/bad-change.patch"
FIX_PATCH="$ROOT/demo/fixed-change.patch"

bad_applied=0
fix_applied=0
demo_status=0
preexisting=0
worktrees=()
guard_dir=""

cleanup() {
  local status=$?
  set +e
  if [[ -n "$guard_dir" ]]; then
    if [[ "$fix_applied" -eq 1 ]]; then
      git -C "$guard_dir" apply -R --whitespace=nowarn "$FIX_PATCH"
    fi
    if [[ "$bad_applied" -eq 1 ]]; then
      git -C "$guard_dir" apply -R --whitespace=nowarn "$BAD_PATCH"
    fi
    rm -f "$guard_dir/node_modules" "$guard_dir/.guard-report.md"
  fi
  local dir
  if ((${#worktrees[@]})); then
    for dir in "${worktrees[@]}"; do
      git worktree remove --force "$dir" >/dev/null 2>&1
      rm -rf "$dir"
    done
  fi
  if [[ "$preexisting" -eq 0 && ( -e "$PAGE" || -e "$CHART" ) ]]; then
    echo "ERROR: demo left fixture files in the primary checkout." >&2
    status=1
  fi
  if [[ "$demo_status" -ne 0 ]]; then
    status=$demo_status
  fi
  exit "$status"
}
trap cleanup EXIT

if [[ -e "$PAGE" || -e "$CHART" ]]; then
  preexisting=1
  echo "Refusing to run: ${PAGE} or ${CHART} already exists in this checkout." >&2
  echo "This demo will not overwrite those paths." >&2
  demo_status=2
  exit 2
fi

echo "FacilityIQ demo fixtures. Not product code. Not for main."
echo "Guard under test: pnpm guard (package.json -> node scripts/guard/pre-pr.mjs)"
echo "Recorded against origin/main $(git rev-parse --short origin/main) — $(git log -1 --format=%s origin/main)"
echo "The guard scripts in that commit are not modified by this demo."
echo

verify_patches() {
  local rev="$1"
  local dir
  dir="$(mktemp -d)"
  worktrees+=("$dir")
  git worktree add --detach "$dir" "$rev" >/dev/null
  git -C "$dir" apply --check --whitespace=nowarn "$BAD_PATCH"
  git -C "$dir" apply --whitespace=nowarn "$BAD_PATCH"
  git -C "$dir" apply --check --whitespace=nowarn "$FIX_PATCH"
  git -C "$dir" apply --whitespace=nowarn "$FIX_PATCH"
  git worktree remove --force "$dir" >/dev/null
  rm -rf "$dir"
  echo "verified: bad-change.patch applies to ${rev}, and fixed-change.patch applies on top"
}

echo "=== apply check ==="
verify_patches "origin/main"
verify_patches "HEAD"
echo

guard_dir="$(mktemp -d)"
worktrees+=("$guard_dir")
git worktree add --detach "$guard_dir" origin/main >/dev/null
if [[ -d "$ROOT/node_modules" && ! -e "$guard_dir/node_modules" ]]; then
  ln -s "$ROOT/node_modules" "$guard_dir/node_modules"
fi

run_guard() {
  local label="$1"
  local out="$2"
  echo "=== ${label}: pnpm guard on origin/main ==="
  set +e
  if [[ -e "$guard_dir/node_modules" ]] && command -v pnpm >/dev/null 2>&1; then
    (cd "$guard_dir" && pnpm guard >"$out" 2>&1)
    guard_exit=$?
  else
    (
      echo "pnpm guard needs node_modules in the worktree. Running node scripts/guard/pre-pr.mjs, which is the pnpm guard script."
      cd "$guard_dir" && node scripts/guard/pre-pr.mjs
    ) >"$out" 2>&1
    guard_exit=$?
  fi
  set -e
  cat "$out"
  echo "exit: ${guard_exit}"
  echo
  echo "=== ${label}: finding -> rule -> doc ==="
  print_findings_with_docs "$out"
  echo
}

require_rule() {
  local report="$1"
  local rule="$2"
  if ! grep -F "| \`${rule}\` |" "$report" >/dev/null; then
    echo "missing expected rule on the bad patch: ${rule}" >&2
    demo_status=1
  fi
}

bad_out="$(mktemp)"
fix_out="$(mktemp)"

echo "=== apply bad-change.patch on origin/main ==="
git -C "$guard_dir" apply --check --whitespace=nowarn "$BAD_PATCH"
git -C "$guard_dir" apply --whitespace=nowarn "$BAD_PATCH"
bad_applied=1
echo "worktree: ${guard_dir}"
echo "rev: $(git -C "$guard_dir" rev-parse HEAD)"
echo

run_guard "bad change" "$bad_out"
if [[ "$guard_exit" -eq 0 ]]; then
  echo "expected the bad patch to fail pnpm guard" >&2
  demo_status=1
fi
for rule in route-or-page-imports-db client-imports-server gssp next-router next-head sync-params adhoc-tofixed async-client; do
  require_rule "$bad_out" "$rule"
done
bad_errors="$(grep -c '^| error |' "$bad_out" || true)"
echo "bad-change error rows: ${bad_errors}"
echo

echo "=== apply fixed-change.patch (same files) ==="
git -C "$guard_dir" apply --check --whitespace=nowarn "$FIX_PATCH"
git -C "$guard_dir" apply --whitespace=nowarn "$FIX_PATCH"
fix_applied=1
echo

run_guard "fixed change" "$fix_out"
if [[ "$guard_exit" -ne 0 ]]; then
  echo "expected the fixed patch to pass pnpm guard" >&2
  demo_status=1
fi
if grep -q '^| error |' "$fix_out"; then
  echo "expected no error rows after the fix" >&2
  demo_status=1
fi
echo

echo "=== revert ==="
git -C "$guard_dir" apply -R --whitespace=nowarn "$FIX_PATCH"
fix_applied=0
git -C "$guard_dir" apply -R --whitespace=nowarn "$BAD_PATCH"
bad_applied=0
rm -f "$guard_dir/node_modules" "$guard_dir/.guard-report.md"
if [[ -e "$guard_dir/$PAGE" || -e "$guard_dir/$CHART" || -e "$PAGE" || -e "$CHART" ]]; then
  echo "revert left fixture files behind" >&2
  demo_status=1
else
  echo "reverted: fixture paths are gone. origin/main was not left patched, and this checkout was not patched."
fi

if [[ "$demo_status" -eq 0 ]]; then
  echo "demo result: bad change exited non-zero, fixed change exited 0."
else
  echo "demo result: failed. See the messages above." >&2
fi

rm -f "$bad_out" "$fix_out"
if [[ -n "${DEMO_CWD_LOG:-}" ]]; then
  pwd >"$DEMO_CWD_LOG"
fi
exit "$demo_status"
