# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | complete | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | Completed 2026-08-13 via the explicit 10-wave alternative; see `research/cache-warm-lane-census.md`. |
| P1 Placement decisions | complete | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed and live-falsified 2026-08-13; see `research/placement-decision.md`. No fleet additions; the one hosted re-fit candidate remains on its existing fleet placement after two runner shutdowns. |
| P2 Execute moves | complete | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | Completed 2026-08-16: every signed zero-expansion move merged through #719. |
| P3 Evidence + close | in progress — admission denied 2026-09-21 | Prove the charter on live waves and close. | The 2026-09-04T00:00:00Z → 2026-09-11T00:00:00Z admission week was censused 2026-09-21 with `beep ci lane-timings --window` and fails: `Check` 20m19s p95, `Coverage Regression` 30m58s p95, shard-pickup tripwire 8m22s p95; see `research/admission-week-p95.md`. Lint (14m38s) and Test Unit (16m31s) clear. Close requires a ratified 17-context population, a signed repair for `Check` and the pickup queue, then a fresh half-open week with every required p95 below 20m00s and no tripwire breach. |

## Notes

- Admission verdict (2026-09-21): the 2026-09-04 → 2026-09-11 week is denied;
  see `research/admission-week-p95.md`. `Check` breaches by 19s, the removed
  `Coverage Regression` lane breaches at 30m58s inside its ratified window,
  and shard pickup p95 is 8m22s. The next window needs the 17-context
  population ratified with its effective date (2026-09-12T01:46:53Z) before
  the census can accept it.

- Operator ruling (2026-09-12): `Heavy / Coverage Regression` was removed
  after the admission window at 2026-09-12T01:46:53.354Z (ruleset `10240248`,
  version `49479116`), reducing the live population to 17. Version `48600030`,
  effective 2026-09-03T17:12:53.589Z, supplies the window's ratified 18 contexts.
  A windowed census resolves the latest history version strictly before its
  exclusive `--until`; recent-runs reporting retains live behavior. The
  census command is unchanged.

- Prior baseline (pre-cache, hosted): Lint ~43.6m, Test Unit ~23m, Property
  Laws ~22.4m. Treat as historical only.
- ci-fleet-endgame P6 (its final close) fires when this packet delivers the
  20-minute outcome — the two packets close in that order.
- The live required set changed to 17 contexts at 2026-08-26T04:16:24Z by
  adding `Heavy / Doctest`. Its first complete current-ruleset week ends at
  2026-09-02T04:16:24Z, but the existing Test Unit breach already prevents a
  time-only close.
- The live required set changed to 18 contexts at 2026-09-03T17:12:53Z by
  adding `JSDoc Ratchet`. The 2026-09-04 through 2026-09-11 admission window
  runs entirely under that population, so the census expects exactly 18.
