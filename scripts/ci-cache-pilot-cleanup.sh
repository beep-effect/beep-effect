#!/usr/bin/env bash
# Refuse every path outside the current job-owned pilot layout.
set -euo pipefail
mode="${1:-signed}"
case "$mode" in
  signed) expected_inputs="$GITHUB_WORKSPACE/.beep/cache/protected-producer-trial" ;;
  local) expected_inputs="$GITHUB_WORKSPACE/.beep/cache/local-pilot-observation" ;;
  *) echo 'Unsupported cleanup mode.' >&2; exit 64 ;;
esac
cleanup_status=0
for tree in "$TRIAL_WORKTREE_A" "$TRIAL_WORKTREE_B"; do
  if [[ -n "$tree" && -e "$tree" ]]; then
    case "$tree" in
      "$GITHUB_WORKSPACE"-worktrees/cache-producer-"$GITHUB_RUN_ID"-"$GITHUB_RUN_ATTEMPT"-[ab])
        git worktree remove -- "$tree" || cleanup_status=1 ;;
      *) echo "::error::Refusing unexpected producer worktree."; cleanup_status=1 ;;
    esac
  fi
done
if [[ -n "$TRIAL_INPUTS" ]]; then
  if [[ "$TRIAL_INPUTS" == "$expected_inputs" ]]; then
    rm -rf -- "$TRIAL_INPUTS"
  else
    echo "::error::Refusing unexpected producer input directory."
    cleanup_status=1
  fi
fi
private_allowed=false
if [[ "$mode" == signed ]]; then
  if [[ "$TRIAL_ROOT" == "$HOME/.cache/beep/cache-producer-trial-v1" ]]; then private_allowed=true; fi
else
  suffix="${TRIAL_ROOT##*/beep-cache-local-observation.}"
  if [[ "$suffix" =~ ^[A-Za-z0-9]{6}$ && "$TRIAL_ROOT" == "$RUNNER_TEMP/beep-cache-local-observation.$suffix" ]]; then
    private_allowed=true
  fi
fi
if [[ "$private_allowed" == true ]]; then
  rm -rf -- "$TRIAL_ROOT"
else
  echo '::error::Refusing unexpected private pilot directory.'
  cleanup_status=1
fi
exit "$cleanup_status"
