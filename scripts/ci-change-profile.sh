#!/usr/bin/env bash
set -euo pipefail

# Change profile for the hosted lane gates. Every profile is computed once
# here from the base...HEAD diff of a pull request and emitted as
# `name=value` lines (stdout for `eval`, plus $GITHUB_OUTPUT when set). Push
# and local runs have no diff to scope: they keep every profile relevant and
# never suppress the matrices.
#
#   goals_only              only convention-owned packet prose changed
#   desktop_rust_relevant   apps/professional-desktop/src-tauri (cargo) changed
#
# The Storybook lane has no path profile here: `beep ci lane storybook
# --affected` asks Turbo's dependency-aware affected set whether
# @beep/storybook is selected (a path list cannot see transitive workspace
# dependencies), and storybook.yml gates only on goals_only.

event_name="${GITHUB_EVENT_NAME:-local}"
base_ref="${1:-origin/${GITHUB_BASE_REF:-main}}"
goals_only=false
desktop_rust_relevant=true

# Rust crate inputs for the desktop-ipc cargo check/clippy steps (D15): the
# crate itself plus the workflow and gate that carry the steps.
# Before Bun/dependencies exist, this script runs on a bare runner: the hosted
# heavy lanes call it in their should_run step ahead of the toolchain setup.
# It reads the schema owner's declarative patterns with whatever JSON-capable
# runtime is present (node, bun, jq, python3) and otherwise falls back to the
# literal patterns below, which must stay equal to CiOperational.patterns.json
# (the typed-vs-shim fixtures compare them). It must never fail for want of a
# runtime: a failure here marks every heavy lane red.
pattern_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json"
fallback_pattern() {
  case "$1" in
    desktop) printf '%s' '^(apps/professional-desktop/src-tauri/|\.github/workflows/check\.yml$|scripts/ci-change-profile\.sh$|packages/tooling/tool/cli/src/commands/Ci/CiOperational)' ;;
    goals) printf '%s' '^(goals/(INDEX|README)\.md|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\.md|goals/[^/]+/ops/manifest\.json)$' ;;
    *) return 1 ;;
  esac
}
read_pattern() {
  # Fail closed when a JSON runtime is present but the read fails (missing file,
  # invalid JSON, unknown key): a stale literal must never classify a change
  # silently. Fall back to the literals only when no runtime exists at all.
  local name="$1" value="" runtime=""
  if command -v node >/dev/null 2>&1; then
    runtime=node
    value="$(BEEP_CI_PATTERN_FILE="$pattern_file" BEEP_CI_PATTERN_NAME="$name" node -e 'const v = require(process.env.BEEP_CI_PATTERN_FILE)[process.env.BEEP_CI_PATTERN_NAME]; if (typeof v !== "string" || v === "") process.exit(3); process.stdout.write(v)')" || value=""
  elif command -v bun >/dev/null 2>&1; then
    runtime=bun
    value="$(BEEP_CI_PATTERN_FILE="$pattern_file" BEEP_CI_PATTERN_NAME="$name" bun -e 'const v = require(process.env.BEEP_CI_PATTERN_FILE)[process.env.BEEP_CI_PATTERN_NAME]; if (typeof v !== "string" || v === "") process.exit(3); process.stdout.write(v)')" || value=""
  elif command -v jq >/dev/null 2>&1; then
    runtime=jq
    value="$(jq -er --arg k "$name" '.[$k] | select(type == "string" and . != "")' "$pattern_file")" || value=""
  elif command -v python3 >/dev/null 2>&1; then
    runtime=python3
    value="$(BEEP_CI_PATTERN_FILE="$pattern_file" BEEP_CI_PATTERN_NAME="$name" python3 -I -c 'import json,os,sys; v=json.load(open(os.environ["BEEP_CI_PATTERN_FILE"])).get(os.environ["BEEP_CI_PATTERN_NAME"]); sys.exit(3) if not isinstance(v,str) or v=="" else sys.stdout.write(v)')" || value=""
  fi
  if [[ -n "$runtime" ]]; then
    if [[ -z "$value" ]]; then
      echo "ci-change-profile: $runtime could not read pattern '$name' from $pattern_file" >&2
      return 1
    fi
  else
    value="$(fallback_pattern "$name")" || { echo "ci-change-profile: unknown pattern '$name'" >&2; return 1; }
  fi
  printf '%s' "$value"
}
desktop_rust_pattern="$(read_pattern desktop)"
goals_document_pattern="$(read_pattern goals)"

if [[ "$event_name" == "pull_request" ]]; then
  changed_files="$(git diff --name-only "${base_ref}...HEAD")"
  # Only convention-owned packet prose can suppress the repository matrices.
  # Executables, fixtures, and arbitrary data under goals/ remain code-bearing
  # inputs and therefore keep the full verification profile.
  if [[ -n "$changed_files" ]] && ! grep -Eqv "$goals_document_pattern" <<< "$changed_files"; then
    goals_only=true
  fi
  if [[ -z "$changed_files" ]] || ! grep -Eq "$desktop_rust_pattern" <<< "$changed_files"; then
    desktop_rust_relevant=false
  fi
fi

emit() {
  echo "goals_only=$goals_only"
  echo "desktop_rust_relevant=$desktop_rust_relevant"
}

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  emit >> "$GITHUB_OUTPUT"
fi

emit
