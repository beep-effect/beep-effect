#!/usr/bin/env bash
set -euo pipefail

event_name="${GITHUB_EVENT_NAME:-local}"
base_ref="${1:-origin/${GITHUB_BASE_REF:-main}}"
goals_only=false

if [[ "$event_name" == "pull_request" ]]; then
  changed_files="$(git diff --name-only "${base_ref}...HEAD")"
  if [[ -n "$changed_files" ]] && ! grep -Eqv '^goals/' <<< "$changed_files"; then
    goals_only=true
  fi
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "goals_only=$goals_only" >> "$GITHUB_OUTPUT"
fi

echo "goals_only=$goals_only"
