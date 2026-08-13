# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | pending | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | A lane-time table from >=1 representative week (or >=10 waves) with turbo hit rates where the lane runs turbo (n/a for uses_turbo: false lanes), replacing all cold-cache numbers. |
| P1 Placement decisions | pending | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed placement table; projected spend within the $100/mo gate. |
| P2 Execute moves | pending | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | All moves merged; no regression in wave wall time. |
| P3 Evidence + close | pending | Prove the charter on live waves and close. | No required job p95 > 20 minutes over a week (attempt-one successful runs); reflection lands; lifecycle completed-retained. |

## Notes

- Prior baseline (pre-cache, hosted): Lint ~43.6m, Test Unit ~23m, Property
  Laws ~22.4m. Treat as historical only.
- ci-fleet-endgame P6 (its final close) fires when this packet delivers the
  20-minute outcome — the two packets close in that order.
