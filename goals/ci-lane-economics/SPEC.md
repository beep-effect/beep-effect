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
across a representative week of PR and push waves at the load the operator
runs (15 to 20 CI-active branches, operator ruling 2026-11-13; the six-branch bound of
`research/repair-decision-3.md` is withdrawn) — the charter says no one waits, so the
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

### Allocate only planned test partitions on pull requests; sweep property tests only and split Property Laws, 2026-11-09

Measured on main run 42677073526 and five pull-request runs of 2026-11-09: one Check run asked for 66 to 70 hosted jobs at once against the organization's 60 concurrent hosted jobs, so Test Unit and Test Integration shards waited up to 9.8 minutes for a runner whenever two runs overlapped and the two aggregates reported 15 to 20 minutes after the run's first job. On a pull request that touched only repo-cli (run 42697058070) 35 of the 47 shard jobs took a runner for about 75 seconds of setup to run nothing. Property Laws ran 17.7 to 23.2 minutes cold.

**Planned partitions.** The Check workflow gains a `Test Plan` job. On a push it publishes every partition of both lanes. On a pull request it runs the lane selection once per lane (`ci lane test-unit --plan-partitions`, `ci lane test-integration --plan-partitions`) and publishes the partitions that carry a selected task; the Test Unit plan uses the instrumented shape, so the coverage planner's owners and its full fallback are part of the selection. The shard matrices are built from the plan. Three checks keep a partition that was not allocated from reading as a pass: every allocated partition receives the plan through `--planned-partitions`, re-derives it from its own selection and fails with `unplanned-partition` when one with selected tasks is missing; Coverage Regression requires a manifest from every partition its own owner plan gives a package to (an expected-empty partition may be absent); and both aggregates fail unless the plan job succeeded and the plan is a JSON array of known partitions. Test Integration always plans `int-rest`, so its aggregate has no empty-plan skip. The plan costs one job of about 90 seconds on a pull request before the shards are allocated, and nothing on a documentation-only diff beyond the classification.

**Property Laws.** Two changes. The deep sweep now selects at test level as well as file level: in a file whose relative import graph never runs a property inline, a test whose registration line is positively a plain `it(...)` or `it.effect(...)` is skipped at collection, and suites left with no runnable test skip their hooks. The floor reaches a test only through `fcRuns` options or an inline property call, so a plain test replayed at 400 runs repeats the Test Unit lane's result. Anything not positively plain keeps running. The rules live in `packages/tooling/test-kit/fc-runs/src/PropertySelection.ts` with unit tests and are applied by `vitest.property-runner.ts`. On repo-cli the local sweep fell from 4,682 tests in 8:05 to 1,387 tests in 3:09 with 3,300 skipped. The hosted lane also splits into two slices with complementary Turbo filters (repo-cli alone, every other package) under one `Property Laws` aggregate, because repo-cli's task used to start about six minutes in, behind the other 85 packages.

**Not changed.** Main-branch Check runs share one concurrency group without cancel-in-progress. GitHub keeps one pending run per group, so a later merge cancels the run that was waiting: 82 of the last 100 push runs on main (2026-11-08 02:09Z to 2026-11-09 21:51Z) were cancelled, and nine of twelve sampled had started no job. Giving each main commit its own group would let every commit finish, at the price of overlapping runs that each ask for about 70 hosted jobs; that trade needs runner-capacity evidence and is left for its own decision.

Lane practical-poincare

Reverse: Put the two ALL_* partition lists back into the shard matrices in check.yml and delete the Test Plan job, the --planned-partitions arguments and the plan terms of both aggregates; remove the runner block from vitest.shared.ts to return to file-level sweep selection; fold the two Property Laws slices back into one job. No baseline rows or shard plans change.

### Bare local coverage defaults to the affected plan; law-practice-server gets its own shard, 2026-11-09

Tier 1 of the 2026-11-09 test/coverage efficiency plan (41-agent workflow, HEAD 33b9f1cb31).

**P9.** A bare local `bun run coverage` is no longer the full proof. Outside CI, with none of `--filter`, `--since`, `--affected`, `--write-baseline`, `--replace-all`, `--add-missing-files-only` or the new `--full`, the root task plans `--affected` against `TURBO_SCM_BASE` or the origin/main merge base, the same plan `yeet final-check` runs, and prints the base and the owners (or the full-fallback reason) on `[beep-cli]` lines. `--full` is the sharded whole-workspace proof; CI keeps it as the default. Hosted Test Unit remains the proof of record; nothing under `.github/workflows` changes and `coverage:baseline:write` is untouched. EF-20 names only `bun run test`, so no done-gate amendment is needed.

**P5a.** The shard weight tables from #684 (run 31727475076) and #707 (run 31766791221) weighed `@beep/law-practice-server` at 51.7 and 103.9 s; the 2026-11-09 baseline showed shard-4 (law-practice-server plus 24 packages at one Vitest worker) still running at 1778 s while repo-cli's shard finished at 1205 s. No hosted run exposes per-task coverage durations any more (hosted coverage is produced inside the Test Unit partitions; the Heavy / Coverage Regression job is the comparator), so one measured local table replaces both: 190 packages from the baseline run's Turbo summaries and law-practice-server from one solo run at the shard topology (2679.9 s wall, 4692.7 s user + 543.9 s system, load average 28 rising to 61). With those weights the unchanged least-loaded planner gives law-practice-server and repo-cli their own shards and spreads the other 189 owners over eight mixed shards of about 252 s each. Shard count (10) and the Vitest worker cap (11) are unchanged; a second worker for law-practice-server stays tier 3 because it breaks writer/judge topology parity.

Measured on the 64-thread workstation under contention; the values are upper bounds and influence placement only.

Lane claude/fervent-darwin-040f12

Reverse: Delete resolveCoverageScopeMode's affected branch in Tasks.ts so a bare run resolves through resolveCoverageTaskOptions again (and drop the --full flag), and restore the #707/#684 weight tables in CoverageScope.ts; no baseline rows or hosted workflows changed.

### Repack Test Unit into 11 repo-cli, 12 law-practice-server and 7 unit partitions under ten minutes, 2026-11-09

Green main run 42554761567 (2026-11-09) measured Test Unit at law-practice-1/2/3 = 23.0 / 31.6 / 22.8 min (sha1 hash shards of 1274 / 1779 / 1267 s of file time at one coverage worker), unit-c 13.9 min (serial package sum 1,175 s) and repo-cli-4 10.4 min (Vitest 532.7 s). The operator wants every hosted test job green in under ten minutes.

Every Test Unit partition is now packed by LPT from that run's per-file and per-package Vitest timings:

- `@beep/law-practice-server`: twelve shards planned by `packages/law-practice/server/vitest.shards.json` (279 files after #3009, 375 s of worst-case file time each, budget 480 s), applied by the package-local `LawPracticeSequencer` (`packages/law-practice/server/vitest.integration.sequencer.ts`), which also applies #3005's sixteen-shard integration plan and keeps Vitest's hash split for any other shard count; repo-cli's plan is applied by `makeMeasuredSequencer` in the root `vitest.shared.ts` (hashed by every Vitest Turbo task). Each file is weighted at its largest measurement over PR #3007's five green runs on pull-request runners (42607991192, 42615698428, 42626103000, 42637312401, 42646019844; `rebalance --write` takes `--run` repeatedly): a plan packed from one run let eleven shards of 393 s vary 0.6x to 1.3x (235 to 505 s, 5.7 to 10.1 min), so the worst case is what the plan carries.
- `@beep/repo-cli`: eleven shards (460 files; ten planned at 305.9 s of worst-case file time and one carrying `test/research-library-views.test.ts` alone at 449 s). repo-cli tests run about 1.5x slower on pull-request runners than on the main run (3,128 s against 2,106 s of file time on the same files), so the plan is measured on the PR runs, and the three suites whose duration swings 1.6x to 2.2x between runs (`research-library-views`, `research-library-replay`, `coverage-artifacts`) are weighted at their slowest run: on run 42637312401 repo-cli-3 took 10.8 min because its single-run plan weighed `test/research-library-replay.test.ts` at 172 s and it ran 284 s. Nine shards of 374.8 s worst-case file time still ran 6.7 to 10.4 min on run 42646019844 (a 57-file shard carries about 215 s of job and transform overhead on top of its file time), so the family widened to eleven: about 306 s of file time keeps every shard near 8.7 min with that overhead. `research-library-views` alone exceeds the ten-minute target in its worst run (449 s of file time plus the overhead; 8.5 min on run 42646019844); it is reported to its owner as a test defect (seven 16.7 s and three 20 s cases that look like real timeouts), not hidden by more shards.
- unit bins: seven (unit-a..g) over 191 packages, 582-583 s of serial sum each at every package's worst measurement over the five green runs (budget 720 s; four bins summed 809 / 894 / 1,175 / 700 s on main). Six bins of about 595 s were tried first on PR #3007 and unit-a still ran 10.7 min because Turbo's two-at-a-time order left its 292 s package for last; seven bins packed from one run at 453 s ran 5.1 to 9.6 min, and the worst-case repack keeps the seven while balancing what actually swings. `@beep/infra`, `@beep/storybook`, `@beep/drizzle` and `@beep/effect-drizzle` had no measurement in those runs and kept their bins.

`check.yml` lists the thirty Test Unit partitions, the lane-timings census gains the layout, and `bun run beep ci partitions rebalance --check` fails when a table weight drifts from its plan or a partition exceeds its budget; `--write --run <id> [--run <id>...]` repacks from later green runs at each file's worst measurement. Budgets live in `CiPartitions.schemas.ts`. The check stays on demand (it is not in the cheap lint tier) because the unit lane's `ci-partitions.test.ts` already replays it against the committed plans.

Lane claude/silly-brahmagupta-5a4fd5

Reverse: Restore the 13-partition layout (repo-cli-1..6 at 402 s, law-practice-1..3 at 990 s, unit-a..d) in CiLanePartitions.ts, check.yml and the lane-timings census, delete packages/law-practice/server/vitest.shards.json together with the unit-plan branch of LawPracticeSequencer (restoring the integration-only sequencer of #3005) and restore the 2026-11-06 repo-cli plan; the census keeps judging runs by the layout they ran.

### Start each unit bin's heaviest packages first and split the 449 s repo-cli test file, 2026-11-09

Main run 42677073526, the first on the 11/12/7 layout, ran every Test Unit shard under ten minutes except unit-b at 10.2 min; repo-cli-1 ran 9.8 min there and over ten on two of the next four pull-request runs. All seven bins had the same serial sum (582 s), so the repack was not the cause. The lane runs two package steps at a time in name order, and unit-b's 309 s package (`@beep/repo-ai-metrics`) started 162 s in and then ran alone: the bin body took 471 s against 265 to 448 s for its siblings.

- A unit bin row now carries `startFirst`: its packages measured at 30 s or more, heaviest first. The lane starts those before the rest (`ciLaneStartOrder`), so a bin's body stays near the larger of its heaviest package and half its serial sum.
- `beep ci partitions rebalance --write` prints each bin's `startFirst` list with the measured seconds.
- `test/research-library-views.test.ts` was one 434 to 449 s file, so `repo-cli-1` held it alone and ran 9.0 to 10.7 min over five runs. The file is split at the test that halves its measured time: `research-library-views.test.ts` keeps the view and integrity tests, `research-library-evidence.test.ts` takes the evidence-binding and correction tests, and `test/support/ResearchLibraryViews.ts` holds the shared fixture. The plan seeds the halves at 221 s and 228 s, the old file's worst measurement divided by the per-test seconds of main run 42677073526, until a green run measures them.
- The bins and both shard plans are refolded over six green runs (five on PR #3007 and main run 42677073526): repo-cli eleven shards of 321 s, law-practice-server twelve of 376 s after pruning two deleted files, unit bins 593 to 594 s.
- Rejected: an eighth unit bin. It lowers the serial sums but leaves the start order to chance, which is what made unit-b slow.

The rerun of PR #3007's last head (42669948388) could not be folded: GitHub returns 502 for its jobs listing.

Lane perf/unit-bins-fold-main-run

Reverse: Remove the startFirst lists from the unit bins in CiLanePartitions.ts and the ciLaneStartOrder call in CiCoverage.ts; steps then run in name order again. Undo the split by moving the tests of research-library-evidence.test.ts back into research-library-views.test.ts and pruning the plan.

### Create a run's test shards before its non-test lanes and cap shard timeouts at 20 minutes, 2026-11-10

A full Check run asks for about 75 hosted jobs against a 60-job concurrency cap, so a run queues on itself even when the pool is free. GitHub creates a job when its `needs` finish and hands out runners roughly in creation order (about 90 percent of job pairs created more than a minute apart are admitted in order). The test shards wait on Change Profile and Test Plan, while eleven non-test lanes waited on Change Profile alone, so they were created first: on quiet main run 42726850927 eight test shards waited 0.4 to 1.3 min while twelve of that run's own non-test jobs took runners.

- Repo Sanity, Ecosystem Contracts, Shadcn Lint, Codegen Drift, Labs, the Lint shards, Professional Desktop IPC Stdio, the Property Laws shards, Fallow Advisory Envelopes, JSDoc Ratchet and Nix Shell now also wait on Test Plan and Heavy Admission, so they are created no earlier than the Test Unit and Test Integration shards.
- The lanes depend on neither job's result. Each condition is `!cancelled()`, an explicit check that Change Profile succeeded, and the lane's former condition: a failed Test Plan or Heavy Admission still lets the lane run, and a failed Change Profile skips it as before.
- The jobs with no `needs` (Commitlint, Secret Scanning, Security, SAST, PR Size Label) are unchanged, as are check names, required contexts and the planned-partition logic.
- Shard timeouts drop to 20 min (Test Unit and Property Laws from 60, Test Integration from 30); the slowest measured shard ran 11.2 min. Rerun Runner Loss re-runs only jobs annotated as having lost communication with the server, so a timeout is not re-run.
- Expected effect: up to 1.2 min less shard queue on a quiet run, 0 to 0.4 min on a busy one. The non-test required checks report about 1.3 to 1.5 min later. This does not bring busy-period verdicts under ten minutes.

Lane perf/ci-shards-before-lanes

Reverse: In check.yml restore needs: [change-profile] and the bare docs_only condition on the eleven lanes, and restore the 60, 30 and 60 minute shard timeouts. One commit, no state.

### Run sharded Test Unit jobs on two Vitest workers and split the 344 s replay file, 2026-11-10

The same plan ran `repo-cli-3` in 7.5, 8.3 and 11.2 min on three main runs. Over the eight green runs since PR 3028 (240 Test Unit job logs) a hosted runner is between 0.45 and 1.44 times the median speed (p90 1.19, p95 1.28, 184 shard jobs); once the runner is removed, a file varies by 6 percent at p90. So the variance is the runner, and a plan sized for the median runner breaks on a slow one.

- Adding shards does not help. A full main run already requests 72 hosted jobs against the 60-job concurrency cap; a queue simulation at that cap puts a 39-job Test Unit layout at 11.2 min after the first job start and a 33-job one at 9.9, against 9.2 today.
- Sharded Test Unit jobs now run two Vitest workers. A sharded job runs one coverage producer and used one of the four vCPUs (run 42726850927, `repo-cli-3`: 562 s of Vitest for 452 s of file time). A unit bin already runs two one-worker producers side by side on the same runner, so the worker count and memory are the ones the bins use.
- Integration shards keep one worker: two workers gave them no gain and pushed native replays past their deadlines (PR 3005).
- `test/research-library-replay.test.ts` was 344 s on a median runner, more than a ten-minute job can hold on a slow runner at any shard count. It is split in two with no test body changed.
- The first push kept the 11 / 12 / 7 layout to measure. Run 42732848457: all 30 Test Unit jobs green, no memory kill and no flake. File seconds rose 1.19 times for repo-cli and 1.30 times for law-practice-server against the one-worker medians, and Vitest finished in 0.66 and 0.73 of the one-worker time (2,678 s for repo-cli, 2,421 s for law-practice-server).
- The counts are cut to what a p95 runner (1.28 times the median) finishes inside ten minutes with 10 percent of plan imbalance: nine repo-cli shards (about 298 s of Vitest each, 9.0 min at p95, 10.0 at the slowest runner seen) and eight law-practice-server shards (303 s, 8.8 and 9.8 min). The seven unit bins are unchanged: 9.5 min at p95; unit-b reaches 10.6 min at 1.44 times the median because one package (ai-metrics, 298 s) bounds it. Test Unit drops from 30 to 24 jobs and a full run from 76 to 70 hosted jobs.
- Each sharded family carries its own file budget (490 and 690 planned seconds), derived from the Vitest seconds one planned second cost on that run. The one-worker 480 s budget still governs the integration shards.
- Rejected: sizing one-worker shards for the slowest runner (33 jobs: 13 repo-cli, 10 law-practice-server, 8 unit bins and a two-shard pair for the ai-metrics package). It holds ten minutes at 1.44 times the median but adds queueing. It stays the fallback if two workers show contention above 1.3, a memory kill or a deadline flake.

Lane perf/unit-shards-two-workers

Reverse: Set CI_COVERAGE_SHARD_WORKERS_ARG in CiCoverage.ts back to --maxWorkers=1, restore the removed partition ids in CiLanePartitions.ts and check.yml, and re-plan the shards for one worker (13 repo-cli, 10 law-practice-server, 8 unit bins plus a two-shard pair for the ai-metrics package). Undo the split by moving the tests of research-library-replay-integrity.test.ts back into research-library-replay.test.ts and pruning the plan.

### Split Property Laws into four slices and create them with the test shards, 2026-11-10

Property Laws was the last test verdict over ten minutes on main: +11.2 min on run 42742264509 while Test Unit landed at +9.3 and Test Integration at +8.7. Two causes, both measured over the 21 completed Check runs since PR 3030.

- The slices had no headroom. `repo-cli` ran 5.7 to 7.9 min (median 7.1, 17 runs with its sweep selected) and a full `rest` 8.0 to 9.5 min (four full runs). Hosted runners vary up to 1.44 times the median, so neither fits ten minutes on a slow runner.
- PR 3046 put the Property Laws shards behind Heavy Admission with the non-test lanes, so they were created at +1.5 min on that run.

Changes:

- Four slices instead of two. `repo-cli-1` and `repo-cli-2` are the two Vitest shards of the repo-cli sweep (335 s of Vitest as one). `foundation-drivers` takes the foundation and drivers package directories and `rest` everything else: 835 and 812 of the 1,647 serial seconds the 85 other packages took on run 42742264509. The directory filters are complements, so no package table is needed; a Turbo dry run selects 51, 34 and 1 packages with no overlap and none missing out of 86.
- The lane command takes several Turbo filters separated by commas and a Vitest shard, forwarded behind Turbo's separator.
- The Property Laws shards wait on Change Profile and Test Plan, like the Test Unit and Test Integration shards, and keep the explicit fail-closed condition. The aggregate and its name are unchanged.
- Projection: each slice about 4.5 to 5.5 min on a median runner, under 8.5 min at 1.5 times that. Cost: two more hosted jobs on a full run (72 requested).

Lane perf/property-laws-under-ten

Reverse: In check.yml restore the two-slice matrix [repo-cli, rest] with its two filters and put admission back in the shard job's needs; the comma-separated filter and shard options of the lane command can stay unused.

### Coverage Regression reads a single coverage artifact in the same layout as several, 2026-11-13

Defect (attributed by the CI goals finish driver, 2026-11-13): on PR #3284, a diff that plans no Test Unit shard, run 43496613037, `Heavy / Coverage Regression` (job 132135174237) failed in `Compare coverage evidence` before any comparison: `jq: error: Could not open file .beep/ci-coverage-inputs/unit-coverage-43496613037-1-labs/manifest.json: No such file or directory`, exit 2. Labs had succeeded and uploaded `unit-coverage-43496613037-1-labs` (430 bytes).

Cause: `actions/download-artifact` v8.0.2 (SHA 9000827ccba6bdab643e8b6fd33ac0654aef8333) downloads a pattern's matches to `path` when `isSingleArtifactDownload || inputs.mergeMultiple || artifacts.length === 1`, and to `path/<artifact name>` otherwise (`src/download-artifact.ts`). A pattern with exactly one match is therefore extracted flat whatever `merge-multiple` says, and the job log reads `Starting download of artifact to: …/.beep/ci-coverage-inputs` with no artifact-named directory. Since #3258 and #3256 a run with no Test Unit shard is common, so Labs is often the only `unit-coverage-<run>-*` artifact.

Fix: a `Normalize coverage evidence layout` step between the download and the comparison. When `.beep/ci-coverage-inputs/manifest.json` exists at the root and no `unit-coverage-*` directory does, it rebuilds the artifact name `unit-coverage-<run>-<attempt>-<partition>` from that manifest's own `partitionId` and identity and moves the root's files under it. It refuses a manifest of another run, an attempt above the current run attempt, a partition outside `[a-z0-9-]`, unparseable JSON, or a root manifest beside an artifact directory. Several artifacts and no artifact are left as they are. The comparison's Labs check (`.partitionId == "labs"`, this run, the authenticated producer attempt) is unchanged, so an older or foreign artifact is never accepted and a missing Labs artifact still fails. `beep ci lane coverage --compare-only` globs `**/manifest.json` under the input and reads each slice beside its manifest, so it reads either layout; the step gives it the per-artifact layout it gets from two or more artifacts.

The other download-artifact consumers do not share the hazard: heavy.yml and hub-pipe-security.yml and catalog-regeneration.yml download by id or name and read the flat layout they get; release-desktop.yml downloads by pattern but finds manifests and assets with `find` at any depth.

Window 5: the change adds one step to an existing job. It changes no job name, `needs`, runner, `if` or required context, so it is not a lane-affecting change for window 5.

Lane fix/ci-coverage-single-artifact

Reverse: Revert the PR: delete the Normalize coverage evidence layout step from check.yml, its contract test and its census prelude entry.

### Judge the charter at 15 to 20 CI-active branches and move test shards to the self-hosted pool, 2026-11-13

Operator ruling 2026-11-13 (about 05:50Z, relayed by the orchestrator). It replaces D1's load bound and repair decision 3's ruling that the charter is judged at six or fewer CI-active branches.

**Evidence.** Preview census `2026-11-10T04:00Z` to `2026-11-13T05:40Z` (373 Check runs, 15 required contexts, ruleset version `54940515`; `research/window-5-preview-2026-11-13.md`): Test Unit p95 24m00s (p50 12m56s), shard pickup p95 13m32s against the 5m00s tripwire (n=3,944), and peak CI-active branches of 8, 9 and 17 on the three days with runs. No day was at or under six. On main run 43370160740 every hosted job waited 10 to 16 minutes for a runner while the slowest body ran 9m05s: about 70 hosted jobs per run against the 60-job concurrency cap, with 11 runs queued.

**Ruling.**

- The charter is judged at the load the operator actually runs: about 15 to 20 CI-active branches. A window passes or fails at that bound; a day above 20 is reported, not excused.
- The six-branch fan-out governor signed in repair decision 3 is not built.
- The test shards (Test Unit, Test Integration, Property Laws) move from GitHub-hosted `ubuntu-24.04` to the existing self-hosted EC2 pool. No new paid service. The runner scaler baseline (`RUNNERS_MAXIMUM_COUNT`, 2) is not raised permanently without the operator: the driver sizes the runners the shards need at about 20 branches and brings that number with an estimated monthly EC2 delta first.
- The workflow edits that change shard labels are hand-merged by the operator and land after #3215.
- The census fixes (a verdict-wait column per required context, Test Integration shards in the population) and the hosted job diet go ahead.
- Window 5 starts after those land and is measured at the new bound.

Window 4 (`2026-10-27T10:00Z` to `2026-11-03T10:00Z`) was previewed on 2026-11-02 and never censused as a full week; its layout was superseded by D4 and the 2026-11-08 to 2026-11-10 repacks, so it stays a preview and admits nothing.

Lane chore/ci-goals-finish

Reverse: Restore the six-branch bound of repair decision 3 and build the pre-push governor; return the shard jobs to ubuntu-24.04 in check.yml.

### Local skills are not hashed in skills-lock.json, 2026-11-13

Of the 39 entries in `skills-lock.json`, 34 are `local`, and each carried `installedTreeHash`. For 33 of them that hash is a function of tracked files only, so it told git nothing new, yet every pull request that edited the skill had to rewrite its line. Skills several lanes edit at once (yeet, closeout) made #3226, #3241, #3248, #3250, #3251 and #3254 conflict on one line on 2026-11-13, and `main` drifted red twice (#3217, #3245).

Decision: a repo-authored skill entry is `_tag` and `installedTargets` only. `skills update --check` and `--check --offline` read both installed targets, hash them on the fly and require them to agree, and still validate frontmatter, the Codex configuration and the set of skills and targets against the lock. The five vendored entries keep their upstream pin, patch series and effective-tree hashes. `adhd`, the one local skill refetched from a floating upstream, keeps `installedTreeHash`: it records the tree `skills update` last fetched, which is the only thing an offline check can compare a hand edit of that skill with, so removing it would have weakened the Repo Sanity step.

The schema keeps `installedTreeHash` as an optional key so a lock written before this change still decodes. On a repo-authored entry it counts as lock drift and `skills update` drops it; the same pull request migrates the committed lock. After this the lock changes only when a skill is added, removed, retargeted, vendored or refetched.

No goal packet owns the skills tooling; this packet holds the decision that put the lock check in Repo Sanity, and the cost removed here is pull-request conflicts and the reruns they cause.

Lane fix/skills-lock-local-unhashed

Reverse: restore installedTreeHash for local entries and the hash comparison

### Prepare the shard overflow cutover without applying anything, 2026-11-13

Enablement step 4 of the shard overflow list (#3256), prepared as one pull request the operator merges by hand, after steps 2 and 3 exist.

- **Caller.** `check.yml`'s `test-unit-overflow` calls `beep-effect/beep-effect/.github/workflows/shard-overflow.yml@main`, the one definition the `beep-shard-overflow` runner group admits, and the routing step passes `--callee pinned` so pull requests from this repository route too. `ci-shard-overflow.test.ts` now requires the pinned pair; going back means both lines together.
- **Binary pin.** Test Plan's routing step runs the pinned CI binary, and `beep-ci-202927595d64` predates `ci shard-overflow`. The pin moves to `beep-ci-a56516d6d309`, which `Publish Beep CI Binary` compiled from #3256's merge commit (`a56516d6d30`), sha256 `6dfe082d...`. The asset was downloaded, its sha256 checked against the release digest and the pin, and `beep-linux-x64 ci shard-overflow --help` answered. The release is built from `main`, not from this pull request's head, as the pin rule requires.
- **Stack config.** `infra/ci-runners/Pulumi.production.yaml` gains `ciShardOverflow:enabled: "true"` and the overflow webhook secret's parameter ARN; `ciShardOverflow:heavyBurstCap` stays at its default of 8. No workflow applies the stack, so merging creates nothing; the next attended apply of `infra/ci-runners` creates the overflow controller, which is why the runner group (step 2) and the parameter (step 3) come before this merge.
- **Preview fix.** The first read-only `pulumi preview --refresh` of the enabled pool failed with six errors: `CiFleetController` looked up the overflow pool's termination-watcher functions for its KMS decrypt grants, and in a preview `dependsOn` did not defer the lookup of functions only the apply creates, so no plan could be saved for step 5. The lookup's name now waits on the module's build-queue ARN, unknown only while the module is being created. With it the preview exits 0: 142 creates (the overflow controller and its six grants), one provider version update, no change to the heavy pool's 141 resources, and one unrelated re-create, the turbo-cache throttle alert's e-mail subscription, which is gone from AWS.
- **Still off.** `BEEP_SHARD_OVERFLOW` stays unset; until it is `on`, Test Plan skips the routing step and every partition runs hosted, so the pinned caller changes nothing on its own.

Lane ci/shard-overflow-cutover

Reverse: Revert the pull request: the caller returns to the local path with --callee local, the binary pin to beep-ci-202927595d64 and ciShardOverflow leaves the stack config; nothing live changed, so nothing else to undo.

### Rename the overflow pool's prefix to beep-ovf and admit its runner role in the fleet boundary (v5), 2026-11-13

Operator ruling 2026-11-13 (overflow-prefix-rename), applied by the CI goals finish driver.

- **Why rename.** The module's termination watcher (github-aws-runners v7.10.1, `ConfigResolver.ts`) matches instances whose `ghr:environment` tag *starts with* its own prefix, and our controllers set no `tag_filters`. With the overflow prefix `beep-ci-ovf`, the heavy pool's (`beep-ci`) spot-termination handler and notification Lambdas would also have handled every overflow VM, deregistering its runner a second time. The overflow prefix is now `beep-ovf`; `CiShardOverflowPool.test.ts` asserts that neither pool's prefix starts with the other's.
- **Why the boundary changed.** Every role the module creates carries the hand-maintained permissions boundary `beep-ci-fleet-boundary` (not managed by Pulumi). Its `PassOwnRoles` statement lets a role pass to EC2 only `arn:aws:iam::832907639880:role/beep-ci/beep-ci-*` (v4). The scale-up Lambda must pass the runner role, which the module creates at `/<prefix>/<prefix>-runner-<hash>`, so no prefix that avoids the heavy prefix fits v4. The same check showed the previous overflow prefix would never have launched a VM either: its role path was `/beep-ci-ovf/`, outside `role/beep-ci/`.
- **The change.** Boundary v5 (default since 2026-11-13, applied by the driver) differs from v4 only in `PassOwnRoles`, which now also lists `arn:aws:iam::832907639880:role/beep-ovf/beep-ovf-*` with the same `iam:PassedToService` `ec2.amazonaws.com` condition. `CiShardOverflowPool.test.ts` asserts both controllers leave `role_path` unset and that each runner role falls inside one of the two entries.
- **Proof.** No preview can exercise `iam:PassRole`, and `simulate-principal-policy` needs a role that exists. The first proof is the first overflow VM launch after enablement: `/aws/lambda/beep-ovf-scale-up` must log `Created instance(s)` with no `Create fleet` failure naming `iam:PassRole` (`docs/runbooks/ci-runner-reliability.md`, Shard overflow pool).

Lane ci/shard-overflow-cutover · PR #3275

Reverse: aws iam set-default-policy-version --policy-arn arn:aws:iam::832907639880:policy/beep-ci-fleet-boundary --version-id v4 once the overflow pool is off, and revert the prefix in CiRunnerPool.ts

### Repo Sanity owns the skills lock check, gated on the paths it reads, 2026-11-13

No hosted lane ran `beep skills update --check`, so #3042, #3044, #3099, #3109, #3111 and #3166 merged over a stale `skills-lock.json` (fixed in #3225). Only the Skills Update Train ran it, and only on its own relock path.

Decision: the check is a step of Repo Sanity's lane body, on the documentation path and the full path, because Repo Sanity is required and a `SKILL.md` edit is a documentation diff. The step runs the check with a new `--offline` flag: the plain check refetches every floating upstream skill (one today, `adhd`) through the unauthenticated GitHub API, which answered 403 from this workstation while the lane was being built and rate-limits shared hosted runner addresses, and it would turn an upstream push into a red on an unrelated pull request. Offline, the check judges the lock, the installed trees, the mirror, the Codex configuration and the frontmatter from tracked files, which is the drift that recurred (#3217 and #3245 each edited a yeet reference without refreshing the lock). It takes about a second inside a job that is already set up, so it gets no job of its own. `--offline` is refused outside `--check`, because a write that skipped the refetch would record a lock no upstream snapshot backs. The step is on by default, which covers local replays, `yeet final-check` and main pushes. On a pull request check.yml's lane gate reads the new `skills` row of the change-profile pattern data with jq and grep and passes `--skip-skills-lock` when the diff touches none of: the installed skills, their .agents mirror and patch series, the lock, the Codex skill configuration, the skills command, and the gate's own sources. It is a top-level pattern row like `desktop`, not a relevance lane, because it gates a step and has no job to guard; the pinned CI binary reads the extended file unchanged (verified against beep-ci-202927595d64).

Lane fix/ci-skills-lock-gate

Reverse: Revert the pull request: the ci:repo-sanity:skills-lock step, the --skip-skills-lock flag, the skills pattern row and the lane gate's skills_lock output go away together.

### Route Test Unit shards to the overflow pool on the hosted queue depth, into free VMs only, 2026-11-13

Design for the operator decision of the same day (shards overflow only past a 10-minute hosted wait). Model, calibration and tables: `research/shard-overflow-routing-2026-11-13.md`.

- **Signal.** Test Plan counts the jobs waiting for a GitHub-hosted runner across this repository's queued and in-progress runs, with its own `GITHUB_TOKEN` (two run listings and one jobs listing per run, at most 40 runs), and predicts the wait as 5.5 s a queued job (330 s mean hosted body over 60 hosted runners). A run routes past 600 s, 110 queued jobs. On the 296 runs of 2026-11-10..13 that planned shards it flags 18 of 235 runs whose worst shard waited ten minutes or less (7.7%) and misses 27 of 61 that waited longer (44.3%). Test Plan's own pickup delay (one API call) correlates at 0.36 against 0.62 and was rejected; an outside controller flipping a variable needs a variable-writing token and was rejected.
- **Routed.** Test Unit partitions only, the first `min(planned, free VMs)` in plan order, free VMs being 48 less the overflow jobs queued or running; the rest stay hosted, so a routed shard never waits behind a full pool. Without that rule the replay queued 29 shards inside a full pool.
- **Aggregates** stay hosted. Skipping them at job level on success is the largest single lever in the model (Test Unit wait p95 on 2026-11-13: 32m08s with overflow alone, 26m31s with both, at $113 to $178 a month); it landed separately in #3258, and this change extends its Test Unit rule, Coverage Regression's acceptance and the census to both halves: a skip needs each half to have succeeded or, holding nothing, to have been skipped.
- **Charter.** Within 48 VMs no rule tested brings Test Unit's wait p95 under 20 minutes on the 17-branch day: the best is 21m15s, routing past 20 queued jobs, at $334 to $527 a month. The front hop (Change Profile and Test Plan queueing, 8m31s p95 even then) is what remains.
- **Safety and pool.** The `beep-shard-overflow` label is reachable only through `shard-overflow.yml`, whose job condition admits a push or a same-repository pull request and whose runner group admits only that file at `refs/heads/main`. The job equals the hosted shard but for `runs-on`. The pool is a second `CiFleetController` with the heavy pool's rails, `r7a`/`r7i`/`r6i` `.2xlarge` only, at most 48 VMs, declared only under `ciShardOverflow:enabled`; 384 overflow vCPU plus 128 for the heavy pool at a burst cap of 8 is the 512-vCPU Spot quota.
- **Off by default.** Nothing routes until the repository variable `BEEP_SHARD_OVERFLOW` is `on`, and the variable is set last, after every step below.
- **Why the runner group restriction is a hand step.** The stack in `infra/ci-runners` authenticates to AWS only: it has no GitHub provider (`@pulumi/github` is not a dependency) and holds no GitHub credential. Writing an organization runner group takes `admin:org`, which only the operator's own login carries, or the fleet App's key, whose `organization_self_hosted_runners: write` permission allows it; that key is KMS-encrypted in SSM and only the controller Lambdas may decrypt it. Handing the Pulumi program either credential would put an organization-administration secret into provider configuration, into every deploy's process and into the state backend, a wider exposure than the restriction guards against. The heavy group `beep-ec2-heavy` was restricted by hand through the API for the same reason, and `docs/runbooks/aws-cost-operations.md` says not to relax it. What code can own is the check: `beep ci shard-overflow-preflight` reads the group and the webhook back with the operator's token and fails unless both are exact (step 8), so switching overflow on does not rest on anyone's memory. A workflow's `GITHUB_TOKEN` cannot read organization runner groups, so the check cannot run inside Test Plan itself.

**Enablement, in order.** Each step is finished before the next starts; nothing routes until step 9.

1. **This pull request on `main`, after #3258.** It carries the skip rule across both halves: the `Test Unit` aggregate is skipped, and Coverage Regression accepts the skip, only when Test Plan succeeded and each half (hosted shards, overflow shards) succeeded or held nothing and was skipped; Test Plan's settle step makes the halves an exact split of the plan. It needs the operator's hand merge (workflow files). Note the `beep-ci-<sha>` release and sha256 that `Publish Beep CI Binary` builds from the merge commit: that binary is the first with `ci shard-overflow`.
2. **Runner group, restricted when it is created.** With the operator's `gh` login (`admin:org`), create the organization runner group `beep-shard-overflow`: visibility `selected` with `beep-effect/beep-effect` as its only repository, public repositories allowed, workflows restricted to exactly `beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main`: `gh api -X POST orgs/beep-effect/actions/runner-groups -f name=beep-shard-overflow -f visibility=selected -F "selected_repository_ids[]=$(gh api repos/beep-effect/beep-effect --jq .id)" -F allows_public_repositories=true -F restricted_to_workflows=true -f "selected_workflows[]=beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main"`. GitHub's defaults are visibility `all`, public repositories refused and every workflow allowed (the organization's `Default` group reads exactly that). With public repositories refused, routed shards never get a runner. With them allowed but workflows unrestricted, a fork's pull request can write `runs-on: beep-shard-overflow` into its own copy of `check.yml` and run its code on the pool's VMs, because a fork edits the `if:` guards as well. The group exists before the apply because the pool registers its runners into it by name.
3. **Webhook secret.** Generate a fresh random value (kept in 1Password, never displayed, never the heavy pool's `/github-action-runners/app/github_app_webhook_secret`) and store it as the SSM SecureString `/github-action-runners/shard-overflow/github_app_webhook_secret`, encrypted with the fleet App's KMS key (stack config `ciFleetController:githubAppKmsKeyArn`), the only key the controller Lambdas may decrypt with.
3a. **Boundary entry.** The scale-up Lambda passes the runner role to EC2, and every module role carries the hand-maintained permissions boundary `beep-ci-fleet-boundary`, whose `PassOwnRoles` admitted only `role/beep-ci/beep-ci-*` (v4). The overflow pool's prefix is `beep-ovf`, chosen so it does not start with the heavy pool's `beep-ci`, because the module's termination watcher matches `ghr:environment` by prefix; its runner role is `role/beep-ovf/beep-ovf-runner-*`. Boundary v5 adds `arn:aws:iam::832907639880:role/beep-ovf/beep-ovf-*` to `PassOwnRoles` with the same `iam:PassedToService` `ec2.amazonaws.com` condition, and nothing else. Rollback: `aws iam set-default-policy-version --policy-arn arn:aws:iam::832907639880:policy/beep-ci-fleet-boundary --version-id v4`, after the overflow pool is off.
4. **Cutover pull request, hand-merged.** One pull request makes three changes. `infra/ci-runners/Pulumi.production.yaml` gains `ciShardOverflow:enabled: "true"` and `ciShardOverflow:githubAppWebhookSecretSsmParameterArn` set to the parameter of step 3; `ciShardOverflow:heavyBurstCap` stays unset (8). `check.yml`'s `test-unit-overflow` caller changes to `uses: beep-effect/beep-effect/.github/workflows/shard-overflow.yml@main` and the routing step to `--callee pinned`, together: `ci-shard-overflow.test.ts` fails on either alone. `.github/actions/fetch-beep-ci/action.yml` pins the release of step 1. The `@main` reference must follow step 1, because GitHub resolves it when it parses the workflow; until it lands, `--callee local` routes `main` pushes only, the one event whose local path resolves to `refs/heads/main`.
5. **Pulumi apply.** From a clean `main` checkout in `infra/ci-runners`, attended, through "Deploy and verify" in `docs/runbooks/ci-runner-reliability.md`: `pulumi preview --diff --refresh --save-plan <plan>` must show only creates under `ci-shard-overflow-controller` (`beep-ovf-*` module resources, roles under `/beep-ovf/`, `/beep-ovf/controller/runner-ami-id`, `beep-ovf-runner-imds-disable`, six KMS grants) and no change to `ci-fleet-controller`; then `pulumi up --plan <plan>` and `pulumi preview --refresh --expect-no-changes`. The program refuses to build without the secret ARN, or when 48 overflow VMs × 8 vCPU plus the heavy burst cap × 16 vCPU exceeds the 512-vCPU Spot quota. An apply resets a live heavy burst cap to the source value 2; re-run that burst's `set-cap.sh` afterwards, within the heavy burst limit below.
6. **`workflow_job` webhook.** Set `endpoint="$(pulumi stack output shardOverflowWebhook --json | jq -r .endpoint)"` and add a repository webhook (`web`, JSON, active, events `workflow_job` only) that delivers there, signed with the parameter of step 3, which is piped so it never reaches the terminal or a process argument: `aws ssm get-parameter --name /github-action-runners/shard-overflow/github_app_webhook_secret --with-decryption --query Parameter.Value --output text | jq --raw-input --arg url "$endpoint" '{name: "web", active: true, events: ["workflow_job"], config: {url: $url, content_type: "json", insecure_ssl: "0", secret: .}}' | gh api -X POST repos/beep-effect/beep-effect/hooks --input - --jq '{id, active, events}'`. The heavy pool's own `workflow_job` webhook stays as it is.
7. **Cost tag.** Activate the `ghr:environment` cost allocation tag (Billing, Cost allocation tags) so the pool's spend reads apart from the heavy pool's.
8. **Preflight.** `bun run beep ci shard-overflow-preflight --webhook-url "$endpoint"`, with the operator's `gh` login, exits 0 only when the group of step 2 exists, admits exactly `beep-effect/beep-effect`, allows public repositories and is restricted to exactly `beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main`, and an active `workflow_job` webhook delivers to the endpoint. Anything else prints each problem and exits 1: stop there.
9. **Switch on.** Only after step 8 printed `shard-overflow-preflight: ok`: `gh variable set BEEP_SHARD_OVERFLOW --body on --repo beep-effect/beep-effect`. Optional tuning without a deploy: `BEEP_SHARD_OVERFLOW_WAIT_SECONDS` (default 600) and `BEEP_SHARD_OVERFLOW_POOL_SIZE` (default 48). On the next busy run, Test Plan logs `shard-overflow: routed; ...`, `Test Unit (<partition>) / Overflow` jobs run on `beep-ovf-*` runners, Coverage Regression finds their evidence, and `Test Unit` passes. The first launch is also the first proof of the boundary entry (step 3a), which no preview can show: the scale-up Lambda's log group `/aws/lambda/beep-ovf-scale-up` must show `Created instance(s): i-...` and no `Create fleet request failed.` or `Create fleet did not create every requested instance.` naming `iam:PassRole` (`aws logs filter-log-events --log-group-name /aws/lambda/beep-ovf-scale-up --start-time <ms> --filter-pattern '?"Created instance" ?"Create fleet" ?"PassRole"' --query 'events[].message' --output text`). If the launch fails, switch the variable off, cancel the runs whose overflow jobs are queued (a self-hosted job with no runner waits), and re-run them hosted; then check the boundary's default version and the runner role's path.

**Heavy burst limit.** While the overflow pool exists, a heavy-pool burst stays at 8 VMs or fewer (`set-cap.sh 8` at most): 48 × 8 + 8 × 16 = 512 vCPU, the Spot quota. `set-cap.sh` does not know about the overflow pool, so this is the operator's rule; the program refuses a `ciShardOverflow:heavyBurstCap` above 8.

**Disable.**

- Stop routing, no deploy: `gh variable set BEEP_SHARD_OVERFLOW --body off --repo beep-effect/beep-effect` (or `gh variable delete BEEP_SHARD_OVERFLOW --repo beep-effect/beep-effect`). The next Test Plan skips the routing step and every partition runs hosted; routed shards already queued or running finish on the pool. Any value but `on` is off: `decideShardOverflow` returns `disabled`, and the command test proves it then makes no API call.
- Remove the pool once no `Test Unit (<partition>) / Overflow` job is queued or running: delete the webhook of step 6; set `ciShardOverflow:enabled` to `"false"` in a pull request and apply it (the preview deletes only the overflow controller's resources); then delete the parameter of step 3 and the runner group of step 2.
- Revert the code: revert this pull request. With the variable off the workflows already behave as they did before it.

Lane feat/ci-shard-overflow-routing

Reverse: Set BEEP_SHARD_OVERFLOW off (no deploy), or revert the PR; set ciShardOverflow:enabled false and apply to drop the pool.

### Shards overflow to the self-hosted pool only past a 10-minute hosted wait, 2026-11-13

Operator decision 2026-11-13 (about 06:25Z), after the sizing in `research/shard-runner-sizing-2026-11-13.md`. It replaces the "move the test shards to the self-hosted pool" clause of the same day's load ruling; the 15 to 20 branch bound stands.

- Moving every shard needs about 96 concurrent runners (the spot quota fits 64) and about $1,500 to $2,300 a month against a $200 ceiling. Not done.
- Shards stay on GitHub-hosted runners. A shard runs on the self-hosted pool only when the hosted wait would pass 10 minutes. Unbounded, the model sends 433 of 6,613 shards over three days and peaks at 78 VMs, which is 624 vCPU and over the 512-vCPU spot quota. The overflow pool is therefore 48 VMs of the 8-vCPU `.2xlarge` types only (384 vCPU), leaving 128 vCPU for the Heavy lanes. The scaler cap counts VMs and the shared pool launches seven types, four of them 16-vCPU `.4xlarge`, so overflow runners get their own launch configuration restricted to `r7a`, `r7i` and `r6i` `.2xlarge`; the overflow PR shows the worst-case vCPU of overflow plus Heavy at or under 512. No `.4xlarge` overflow option is offered: it was not modelled. A shard that finds the pool full stays in the hosted queue. Modelled at that cap: 300 shards, 43.8 VM-hours, shard pickup p95 8m43s, longest wait 12m52s, about $110 to $170 a month. No quota request and no second shard per VM.
- The queue tripwire moves from 5m00s to 10m00s shard pickup p95 for windows starting on or after 2026-11-13, because the design admits waits up to its threshold; earlier windows keep 5m00s so their documents reproduce. The census retarget (`Ci/LaneTimings.ts`, a window-dated limit) is open work: it is being added to #3229, whose first head (ee4b635b) left the limit at 5m00s. Until that lands on main the command prints 5m00s, and window 5 does not start before it. The charter is unchanged: every required check under 20m00s at p95, queue and pickup included.
- The scaler baseline cap stays 2. The operator accepted a burst cap near 80 for the overflow; the quota bounds it lower, at 48 `.2xlarge` overflow VMs plus the Heavy lanes, 512 vCPU in all. The overflow PR designs how the cap rises and is restored around a burst, and reports its first week of actual spend against the estimate.
- The hosted job diet goes ahead regardless.

Lane docs/ci-lane-overflow-ruling

Reverse: Remove the overflow routing so every shard runs on ubuntu-24.04 again and restore the 5m00s pickup tripwire; no standing AWS setting changes.

### Skip the required aggregates and Heavy Admission at job level on documentation diffs, 2026-11-13

A documentation-only pull request took 13 to 15 hosted runners (measured on #3170, #3202 and #3205, 2026-11-13) although it can fail only Repo Sanity's documentation path, Docs Policy, Commitlint and Secret Scanning. Four aggregates (Lint, Test Unit, Property Laws, Heavy / Test Integration) each queued up to 400 seconds for a runner to print one line, Heavy Admission queued 177 to 350 seconds in front of Repo Sanity to emit three constants, and the Storybook and Vercel Deploy workflows each took a runner to decide to do nothing.

Decision: the aggregates and Heavy Admission are skipped at job level when Change Profile succeeded and reported `docs_only` (same-repository heads for admission). GitHub reports a job-level skip as a passing required check, which the ruleset already relies on for Codegen Drift, Nix Shell, Security, SAST and the Heavy lanes. The Heavy caller reads Change Profile directly and still calls heavy.yml with `admitted: false`, so every `Heavy / <lane>` context exists. Any other profile result runs each aggregate, whose script fails closed. Vercel Deploy gets a `pull_request.paths` filter equal to its preview rule, and Storybook ignores pull requests confined to docs/, goals/, explorations/ and research/.

Test Plan keeps starting beside Change Profile and still takes one runner (about 25 seconds) on a documentation diff. Gating it on Change Profile would put one more runner wait in front of every code pull request's test shards, the ordering the 2026-11-10 decision in this packet protects.

`ci-docs-job-admission.test.ts` simulates the job graph from the checked-in `if` expressions and fails when a documentation diff requests any runner beyond Change Profile, Test Plan, PR Size Label, Commitlint, Secret Scanning, Repo Sanity and Docs Policy.

Lane fix/ci-applicability-docs-only

Reverse: Revert the pull request: the four aggregates return to `if: !cancelled()`, Heavy Admission regains its documentation step, and the Vercel and Storybook pull_request path filters are removed.

### Skip the four test and lint aggregates at job level when every shard succeeded, 2026-11-13

The aggregates `Test Unit`, `Heavy / Test Integration`, `Lint` and `Property Laws` used to take a hosted runner after their last shard only to print one line. On 2026-11-13 that hop (last shard done to the Test Unit aggregate reported) measured p50 1m39s and p95 9m13s over 83 green runs, because the aggregate queued behind every other run's jobs. Each aggregate is now skipped at job level in exactly two states whose verdict is already a pass, and GitHub reports a job-level skip as a passing required check (live on #3241 after #3215: the four contexts concluded `skipped` and the pull request merged under the ruleset).

- **Documentation diff** (#3215's skip, tightened): Change Profile succeeded with `docs_only` true, the shard matrix was skipped, and for Test Unit and Test Integration a successful Test Plan planned nothing.
- **Skip on success**: Change Profile succeeded with `docs_only` false, every job the aggregate's script checks succeeded (Test Plan; Heavy Admission for Test Integration; a non-empty plan, one carrying `int-rest` for Test Integration), and the shard matrix concluded `success`, which GitHub reports only when every leg the plan expanded passed.

Every other state runs the aggregate and its unchanged script fails closed. The conditions keep `!cancelled()`, a status function, so GitHub evaluates them whatever the needs concluded rather than skipping on an implicit `success()`, and a cancelled run still reports the aggregate `cancelled` (seen on 45 cancelled runs of 2026-11-10..13). `ci-docs-job-admission.test.ts` runs every combination of the needs results through each condition and its script: the verdict never changes, every passing state is a skip, and no state with a shard that failed, was cancelled or was skipped on a code diff, or with an unsuccessful Change Profile or Test Plan, is skipped. Coverage Regression now also reads the Test Unit shard matrix and accepts a skipped Test Unit verdict only beside a successful one. The lane-timings census reads a skipped aggregator beside shards that all succeeded as a success whose duration and verdict wait end at the last shard's completion; any other skipped aggregator stays a failure, and runs from before the change read as they did.

**Modelled effect** (the job-graph replay of the 378 Check runs of 2026-11-10..13 in #3256's research note; the model frees the aggregate on every outcome, but failing verdicts are outside the charter population): on its own, Test Unit wait p95 43m40s to 31m40s over the window and 48m22s to 34m14s on 2026-11-13; Test Integration 43m42s to 29m29s and Lint 43m23s to 29m19s on that day. With the overflow routing of #3256: Test Unit 26m31s, Test Integration 22m34s and Lint 22m07s on 2026-11-13. No spend: about four fewer hosted jobs per green code run.

Lane perf/ci-aggregate-skip-on-success

Reverse: Revert the PR: the four aggregate conditions and Coverage Regression's Test Unit check return to their #3215 form; the census change only adds a shape old runs never had.

### The census reports verdict wait per required context and measures Test Integration by its shards, 2026-11-13

The bounded census (`beep ci lane-timings --window`) now records `verdictWaitSeconds` on every attempt-one successful row: the workflow run's `created_at` to the reporting job's `completed_at` (the aggregator for a sharded lane, the job itself otherwise). That is what an author or the merge gate waits for: run-level queueing (main's concurrency group), `needs` chains, runner pickup and the body. The duration table gains `Wait p50` and `Wait p95`. A lane's P3 state is `Breach` when either the duration p95 or the wait p95 is 20m00s or more, and the cell names the measure (`Breach (wait)`, `Breach (duration, wait)`). Like pickup, the wait exists only on attempt-one rows; it reads `created_at`, never the re-dispatch-rewritten `run_started_at`. The duration columns are unchanged, and the TSV adds the column last.

The shard pickup tripwire follows the operator decision of the same day (`2026-11-13-shards-overflow-to-the-self-hosted-pool-only-past-a-10-minute-hosted-wait.md`): it moves from 5m00s to 10m00s. The census chooses the limit by the window from a dated table, the way it chooses ratified populations: a window whose `--since` is before 2026-11-13T00:00:00Z is judged against 5m00s and a window starting at or after it against 10m00s. The Markdown tripwire line prints the limit that applied, so windows 1 to 4 and the earlier previews re-render as they were written.

`Test Integration` is now an effective lane like `Lint` and `Test Unit`: aggregator `Heavy / Test Integration`, planned by `Test Plan`, with the shard layouts of #3005 (sixteen `lps-int` shards and `int-rest`, merged 2026-11-09T17:15:26Z) and #3029 (nineteen and `int-rest`, merged 2026-11-10T00:52:58Z). A run created before #3005 merged is measured as heavy.yml's single job, so earlier windows read as they did. Its shards join the pickup population. Property Laws is not a required context and stays out.

**Evidence.** On main run 43370160740 every hosted job waited 10 to 16 minutes for a runner, and the run waited 7m47s between its `created_at` and its first job's `created_at`; none of that was in any duration p95. The 2026-11-13 preview measured `Test Integration` as its aggregate job alone (p50 0m03s). A two-hour preview (`2026-11-13T04:00Z` to `06:00Z`, before and after read concurrently at 06:15Z): before, only `Test Unit` breached (24m55s p95); after, `Test Integration` reads 11m53s p50 and 21m03s p95 by its shards, nine of fifteen contexts breach on wait p95 (`Lint` 37m00s, `Test Unit` 41m26s, `Test Integration` 35m36s), and shard pickup n rises from 681 to 902.

**Consequence.** Window 5 is judged on wait p95 as well as duration p95: a required context passes only when both are under 20m00s.

Lane fix/ci-lane-census-verdict-wait

Reverse: Drop the Test Integration lane spec and judge the P3 state on duration p95 alone; the wait columns may stay as information.

<!-- beep:decisions:end -->
