#!/usr/bin/env bash
# Re-surfaces core repo laws every Nth edit to counter within-session
# instruction decay (measured ~5.6% lower adherence odds per generated
# function, median first omission at the 4th — arxiv.org/pdf/2605.10039;
# adopted 2026-07-05, goals/agent-pipeline-velocity C4). Machine enforcement
# is the reliable channel; this pulse is the cheap middle ground for laws
# without lint rules yet. Always exits 0; emits ~30 tokens every 5th edit.
set -euo pipefail
counter="${TMPDIR:-/tmp}/beep-law-pulse-$(id -u)"
n=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 ))
printf '%s' "$n" > "$counter"
if (( n % 5 == 0 )); then
  echo "law pulse: schema-first models · typed errors/tagged unions · tersest helper forms · effect helper modules over native · @beep/* aliases in test imports · reuse before recreate (rg + barrels)"
fi
