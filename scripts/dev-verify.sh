#!/usr/bin/env bash
#
# Local pre-PR verification for this monorepo. Mirrors what CI runs
# (typecheck / lint / build / unit tests) so you can catch failures before
# pushing.
#
#   scripts/dev-verify.sh [web|api|all]   # default: all
#
# It also papers over a couple of pnpm-v11-on-a-dev-box quirks that CI (pnpm 9)
# doesn't hit — see link_eslint() and the `next` bin fallback below. On CI or a
# machine where the bins resolve normally, those are no-ops.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
TARGET="${1:-all}"
FAIL=0

have() { command -v "$1" >/dev/null 2>&1; }

# pnpm 11 doesn't always hoist eslint plugins into apps/web/node_modules the way
# `next lint` expects. Symlink the ones it needs from the pnpm store if missing.
link_eslint() {
  local web=apps/web/node_modules
  mkdir -p "$web/@eslint" "$web/@next"
  local p tgt
  for p in eslintrc js; do
    [ -e "$web/@eslint/$p" ] && continue
    tgt=$(ls -d node_modules/.pnpm/@eslint+${p}@*/node_modules/@eslint/${p} 2>/dev/null | head -1)
    [ -n "$tgt" ] && ln -sfn "$(realpath "$tgt")" "$web/@eslint/$p"
  done
  for p in eslint-plugin-react-hooks eslint-plugin-react eslint-plugin-jsx-a11y eslint-plugin-import; do
    [ -e "$web/$p" ] && continue
    tgt=$(ls -d node_modules/.pnpm/${p}@*/node_modules/${p} 2>/dev/null | head -1)
    [ -n "$tgt" ] && ln -sfn "$(realpath "$tgt")" "$web/$p"
  done
  [ -e "$web/@next/eslint-plugin-next" ] && return
  tgt=$(ls -d node_modules/.pnpm/@next+eslint-plugin-next@*/node_modules/@next/eslint-plugin-next 2>/dev/null | head -1)
  [ -n "$tgt" ] && ln -sfn "$(realpath "$tgt")" "$web/@next/eslint-plugin-next"
}

# Prefer the real `next` bin; fall back to invoking it via node when pnpm 11
# didn't create the .bin shim.
next_cmd() {
  if [ -x apps/web/node_modules/.bin/next ]; then
    (cd apps/web && node_modules/.bin/next "$@")
  else
    (cd apps/web && node node_modules/next/dist/bin/next "$@")
  fi
}

step() {
  local name="$1"; shift
  printf '\n\033[1m── %s\033[0m\n' "$name"
  if "$@"; then printf '\033[32m✓ %s\033[0m\n' "$name"; else printf '\033[31m✗ %s FAILED\033[0m\n' "$name"; FAIL=1; fi
}

if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  step "api typecheck" pnpm --filter api exec tsc --noEmit
  step "api tests"     pnpm --filter api test
fi

if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  step "web typecheck" pnpm --filter web exec tsc --noEmit
  link_eslint
  step "web lint"      next_cmd lint
  step "web build"     next_cmd build --no-lint
  step "web unit"      pnpm --filter web test:unit
  # `next build` rewrites tsconfig.json (adds target) and pnpm v11 rewrites
  # pnpm-workspace.yaml; drop that churn so it doesn't pollute a PR.
  git checkout -- apps/web/tsconfig.json pnpm-workspace.yaml 2>/dev/null || true
fi

printf '\n════════════════\n'
if [ "$FAIL" -eq 0 ]; then printf '\033[32mALL GREEN\033[0m\n'; else printf '\033[31mSOMETHING FAILED\033[0m\n'; fi
exit "$FAIL"
