# Yeet Monitor App Identity

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the Yeet monitor read-only by moving its environment-only reruns into `rerun-runner-loss.yml`, then run the per-host GitHub-state worker's reads on the beep-fleet-orchestrator App installation token through `LoadCredential=`, proving with the budget ledger that polling left the user bucket.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/yeet-monitor-app-identity/GOAL.md
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
  (goal 3 of 3). Siblings: [`github-budget-ledger`](../github-budget-ledger/README.md),
  [`github-state-worker`](../github-state-worker/README.md).
- 3a (rerun widening) starts after `github-budget-ledger` and may run
  alongside `github-state-worker`; 3b (identity switch) waits for that worker
  and 3a to merge.
