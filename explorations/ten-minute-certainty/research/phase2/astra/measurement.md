# Area J — measurement audit (GPT-6 Astra, independent)

## Verdict

The acceptance target is not met. In the latest 30 PR Check runs, **12/30 reached all 15 required contexts; 4/30 did so within 10 minutes**. Conditional time-to-green p95 is **101.90 minutes**, using workflow creation as a push proxy. The all-run p95 is **not attained**, not 101.90 minutes: 18 runs have no observed all-required-green event. Total compute averages **315.04 runner-minutes / PR run including linked Heavy Admit workflows**, or **360.80 class-weighted runner-minutes**. Of the latest 30 main first-parent commits represented by the sample, **5/30 (16.67%) have a non-cancelled completed Check verdict**.

These observations are a burst sample, not an estimate of the post-#3005/#3007/#3014 steady state. Treat those PRs as merged when designing improvements; their work is not proposed again. Measurement itself saves no demonstrated verification minutes. The smallest useful instrumentation PR is **M-L1's hosted metric core + M-L4 + the remaining M-L5 collection fixes**, without waiting for a complete local/task ledger.

## Baseline computed (tables)

### Definitions and population

- **Unit:** one `check.yml` workflow run ID triggered by `pull_request`; attempts are nested inside the run. Last 30 by original `created_at`, without filtering conclusions. Main population is the last 30 `check.yml` push runs on `main`, cross-checked against 30 first-parent commits from the newest sampled main head. All 30 commits match one sampled run.
- **Push:** the timestamp when GitHub receives the ref update introducing that PR head. Neither commit author/committer date nor repository-level `pushed_at` is that timestamp. The REST run objects used here do not contain a head-specific `pushed_at`. **This baseline uses the original run `created_at`**, retains it across reruns, and explicitly omits push-to-workflow-creation lag. Future collection should retain push/synchronize event receipt time and event identity. A nightly poll cannot retroactively recover that exact event timestamp. Report `clockSource` and lag coverage; do not silently mix clocks.
- **Required set:** the 15 exact names in `standards/branch-protection-contexts.json` (captured 2026-10-27, ruleset 10240248). This audit follows that requested snapshot; it does not assert the live ruleset is unchanged. Snapshot its digest with each observation. Exact `Lint` and `Test Unit` aggregator checks exist; matrix children do not substitute for them. Coverage Regression, Property Laws and Lint Policy are outside this required-context latency metric, but remain in compute and Yeet's merge gates.
- **Green:** all exact required names simultaneously satisfied by GitHub Actions checks on the same head, including contexts from linked Heavy Admit runs. `success`, `skipped`, and `neutral` satisfy; absent, cancelled, failure, timed-out and pending do not. Replay check starts/completions; a newer start invalidates the earlier same-name state. Synthetic skipped timestamps sometimes end one second before they start: clamp only that zero-work start to completion. Never treat an absent child context as satisfied merely because its parent workflow was skipped.
- **Latency:** first observed simultaneous all-required-green time minus push proxy. Rerun recovery counts all elapsed waiting and human delay. Later regressions remain separate from first attainment. The latest-check snapshot has 11 green PR heads, while 12 attained green at least once. This is why the time series is needed.
- **Percentile:** nearest-rank `ceil(p*n)-1`. Conditional green p95 is diagnostic only. Non-green terminal runs remain SLO misses; open runs are censored. Treating terminal non-attainment as infinity yields an infinite all-run p95 here. Do not discard cancellations or advertise the green-only p95 as the acceptance statistic.
- **Compute:** sum distinct job IDs' nonnegative `completed_at-started_at` across **every attempt**, including failed and cancelled allocated jobs. Skips and jobs with no assigned runner contribute zero; queue is not runner time. Running jobs contribute observed elapsed time only, a lower bound. Include setup and teardown; never add task spans to their enclosing job spans. Raw runner-minutes and class-weighted runner-minutes are separate columns.
- **Weights:** declared capacity normalization, ubuntu-24.04 = 1 and beep-ec2-heavy = 2 (4-vCPU hosted reference versus 8-vCPU m7i.2xlarge). The heavy type is pinned in `infra/ci-runners/Pulumi.yaml:32`; eight-core rationale appears in `goals/ci-lane-economics/research/repair-decision-2.md:50`. Job labels support class assignment, not actual CPU utilization. The public-runner 4-vCPU reference is an explicit normalization assumption, not hardware sampled this pass. Keep raw class totals so other weights can be applied. These are **not dollars, billed minutes, CPU-seconds, or measured hardware throughput**; money needs timestamped actual rates and fleet idle/boot allocation.
- **Main verdict rate:** distinct first-parent main commits with at least one completed non-cancelled Check run / all eligible main commits. A failure is a verdict; cancellation is not. Separately report literal API `status=completed` (which includes cancellations), success rate, missing-run count, and pending count. Nightly use a fixed UTC cohort plus maturity/late-arrival updates so younger commits do not disappear.
- **Queue terms:** attempt 1 only. `first allocated job started_at - original run created_at` is a run-level pre-first-runner delay, including orchestration; it is not pure runner-pool pickup. Dependency wait and ready-to-run queue require separate timestamps. No queue estimate is fabricated for runs with no allocated jobs, or from rerun `run_started_at`.

### Aggregate results

Capture ended 2026-11-09 17:24:12 UTC for run/job collection; head-check and linked-workflow supplements were read afterward in this pass. Main in-flight totals are lower bounds at that capture; this is a staggered API snapshot, not atomic historical replay.

| Metric | PR | Main |
|---|---:|---:|
| Original runs / attempts | 30 / 37 | 30 / 33 |
| Created UTC range, Nov 9 | 11:59:22–16:33:53 | 02:49:35–17:15:30 |
| Workflow success / failure / cancelled / open | 12 / 3 / 15 / 0 | 3 / 2 / 23 / 2 |
| All-required-green attained | 12/30, head-joined | 4/30, Check jobs |
| Under 10 minutes | 4/30 (13.33%) | 0/30 |
| Green-only p50 / p95 minutes | 40.13 / 101.90 | 101.53 / 271.87 |
| All-population p95 | Not attained | Not attained |
| Check-only runner-min, total / mean / p95 | 9267.20 / 308.91 / 959.88 | ≥3836.25 / ≥127.87 / ≥638.67 |
| Check-only weighted runner-min, total / mean / p95 | 10459.85 / 348.66 / 1118.02 | ≥4676.09 / ≥155.87 / ≥776.53 |
| Check-only ubuntu / heavy runner-min | 8074.55 / 1192.65 | ≥2996.41 / ≥839.84 |
| PR plus linked Heavy Admit runner-min, total / mean | 9451.32 / 315.04 | — |
| PR plus linked Heavy Admit weighted runner-min, total / mean | 10824.07 / 360.80 | — |
| Attempt-1 first-runner delay, p50 / p95 min | 0.20 / 0.48 (n=30) | 6.85 / 71.13 (n=10) |
| Runs with zero allocated runner-minutes | 0 | 20 |
| Main commit verdict / success rate | — | 5/30 (16.67%) / 3/30 (10%) |
| Literal API status completed, including cancelled | 30/30 | 28/30 (93.33%) |

The 93.33% literal completion number is misleading for the operator's “every main commit gets a verdict” intent. The useful verdict rate is 16.67%. Twenty main runs incurred no allocated compute, but still failed to deliver certainty.

Linked Heavy Admit IDs: 42636644275, 42635598437, 42655574858 (the last has two attempts). They add 184.12 raw and 364.22 weighted runner-minutes. These are not extra PR observations. Other side workflows such as Storybook and Vercel are excluded, explicitly; a full-repository spend ledger should add them without changing the required-context SLO denominator.

### Volume for ranking

`gh run list --workflow check.yml --event pull_request --limit 100` returned 100 runs: 79 on Nov 9 UTC and 21 on Nov 8 UTC, spanning Nov 8 16:49:31 to Nov 9 16:33:53 (0.98914 days). Both calendar days are truncated. A burst-rate projection is 101.10 runs/day or 707.68/week, **not a representative weekly census**.

Live economics: this checkout 476 attempts, including 188 publish and 157 verify, Aug 8–Nov 9 (~93.24 days: 14.11 publishes/week and 11.79 verifies/week). Fleet refresh returned **2579 finished attempts in 329 journals**, including 1210 publish and 724 verify, Aug 4–Nov 9 (~97.10 days: 87.23 publishes/week and 52.19 verifies/week). This differs from the inventory's earlier 2596, confirming that a live-checkout census is not a monotonic durable history.

### Per-run receipts

Runner-minutes below are Check-only, all attempts; PR green is the head-level join. `—` means no attained green, not zero. Linked cost is separately reported above.

| Population | Run ID | Conclusion | Attempts | Required green min | Runner-min | Weighted runner-min |
|---|---:|---|---:|---:|---:|---:|
| pr | 42656046751 | success | 1 | 40.13 | 382.07 | 436.83 |
| pr | 42655575171 | success | 1 | 6.27 | 57.05 | 72.88 |
| pr | 42648304236 | failure | 2 | — | 582.32 | 702.33 |
| pr | 42647727570 | cancelled | 3 | — | 752.93 | 889.72 |
| pr | 42646019844 | success | 3 | 101.90 | 959.88 | 1118.02 |
| pr | 42644098697 | cancelled | 1 | — | 269.33 | 297.97 |
| pr | 42642253640 | cancelled | 3 | — | 1148.05 | 1270.40 |
| pr | 42637925544 | cancelled | 1 | — | 382.93 | 421.47 |
| pr | 42637312401 | success | 1 | 40.18 | 315.30 | 373.92 |
| pr | 42636639808 | success | 1 | 42.37 | 224.75 | 224.75 |
| pr | 42635844898 | cancelled | 1 | — | 230.90 | 248.72 |
| pr | 42635593072 | failure | 1 | — | 235.20 | 235.20 |
| pr | 42635375418 | cancelled | 1 | — | 102.43 | 108.15 |
| pr | 42634648552 | cancelled | 1 | — | 171.57 | 184.60 |
| pr | 42628673169 | success | 1 | 39.08 | 278.85 | 333.32 |
| pr | 42628003374 | cancelled | 1 | — | 99.80 | 110.90 |
| pr | 42627756984 | success | 1 | 3.10 | 7.85 | 7.85 |
| pr | 42626103000 | failure | 1 | — | 343.55 | 415.53 |
| pr | 42624585700 | cancelled | 1 | — | 306.12 | 332.93 |
| pr | 42624477383 | success | 1 | 2.77 | 7.22 | 7.22 |
| pr | 42622276409 | cancelled | 1 | — | 298.85 | 326.75 |
| pr | 42622023234 | success | 1 | 92.27 | 339.27 | 447.43 |
| pr | 42619809660 | cancelled | 1 | — | 303.33 | 316.85 |
| pr | 42619321906 | cancelled | 1 | — | 127.50 | 127.50 |
| pr | 42616280479 | success | 1 | 63.35 | 271.63 | 322.48 |
| pr | 42615698428 | cancelled | 1 | — | 260.87 | 260.87 |
| pr | 42614350639 | success | 1 | 45.37 | 268.72 | 290.30 |
| pr | 42613959133 | cancelled | 1 | — | 248.53 | 248.53 |
| pr | 42613782775 | cancelled | 1 | — | 283.10 | 319.13 |
| pr | 42613299480 | success | 1 | 3.98 | 7.30 | 7.30 |
| main | 42662847801 | pending | 1 | — | 0.00 | 0.00 |
| main | 42659704127 | queued | 1 | — | 221.97 | 237.57 |
| main | 42659366143 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42642693204 | failure | 3 | — | 832.38 | 1003.42 |
| main | 42634939284 | success | 1 | 46.28 | 257.37 | 316.65 |
| main | 42630850021 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42625128150 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42619213744 | success | 1 | 110.95 | 357.98 | 468.53 |
| main | 42619131775 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42619087191 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42617527739 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42616399512 | cancelled | 1 | — | 250.95 | 273.00 |
| main | 42616043782 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42607656131 | cancelled | 1 | — | 227.20 | 227.20 |
| main | 42604430782 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42599114355 | cancelled | 1 | — | 321.68 | 390.25 |
| main | 42598983450 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42594740277 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42587271848 | success | 1 | 101.53 | 360.78 | 479.77 |
| main | 42587207714 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42587070257 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42573367446 | cancelled | 2 | — | 638.67 | 776.53 |
| main | 42554761567 | failure | 1 | 271.87 | 367.27 | 503.17 |
| main | 42554255951 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553274587 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553250954 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553233281 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553215645 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553199332 | cancelled | 1 | — | 0.00 | 0.00 |
| main | 42553038022 | cancelled | 1 | — | 0.00 | 0.00 |

## Measured this pass

Read the brief first, required inventory sections and the measurement rows of all four companion maps. Did not inspect the other phase-2 seat's output. No tracked file, git state, worktree, infrastructure or proof was changed; no tests/install/lint/build/check/coverage ran.

Evidence is in `astra-measurement-evidence/` beside this report:

- `pr100.json`: exact requested `gh run list` output with databaseId, headSha, createdAt, updatedAt, status, conclusion, attempt, event, headBranch.
- `main30.json`: `gh api repos/beep-effect/beep-effect/actions/workflows/check.yml/runs?event=push&branch=main&per_page=30`.
- `run-<id>.json`: every `/actions/runs/<id>/attempts/<attempt>/jobs?per_page=100`, paginated with `--paginate --slurp`; bounded five-way reads, transient retries, job-ID deduplication. All 60 selected original runs were read, including empty-job cancelled/pending runs.
- `checks-<id>.json`: `/commits/<head>/check-runs?filter=all&per_page=100`, paginated. `extra-<id>.json` and additional run files retain linked Heavy Admit provenance.
- `main-commits100.json`: `/commits?sha=main&per_page=100`; walk first parents starting at newest sampled run's SHA, rather than counting arbitrary reachable side-branch commits.
- `reduce.py`, `head_reduce.py`, `rows.json`, `head-event-replay.json`, `baseline.json`: reproducible arithmetic over captured data. Run the two reducers in that order; no network is required. The reducers use the frozen `required-contexts.json`; `required-contexts.sha256` retains its digest.
- `bun run beep yeet economics --json` returned 476 attempts; `economics-fleet.json` retains `bun run beep yeet economics --fleet --json`. Fleet first-red population: 1693 red/unknown, 753 reconstructable outer failures, 940 unreconstructable, 418 unlocated; 181 attributed to publish preflight by the current fallback. These are mixed historical populations, not a benchmark of current publish behavior.
- Artifact listing for PR run 42656046751 returned **zero artifacts** at read time. Main run 42634939284 had 40 artifacts, 25 named `turbo-summary-*`. Downloaded artifact **13683272268**, `turbo-summary-test-unit-shard-law-practice-3`, 130547 compressed bytes. Its single summary contains **57 build tasks, 56 cached, 3.987 s overall execution**, command `turbo run build --filter=@beep/law-practice-server^...`, **zero test tasks**. Archive retained as `summary-artifact.zip`. This directly limits M-L2: the name of a shard artifact is not proof that it times the test body.

Source references below use `C = packages/tooling/tool/cli/src/commands`, `R = packages/tooling/tool/cli/src/internal/repo-run`. No CPU-seconds or real process RSS were measured this pass. Do not derive them from elapsed seconds or provisioned cores.

## Ranked levers

**Ranking rule:** weekly saved minutes = `707.68 × hostedRunnerMinPerPrRun + 87.23 × localWallMinPerPublish + 52.19 × localWallMinPerVerify`, using the explicit burst/retained-history caveats above. Do not add critical-path latency to compute in that numerator. Divide by a declared trust-risk score (low=1, medium=3, high=10). **All measurement-only levers have zero demonstrated direct savings, so all score 0 and tie.** Below is an execution-order tie-break by prerequisite value and loss of evidence, not a fabricated savings ranking. Instrumentation overhead is unmeasured and could make net savings slightly negative. No downstream performance lever receives credit here.

Common savings fields for each lever: hosted runner-min/PR = 0; critical-path min/PR = 0; local wall min/publish = 0; local wall min/verify = 0; CPU-seconds saved = 0 demonstrated. Basis = **derived**, because none changes check selection or execution. Indirect savings are unknown until controlled optimization trials. All are Area J.

### 1. M-L1 — Joined verification cost ledger and hosted metric core

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** Implement a versioned read-only fold beside C/Ci/LaneTimings.ts. Primary keys: repo, head SHA, workflow ID/path/ref, run ID, attempt, job ID; child task key adds summary ID and task ID/hash. Local keys: repository identity, checkout identity, attempt ID, invocation ID, lane ID, parent span ID, input digest and environment profile. Keep required-context name, internal lane ID and package/task ID as separate mapped dimensions. Record observed/enqueued/admitted/started/completed timestamps, outcome, skip reason, runner class/versioned weight, source URI/digest, units, completeness and censoring. Join local final-check, scheduler and Turbo spans via emitted foreign keys, never just head SHA. Whole-repo aggregation is sound because it changes no proof grain. Keep wrapper wall, exclusive resource counters and child durations separate to prevent double-counting.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. A lossy name join or omitted failed attempt makes a false fast/cheap dashboard; it must never become proof authority. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: frozen 60-run fixture totals, exact required names, linked Heavy Admit, missing contexts, reruns, skips and duplicate ingestion. Assert 60 originals, 70 Check attempts, 15 contexts, and identical raw totals.
- **Prior art / rejected or parked:** Five stores already exist; Economics.ts:760–849 discovers checkout runs, LaneTimings has job/step schemas. Cross-profile hosted/local proof reuse remains parked; a telemetry join does not authorize it.
- **Dependencies:** M-L4/M-L5 for hosted core; M-L2/M-L3/M-L6/M-L8 progressively raise join coverage. Assume #3005/#3007/#3014 merged and version workflow topology.
- **PR slices (title / files / size):** Joined verification cost ledger and hosted metric core: S: hosted required-context scorecard and fixtures in Ci; M: local span adapters in Yeet and repo-run.
- **Confidence:** High for schema/join need; medium for full mapping coverage.
- **Open questions:** Which historical lane aliases are exact equivalents? Keep unmapped rows rather than guessing.

### 2. M-L5 — Complete and resumable lane-timings collection

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** Retain existing transient retry implementation at C/Ci/LaneTimings.ts:935–978. Fix recent mode at :1127–1148: it reads repository-wide actions/runs, not check.yml, and accepts no branch/event filters. Use one explicit workflow/event/branch query model for recent and window modes. Persist pages and cursors, bounded retries, endpoint error receipts, dedup keys and selected/fetched counts. A failed page makes report incomplete, not green or zero. Leave peakRss null until joined to a resource artifact; API job time cannot supply RSS.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Partial API reads falsely lower p95/cost or mix workflows. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger plus injected 502 exhaustion, secondary rate limit, page duplication, missing page and late rerun fixtures. An incomplete census must not certify the SLO.
- **Prior art / rejected or parked:** Retry is already shipped in live code; inventory overstates its absence. Window branch filtering exists at :2111–2128; recent mode remains different.
- **Dependencies:** M-L1 hosted core; no dependency on execution changes.
- **PR slices (title / files / size):** Complete and resumable lane-timings collection: S/M: Ci/LaneTimings.ts, its focused tests, metric output schema.
- **Confidence:** High.
- **Open questions:** How should a partial nightly report notify? Explicit incomplete status is sufficient; no operator decision required.

### 3. M-L8 — Preserve measurement journals through retirement

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** Extend the existing archive service, not a second archive mechanism: export only attempts, final-check history and relevant resource manifests to durable repository-scoped telemetry storage, with manifest hash and stable IDs, before deleting a lane. C/Worktree/Worktree.service.ts preservation flow calls residue classification; C/Worktree/internal/ResidueReap.ts:1752–1786 explicitly makes yeet checkout-jobs and isRetainedCheckoutResidueName("yeet") false. Add archive discovery to Economics.ts:760–849, dedup live/archive copies. Do not retain ephemeral locks, PIDs or credentials. Fold at repo grain to retain removed checkouts.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Survivorship bias favors long-lived lanes; duplicate archival inflates cost. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: fixture retirement, crash after export, restore, duplicate live/archive and missing manifest. Counts and durations must remain invariant; refuse retirement on failed required telemetry export.
- **Prior art / rejected or parked:** Retire.ts:353–354 already requests archive:true. Protected .beep owner material is preserved, but this is not whole-.beep preservation. Inventory uncertainty is resolved by source.
- **Dependencies:** M-L1 stable keys; M-L6 adds final-check history.
- **PR slices (title / files / size):** Preserve measurement journals through retirement: S/M: Worktree archive allowlist/export manifest, Economics discovery, retirement fixture.
- **Confidence:** High for classification gap; medium for historical recovery, which may be impossible.
- **Open questions:** How much pre-retirement history is already gone? Report unrecoverable, never reconstruct synthetic attempts.

### 4. M-L2 — Ingest hosted summaries with explicit body coverage

- **Area / grain:** J / package.
- **Mechanism and grain rationale:** Nightly pull turbo-summary artifacts before seven-day expiry; normalize allowlisted fields: run/attempt/job, summary ID, task ID, hash, execution duration, cache source/status, exit, toolchain and partition plan digest. Validate schema/size and record missing/expired artifacts. Join to steps and resource receipts. Preserve setup/build/test boundaries: sampled law-practice shard has only dependency builds, so ingest canonical test-body/partition timing output as a separate source; do not infer test speed from 3.987 s build summary. Package grain reflects actual Turbo task; per-file timing needs separate Vitest evidence.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Build-only or cache-hit summaries mislabel test workload and drive unsound rebalancing. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: artifact task coverage versus commands/step census; A/B fixed-head timing controls before any rebalance; fixed seed, canonical test count and coverage parity remain mandatory.
- **Prior art / rejected or parked:** .github/workflows/check.yml:823–831 and heavy.yml:308–316 upload summaries with seven-day retention. Mixed setup+test rebalance is rejected; sample confirms new missing-body evidence.
- **Dependencies:** M-L1; consume #3007 partition evidence without re-proposing its repack.
- **PR slices (title / files / size):** Ingest hosted summaries with explicit body coverage: M: CI artifact collector + typed minimal summary decoder + task/body coverage manifest.
- **Confidence:** High for ingestion; low that existing artifacts alone cover tests.
- **Open questions:** Missing artifacts can mean upload absent or failure; distinguish those from expiry with metadata.

### 5. M-L6 — Append final-check invocation and gate history

- **Area / grain:** J / affected-set.
- **Mechanism and grain rationale:** C/Yeet/internal/FinalCheck.ts:683–726 uses headSha.json and overwrites it; no AttemptJournal reference was found. Emit invocation-start, gate-start/end and invocation-end with unique IDs, head/base/tree/input digest, command, selected scope, skip reason, duration, cancellation and environment. Retain existing head receipt as ready-gate materialized view. Economics consumes immutable history, not that mutable view. Grain remains the selected affected set; repo-wide child gates retain explicit repo scope.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Overwriting history hides retries; a journaling change could accidentally change ready proof semantics. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: repeat same head, interrupted gate, failed write, skipped gate, changed base and ready-gate regression fixtures. Compare identical ready decisions before/after.
- **Prior art / rejected or parked:** Existing per-gate durationMs and receipt schema are reused. Hosted receipt substitution still requires separate equivalence evidence and is not part of this lever.
- **Dependencies:** M-L1 keys and M-L8 retention.
- **PR slices (title / files / size):** Append final-check invocation and gate history: S/M: FinalCheck.ts, AttemptJournal.ts/schema, Economics adapter and tests.
- **Confidence:** High.
- **Open questions:** Do not estimate final-check p95 from sums that omit admission/overhead; add actual invocation timestamps.

### 6. M-L3 — Stamp host pressure and resource identity on spans

- **Area / grain:** J / package.
- **Mechanism and grain rationale:** Reuse packages/tooling/library/palantiri/src/HostPressure.ts parsing and R/AdmissionJournal.ts. Stamp attempt start/end and scheduler enqueue/admit/release with pseudonymous host/boot identity, monotonic and UTC time, PSI cpu/memory/io some/full totals and avg10/60, MemAvailable, active/queued weight and scheduler config digest. Join cgroup CPU/peak-memory to execution spans; never sum nested cgroups twice. End-point PSI total deltas measure host contention over the interval, not that lane CPU. Package/lane stamps support the mandated small-unit QualityScheduler; no new authority. Optional bounded periodic samples are needed for transient peaks; endpoints alone miss them.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Attributing other agents’ load to one lane yields wrong scheduler weights. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** A/B measurement with controls: same command/head, controlled fan-out, snapshot overhead, missing /proc/non-Linux, boot reset, counter reset and unavailable pressure. Keep overhead observable; telemetry failure must not grant extra tokens.
- **Prior art / rejected or parked:** HostPressure.ts already parses proc values and has a one-minute freshness contract. AdmissionJournal.ts:59 retains 200 admissions. No new daemon or second scheduler.
- **Dependencies:** Existing QualityScheduler; M-L1 and export of journal beyond ring. Scheduler changes belong to Area G.
- **PR slices (title / files / size):** Stamp host pressure and resource identity on spans: M: AttemptJournal, AdmissionJournal schemas, host-pressure adapter and bounded resource joins.
- **Confidence:** High for need; medium for overhead and attribution.
- **Open questions:** Representative fan-out is an experimental parameter, not a reason to block instrumentation.

### 7. M-ATTR — Correct economics failure attribution

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** In C/Yeet/internal/Economics.ts:1154–1161, replace unverified failedStepId fallback with provenance-tagged classification: observed failed inner lane first, observed failed wrapper second, handler/admission failure separate; use failedStepId only with evidence the step started and failed. Preserve raw historical values and emit correction reason. A planned first step is not an executed failure. Repo fold changes reporting only.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. A true preflight error could be hidden by a broad lock-message regex. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: fixtures for refused admission before step start, real preflight failure, wrapper failure with inner details, interruption and malformed legacy receipt. Reconcile raw outcome totals exactly.
- **Prior art / rejected or parked:** Inventory attributes 46 local and 182 fleet rows to legacy lock errors; live fleet now has 181 preflight labels, not independently adjudicated here. Code confirms unsafe fallback; do not claim every row repaired without replay. Y1 reorder savings are unsupported.
- **Dependencies:** M-L1 versioned provenance; no dependency on new scheduler or in-flight PRs.
- **PR slices (title / files / size):** Correct economics failure attribution: S: Economics.ts/schema and historical receipt fixtures.
- **Confidence:** High for defect; medium for corrected historical counts.
- **Open questions:** None operator-only; uncertain rows stay unknown.

### 8. M-L7 — Classify unlocated failures without inventing timings

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** Add orthogonal location/evidence/confidence taxonomy: check failure, admission refusal, runner loss, OOM/termination, auth/environment, GitHub transport, operator cancellation, incomplete legacy, unknown. Start with 30 deterministic unlocated samples stratified by failureKind and date before implementing message rules; retain sanitized evidence and reviewer adjudication. Prefer structured error tags and lane start/end spans for new attempts. A classified error without a timestamp remains unavailable for first-red latency. Repo fold preserves all failures.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Text heuristics manufacture actionable lanes or early failure times, leading to a bad ordering policy. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger against adjudicated fixtures; false-attribution cases and unknown bucket required. Only timestamped events enter latency quantiles; report reconstructability denominator.
- **Prior art / rejected or parked:** Live fleet: 940/1693 unreconstructable and 418 unlocated. Existing receiptProxyClass at Economics.ts:1163–1183 is regex classification, not proof of location. No 30-row manual adjudication performed in this pass; that remains the implementation gate.
- **Dependencies:** M-ATTR first, M-L6 spans and M-L8 retention.
- **PR slices (title / files / size):** Classify unlocated failures without inventing timings: S/M: typed failure classes, writers and economics fold; separate fixture review.
- **Confidence:** Medium.
- **Open questions:** Historical missing chronology cannot be restored by labeling messages.

### 9. M-L4 — Publish main commit verdict and non-attainment cohorts

- **Area / grain:** J / repo.
- **Mechanism and grain rationale:** Join first-parent main commit cohorts to all Check run attempts by SHA. Emit non-cancelled verdict coverage, success coverage, cancelled/no-run/open counts and verdict latency with maturity timestamp. Report 28/30 literal completed separately from 5/30 meaningful verdicts. Add PR required-green attainment and censoring to the same scorecard. Repo population is necessary to expose commits with no workflow at all.
- **Savings:** hosted runner-min/PR 0; critical-path min/PR 0; local wall min/publish 0; local wall min/verify 0; CPU-seconds 0 demonstrated. Basis derived; see common ranking rule. Weekly direct score = 0/1 = 0. Indirect gains unestimated.
- **Trust risk:** low. Counting cancelled runs as completed proof falsely certifies main; counting only existing runs omits missing triggers. Mitigation: preserve raw provenance, explicit unknowns and keep telemetry out of proof authorization.
- **Admission gate:** Parity ledger: multi-commit pushes, no-run commits, duplicate reruns, cancelled-then-success, open run and failure-as-verdict fixtures.
- **Prior art / rejected or parked:** Inventory M-L4 originally mixed measurement with serialization changes. Cancellation removal is rejected without cadence/cost evidence; this lever changes no concurrency.
- **Dependencies:** Ship with M-L1/M-L5 hosted core.
- **PR slices (title / files / size):** Publish main commit verdict and non-attainment cohorts: S: shared hosted cohort reducer + nightly output; no workflow cancellation change.
- **Confidence:** High.
- **Open questions:** Operator target already resolves the intent: every commit gets a verdict, not only successful commits.

### Smallest nightly instrumentation PR

**Title:** `feat(ci): emit attempt-aware required-context and main-verdict scorecard` (M, narrow hosted slice of M-L1/M-L4/M-L5).

Files: existing `C/Ci/LaneTimings.ts` collector plus role-separated schema/reducer registered through the repository architecture command when implementation begins; focused fixtures; one scheduled read-only workflow or existing nightly collector entry. Store immutable compact run/check/job rows, required-context snapshot, runner-weight manifest, cohort IDs, capture time, completeness/error manifest and metric JSON. Persist in an existing authorized artifact/storage lane; do not add a paid service. Retain daily compact observations for at least 90 days and repoll unfinished/retried cohorts so late results are explicit amendments, not overwritten history. Collector should read untrusted artifact data as data, never execute it.

Nightly: enumerate prior UTC-day PR pushes/runs and main first-parent commits; reconcile the rolling seven-day late-arrival horizon; enumerate attempts and linked required-context workflows; join exact contexts; reduce latency and compute separately; print finite conditional p95 beside all-population attainment and main verdict rate. Preserve absent contexts as misses. For now label `clockSource=workflow_created_at`; **exact push SLO needs a separate minimal event-timestamp source**, preferably an existing GitHub App event receiver. Do not claim adding a scheduled poll makes past pushed_at recoverable.

Gate: replay this 60-run corpus and linked-run fixtures, require exact count/cost parity, replay cancellation and missing-page mutations, check idempotence. Nightly observation is not route qualification. This PR changes no coverage, tests, scheduler admissions, required contexts, cache policy or merge policy. Full M-L1's local join can follow; M-L2 is not a prerequisite for computing hosted latency and runner allocation cost.

## Rejected mechanisms considered

- **Drop cancelled/failed runs or reset the clock on rerun:** rejects the actual run population and hides repeated compute; retain both.
- **Use workflow updated_at as completion:** API bookkeeping can trail jobs; use check completion events.
- **Call all status=completed main runs verdicts:** would inflate 16.67% to 93.33%; cancelled is no verdict.
- **Infer CPU/RSS or dollars from elapsed job time:** reject. Keep provisioned-weight normalization explicit; CPU/resource artifacts and real rates are separate evidence.
- **Cache coverage or reuse hosted receipts as local proof:** rejected in inventory K / repository-performance runbook; ingestion grants no reuse authority. Only qualification/parity-ledger work could reopen reuse.
- **Rebalance shards using mixed setup/build/test summaries:** rejected; downloaded build-only artifact is new evidence to improve instrumentation, not permission to rebalance without fixed-work parity.
- **Disable superseded-run cancellation, add merge queue, hold main-red admission or increase paid capacity:** outside measurement scope; cancellation needs cadence/cost evidence, merge queue retains its 80%-green/14-day reopening condition, money remains operator-owned.
- **Restart/disable telemetry because reports are empty:** rejected; missing summaries are diagnostic gaps, not authority to alter live consumers.
- **Parallelize final-check unadmitted or add a checker agent:** rejected. Extend QualityScheduler only, with controlled equivalent-work experiments before execution changes.
- **Claim cache-hit savings in historical economics without first-cold-lane accounting:** rejected. New task series has explicit observation coverage and does not rewrite historical M1/M2 claims.
- **Re-propose #3005, #3007, #3014:** excluded. Baseline retains their mixed historical topology; future reports stratify by workflow/toolchain/partition digest.

## Contradictions with the inventory

1. **“Aborts on one 502” is stale as an implementation description.** Live LaneTimings retries transient errors five total attempts; exhaustion still fails the report. Remaining work is resumability/partial-result integrity and recent-mode filters.
2. **Hosted artifact ingestion is not automatically hosted test-duration ingestion.** The inspected Test Unit artifact has 57 build tasks, zero test tasks. Existing summaries need a coverage manifest and a separate test-body source.
3. **Required contexts may live outside the Check run.** Run 42636639808 is successful but lacks four Heavy child contexts in its job list; its Heavy Admit run supplies them. Per-run job-only green counting gave 11; head join gives 12. Conversely a skipped parent `Heavy` alone is not sufficient evidence.
4. **Fleet counts are not stable history:** inventory 2596 attempts/331 journals versus live 2579/329, despite a later observation end. This proves non-monotonic census, not by itself which specific retirement removed each row. Code independently excludes the yeet subtree from general material preservation.
5. **All-run latency is not successful-run p95.** The inventory's run walls and green-only timing cannot certify the target with half the PR sample cancelled.
6. **Main completed status is not a verdict.** The measured gap is 28 status-completed versus 5 non-cancelled verdicts. The operator's clarified metric supersedes inventory section 4's open latency question.
7. **Attribution remains defective:** Economics falls back to a planned failedStepId before an observed wrapper failure. The first-preflight-red reorder premise remains unproven; no savings credited.
8. **M-L8 is more specific than “archive all journals”:** retirement already preserves some owner material; it excludes yeet by classification. Repair the durable measurement subset and its discovery, preserving safety fences.

## Operator-only questions

None blocks this measurement plan. No spending, paid capacity increase, assurance-depth reduction or second admission authority is proposed. The latency and main-verdict intent is already ruled. For exact push timing, first reuse an existing authorized event receiver; only a proposal that needs a new paid endpoint would return to the operator. Capacity weights are declared analytical normalization and can be recomputed from retained class totals without changing trust policy.

```json
{
  "area": "J: measurement",
  "baseline": {
    "asOf": "2026-11-09T17:24:12.653322+00:00",
    "weights": {
      "ubuntu": 1,
      "heavy": 2
    },
    "required": [
      "Codegen Drift",
      "Commitlint",
      "Heavy / Check",
      "Heavy / Docgen",
      "Heavy / Doctest",
      "Heavy / Test Integration",
      "JSDoc Ratchet",
      "Lint",
      "Nix Shell",
      "Professional Desktop IPC Stdio",
      "Repo Sanity",
      "SAST",
      "Secret Scanning",
      "Security",
      "Test Unit"
    ],
    "populations": {
      "pr": {
        "runs": 30,
        "conclusions": {
          "success": 12,
          "failure": 3,
          "cancelled": 15
        },
        "attempts": 37,
        "reachedRequiredGreen": 11,
        "under10": 4,
        "conditionalGreenMinutes": {
          "n": 11,
          "mean": 39.85454545454545,
          "p50": 40.13333333333333,
          "p95": 101.9,
          "sum": 438.4
        },
        "runnerMinutes": {
          "n": 30,
          "mean": 308.9066666666667,
          "p50": 269.3333333333333,
          "p95": 959.8833333333331,
          "sum": 9267.2
        },
        "weightedRunnerMinutes": {
          "n": 30,
          "mean": 348.6616666666667,
          "p50": 297.96666666666664,
          "p95": 1118.0166666666664,
          "sum": 10459.850000000002
        },
        "attempt1FirstRunnerDelayMinutes": {
          "n": 30,
          "mean": 0.25222222222222224,
          "p50": 0.2,
          "p95": 0.48333333333333334,
          "sum": 7.566666666666666
        },
        "zeroRunnerRuns": 0,
        "costByClass": {
          "ubuntu": 8074.550000000001,
          "heavy": 1192.65,
          "unknown": 0
        },
        "start": "2026-11-09T11:59:22+00:00",
        "end": "2026-11-09T16:33:53+00:00"
      },
      "main": {
        "runs": 30,
        "conclusions": {
          "null": 2,
          "cancelled": 23,
          "failure": 2,
          "success": 3
        },
        "attempts": 33,
        "reachedRequiredGreen": 4,
        "under10": 0,
        "conditionalGreenMinutes": {
          "n": 4,
          "mean": 132.65833333333333,
          "p50": 101.53333333333333,
          "p95": 271.8666666666667,
          "sum": 530.6333333333333
        },
        "runnerMinutes": {
          "n": 30,
          "mean": 127.87497775888887,
          "p50": 0,
          "p95": 638.6666666666666,
          "sum": 3836.249332766666
        },
        "weightedRunnerMinutes": {
          "n": 30,
          "mean": 155.8695925611111,
          "p50": 0.0,
          "p95": 776.5333333333333,
          "sum": 4676.087776833333
        },
        "attempt1FirstRunnerDelayMinutes": {
          "n": 10,
          "mean": 21.43,
          "p50": 6.85,
          "p95": 71.13333333333334,
          "sum": 214.3
        },
        "zeroRunnerRuns": 20,
        "costByClass": {
          "ubuntu": 2996.4108886999998,
          "heavy": 839.8384440666666,
          "unknown": 0
        },
        "start": "2026-11-09T02:49:35+00:00",
        "end": "2026-11-09T17:15:30+00:00"
      }
    },
    "volume": {
      "pr100Count": 100,
      "byUtcDate": {
        "2026-11-09": 79,
        "2026-11-08": 21
      },
      "oldest": "2026-11-08T16:49:31Z",
      "newest": "2026-11-09T16:33:53Z",
      "spanDays": 0.9891435185185186
    },
    "mainCommitVerdict": {
      "firstParentCommits": 30,
      "withSampledRun": 30,
      "withVerdict": 5,
      "withStatusCompletedIncludingCancelled": 28
    },
    "headJoinedPr": {
      "green": 12,
      "under10": 4,
      "p50": 40.13333333333333,
      "p95": 101.9,
      "method": "start/completion replay; synthetic skipped start clamped to completion; newer starts invalidate older checks",
      "runnerMinWithLinked": {
        "mean": 315.04388888888894,
        "p95": 959.8833333333331,
        "total": 9451.316666666668
      },
      "weightedRunnerMinWithLinked": {
        "mean": 360.80222222222227,
        "p95": 1118.0166666666664,
        "total": 10824.066666666668
      }
    }
  },
  "levers": [
    {
      "id": "M-L1",
      "title": "Joined verification cost ledger and hosted metric core",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "A lossy name join or omitted failed attempt makes a false fast/cheap dashboard; it must never become proof authority."
      },
      "admissionGate": "Parity ledger: frozen 60-run fixture totals, exact required names, linked Heavy Admit, missing contexts, reruns, skips and duplicate ingestion. Assert 60 originals, 70 Check attempts, 15 contexts, and identical raw totals.",
      "confidence": "High for schema/join need; medium for full mapping coverage."
    },
    {
      "id": "M-L5",
      "title": "Complete and resumable lane-timings collection",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Partial API reads falsely lower p95/cost or mix workflows."
      },
      "admissionGate": "Parity ledger plus injected 502 exhaustion, secondary rate limit, page duplication, missing page and late rerun fixtures. An incomplete census must not certify the SLO.",
      "confidence": "High."
    },
    {
      "id": "M-L8",
      "title": "Preserve measurement journals through retirement",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Survivorship bias favors long-lived lanes; duplicate archival inflates cost."
      },
      "admissionGate": "Parity ledger: fixture retirement, crash after export, restore, duplicate live/archive and missing manifest. Counts and durations must remain invariant; refuse retirement on failed required telemetry export.",
      "confidence": "High for classification gap; medium for historical recovery, which may be impossible."
    },
    {
      "id": "M-L2",
      "title": "Ingest hosted summaries with explicit body coverage",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Build-only or cache-hit summaries mislabel test workload and drive unsound rebalancing."
      },
      "admissionGate": "Parity ledger: artifact task coverage versus commands/step census; A/B fixed-head timing controls before any rebalance; fixed seed, canonical test count and coverage parity remain mandatory.",
      "confidence": "High for ingestion; low that existing artifacts alone cover tests."
    },
    {
      "id": "M-L6",
      "title": "Append final-check invocation and gate history",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Overwriting history hides retries; a journaling change could accidentally change ready proof semantics."
      },
      "admissionGate": "Parity ledger: repeat same head, interrupted gate, failed write, skipped gate, changed base and ready-gate regression fixtures. Compare identical ready decisions before/after.",
      "confidence": "High."
    },
    {
      "id": "M-L3",
      "title": "Stamp host pressure and resource identity on spans",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Attributing other agents\u2019 load to one lane yields wrong scheduler weights."
      },
      "admissionGate": "A/B measurement with controls: same command/head, controlled fan-out, snapshot overhead, missing /proc/non-Linux, boot reset, counter reset and unavailable pressure. Keep overhead observable; telemetry failure must not grant extra tokens.",
      "confidence": "High for need; medium for overhead and attribution."
    },
    {
      "id": "M-ATTR",
      "title": "Correct economics failure attribution",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "A true preflight error could be hidden by a broad lock-message regex."
      },
      "admissionGate": "Parity ledger: fixtures for refused admission before step start, real preflight failure, wrapper failure with inner details, interruption and malformed legacy receipt. Reconcile raw outcome totals exactly.",
      "confidence": "High for defect; medium for corrected historical counts."
    },
    {
      "id": "M-L7",
      "title": "Classify unlocated failures without inventing timings",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Text heuristics manufacture actionable lanes or early failure times, leading to a bad ordering policy."
      },
      "admissionGate": "Parity ledger against adjudicated fixtures; false-attribution cases and unknown bucket required. Only timestamped events enter latency quantiles; report reconstructability denominator.",
      "confidence": "Medium."
    },
    {
      "id": "M-L4",
      "title": "Publish main commit verdict and non-attainment cohorts",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived: instrumentation only; indirect savings unknown; overhead unmeasured"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Counting cancelled runs as completed proof falsely certifies main; counting only existing runs omits missing triggers."
      },
      "admissionGate": "Parity ledger: multi-commit pushes, no-run commits, duplicate reruns, cancelled-then-success, open run and failure-as-verdict fixtures.",
      "confidence": "High."
    }
  ]
}
```
