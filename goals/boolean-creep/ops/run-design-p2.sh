#!/usr/bin/env bash
# P2 driver: run all six design batches on codex, up to 3 concurrently.
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
max_jobs=3

per_id='Write ONE document per brief record at goals/boolean-creep/designs/<id>.md (the id field is the filename).'

run() { "$script_dir/run-design-batch.sh" "$@" & }

running=0
gate() {
  running=$((running + 1))
  if [ "$running" -ge "$max_jobs" ]; then
    wait -n || true
    running=$((running - 1))
  fi
}

run family-cli-mode-flags \
  'Write ONE document at goals/boolean-creep/designs/family-cli-mode-flags.md: a shared family design followed by a full per-instance section (all 9 parts) for each of the 10 brief records.' \
  'FAMILY NOTE: all 10 instances are exclusive/implied CLI mode flags. The repo already ships collapse infrastructure at packages/tooling/tool/cli/src/internal/cli/RunMode.ts (resolveRunModeFromFlags, runModeFlagsConflict) — the family design must reuse or extend it, and check whether the effect v4 unstable/cli Flag layer supports parsing straight to a literal (validate against .repos/effect). Several target literals already exist (BakeMode, SkillsRunMode, TsconfigSyncMode, SyncDataRunMode). docgen-local-json-requires-plan is the one implication variant (json => plan), target option-literal.'
gate

run tooling "$per_id" \
  'TIER 2 NOTE: yeet-merge-ready-verdict is persisted (.beep/yeet JSON); the legacy normalizer precedent lives in the same Verdict.ts file. create-package-template-type-flags and create-package-template-app-kind-flags share TemplateContext — design them together as two documents with a shared migration inventory; note the template-engine consumers of those booleans.'
gate

run foundation "$per_id" \
  'REUSE NOTE: color-support-level-flags must reuse the ColorSupportLevel value already stored beside the flags; foundation-ui-system-speech-input-connection must pass through scribe.status instead of minting a new literal.'
gate

run drivers "$per_id" \
  'TIER 2 NOTE: nlp-mcp-file-info-exists is an MCP tool output — the encoded wire JSON must stay stable (design the decoded union behind an encoded transformation). xai-sse-done-payload and venice-sse-done-payload are twins: cross-reference a shared target pattern in both documents.'
gate

run domains "$per_id" \
  'TIER 2 NOTE: vault-sync-status-connected carries an explicit older-sidecar decoding-compat contract (see the comment above disconnectReason in VaultSyncEngine.ts) — the encoded shape must keep decoding old sidecar output. dms-mirror-probe-connected is its sibling shape; align the two designs on one connected-state union.'
gate

run apps-agents "$per_id" \
  'PAIR NOTE: thread-transcript-load-state (Thread.atoms.ts) and thread-load-state-props (Thread.tsx) are the same creep across the atom and its props — two documents sharing one literal design.'

wait
echo "[design] P2 driver done"
