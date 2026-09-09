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
desktop_rust_pattern='^(apps/professional-desktop/src-tauri/|\.github/workflows/check\.yml$|scripts/ci-change-profile\.sh$)'

if [[ "$event_name" == "pull_request" ]]; then
  changed_files="$(git diff --name-only "${base_ref}...HEAD")"
  # Only convention-owned packet prose can suppress the repository matrices.
  # Executables, fixtures, and arbitrary data under goals/ remain code-bearing
  # inputs and therefore keep the full verification profile.
  goals_document_pattern='^('
  goals_document_pattern+='goals/(INDEX|README)\.md'
  goals_document_pattern+='|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\.md'
  goals_document_pattern+='|goals/[^/]+/ops/manifest\.json'
  goals_document_pattern+=')$'
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
