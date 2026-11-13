# GitHub Budget Ledger

## Status

Lifecycle: `completed-retained`

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

P4 Close: the final PR carries the baseline, the T3 threshold decision, the reflection and the closeout.

## Latest Evidence

- Implementation: #3068 (ledger, sampler, reserve signal, `github-headroom` parcel, gh attribution, ledger-first
  `GraphqlBudget`), #3200 (per-credential buckets), #3247 (GraphQL windows as reset-scoped instances).
- Baseline: [`history/2026-11-13-hub-baseline.md`](./history/2026-11-13-hub-baseline.md). Over 24 h the token
  spent 66,701 GraphQL points (median 2,495/h, p90 5,197/h). `yeet monitor` spends about 94 points per process-hour,
  which resolves the 430 vs 720-1,440 conflict in favour of the sample.
- T3 share: upper bound median 45.6%, p90 66.4%. Threshold 60% median share and 1,500 points/h median residual
  ([decision](./decisions/2026-11-13-t3-share-threshold.md)); not fired.

## Notes

- Source exploration: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md)
  (goal 1 of 3). Siblings: [`github-state-worker`](../github-state-worker/README.md) (requires this goal's
  ledger and reserve signal) and [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/README.md) (3a starts
  after this goal; adds the App identity as a second configured ledger identity).
- The ledger is the before/after evidence for both siblings: start the 24 h hub baseline as soon as the first
  slice merges.
