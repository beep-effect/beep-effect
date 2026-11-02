# CI Lane Economics — Spec

## Charter (inherited from ci-fleet-endgame, operator-worded)

"Endgame should just mean we don't wait 20 minutes for any job."

## Scope

Every required check lane's placement and cost: hosted ubuntu vs the
`beep-ec2-heavy` ephemeral fleet vs cache-warm free runners. Headline
offenders at split time (pre-cache p50s): Lint ~43.6m, Test Unit ~23m,
Property Laws ~22.4m on hosted.

## Constraints

- Measure before moving: the remote cache (live 2026-08-13) invalidates all
  cold-cache lane numbers. A cached lane may re-fit free hosted runners,
  attacking fleet necessity rather than adding fleet load (decision-record
  prediction).
- Fleet lanes inherit the one-job-one-VM cost model: every move to
  `beep-ec2-heavy` is EC2 minutes; the $100/mo projection and $200/mo ceiling
  from the signed decision record still govern.
- Per-slice sharding (speed-loop ledger lineage) is the lever for the
  ~9-minute type-graph import class that caching cannot touch.
- No placement change may weaken the fork-PR, cache-write, IAM, egress, or
  teardown rails.

## Exit criteria

No required job exceeds 20 minutes at p95 (attempt-one successful runs)
across a representative week of PR and push waves under any load the
orchestration doctrine admits (at most six CI-active branches,
`research/repair-decision-3.md`) — the charter says no one waits, so the
tail is the gate, not the median; queue time counts. Per-lane placement decisions
recorded; cost within the standing budget gates; rerun/flake rates tracked
separately via the attribution rules rather than laundered into percentiles.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-02 | D1 Window 4 is censused without the `beep ci slots acquire` governor signed in `research/repair-decision-3.md`, which was never built. The census carries the per-day peak CI-active branches column (ruling 6) so the verdict is attributed by observed load: a breach on a day peaking at six branches or fewer calls for the costed option B; a breach only on days above six names ungoverned load, and the governor becomes the repair. | A month passed with no governor and the operator asked for the goal to complete now; the charter is judged on the load the doctrine admits, and the column makes that load visible without first gating every push in every session. | Build the governor as its own PR and census the first complete week after it merges, as ruling 6 originally read. |
| 2026-11-02 | D2 Ruleset `10240248` version `54940515` (effective 2026-10-27T09:49:40.844Z) is ratified at exactly 15 required contexts; window 4 is `2026-10-27T10:00:00Z` → `2026-11-03T10:00:00Z`, the first seven-day span inside that population. | Eight unratified versions landed after window 3; the census fails closed on any of them. A window need not start at UTC midnight, only lie inside one population and span seven days. | Remove the row from `CI_LANE_TIMING_RATIFIED_POPULATIONS` and pick a later week. |
| 2026-11-02 | D3 The census halves any span whose GitHub run listing exceeds 1,000 runs until each half fits, instead of failing on the listing cap. | The Actions runs listing stops at 1,000 regardless of paging; window 4 has over 1,200 runs. | Drop the split in `collectCiWorkflowWindowRunPages`. |

