# Agent Pool Picker Plan

## Status

Paused (authored 2026-09-16, not started). Resume condition: `goals/agent-pool-doctrine` merged.

## Phases

- **P0 Research — completed** in the exploration (meter proven; Cursor meter ruled out).
- **P1 Implement** — schemas → `CodexMeter` service → `pick` command → dry-marker contract in the
  runbook wrapper.
- **P2 Verify** — fixture-driven decision-table tests; one live probe.
- **P3 Yeet** — PR via `bun run beep yeet`.
- **P4 Close** — reflection; `set-status completed-retained`.

## P4 Closeout Checklist

- [ ] Reflection written; `bun run beep lint reflection-artifacts` passes.
- [ ] Runbook updated to say "run what the picker prints".

## Execution Notes

- Keep stdin open ~40 s for the rate-limit reply; send `initialize` then `initialized` first.

## Verification Commands

```sh
bun run beep quality package-verify @beep/repo-cli
test "$(wc -m < goals/agent-pool-picker/GOAL.md)" -le 4000
```
