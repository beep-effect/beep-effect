# CI Lane Economics Plan

## Status

Status: `active`

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Cache-warm census | complete | Re-measure every required lane's p50/p95 on cache-warm PR and push waves (attempt-one successful runs only; failures and reruns feed flake attribution, never the percentiles). | Completed 2026-08-13 via the explicit 10-wave alternative; see `research/cache-warm-lane-census.md`. |
| P1 Placement decisions | complete | Decide fleet vs hosted vs free re-fit per lane from the census plus cost model. | Signed and live-falsified 2026-08-13; see `research/placement-decision.md`. No fleet additions; the one hosted re-fit candidate remains on its existing fleet placement after two runner shutdowns. |
| P2 Execute moves | complete | Move lanes per the placement table (workflow lane edits; sharding where caching cannot help). | Completed 2026-08-16: every signed zero-expansion move merged through #719. |
| P3 Evidence + close | in progress — two windows denied, repair path | Prove the charter on live waves and close. | Window 1 (2026-09-04 → 2026-09-11, 18 contexts) denied 2026-09-21: `Check` 20m19s, `Coverage Regression` 30m58s, pickup 8m22s (`research/admission-week-p95.md`). Window 2 (2026-09-13 → 2026-09-20, ratified 17 contexts) denied 2026-09-22: `Test Unit` 22m02s, `Lint Policy` 21m59s, pickup 7m47s; `Check` recovered to 8m22s (`research/admission-week-2-p95.md`). Repair moves (`research/repair-decision-2.md`): #1195 `Test Unit` shard split merged 2026-09-22, #1194 refs-check quiet listing merged 2026-09-22T16:34Z; `Lint Policy` handed to `goals/time-to-certainty` C4 (measured, not repaired, here); window 3 is `2026-09-23T00:00:00Z` → `2026-09-30T00:00:00Z`, censused on or after 2026-09-30T00:00Z, then close only when every required p95 under the ratified population is below 20m00s and no tripwire breaches. |

## Notes

- Window-3 retarget (2026-09-24): the last repair merge is #1194 at
  2026-09-22T16:34Z, so window 3 is the first complete half-open UTC week
  after it, `2026-09-23T00:00:00Z` → `2026-09-30T00:00:00Z`; the admission
  census runs on or after 2026-09-30T00:00Z. A preview over the first 1.9
  days (`--until 2026-09-24T22:00:00Z`, exit 0, 17 contexts resolved) showed
  every required lane under 20m00s and pickup at 2m50s p95 (n=180); `Test
  Unit` 14m21s p95 (p50 11m31s) against 22m02s in window 2, `Lint Policy`
  19m51s p95 (p50 16m48s). The two `repo-cli` halves, read from the same
  runs as attempt-one successful job spans (started to completed, 25 jobs
  each, 19 cold at or above 240 s): `repo-cli-1` cold p50 676 s, max 717 s;
  `repo-cli-2` cold p50 644 s, max 696 s, both under the 756–814 s
  projection with 32 s of hash skew; `unit-a`/`unit-b` cold p50 619 s/605 s.
  A preview is not an admission: the verdict is the full-week census only,
  and the `--preview` guard that enforces that in `beep ci lane-timings`
  landed in #1219.

- Repair decision (2026-09-22): `research/repair-decision-2.md` keeps
  `Test Unit` on free hosted runners and splits the `repo-cli` shard through an
  optional `shard {index,total}` field on `CiLanePartition` (#1195, merged
  2026-09-22), with the refs-check quiet listing (#1194, merged 2026-09-22T16:34Z) as
  a companion. The shard-merge option was dropped on cold arithmetic: `unit-a`
  and `unit-b` weigh 1214 s cold each, so a merged bin is 2428 s serialized,
  about 1214 s of body at concurrency two, plus 316–374 s setup gives
  25m30s–26m28s; `lint-a` and `lint-b` weigh 1132 s and 1134 s, so merged
  they are 2266 s serialized, about 1133 s at concurrency two, giving
  24m09s–25m07s. Merging moves the breach instead of removing it. `Lint Policy` is measure-only for window 3
  (6–9 min observed on the fleet since #1180); the window-3 verdict decides
  whether `goals/time-to-certainty` C4 is pulled forward.

- Population ratification (2026-09-22): ruleset `10240248` version `49479116`,
  effective 2026-09-12T01:46:53.354Z, is ratified at exactly 17 required
  contexts (`Heavy / Coverage Regression` removed). The census command now
  carries a ratified population table keyed by history version (48600030 at
  18, 49479116 at 17) and fails closed by name on any version the packet has
  not ratified. The first complete half-open UTC week under the 17-context
  population is `2026-09-13T00:00:00Z` → `2026-09-20T00:00:00Z`.

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
  census flags are unchanged; the expected count now comes from the ratified
  population table (2026-09-22) instead of a fixed 18.

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
  ran entirely under that population, so its census expected exactly 18 and
  was denied on 2026-09-21 (see the admission verdict above). That 18-context
  expectation applies only to that window; the next window expects the
  17-context population effective 2026-09-12T01:46:53Z once ratified.
