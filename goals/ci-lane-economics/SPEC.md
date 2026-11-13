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

### Repo Sanity owns the skills lock check, gated on the paths it reads, 2026-11-13

No hosted lane ran `beep skills update --check`, so #3042, #3044, #3099, #3109, #3111 and #3166 merged over a stale `skills-lock.json` (fixed in #3225). Only the Skills Update Train ran it, and only on its own relock path.

Decision: the check is a step of Repo Sanity's lane body, on the documentation path and the full path, because Repo Sanity is required and a `SKILL.md` edit is a documentation diff. Over the v2 lock the check fetches nothing (every entry is local or vendored), reads tracked files only and takes about a second inside a job that is already set up, so it gets no job of its own. The step is on by default, which covers local replays, `yeet final-check` and main pushes. On a pull request check.yml's lane gate reads the new `skills` row of the change-profile pattern data with jq and grep and passes `--skip-skills-lock` when the diff touches none of: the installed skills, their .agents mirror and patch series, the lock, the Codex skill configuration, the skills command, and the gate's own sources. It is a top-level pattern row like `desktop`, not a relevance lane, because it gates a step and has no job to guard; the pinned CI binary reads the extended file unchanged (verified against beep-ci-202927595d64).

Lane fix/ci-skills-lock-gate

Reverse: Revert the pull request: the ci:repo-sanity:skills-lock step, the --skip-skills-lock flag, the skills pattern row and the lane gate's skills_lock output go away together.

<!-- beep:decisions:end -->
