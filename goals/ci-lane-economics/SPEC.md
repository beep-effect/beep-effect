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

Lane @slop/11-6-26 · PR #2915

Reverse: Return @beep/law-practice-server to unit-d (weight 749), drop law-practice-1..3 from the partition table, the check.yml matrix and the census layout; the census keeps judging runs by the layout they ran.

### Bare local coverage defaults to the affected plan; law-practice-server gets its own shard, 2026-11-09

Tier 1 of the 2026-11-09 test/coverage efficiency plan (41-agent workflow, HEAD 33b9f1cb31).

**P9.** A bare local `bun run coverage` is no longer the full proof. Outside CI, with none of `--filter`, `--since`, `--affected`, `--write-baseline`, `--replace-all`, `--add-missing-files-only` or the new `--full`, the root task plans `--affected` against `TURBO_SCM_BASE` or the origin/main merge base, the same plan `yeet final-check` runs, and prints the base and the owners (or the full-fallback reason) on `[beep-cli]` lines. `--full` is the sharded whole-workspace proof; CI keeps it as the default. Hosted Test Unit remains the proof of record; nothing under `.github/workflows` changes and `coverage:baseline:write` is untouched. EF-20 names only `bun run test`, so no done-gate amendment is needed.

**P5a.** The shard weight tables from #684 (run 31727475076) and #707 (run 31766791221) weighed `@beep/law-practice-server` at 51.7 and 103.9 s; the 2026-11-09 baseline showed shard-4 (law-practice-server plus 24 packages at one Vitest worker) still running at 1778 s while repo-cli's shard finished at 1205 s. No hosted run exposes per-task coverage durations any more (hosted coverage is produced inside the Test Unit partitions; the Heavy / Coverage Regression job is the comparator), so one measured local table replaces both: 190 packages from the baseline run's Turbo summaries and law-practice-server from one solo run at the shard topology (2679.9 s wall, 4692.7 s user + 543.9 s system, load average 28 rising to 61). With those weights the unchanged least-loaded planner gives law-practice-server and repo-cli their own shards and spreads the other 189 owners over eight mixed shards of about 252 s each. Shard count (10) and the Vitest worker cap (11) are unchanged; a second worker for law-practice-server stays tier 3 because it breaks writer/judge topology parity.

Measured on the 64-thread workstation under contention; the values are upper bounds and influence placement only.

Lane claude/fervent-darwin-040f12

Reverse: Delete resolveCoverageScopeMode's affected branch in Tasks.ts so a bare run resolves through resolveCoverageTaskOptions again (and drop the --full flag), and restore the #707/#684 weight tables in CoverageScope.ts; no baseline rows or hosted workflows changed.

<!-- beep:decisions:end -->
