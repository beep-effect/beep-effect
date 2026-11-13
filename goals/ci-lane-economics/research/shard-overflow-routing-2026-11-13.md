# Shard overflow routing, 2026-11-13

Design of the overflow routing the operator decided on 2026-11-13 ("Shards overflow to the self-hosted pool only
past a 10-minute hosted wait"). Nothing in AWS, in the runner groups or in a repository variable was changed to
produce it; the workflow and infrastructure code ships with the overflow switched off.

## Short answer

- **Signal.** Test Plan reads the hosted queue with its own `GITHUB_TOKEN` once its plan is ready: the jobs that
  wait for a GitHub-hosted runner across this repository's queued and in-progress runs. The predicted wait is
  `queued × 330 s / 60` (the mean hosted body over the hosted concurrency, 5.5 s a job); a run routes when it
  passes 600 s, 110 queued jobs. The same listing counts the overflow jobs already queued or running.
- **What is routed.** Test Unit partitions only, the first `min(planned, free VMs)` in plan order, where the
  free VMs are 48 less the overflow jobs queued or running. The rest of the run stays hosted. A routed shard
  never waits behind a full pool, which keeps the rule from doing worse than staying hosted.
- **Aggregates.** They stay hosted in this change. The model says the largest single lever is to stop them
  taking a runner on success (a job-level skip, which GitHub reports as a passing required check): it cuts the
  Test Unit wait p95 by about 12 minutes at no spend. That is a separate change because the census must first
  accept a skipped aggregator.
- **Charter.** Within 48 VMs the design does **not** bring Test Unit's wait p95 under 20 minutes on the
  17-branch day. Design alone: 32m08s (replayed today 48m22s). Design plus the aggregate skip: 26m31s at
  $113 to $178 a month. The best the model finds within 48 VMs is 21m15s, routing whenever 20 or more hosted
  jobs queue, at $334 to $527 a month. What is left is the front hop (Change Profile and Test Plan wait in the
  hosted queue, 8m31s p95 even then) plus a 9-minute shard body.

## Data and model

The 378 Check runs created `2026-11-10T04:00Z` to `2026-11-13T06:00Z` (attempt-one jobs, hosted labels only),
replayed through a 60-server first-come hosted pool and an optional overflow pool. A run's jobs keep their
measured bodies; Change Profile and Test Plan gate the run's other jobs; each aggregate is created when its
shards finish. An overflow VM costs a 90 s boot before the job and 30 s of teardown after it, one job per VM.
The routing decision is taken where the workflow takes it: when the replayed Test Plan job finishes, from the
replayed queue at that moment. Shards are created when Change Profile also finishes, so two runs can count the
same free VM; the replay keeps that race.

The replay overstates today's Test Unit wait p95: 48m22s against 41m26s measured on 2026-11-13 (+17%) and
43m40s against 35m06s over the window (+24%). The tables below are the replay's numbers, not scaled. The model
code is `route.py` beside the earlier `des.py` in the driver's model directory
(`~/.cache/beep/ci-goals-finish/model/`), with `calib.py` and `calib2.py` for the signal calibration.

Measured, for reference (aggregate completion minus run creation, every run whose aggregate concluded):

| Lane | Window p50 / p95 | 2026-11-13 p50 / p95 |
| --- | --- | --- |
| Test Unit | 14m33s / 35m06s | 20m35s / 41m26s |
| Heavy / Test Integration | 11m52s / 29m44s | 17m33s / 30m31s |
| Lint | 9m46s / 30m28s | 17m32s / 36m54s |

## Signal calibration

Population: the 296 runs that planned shards (the other 82 were documentation-only or cancelled before any
shard). A run is positive when its worst shard waited more than 10 minutes for a hosted runner: 61 runs.

| Signal, threshold | Routed | False positives (of 235) | False negatives (of 61) | Precision | API calls a run |
| --- | ---: | ---: | ---: | ---: | --- |
| Queued hosted jobs at Test Plan end > 109 (10 min) | 52 | 18 (7.7%) | 27 (44.3%) | 65% | 2 + one per in-flight run |
| Queued hosted jobs > 54 (5 min) | 138 | 83 (35.3%) | 6 (9.8%) | 40% | same |
| Test Plan's own pickup > 3 min | 66 | 39 (16.6%) | 34 (55.7%) | 41% | 1 |
| Test Plan's own pickup > 5 min | 35 | 20 (8.5%) | 46 (75.4%) | 43% | 1 |

Correlation with the run's worst shard pickup: queued hosted jobs at Test Plan end r = 0.62, at Test Plan start
0.52, other Check runs in flight 0.40, Test Plan's own pickup 0.36. Test Plan's pickup samples the queue about
four minutes before the shards are created and misses the bursts that arrive in between; it was rejected. A
repository variable flipped by an outside controller needs a token that can write variables and reacts on a
schedule, so it was rejected too.

Cost of the chosen signal: two run listings plus one jobs listing per queued or in-progress run, at most 40
runs. On the busiest hour of the window (41 Check runs created) that is about 390 calls against
`GITHUB_TOKEN`'s 1,000 an hour for the repository. A refused or failed read keeps every partition hosted.
Only gated runs read the queue: a disabled switch, a fork, or an unpinned caller makes no call.

## Routing rule and the full pool

In the replay of 2026-11-13, three runs decided within one minute at 02:46Z while 132 to 149 hosted jobs
queued:

| Run | Queue at Test Plan end | Free VMs | Planned Test Unit partitions | Routed | Test Unit wait, today → design |
| --- | ---: | ---: | ---: | ---: | --- |
| 43354467054 | 132 | 48 | 11 | 11 | 31m00s → 16m44s |
| 43354484845 | 149 | 37 | 24 | 24 | 35m41s → 16m43s |
| 43354572660 | 134 | 15 | 24 | 15 | 30m18s → 19m08s |

The third run took the 15 VMs left and kept 9 partitions hosted. A fourth would have routed nothing and
waited exactly as it does today. Without the free-VM rule (row 6 below) 29 shards waited inside a full pool
with no way back; a fixed per-run share of 12 (row 7) still queued 6 and routed too little to matter.

## Model results

Window `2026-11-10T04:00Z` to `2026-11-13T06:00Z` (three days, 2.3 of them active) and 2026-11-13 alone. Wait is
run creation to the aggregate's report. Monthly cost scales the window's VM-hours to 30 days of the same load
(`× 30 / 2.3`) at $0.19 to $0.30 a VM-hour.

| # | Candidate | TU window p50 / p95 | TI window | Lint window | TU 11-13 | TI 11-13 | Lint 11-13 | Shards sent | VM-h | Peak VMs | Shards queued in pool | $/month |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Today (replayed) | 18m42s / 43m40s | 16m26s / 41m28s | 15m30s / 37m16s | 30m18s / 48m22s | 26m47s / 43m42s | 25m20s / 43m23s | 0 | 0.0 | 0 | 0 | - |
| 2 | Oracle: per-shard queue estimate over 10 min, all shard lanes (des.py rule) | 14m28s / 31m17s | 12m03s / 25m26s | 10m42s / 23m14s | 18m20s / 33m32s | 14m21s / 29m40s | 14m09s / 27m46s | 456 | 57.8 | 48 | 0 | $143–226 |
| 3 | Test Plan pickup over 3 min, Test Unit, free VMs only | 13m05s / 27m22s | 9m56s / 24m35s | 8m18s / 20m48s | 15m22s / 35m13s | 11m22s / 31m19s | 10m37s / 29m51s | 872 | 122.2 | 48 | 0 | $303–478 |
| 4 | **Design**: queue over 109 jobs (10 min), Test Unit, free VMs only, hosted aggregates | 14m36s / 30m26s | 12m45s / 28m31s | 10m58s / 25m27s | 18m12s / 32m08s | 15m07s / 30m11s | 14m46s / 27m45s | 321 | 44.8 | 48 | 7 | $111–175 |
| 5 | Design, all three shard lanes | 14m32s / 30m35s | 12m08s / 26m37s | 10m58s / 24m53s | 17m29s / 31m57s | 14m14s / 29m20s | 14m17s / 27m21s | 391 | 51.2 | 48 | 0 | $127–200 |
| 6 | Design without the free-VM rule (a full pool queues) | 14m32s / 28m53s | 12m37s / 27m01s | 10m58s / 25m27s | 17m39s / 31m08s | 15m07s / 28m54s | 14m45s / 27m44s | 343 | 47.2 | 48 | 29 | $117–185 |
| 7 | Design, 12 shards per run, no free-VM rule | 15m00s / 31m49s | 13m14s / 28m51s | 10m58s / 26m57s | 19m02s / 34m15s | 17m03s / 31m03s | 16m38s / 28m43s | 238 | 35.8 | 48 | 6 | $89–140 |
| 8 | Design, aggregates of a routed run on the pool | 14m28s / 28m27s | 12m45s / 27m06s | 10m58s / 24m01s | 17m30s / 31m14s | 15m32s / 29m17s | 14m52s / 27m20s | 318 | 47.1 | 48 | 10 | $117–184 |
| 9 | Aggregates skip on success, no overflow | 14m49s / 31m40s | 11m22s / 25m53s | 10m28s / 25m38s | 21m56s / 34m14s | 17m05s / 29m29s | 16m49s / 29m19s | 0 | 0.0 | 0 | 0 | - |
| 10 | **Design + aggregates skip on success** | 11m53s / 24m19s | 9m52s / 21m27s | 7m47s / 19m20s | 14m00s / 26m31s | 10m47s / 22m34s | 11m14s / 22m07s | 325 | 45.5 | 48 | 0 | $113–178 |
| 11 | Queue over 54 jobs (5 min) + aggregates skip | 11m19s / 21m32s | 9m02s / 17m55s | 7m14s / 16m33s | 13m00s / 22m29s | 9m50s / 19m49s | 8m58s / 19m07s | 642 | 86.8 | 48 | 0 | $215–340 |
| 12 | Queue over 20 jobs (1.8 min) + aggregates skip | 11m05s / 18m56s | 8m03s / 16m44s | 6m30s / 14m18s | 11m40s / 21m15s | 8m26s / 18m31s | 7m03s / 15m53s | 968 | 134.6 | 48 | 0 | $334–527 |
| 13 | Design + skip, decided on the recorded queue | 11m40s / 22m25s | 9m02s / 17m48s | 6m59s / 16m52s | 13m00s / 22m25s | 9m21s / 19m20s | 8m09s / 16m52s | 596 | 83.8 | 48 | 0 | $208–328 |
| 14 | Design + skip, VM boot 180 s | 12m19s / 24m50s | 9m52s / 21m36s | 7m47s / 19m20s | 14m27s / 27m48s | 10m47s / 22m48s | 11m14s / 22m10s | 314 | 51.7 | 48 | 0 | $128–202 |
| 15 | Design + skip, shard body x0.75 on 8 vCPU | 11m42s / 24m19s | 9m52s / 21m20s | 7m47s / 19m20s | 13m42s / 26m31s | 10m47s / 22m26s | 11m14s / 21m58s | 336 | 38.0 | 48 | 0 | $94–149 |

Row 13 decides each run on the queue recorded on the real day, before any routing shortened it, so it routes
more than the replay's own signal and bounds the decision from the other side. Routing the Test Integration and
Property Laws shards too (row 5) buys under a minute of Test Unit p95 for 14% more VM-hours. Running a routed
run's aggregates on the pool (row 8) buys one minute and takes VMs from shards.

On 2026-11-13 the design-plus-skip Test Unit wait splits into run creation to Change Profile and Test Plan done
(p50 3m17s, p95 11m12s) and front done to the last shard done (p50 10m23s, p95 17m45s). Even at the most
aggressive routing (row 12) the front hop is 8m31s at p95. Closing the gap therefore needs the front jobs to
stop queueing (the hosted job diet, or fewer hosted jobs per run), a lower threshold than the decided ten
minutes, or more than 48 VMs; row 12 with a 64-VM pool still reads 21m15s on the day.

## Workflow

- `check.yml` Test Plan gains `actions: read` and a `Route shard overflow` step after the plan is published. It
  runs `beep ci shard-overflow` from the compiled CI binary, so push runs need no install, and only while the
  repository variable `BEEP_SHARD_OVERFLOW` is `on`; `continue-on-error` and the job outputs' fallbacks make a
  skipped or failed step publish "every partition hosted".
- `test-unit-shard` allocates `test_unit_hosted`; the new `test-unit-overflow` matrix allocates
  `test_unit_overflow` by calling `shard-overflow.yml`, whose single job is the hosted shard's steps with
  `runs-on: beep-shard-overflow`. Every shard still receives the whole plan for its unplanned-partition check.
- The `Test Unit` aggregate needs both jobs, checks that the two halves hold the plan exactly once, and passes
  only when each half passed or, holding nothing, was skipped. With the switch off the overflow half is always
  empty and the aggregate decides exactly as before. Its name, its required context and the #3215 job-level skip
  on documentation diffs are unchanged.
- A routed shard reports as `Test Unit (<partition>) / Overflow`. The lane-timings census counts it as that
  partition's shard, in the layout, the duration and the pickup population.

## Safety

- **Forks.** The overflow label appears in exactly one job, `shard-overflow.yml`'s, whose condition is
  `github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`. The
  `beep-shard-overflow` runner group admits only `shard-overflow.yml` at `refs/heads/main`, so a pull request
  cannot replace that definition or the condition. The caller repeats the condition and the routing command
  refuses any other event. `ci-shard-overflow.test.ts` pins the condition, the caller and an allow-list of every
  self-hosted label by workflow and job.
- **Privilege.** The overflow job's steps, timeout, environment and permissions equal the hosted shard's, and it
  references the same secret names through the same push guards: write credentials only on a push, through the
  `turbo-cache-write` environment, as the hosted shard and every heavy lane get them today. A contract test
  fails if the two drift.
- **Artifacts.** The overflow job keeps the hosted shard's job id, so coverage evidence and Turbo summaries upload
  under the same names. The fleet AMI is Amazon Linux 2023, not the hosted Ubuntu image: the setup action already
  installs the pinned Node with setup-node, `pdftotext` with `dnf` when apt is absent, skips the hosted-image disk
  cleanup on `beep-` runner names, and takes the baked-Bun fast path when the image's lockfile matches. The shard
  runs two Vitest workers on either runner, so its output is the same; only durations differ.
- **Rollout.** Until a follow-up pull request pins the caller to `shard-overflow.yml@main`, the caller uses the
  local path, which resolves to `main` only on a push; the routing command is told so (`--callee local`) and
  routes main pushes only. The test asserts the flag and the `uses:` reference change together.

## Pool

`infra/src/CiRunnerPool.ts` gives every `CiFleetController` a pool profile. The heavy profile reproduces the
former literals. The overflow profile: label and runner group `beep-shard-overflow`, resource prefix
`beep-ci-ovf`, runner names `beep-ovf-*`, `r7a`, `r7i` and `r6i` `.2xlarge` only, at most 48 VMs, none idle
(ephemeral one-job-one-VM, so idle cost is the controller's Lambdas, queues and webhook, under a dollar a month).
Every rail is the heavy pool's: organization registration, exact label match, Spot `capacity-optimized` with no
On-Demand fallback, the IMDS boundary and per-job hook, the permissions boundary, the egress-only worker security
group, the 150-minute reaper tag and self-poweroff teardown. `infra/test/CiShardOverflowPool.test.ts` compares
every rail input of the two controllers.

Spot budget: 48 overflow VMs × 8 vCPU = 384, plus the heavy pool at a burst cap of 8 × 16 vCPU (its largest
type) = 128, is 512, the account's standard Spot quota. The controller refuses to build when the sum is over, and
the operator keeps every heavy burst at 8 or under while overflow is enabled. At the heavy pool's standing cap
of 2 the sum is 416.

The pool is declared only when the stack config `ciShardOverflow:enabled` is `true`. It reuses the fleet App's
id and key (the scale-up Lambda of `github-aws-runners` v7.10.1 resolves the App's organization installation when
a delivery carries none) and verifies deliveries with its own webhook secret, which a repository webhook for
`workflow_job` events signs.

## Off switch, revert and observability

- Off: `gh variable set BEEP_SHARD_OVERFLOW --body off` (or delete it). The next run's Test Plan skips the
  routing step; runs already routed finish on the pool. `decideShardOverflow` returns `disabled` for any value
  but `on`, and the contract test pins the step's condition.
- Threshold: `BEEP_SHARD_OVERFLOW_WAIT_SECONDS` (default 600) and `BEEP_SHARD_OVERFLOW_POOL_SIZE` (default 48)
  tune without a deploy; a malformed value keeps every partition hosted.
- Revert: revert the pull request; with the switch off the workflows already behave as before it. The pool is
  removed by setting `ciShardOverflow:enabled` to `false` and applying.
- Census: routed shards are `Test Unit (<partition>) / Overflow` jobs with the `beep-shard-overflow` label and
  `beep-ovf-*` runners; `beep ci lane-timings --window ... --tsv` lists them with their pickup, and every Test
  Plan log carries a `shard-overflow:` line with the reason, the predicted wait and the free VMs.
- Spend: with the `ghr:environment` cost allocation tag active, a weekly
  `aws ce get-cost-and-usage --granularity DAILY --metrics UnblendedCost --filter '{"Tags":{"Key":"ghr:environment","Values":["beep-ci-ovf"]}}'`
  reads the pool's EC2 spend against the $110 to $170 a month the design models.
