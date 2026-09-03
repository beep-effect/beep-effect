# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | complete | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | Completed 2026-08-13 via the explicit 10-wave alternative; see `research/cache-warm-lane-census.md`. |
| P1 Placement decisions | complete | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed and live-falsified 2026-08-13; see `research/placement-decision.md`. No fleet additions; the one hosted re-fit candidate remains on its existing fleet placement after two runner shutdowns. |
| P2 Execute moves | complete | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | Completed 2026-08-16: every signed zero-expansion move merged through #719. |
| P3 Evidence + close | in progress | Prove the charter on live waves and close. | The $0 hosted-shard repair landed in PR #982 (`.github/workflows/check.yml` shards and aggregators plus `beep ci lane --partition`). After merge, only a fresh representative half-open UTC week remains: attempt-one successes, effective critical path from earliest shard start through aggregator completion, required set exactly 17, and both Lint and Test Unit effective p95 below 20m00s. |

## Notes

- Prior baseline (pre-cache, hosted): Lint ~43.6m, Test Unit ~23m, Property
  Laws ~22.4m. Treat as historical only.
- ci-fleet-endgame P6 (its final close) fires when this packet delivers the
  20-minute outcome — the two packets close in that order.
- The live required set changed to 17 contexts at 2026-08-26T04:16:24Z by
  adding `Heavy / Doctest`. Its first complete current-ruleset week ends at
  2026-09-02T04:16:24Z, but the existing Test Unit breach already prevents a
  time-only close.
