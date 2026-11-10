# GitHub Budget Ledger

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Record the cost of every GitHub request per identity, resource, command and host in a host-scoped ledger fed by x-ratelimit-* headers and the free /rate_limit, show it as a github-headroom parcel in session open, and publish the 15% reserve signal and the T3 share threshold that later goals obey.

Source exploration: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md) (MAP goal 1; provides `github/budget-ledger`).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/github-budget-ledger/GOAL.md
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
  (goal 1 of 3). Siblings: [`github-state-worker`](../github-state-worker/README.md) (requires this goal's
  ledger and reserve signal) and [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/README.md) (3a starts
  after this goal; adds the App identity as a second configured ledger identity).
- The ledger is the before/after evidence for both siblings: start the 24 h hub baseline as soon as the first
  slice merges.
