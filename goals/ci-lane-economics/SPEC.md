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
| 2026-11-02 | D4 Test Unit is re-binned and its producers run two package steps at a time: `@beep/repo-cli` goes from four to six Vitest shards (402 s each), the two unit bins become four LPT bins over per-package wall seconds measured 2026-11-02 (every one of the 182 test-unit packages curated; 44 had been hash-placed since September), and `runCompoundCoverageSteps` runs with concurrency 2 through a buffered step group so logs do not interleave. The census accepts both shard layouts. | The window-4 preview read Test Unit at 44m27s p95 with a 32m47s median; a 60-run sample put unit-b bodies at 25.9 min p50 and repo-cli-3 at 18.5 min p95, and the producer loop ran 86 package steps strictly serially on a 4-vCPU runner (`research/test-unit-rebin-2026-11-02.md`). Rejected: eight unit bins with serial producers (14 Test Unit jobs on a queue already at 11m18s pickup p95); `--maxWorkers=2` for repo-cli (unmeasured memory headroom against the 16 GB the one-worker pin was sized for). | Revert the partition table and matrix to the 2026-09-22 layout and drop the `concurrency` argument; the census keeps judging old runs by the old layout. |
| 2026-11-02 | D5 The Lint breach (27m32s p95 in the window-4 preview) is attributed to biome's project scan and is repaired by #2526 (`3ceb6833db`, 2026-11-02), not by this packet: the project-domain rule `noDeprecatedImports` made every per-package `biome check .` index the repository (about 75 CPU-seconds, 31 s wall per package on a 4-vCPU runner; 92 tasks at concurrency 2 is the 25-minute cold body). The first cold `main` lint shards after it ran 92 and 91 uncached tasks in 31 s and 35 s. No lint shard change here. | Measured from job 124673581872 (cold lint-a, 2026-10-31) and run 41412952418 (main, after #2526). Rejected: four lint shards (halves a cost that is already gone); one biome invocation per partition (loses per-package turbo caching for nothing). | Not needed; if the scan returns, `beep lint policy` owns the root pass. |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug ci-lane-economics`; add a `kind: decision` file there, never edit this block._

### Shard @beep/law-practice-server into three Test Unit partitions, 2026-11-08

The 2026-11-02 rebin measured @beep/law-practice-server at 98 s. After #2847 registered the canonical citation corpora its Bun/Istanbul unit run takes about 2,970 s on the 4-vCPU hosted runner, so unit-d went from a 25-minute body to a 60-minute job timeout on main (runs 42417048100, 42422844786) and on #2915. The package now runs as three Vitest shards (law-practice-1..3, weight 990 each, the mechanism repo-cli-1..6 already use); unit-d keeps its other 45 packages at weight 651. check.yml lists thirteen Test Unit partitions and the lane-timings census gains the thirteen-shard layout. The per-document extraction cost itself stays with goals/citation-extraction-engine.

Lane `@slop/11-6-26` · PR #2915

Reverse: Return @beep/law-practice-server to unit-d (weight 749), drop law-practice-1..3 from the partition table, the check.yml matrix and the census layout; the census keeps judging runs by the layout they ran.

### Repack Test Unit into 8 repo-cli, 11 law-practice-server and 6 unit partitions under ten minutes, 2026-11-09

Green main run 42554761567 (2026-11-09) measured Test Unit at law-practice-1/2/3 = 23.0 / 31.6 / 22.8 min (sha1 hash shards of 1274 / 1779 / 1267 s of file time at one coverage worker), unit-c 13.9 min (serial package sum 1,175 s) and repo-cli-4 10.4 min (Vitest 532.7 s). The operator wants every hosted test job green in under ten minutes.

Every Test Unit partition is now packed by LPT from that run's per-file and per-package Vitest timings:

- `@beep/law-practice-server`: eleven shards planned by `packages/law-practice/server/vitest.shards.json` (280 files, 392.8 s of file time each, budget 480 s), applied by the shared `vitest.sequencer.ts`; predicted wall about 393 + 110 s of job overhead, about 8.4 min, and still under ten minutes if the redundant-test deletion lane does not land.
- `@beep/repo-cli`: eight shards (459 files, 263.2 s each; the 2026-11-06 six-shard plan measured 240-467 s and 322-533 s of Vitest duration); predicted about 6.5 min.
- unit bins: six (unit-a..f) over 191 packages, 593-595 s of serial sum each (budget 720 s; four bins summed 809 / 894 / 1,175 / 700 s); predicted about 8.6 min at two packages at a time plus about 180 s of setup.

`check.yml` lists the twenty-five partitions, the lane-timings census gains the layout, and `bun run beep ci partitions rebalance --check` fails when a table weight drifts from its plan or a partition exceeds its budget; `--write --run <id>` repacks from a later green run. Budgets live in `CiPartitions.schemas.ts`. The check stays on demand (it is not in the cheap lint tier) because the unit lane's `ci-partitions.test.ts` already replays it against the committed plans.

Lane `claude/silly-brahmagupta-5a4fd5`

Reverse: Restore the 13-partition layout (repo-cli-1..6 at 402 s, law-practice-1..3 at 990 s, unit-a..d) in CiLanePartitions.ts, check.yml and the lane-timings census, delete packages/law-practice/server/vitest.shards.json and restore the 2026-11-06 repo-cli plan; the census keeps judging runs by the layout they ran.

<!-- beep:decisions:end -->
