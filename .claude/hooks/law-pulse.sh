#!/usr/bin/env bash
# Re-surfaces core repo laws every Nth edit to counter within-session
# instruction decay (measured ~5.6% lower adherence odds per generated
# function, median first omission at the 4th — arxiv.org/pdf/2605.10039;
# adopted 2026-07-05, goals/agent-pipeline-velocity C4). Machine enforcement
# is the reliable channel; this pulse is the cheap middle ground for laws
# without lint rules yet. Always exits 0; emits ~30 tokens every 5th edit.
set -euo pipefail
# Counter scoped per user AND per checkout/worktree (cksum of $PWD): parallel
# sessions in sibling worktrees must not share pulse cadence. Same-worktree
# concurrent sessions still share one counter — acceptable under the
# one-agent-per-worktree convention (standards/git-worktrees.md).
counter="${TMPDIR:-/tmp}/beep-law-pulse-$(id -u)-$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)"
n=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 ))
printf '%s' "$n" > "$counter"
if (( n % 5 == 0 )); then
  # PostToolUse stdout on exit 0 reaches the debug log ONLY — never the model.
  # UserPromptSubmit, UserPromptExpansion, and SessionStart are the sole events
  # where plain stdout becomes context (code.claude.com/docs/en/hooks). For every
  # other event the injection channel is hookSpecificOutput.additionalContext,
  # which Claude Code wraps in a system reminder at the point the hook fired.
  # A bare echo here made this pulse a silent no-op from 2026-07-05 to 2026-08-04;
  # the cadence and payload were always right, the channel was never connected.
  # Payload must stay free of `"` and `\` — it is interpolated into JSON unescaped.
  laws="schema-first models · typed errors/tagged unions · tersest helper forms · effect helper modules over native · @beep/* aliases in test imports · reuse before recreate (rg + barrels)"
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"law pulse: %s"}}\n' "$laws"
fi
