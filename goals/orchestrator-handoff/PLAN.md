# Plan

## P1 — Register, role, HANDOFF format, skill procedures, merge gate

1. `SessionRole` on the session ledger row (optional key, old rows decode unchanged);
   `session note --role`, `session open` prints the holder.
2. `RegisterRow` schema + `OrchestratorRegister` service (JSON Lines under the workstation state
   root) + `session register add|list [--json|--markdown]`.
3. `MergeGateRead` → `decideMergeGate` (pure) → `readMergeGate` (gh REST + one GraphQL) →
   `executeMergeGate` (squash via `gh api`), exposed as `yeet merge-gate <pr> <sha>
   [--tolerate "<check>=<attribution>"] [--force-window] [--dry-run]`.
4. `orchestrate` skill: files, smart-zone rules, take-over, run table, hand-off, trigger.
5. `HANDOFF.template.md`.
6. Tests from recorded fixtures (`test/fixtures/yeet-merge-gate/`, PR #1459 at 212fe39b4f).

## P2 — Follow-ups

- `beep session handoff` renders HANDOFF.md from the register, ledger and a rulings file.
- `yeet merge-gate --table`: port `gate.sh` (REST PR list, one GraphQL thread query, pagination,
  pending commit statuses as blocking).
- `session register convert <address>`: in-process agent row → task chip or detached job.
- Codex-lane comment helper (`orchestrator:` prefix).

## P3 — Close

- One take-over performed from files alone by a fresh session; reflection recorded.
