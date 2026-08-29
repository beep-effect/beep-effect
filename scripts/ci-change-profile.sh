#!/usr/bin/env bash
set -euo pipefail

event_name="${GITHUB_EVENT_NAME:-local}"
base_ref="${1:-origin/${GITHUB_BASE_REF:-main}}"
goals_only=false

if [[ "$event_name" == "pull_request" ]]; then
  changed_files="$(git diff --name-only "${base_ref}...HEAD")"
  # Only convention-owned packet prose can suppress the repository matrices.
  # Executables, fixtures, and arbitrary data under goals/ remain code-bearing
  # inputs and therefore keep the full verification profile.
  goals_document_pattern='^('
  goals_document_pattern+='goals/(INDEX|README)\.md'
  goals_document_pattern+='|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\.md'
  goals_document_pattern+='|goals/[^/]+/(docs|designs|history|research)/.*\.md'
  goals_document_pattern+='|goals/[^/]+/ops/manifest\.json'
  goals_document_pattern+=')$'
  if [[ -n "$changed_files" ]] && ! grep -Eqv "$goals_document_pattern" <<< "$changed_files"; then
    goals_only=true
  fi
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "goals_only=$goals_only" >> "$GITHUB_OUTPUT"
fi

echo "goals_only=$goals_only"
