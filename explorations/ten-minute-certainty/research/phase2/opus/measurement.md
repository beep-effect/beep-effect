# Phase 2 audit, Opus 5.5 seat: J: measurement and telemetry

Produced 2026-11-09 by a `claude-opus-5-5` (medium) auditor from the shared brief and the phase 1 inventory; read-only. Paths are repository-relative or `~`.

## Verdict

Measurement itself does not cost much wall time, but today nobody can report the target metric, and the headline numbers that do exist are wrong in ways that decide what gets fixed. The baseline I computed (90 PR heads in 21.4 h, required contexts read from the live ruleset, which matches standards/branch-protection-contexts.json) is far from target. Code-changing PR heads: push-to-every-required-green p50 48.5 min, p95 124.5 min, and 2 of 27 under 10 min. On the last 30 verdict-bearing heads the code p95 is 146.8 min. Docs-only heads already pass (p50 3.2, p95 4.0 min). Runner-minutes per green code head: p50 264, p95 556 raw; p50 285, p95 674 vCPU-weighted. Heads that a later push superseded and that were cancelled burned 10,623 of 25,336 PR runner-minutes (42%). Main verdict rate is 13% (13 of 101 main commits got a completed check.yml verdict, 3 of them success). The critical context is Heavy / Test Integration on 13 of 27 green code heads (#3005 targets that), then Test Unit, Heavy / Check and Docgen. So the 10-minute target needs work on hosted CI and queueing, not on this area. This area owns three things: making the metric reproducible nightly (one small PR), correcting the first-failure attribution so the local levers are ranked on true numbers, and the joined ledger that every other lever's admission gate needs. Two of the inventory's measurement levers rest on a false premise. M-L2 cannot give PR per-task durations, because PR runs never upload turbo summaries (check.yml:544 uploads on push only). And 78 of the 84 'unlocated' reds are terminated attempts with no verdict, not reds that lack a location.

## Measured this pass

- **Metric definitions used for the baseline** (`python3 -I auditJ-scripts/metric.py (scratchpad); gh api commits/{sha}/check-runs, actions/runs/{id}/attempts/{n}/jobs, rules/branches/main`): Unit = PR head SHA, not run. T0 = min(created_at) of check.yml pull_request runs for that SHA (a rerun keeps created_at, so reruns count against latency). Required set = live ruleset (15 contexts, identical to standards/branch-protection-contexts.json). Each context = its latest check run on the SHA; green = success|skipped|neutral, so skip-satisfied counts. Head states: green / red (any required non-green, not all cancelled) / cancelled (superseded) / held (required context missing). Latency = max(completed_at over the 15) - T0, for green heads only. Runner-minutes = sum(job completed-started) over every attempt of check.yml plus heavy-admit.yml runs for the SHA. Weighted = vCPU/4: ubuntu-24.04 = 1, beep-ec2-heavy (m7i.2xlarge, 8 vCPU) = 2.
- **PR baseline, newest 90 heads (2026-11-08T19:10Z..11-09T16:34Z)** (`metric.py pr 90 + summ.py`): green 41, red 16, cancelled 33, held 0. All-green latency p50 31.9, p90 110.2, p95 123.7, max 187.6 min. Docs-only class (no heavy minutes) 14 heads: p50 3.2, p95 4.0, 14/14 under 10. Code class 76 heads: green 27, p50 48.5, p95 124.5, 2/27 under 10. Runner-min per green code head p50 263.5 / p95 555.5, weighted 284.7 / 673.5. 3 green heads needed reruns. Critical context: Heavy / Test Integration 13, Repo Sanity 14 (all docs-only), Test Unit 6, Heavy / Check 4.
- **PR baseline, newest 30 verdict-bearing heads (cancelled excluded)** (`summ.py`): 24 green / 6 red. Code 20 heads: green 14, p50 51.7, p95 146.8, 1 under 10. Runner-min per green code head p50 283.8 / p95 735.9 (weighted 330.8 / 861.8). Red contexts: Heavy / Test Integration 4, Test Unit 3, Commitlint 2, Heavy / Check 2, Docgen 2, Doctest 2.
- **Runner-minutes spent on superseded (cancelled) PR heads** (`summ.py over 90 heads`): 33 cancelled heads: 10,623 runner-min (13,516 weighted) of 25,336 total in 21.4 h = 42%. Cancelled PR heads also include leftovers that MergeGate.cancelMergedHeadRuns cancels after a merge.
- **PR run volume** (`gh api actions/workflows/check.yml/runs event=pull_request (300 runs)`): 300 runs 11-08T02:49Z..11-09T16:33Z (37.7 h): about 190 PR runs/day, about 100 distinct heads/day. Conclusions: 177 cancelled, 56 failure, 67 success. Last 30 runs: 15 cancelled, 3 failure, 12 success.
- **Main verdict rate** (`gh api check.yml runs event=push branch=main (100) + commits?sha=main since 11-07T23:50Z`): 101 main commits; 13 (13%) got a completed check.yml verdict on their exact SHA (3 success, 10 failure); 87 only cancelled/pending; 1 no run. created->completed for verdict runs: 17-272 min, p50 about 111. Last 30 main runs: 23 cancelled, 2 failure, 3 success. 85 of 100 runs cancelled: 35 within 2 min (pending superseded by concurrency), 37 after more than 10 min in progress (max 311 min). check.yml push has cancel-in-progress false, so some actor cancels these.
- **Duplicate Heavy context producers per head** (`auditJ-scripts/dup.py`): 23 of 90 heads had heavy-admit.yml runs. On 11 of them both check.yml and heavy-admit ran real Heavy lane work: about 94 heavy-lane min duplicated. Example eb295434: Heavy / Test Integration success in the check.yml suite (16:37Z) and failure in a heavy-admit attempt 2 (16:44Z). The metric therefore needs an explicit latest-check-run-wins rule.
- **lane-timings 502 root cause** (`gh api actions/runs/42646019844/jobs?filter=all&per_page={100,50,30}&page={2,3,4} vs /attempts/{1,2,3}/jobs`): The filter=all pages 502 or return truncated bodies non-deterministically on a 3-attempt, 180-job run. The /attempts/{n}/jobs endpoint returned 60 jobs per attempt cleanly. My own script hit 4 transient 502s in 90 heads and recovered by retrying. LaneTimings.ts:1059 uses filter=all&per_page=100, and recent mode (:1133) lists actions/runs with no workflow/branch/event filter.
- **Head-install-preflight misattribution** (`python3 over .beep/yeet/**/attempts.ndjson (deduped)`): All 46 reds attributed to publish:00-head-install-preflight are failureKind=handler-error with that lane's status 'not-run' and the message 'Another Yeet full proof for this repository is active...'. They are admission lock bounces. Economics.ts:1154 actionableLane falls back to failedStepId.
- **Unlocated first failures** (`same journal census + bun run beep yeet economics --json (0.99 s, 359 MB RSS)`): Of the 84 'unlocated': 78 are attempt-terminated rows with no verdict (interrupted 57, legacy-unowned-start 19, lease-eviction 1) and 6 are handler-error 'merge readiness requires zero unresolved review threads'. 0 are true unlocated lane failures. receiptProxyMix: unclassified 257, scheduler-lock-bounce 46, base-churn 15.
- **Hosted turbo summaries** (`gh api runs/{pr,main}/artifacts; read check.yml:540-550, heavy.yml:308-316`): PR run 42656046751: 15 artifacts, 0 turbo-summary. Main run 42634939284: turbo-summary-* present (lint-policy 14.5 MB, check 784 KB, test-integration 751 KB, unit shards about 130 KB). Upload is gated on github.event_name == 'push', 7-day retention. PR jobs only append the summary to the step summary, which REST cannot read.
- **Final-check and journal retention** (`ls .beep/yeet/final-check; rg FinalCheck/Handler; find journals`): 21 per-head receipts (yeet-final-check/v1, steps[].durationMs, overwritten per head). FinalCheck never calls appendYeetAttemptJournalEvent. Journals live at <checkout>/.beep/yeet/runs/<runId>/attempts.ndjson. 329 under ~/YeeBois/projects. ~/.t3/worktrees/beep-effect has 34 lanes and 13 journals, which the derived fleet scan does not read unless roots.json lists it. 7 archived journals sit under ~/.local/state/beep and are not read.
- **Host pressure source** (`ls/wc ~/.local/state/beep-psi/safe-pressure.jsonl; wc admission journal`): PSI flight recorder: 3,325 samples about 30 s apart (11-08T13:37Z..11-09T17:33Z), 2.3 MB, with boot_id, MemAvailable, cpu/mem/io PSI and CPU temperature. Admission journal.ndjson: 607 rows. A timestamp join gives pressure at attempt time with no hot-path cost.

## Ranked levers

### J1. Nightly push-to-required-green certainty metric (the smallest instrumentation PR)

- **Mechanism:** New read-only `bun run beep ci certainty --since --until [--event pull_request|push] --json|--markdown` in packages/tooling/tool/cli/src/commands/Ci/Certainty.ts. It reuses the LaneTimings window run listing, GithubRest check-runs-for-SHA (GithubRest.ts:507) and the CiGovernance required-context loader, and applies the definitions above. Per-head row: sha, branch, class (docs-only|code from Heavy Admission verdict or heavy minutes), T0, state (green/red/cancelled/held/api-partial), latency, critical context, rerun flag, runner-min raw/weighted, heavy-min, queue-min. Main row: verdict yes/no, time-to-verdict. Report: p50/p90/p95 per class, under-10 share, cancelled-head minute share, main verdict rate, with n stated. A new .github/workflows/certainty-nightly.yml (cron, permissions actions:read checks:read contents:read; not heavy.yml, so it needs no two-PR dance) writes ndjson + markdown as a 90-day artifact and to the job summary.
- **Grain:** repo. The operator's metric is defined per head across all required contexts, so the head SHA is the only sound unit. A per-job or per-run measure misses cross-workflow Heavy producers and reruns.
- **Savings:** basis: derived; hostedRunnerMinPerPrRun: 0 direct (about 1 min of nightly runner); criticalPathMinPerPrRun: 0 direct; localWallMinPerPublish: 0; localWallMinPerVerify: 0. Sources: auditJ/pr_heads.json: code p95 124.5 min, 42% of minutes on cancelled heads; auditJ/main_runs.tsv: 13% main verdict rate
- **Trust risk:** none. Failure mode: Mislabelled metric: picking the wrong check run when two workflows produce the same context, or counting skip-satisfied as work. Mitigation: Fixture heads in tests: eb295434 (duplicate producers), a rerun head (facc14a6, 3 attempts), a docs-only head, a cancelled head. Latest check run by id wins, as GitHub's merge box does. Report n beside every percentile.
- **Admission gate:** none, pure measurement; fixture replay of 4 recorded heads (check-runs JSON captured as test fixtures)
- **Prior art:** lane-timings --window bounded census (admission documents), the economics M1-M5 frame from time-to-certainty, and Astra's per-job ledger for runs A/B/C. None of them measures per-head required-green latency or main verdict rate. M-L4 in the inventory covers only part of it.
- **Depends on:** J3 (shares the 502-safe job fetch)
- **PR slices:** feat(ci): beep ci certainty push-to-required-green report with fixture heads [M]; ci: certainty-nightly workflow uploads the 24 h report [S]
- **Confidence:** high
- **Open questions:** Should held time (heavy waiting for the ready-for-heavy label) count? I counted it from T0 = push; it was 0 in this window because publish labels at open. | Is p95 over code heads only, or over all heads? Docs-only heads already pass and would flatter a pooled number.

### J2. Fix the first-failure attribution and classify the 'unlocated' (attribution fix + M-L7)

- **Mechanism:** Economics.ts:1154 actionableLane changes in three ways. (1) When failureKind = handler-error and the failedStepId lane has status not-run, the attempt gets a refusal class from the message (admission:lock-bounce, gate:review-threads, ...) instead of the lane. (2) attempt-terminated rows without a verdict are left out of isRed/firstFailure and reported as terminations by reason (M5 already counts them). (3) Only failures that are truly lane-less stay 'unlocated'. Add a test row per class from recorded journal lines.
- **Grain:** n/a. A measurement correction; no check runs at any grain.
- **Savings:** basis: measured; localWallMinPerPublish: 0 direct; it stops Y1 (move preflight first) from being justified by 46 lock bounces that were never preflight reds. Sources: journal census: 46/46 preflight reds = handler-error 'Another Yeet full proof ... active', lane not-run; 84 unlocated = 78 terminated (57 interrupted, 19 legacy-unowned-start, 1 lease-eviction) + 6 review-thread handler errors
- **Trust risk:** none. Failure mode: Reclassification hides a real preflight red. Mitigation: Only lanes with status not-run are reclassified; a preflight lane that ran and failed keeps its attribution. Fixture for each case.
- **Admission gate:** none, pure measurement fix; fixture rows taken from the recorded journal
- **Prior art:** Inventory J attribution defect and levers L5/M-L7; ruling 74 (failing-lane rule). Not shipped.
- **PR slices:** fix(yeet): attribute lock-bounce refusals and terminations outside lane first-failure [S]
- **Confidence:** high
- **Open questions:** Should M2's denominator change (red attempts 321 -> about 243 locally once terminations are removed)? That shifts the ratified baseline comparability, so record it as a decision.

### J3. lane-timings robustness (M-L5)

- **Mechanism:** LaneTimings.ts:1059: read jobs per attempt (/actions/runs/{id}/attempts/{n}/jobs, per_page 50) instead of filter=all&per_page=100. Classify 5xx as transient in classifyGithubApiTransient (:857). On exhaustion emit an api-partial row per run instead of failing the census. Make recent mode (:1133) honour --branch/--event/--workflow, or reject them. Add queue (started-created) and runner label columns.
- **Grain:** n/a. Tooling fix.
- **Savings:** basis: measured; hostedRunnerMinPerPrRun: 0. Sources: run 42646019844: filter=all pages 502/truncate, attempts endpoint 3x60 jobs clean; 4 transient 502s in 90 heads in this pass
- **Trust risk:** none. Failure mode: Partial rows silently dropped and read as a full census. Mitigation: Report the partial count in the header; refuse --markdown admission output when partial > 0 unless --preview.
- **Admission gate:** none; unit test with a 502-then-success fetcher and a three-attempt fixture
- **Prior art:** Inventory M-L5; the retry schedule already exists for transport and secondary-rate-limit errors.
- **PR slices:** fix(ci): lane-timings reads jobs per attempt, retries 5xx, keeps partial rows [S]
- **Confidence:** high

### J4. Joined per-check cost ledger (M-L1)

- **Mechanism:** A read-only fold `beep quality ledger` writes one row per (contextId, headSha, inputDigest?, machine/runnerClass, source) with durationMs, queueMs, outcome, cacheStatus, peakRssKb and attempt/run id. Sources: hosted jobs (J1/J3), hosted turbo tasks (J5), economics inner lanes, final-check steps (J6), admission journal and PSI (J7). The join key is the canonical lane id that GithubCheckLaneSpec already names (TTC ruling 28: ids name the command). A static map from hosted context, final-check hostedContext and economics lane label to lane id is checked by a test that fails on an unmapped id.
- **Grain:** package. Rows are per lane, per package task where Turbo provides one. Package is the finest grain that both hosted and local sources share.
- **Savings:** basis: derived; hostedRunnerMinPerPrRun: 0 direct; it is the parity ledger that admission gates of other levers (route, cache, scheduler) require. Sources: inventory J: five stores, none joined
- **Trust risk:** low. Failure mode: A wrong lane-id map attributes minutes to the wrong check, so the wrong lever gets optimised. Mitigation: Exhaustiveness test over GithubCheckLaneSpec; coverage-of-join percentage printed per source.
- **Admission gate:** none; join-coverage report over one week (target 95% of hosted job-minutes mapped)
- **Prior art:** Inventory M-L1 (high); Astra per-job ledger. Measurement windows are rejected as route gates (C7), but this ledger is evidence, not a gate.
- **Depends on:** J1; J3; J5; J6
- **PR slices:** feat(quality): lane-id map across hosted contexts, final-check and economics with exhaustiveness test [S]; feat(quality): beep quality ledger fold [M]
- **Confidence:** medium
- **Open questions:** Where does the durable ledger live: ~/.local/state/beep/ledger (local only) or a nightly artifact? The rules forbid a shared memory service, but a file artifact is fine.

### J5. Hosted turbo-summary ingest, PR runs included (M-L2, corrected)

- **Mechanism:** (a) Add a compact measurement-only artifact on every event: `beep ci turbo-timing --out` projects .turbo/runs/*.json to {taskId, package, task, durationMs, cacheStatus, exitCode} (KB, not the 14.5 MB lint-policy summary) and uploads it as turbo-timing-<job>-<partition> with 14-day retention. The trusted push-only turbo-summary upload stays as is. (b) The nightly J1 job downloads and folds them into per-package task duration series, which feeds `ci partitions rebalance` (#3007) and the coverage weights.
- **Grain:** package. Turbo tasks are package by task, the same grain the shard planners consume.
- **Savings:** basis: derived; hostedRunnerMinPerPrRun: under 0.1 (one small upload step per Turbo job). Sources: PR run 42656046751: 0 turbo-summary artifacts; main run 42634939284: lint-policy summary 14.5 MB; check.yml:544 'if: github.event_name == push'
- **Trust risk:** low. Failure mode: PR-controlled timing data poisons a consumer that treats it as trusted (cache qualification). Mitigation: A distinct artifact name and schema; consumers may use it only for weights and reporting, never for cache trust. The weights stay reviewable in the partitions PR.
- **Admission gate:** none for measurement; any weight change it feeds stays gated by the partitions rebalance PR review
- **Prior art:** Inventory M-L2 assumed the summaries already existed for PRs; they exist only on push. Shard rebalance on mixed setup and test durations was rejected (needs test-only durations), and this supplies test-only task durations.
- **Depends on:** #3007 ci partitions rebalance (assumed merged)
- **PR slices:** feat(ci): compact turbo-timing projection and upload on every event [M]
- **Confidence:** medium
- **Open questions:** Is the push-only upload deliberate trust policy (a cache-qualification input) or just size? If it is policy, keep the separate name.

### J6. Journal final-check runs (M-L6)

- **Mechanism:** Two parts. (1) FinalCheck.ts appends a final-check attempt (mode 'final-check', lanes = steps with gate, hostedContext, durationMs, status) to attempts.ndjson through appendYeetAttemptJournalEvent, wrapped in the same started/finished/terminated triple. (2) The per-head receipt gets a sibling history file .beep/yeet/final-check/<sha>.<startedAt>.json, or the receipt carries a runs[] array, so reruns are no longer overwritten. Economics picks up the mode automatically.
- **Grain:** n/a. Measurement.
- **Savings:** basis: derived; localWallMinPerPublish: 0 direct; it makes final-check (p50 6.3, p95 50 min, coverage gate 18-20 min) visible to economics and to the scheduler levers. Sources: inventory baseline table; rg: FinalCheck never journals
- **Trust risk:** none. Failure mode: yeet ready reads the history file instead of the head receipt. Mitigation: Keep the head receipt path and semantics unchanged; history is append-only beside it.
- **Admission gate:** none; unit test that a final-check run produces a journal row
- **Prior art:** Inventory M-L6; the open question 'does ready/final-check write a journal row' is answered: no.
- **PR slices:** feat(yeet): journal final-check attempts and keep per-run receipts [S]
- **Confidence:** high

### J7. Host pressure on attempts and admissions (M-L3) by join first, stamp second

- **Mechanism:** (1) Economics and the J4 ledger join each attempt or admission window to ~/.local/state/beep-psi/safe-pressure.jsonl by time and boot_id: mean and max cpu/mem/io avg10, min MemAvailable, sample count. This costs nothing on the hot path. (2) Stamp hostId (machine-id hash), activeTokens and queued at attempt-started/finished and admission grant, values the scheduler already holds, so fleet hosts without the recorder still carry N-agents context.
- **Grain:** n/a. Measurement.
- **Savings:** basis: derived; localWallMinPerVerify: 0 direct; enables measuring throughput under N agents and Astra's 'representative fan-out' acceptance condition. Sources: PSI recorder 3,325 samples about 30 s apart, 2.3 MB/day
- **Trust risk:** none. Failure mode: Time-join smears pressure across concurrent attempts. Mitigation: Report pressure as context, never as attribution to one attempt; include activeTokens.
- **Admission gate:** none
- **Prior art:** Inventory M-L3. Rejected: 'journal capacity stamps' (ruling 9, re-parked family). Stamping activeTokens is a different field from capacity stamps; if the record treats it as the same family, ship only the time-join (1).
- **Depends on:** J4
- **PR slices:** feat(yeet): join PSI recorder samples into economics attempt rows [S]; feat(yeet): stamp hostId and active tokens on attempt and admission rows [S]
- **Confidence:** medium
- **Open questions:** Does ruling 9's rejection of capacity stamps cover activeTokens stamps?

### J8. Journal retention on lane retirement (M-L8)

- **Mechanism:** (1) `yeet sweep --retire` and `worktree remove --archive` copy .beep/yeet/runs/*/attempts.ndjson (and final-check history) into ~/.local/state/beep/yeet-journals/<origin-hash>/<lane>-<retiredAt>/ even for clean lanes. (2) economics --fleet reads that archive root and ~/.t3/worktrees/<repo> (or roots.json gains it by default), deduped by attemptId.
- **Grain:** n/a. Measurement.
- **Savings:** basis: measured. Sources: 329 journals under ~/YeeBois/projects; 13 journals in 34 T3 lanes not on the derived fleet scan; 7 archived journals unread
- **Trust risk:** none. Failure mode: Double-counting an attempt seen in both a live checkout and the archive. Mitigation: Dedupe by attemptId (already unique).
- **Admission gate:** none
- **Prior art:** Inventory M-L8; archive mode already preserves dirty .beep residue but not clean lanes' journals.
- **PR slices:** feat(yeet): archive attempt journals on retire and read the archive and T3 lanes in --fleet [S]
- **Confidence:** medium
- **Open questions:** Is ~/.t3/worktrees in roots.json on this workstation? If it is, only the archive part remains.

## Rejected mechanisms considered

- Measure the target per job or per run wall: Heavy contexts come from two workflows (check.yml and heavy-admit.yml) for the same head, and reruns keep created_at. A per-run measure misses 11 of 23 cross-workflow heads and every label-held head. The ruling names push to every required context.
- Use the commit's committer date as push time: Committer date predates the push by arbitrary amounts (rebases, local commits). The first check.yml run's created_at is fired by the synchronize event within seconds of the push. Reopen evidence: A GitHub push timestamp field on REST (the GraphQL pushedDate is deprecated).
- Count cancelled or superseded heads in the latency percentile: They have no verdict. They are reported as a separate cancelled-minutes share (42%) so compute waste stays visible without polluting latency.
- Cache-hit metric inside the economics fold: Already rejected (economics-close: inputs have no first-cold-lane accounting). J5 reports cacheStatus per task as data, not as a fold metric.
- Use measurement-window results as route or cache enforcement gates: Rejected (C7, verification-route DECISIONS 2026-10-28). The J1/J4 data is evidence for ranking only; replay and fixtures remain the gates.
- Restart or disable telemetry because a scorecard is empty: Rejected in the repository-performance dispositions; J1 adds a reader and touches no telemetry service.

## Contradictions with the phase 1 inventory

- Inventory section 1 says the PR run wall is 40 min. Measured push-to-every-required-green for code heads: p50 48.5, p95 124.5 min (n=27). The 40 min is one run's job span and excludes pending, heavy queue and reruns.
- Inventory M-L2 says hosted turbo-summary artifacts exist and nobody reads them. They exist only for push runs (check.yml:544 and heavy.yml upload gated on event == push). PR runs have none, so M-L2 as written cannot yield PR per-task durations.
- Inventory M-L7 proposes sampling unlocated reds for handler-error messages. 78 of the 84 'unlocated' are attempt-terminated rows with no verdict (57 interrupted, 19 legacy-unowned-start, 1 lease-eviction), not reds. The other 6 are review-thread merge-readiness refusals.
- Inventory says about 80% of main runs are cancelled before a verdict. Per commit, 87% of 101 main commits got no verdict and only 3% got a success. Of 85 cancelled main runs, 37 were cancelled after more than 10 min in progress, although check.yml push concurrency has cancel-in-progress false, so some actor is cancelling them.
- Inventory M-L5 attributes the lane-timings abort to 'one 502'. It is a reproducible GitHub failure of filter=all pagination on multi-attempt runs (run 42646019844, 180 jobs). The per-attempt endpoint avoids it.
- Not in the inventory: 42% of PR runner-minutes (10,623 of 25,336 in 21.4 h) went to heads a later push superseded, and on 11 heads both check.yml and heavy-admit.yml ran Heavy lane work for the same SHA (about 94 duplicated heavy-lane min).

## Operator-only questions

- Is the p95 target over code-changing heads only, or over all PR heads? Docs-only heads (about 15%) already sit at p95 4.0 min and would flatter a pooled number.
- Does time held waiting for the ready-for-heavy label count as push-to-green latency? It was 0 in this window because publish labels at open, but manual PRs would carry it.
- Which actor cancels in-progress main check.yml runs (37 of 85 cancellations ran more than 10 min, up to 311 min)? Is that orchestrator 'cancel to give the unblocker runners' doctrine intended to cost 87% of main commits their verdict?
- For weighting runner-minutes: vCPU-equivalent (ubuntu-24.04 = 1, beep-ec2-heavy = 2), or dollars (hosted free on a public repo, heavy about $0.0067/min on-demand)? I report both raw and vCPU-weighted.
- Where should the nightly metric live: a 90-day workflow artifact (reproducible by anyone) or a local systemd timer writing to ~/.local/state/beep?
