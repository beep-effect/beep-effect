# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | complete | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | Completed 2026-08-13 via the explicit 10-wave alternative; see `research/cache-warm-lane-census.md`. |
| P1 Placement decisions | complete | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed and live-falsified 2026-08-13; see `research/placement-decision.md`. No fleet additions; the one hosted re-fit candidate remains on its existing fleet placement after two runner shutdowns. |
| P2 Execute moves | complete | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | Completed 2026-08-16: every signed zero-expansion move merged through #719. |
| P3 Evidence + close | in progress | Prove the charter on live waves and close. | The current-ruleset week still fails at Lint 21m00s and Test Unit 24m50s. Tail attribution and the signed $0 hosted-shard repair are in `research/current-ruleset-week-p95.md`, `research/tail-attribution.md`, and `research/repair-decision.md`; implementation plus a fresh representative-week admission remain. |

## Notes

- Prior baseline (pre-cache, hosted): Lint ~43.6m, Test Unit ~23m, Property
  Laws ~22.4m. Treat as historical only.
- ci-fleet-endgame P6 (its final close) fires when this packet delivers the
  20-minute outcome — the two packets close in that order.
- The live required set changed to 17 contexts at 2026-08-26T04:16:24Z by
  adding `Heavy / Doctest`. Its first complete current-ruleset week ends at
  2026-09-02T04:16:24Z, but the existing Test Unit breach already prevents a
  time-only close.
