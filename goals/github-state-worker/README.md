# GitHub State Worker

## Status

Lifecycle: `paused`

**Paused by operator ruling (finish board, 2026-11-13).** It is the second of three goals in a sequence and should wait for the budget ledger to land. No lane is working on it; resume with `bun run beep goals set-status github-state-worker active` when it is picked up. Decision: [`decisions/2026-11-13-finish-board-ruling-pause.md`](./decisions/2026-11-13-finish-board-ruling-pause.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run one per-host systemd GitHub-state worker that reads each tracked PR once per cycle (fingerprint-batched GraphQL, ETag-revalidated REST) and publishes atomic PR snapshots that every Yeet and orchestrator reader consumes instead of polling GitHub itself.

Goal 2 of 3 from [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md); requires
[`github-budget-ledger`](../github-budget-ledger/README.md), feeds
[`yeet-monitor-app-identity`](../yeet-monitor-app-identity/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/github-state-worker/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started.

## Latest Evidence

Not started.

## Notes

- Source exploration: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md)
  (goal 2 of 3). Siblings: [`github-budget-ledger`](../github-budget-ledger/README.md) (prerequisite: ledger,
  reserve signal, baseline) and [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/README.md) (3a may
  run alongside this goal; 3b switches this goal's worker to the App identity after it merges).
- Blocked until `github-budget-ledger` lands (`blockedBy` in the manifest).
