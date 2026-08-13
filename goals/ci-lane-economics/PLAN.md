# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | complete | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | Completed 2026-08-13 via the explicit 10-wave alternative; see `research/cache-warm-lane-census.md`. |
| P1 Placement decisions | complete | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed 2026-08-13; see `research/placement-decision.md`. No fleet additions; one fleet lane re-fits hosted; projected spend remains at or below the $100/mo gate. |
| P2 Execute moves | in progress | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | All moves merged; no regression in wave wall time. |
| P3 Evidence + close | pending | Prove the charter on live waves and close. | No required job p95 > 20 minutes over a week (attempt-one successful runs); reflection lands; lifecycle completed-retained. |

## Notes

- Prior baseline (pre-cache, hosted): Lint ~43.6m, Test Unit ~23m, Property
  Laws ~22.4m. Treat as historical only.
- ci-fleet-endgame P6 (its final close) fires when this packet delivers the
  20-minute outcome — the two packets close in that order.
