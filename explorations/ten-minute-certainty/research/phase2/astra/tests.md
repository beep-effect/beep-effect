# Area F — tests: phase 2 independent Astra audit

## Verdict

**The ten-minute target is not yet demonstrated.** Assume #3005, #3007 and #3009 merged, as instructed; also exclude #3014's content under the shared brief. Do not claim their savings again. The residual program is: fix the setup-file dependency hole first; shorten expensive test bodies; reuse complete shard plans locally under QualityScheduler; shard Property Laws for latency. File selection is useful **advisory feedback**, not a replacement for bare `bun run test`, verify, or hosted coverage.

The strongest concrete finding is that `research-library-views.test.ts` includes one property at its end, causing the deep sweep to replay its entire 89-test file. A second finding is that citation clock injection already exists; a blanket “introduce TestClock” proposal overstates the remaining work. T2 is a strong latency intervention but a likely runner-minute regression. It must not be ranked as compute savings.

No tracked files, proofs, tests, installs, or worktrees were changed or run. This report does not claim a measured implementation speedup. All savings below are conditional estimates; zero means no credited saving, not a claim of zero execution cost. Unknown values remain unknown. Local publish has no test gate, so **every direct publish saving is zero**.

Source notation: `C/` = `packages/tooling/tool/cli/src/commands/`; `S/` = the sibling `../audit-surface/` directory. Report paths use repo-relative paths or `~`.

## Measured this pass

Read BRIEF first, then inventory §§1, F, K, L, 3, 4, 4b; tests rows of all four requested supporting maps, and relevant prior rejections. Did not inspect the other phase-2 auditor's output.

| Command / evidence | Result and limitation |
|---|---|
| `gh run list --workflow check.yml --event pull_request --limit 100 --json databaseId,createdAt,status,conclusion` | 100 runs, Nov 8 16:49:31Z–Nov 9 16:33:53Z (23h44m22s). Nov 8: 21 rows, 7 success, 12 cancelled; Nov 9: 79 rows, 39 success, 30 cancelled. Both dates are partial. 46 success, 12 failure, 42 cancelled overall. This is a burst sample, not a long-term daily rate. |
| Same command grouped by UTC date | Confirmed counts above. Throughput extrapolation: ~101 runs/day, ~708/week; 58 non-cancelled rows imply ~411/week. Cancelled runs may still consume substantial test time. Neither denominator proves a particular lane executed. |
| `bun run beep yeet economics` | 476 attempts; publish 188, verify 157; Aug 8–Nov 9 (~93 days). Pre-push p50 14.5m/p95 57.1m. Test-unit 13 observed inner executions p50 11.3m/p95 13.8m; coverage 9 executions p50 11.5m/p95 13.0m. Small, historically mixed samples. |
| `bun run beep yeet economics --fleet` | **2,579**, not 2,596, attempts at 17:22Z; publish 1,210, verify 724, Aug 4–Nov 9 (~97 days). Approximate rates: 87.3 publishes/week, 52.2 verifies/week; checkout alone 14.2/11.8. Fleet review-ledger read failures were reported separately; do not mistake that for missing attempt journals. |
| `bunx turbo run test doctest --dry-run=json --filter=...@beep/identity` | 560 planned task nodes; 198 executable test tasks and 36 executable doctest tasks. 200 test task nodes including placeholders. Recursive traversal of the returned dependency graph finds **128/200** test nodes without `@beep/glob#transit`. Direct-edge count alone (195) would have been misleading. This is graph evidence, not a mutation/hash A/B. |
| `gh api --allow-escape-sequences repos/beep-effect/beep-effect/actions/jobs/129229069201/logs` (filtered) | PR Property Laws: repo-cli 126 files, 4,664 passed / 1 skipped, 683.81s task duration; tests 74%, import 14%, transform 10%, setup 2%. `research-library-views.test.ts`: 89 tests, **123.374s**. Full job 1,084s / execution step 990s from S/astra-surface-map.md. Single task is not whole lane. |
| Same API for job `129229070723` | Unit repo-cli-3: 1,066 passed, Vitest duration 521.36s; job wall 650s per phase-1 ledger. This sample therefore still exceeds 600s with #3007's layout. |
| Read newest 150 `.turbo/runs/*.json` for doctest executions | No matching executed doctest records found in this bounded sample. Cold hub-edit cost remains **unmeasured**, not zero. |
| Targeted source reads / ripgrep | Confirmed glob setup import, property marker, clock capture/injection, generated Bun test script, Node coverage workflow pins, and live SHACL/Oxigraph fixture services. Some guessed path/glob reads failed; corrected via source search. No result inferred from those failures. |

The first raw log request was refused by gh's terminal-escape safeguard; repeated read with its explicit escape-output flag succeeded. No package benchmarks were run: neither long pole is an allowed measurement target, and a tiny package would not calibrate them.

### Ranking rule and honest volumes

Use `(hosted runner-minutes saved/week + local wall-minutes saved/week) / risk weight`, with weights low=1, medium=3, high=10. Critical-path savings are reported separately, **not added again**. Let H be actual weekly executions of the relevant lane/package, V its local verifies, and A advisory retries replacing another advisory full-package retry. The observed burst gives H at most ~708/week before lane selection and cancellation; ~411/week is a non-cancelled sensitivity case, not a guaranteed eligible count. V ≤52.2/week from the fleet. Bare test and A volumes are unrecorded here.

The ordered list below is a provisional planning ranking using explicit conservative scenarios, not a fabricated measured ROI. For comparison only, take H=41/week (10% of non-cancelled burst throughput) and V=5.2/week (10% of fleet verifies). T6 at 2m hosted/1m local, risk 1: score 87; T9 at 10m local, risk 3: 17; T7 at 0.5m hosted/2m local, risk 3: 10.3; T3 at 0 hosted/5m local, risk 10: 2.6. T1/T8/T10 have zero defensible proof-minute savings pending data, while T2 adds compute. These assumed exposure fractions are **not observations**. Re-rank from joined lane receipts before implementation allocation; do not multiply coverage-era 2,680s by every verify or sum overlapping T6/T7/T9 benefits. T5 is a prerequisite outside ROI ranking.

## Ranked levers

### 1. T6 — Shorten and separate research library verification work

- **Area / grain:** F; file, retaining all assertions and package census.
- **Mechanism / files:** `packages/tooling/tool/cli/test/research-library-views.test.ts:74,394,2312` combines live Oxigraph/SHACL services, many integrity/render cases, and one schema round-trip property. First profile fixture construction, `verifyLibrary`, SHACL, and rendering separately. `C/Research/Library/Library.verify.ts:701` invokes the validator; do not infer a network timeout from long durations. Move the pure property into an independently discovered property test file with the same generator, options, seed and floor. Keep every ordinary case in Unit; keep all actual properties in Property Laws. Only optimize repeated immutable fixture construction after proving isolation; do not replace live contract checks with mocks.
- **Savings:** hosted **0–5 runner-min/eligible PR** (guess; 2m ranking scenario), critical path 0–4m if this shard is the tail, local publish 0, verify 0–3m. Fresh property file time is 123.374s; removing its incidental non-property replay saves at most its attributable task contribution, not necessarily 123s of lane wall. Phase-1 coverage file time 200–464s is a separate runtime/instrumentation population. CPU-seconds unmeasured.
- **Risk:** low for source optimization, medium for sweep membership change. Failure: dropped cases, mutable fixture state shared across cases, removing real validator coverage. Mitigation: exact ordinary and property case ledger, same negative integrity witnesses, independent temporary roots.
- **Admission:** parity ledger plus A/B controls, same head/toolchain/runner/topology; per-test identities and property run counts; fresh coverage comparison. For moving the property, explicitly prove marker discovery and no loss of ordinary Unit execution.
- **Prior art / dependencies:** #3009 already removed citation replay, unrelated to this file. #3007 already balances files; a file remains indivisible to its sequencer. File-level property marker in `vitest.shared.ts:113–135` explains residual duplicate work.
- **PR slices:** S: separate pure property with census proof; M: measured library fixture/validation optimization plus refreshed timing plan. Files above and repo-cli plan from #3007.
- **Confidence / open questions:** medium mechanism, low saving estimate. Which stages dominate Node/V8? Does property isolation materially shorten the critical shard after rebalancing? No timeout root cause established.

### 2. T9 — Execute complete local shard plans through QualityScheduler

- **Area / grain:** F; package admission units, each executing a named complete file group; union gives affected-set verify or repo-wide bare test.
- **Mechanism / files:** reuse #3007 measured sequencer and committed plans; extend `C/Ci/CiLane.ts`, `CiLanePartitions.ts`, root test command dispatch and `internal/repo-run/QualityScheduler.ts`. Admit each package-shard execution through the existing scheduler, with measured cgroup peak weights. No second queue or unbounded parent lease plus nested leases. Preserve integration serial-resource locks; coverage shards have separate output dirs and a single validating join.
- **Savings:** hosted 0 (already shipped layout), critical hosted 0, publish 0; local verify **0–20m** on long-pole misses (guess; ranking 10m). Warm cache-hit proof may save nothing or regress planning. Historical 44.7m one-worker coverage is a ceiling source, not present-day #3009 baseline. CPU likely increases through repeated startup, magnitude unknown.
- **Risk:** medium. Failure: omitted/duplicate file, early aggregate green, output collisions, deadlocked nested admission, coverage writer/judge topology divergence. Preserve exact union/disjointness validation, plan digest, census, per-shard failure and cancellation, native caps and P5b topology.
- **Admission:** parity ledger + A/B measurement with controls at representative workstation contention; identical merged coverage counters and floors, no orphan children, peak memory/CPU and queue times. Warm bare full `bun run test` and all verify test lanes must separately finish under 600s, including admission.
- **Prior art / dependencies:** #3005/#3007 hosted partitions are prerequisites, not new savings. Existing CiLane shard completeness checks around lines 987–1055 and partition coverage proof around 1120 are reusable. Scheduler authority remains unchanged.
- **PR slices:** M: local full-census unit shard dispatch/admission; L: local coverage artifact join and topology parity. Separate integration reuse only after exclusive-resource proof.
- **Confidence / questions:** medium feasibility, low timing; how many shard workers fit measured local peaks, and how much transform startup duplicates? Never increase hosted integration workers as part of this.

### 3. T7 — Finish deterministic deadline tests at existing clock boundaries

- **Area / grain:** F; file within existing native versus ordinary projects.
- **Mechanism / files:** audit remaining real-clock tests against existing `CitationExtractorControls.test.ts:307`, `CitationRecognizerWorker.test.ts:322`, and `CitationExtractorSelection.test.ts:101`. Supply TestClock **before constructing** clock-capturing services (`Citation/Admission.ts:72,137`, NativeAdmission/NativeProcess), fork the operation, synchronize readiness, then advance to before/at/after deadline. Retain actual native process timeout, termination, permit-release and cleanup integration witnesses under existing caps. Do not scale production deadlines.
- **Savings:** hosted 0–2 runner-min per eligible run, critical 0–2m, publish 0, verify 0–5m; guess (ranking 0.5/2). No evidence supports freeing every LPS file to default width. CPU reduction unknown; clock-driven waiting removal primarily saves wall.
- **Risk:** medium. Failure: fake clock bypasses actual process cleanup or clock capture, removes native deadline contract. Mutation fixtures must break timeout, late completion, release, captured-clock semantics and cancellation independently.
- **Admission:** parity ledger + mutation fixtures + A/B under contention; native integration unchanged and passing. Clock correctness is not permission to widen every native runner.
- **Prior art / dependencies:** injection already exists; #3007 project split assumed done. Prior default-width failure and #3005 two-worker failure remain binding.
- **PR slices:** S/M: remaining deterministic deadline cases only; separate M width change only if same contract and measured headroom pass.
- **Confidence / questions:** high reuse boundary, low residual savings; exact remaining real-clock census and measured wait share needed.

### 4. T3 — Narrow test invalidation only for proven irrelevant hub inputs

- **Area / grain:** F; package task keys derived from conservative file consumption, not exported type signatures.
- **Mechanism / files:** after T5, inspect `turbo.json:5352,5395`, package overlays, generated aliases and setup closure. Prototype an explicit input closure for one owner in shadow. Include transitive implementations, type/runtime resolver inputs, fixtures, generated data, executable scripts, filesystem discovery and native code. Export-surface stability alone cannot justify removing an edge: implementation-only bugs can preserve all types.
- **Savings:** hosted **0 credited** until a distinct affected-route refinement qualifies; Unit remains forced fresh coverage. Critical hosted 0 credited; publish 0; local verify 0–10m on eligible hub misses, guess (ranking 5m). Identity dry run reaches all 198 executable tests, but that proves fan-out, not irrelevant work. CPU unmeasured.
- **Risk:** high stale-green or missing affected owner. Unknown/dynamic consumers widen to package/dependency closure. Existing Turbo is the only result cache.
- **Admission:** cache qualification plus shadow and mutation/hash matrix, then route replay + mutation fixture for any hosted affected-set changes. Full proof controls must detect every introduced failing witness.
- **Prior art / dependencies:** hard dependency T5; cache qualification operational pause respected, no automatic broad rollout. Existing input hygiene and #3014 not re-proposed.
- **PR slices:** M shadow consumption report; M one qualified package overlay; later L graph generalization only with evidence.
- **Confidence / questions:** low benefit, high confidence risk; frequency of truly unused hub implementation changes remains unmeasured.

### 5. T1 — Advisory related-tests map with conservative fallback

- **Area / grain:** F; file within an affected package, explicitly advisory.
- **Mechanism:** new advisory entry under existing CI/test CLI, reusing Vitest resolution/configuration. Start from canonical discovered tests. Reverse static resolved import closure (aliases, re-exports, TSX, literal dynamic imports); union changed tests, fixture/read dependencies, child CLI/native executable inputs, and setup/config consumers. Compare base and head edges so deleted/renamed imports cannot disappear from selection. New/deleted tests, unresolved dynamic imports, glob/FS discovery, unknown ownership, config/lock/toolchain/environment changes fall back to whole affected owner/dependents or full scope. No result promoted to test/coverage proof cache.
- **Soundness check:** mapping receipt binds head/base, index membership, resolver/config digest and test census. Shadow compare selected versus full failed-test identities on real red replays; mutation suite covers source, barrel, alias, shared fixture, setup, dynamic import, spawned script, generated file, deletion, rename, glob membership and environment. Require 100% failing-witness recall; any unknown widens execution. Zero historical misses alone is not a soundness theorem.
- **Savings:** hosted 0, critical hosted 0, publish 0, mandatory verify 0. Advisory retry wall could save 0–20m/long-pole retry (guess), but A is unmeasured. If added before an unchanged green verify it **adds cost**. Do not claim 44.7m coverage reduction from file selection.
- **Risk:** low proof risk if structurally excluded from proof authority, medium misleading-feedback risk. Print selected/full census and advisory label; no suppression of required contexts or full bare test.
- **Admission:** route replay + mutation fixture and parity ledger, with deliberate incomplete-map fallback tests.
- **Prior art / dependencies:** no related selector in current source; T5 fixes shared input completeness. Rejected P10 bare affected test and partial hosted coverage remain rejected.
- **PR slices:** M map/report shadow; M explicit advisory command and fallback tests. Files: CiLane/test dispatcher, related map module, Vitest configuration interface and CLI tests.
- **Confidence / questions:** medium design, low ROI; record advisory attempt counts and selection fan-out before ranking it above measured body work.

### 6. T8 — Audit Bun/Node duplicate obligations before removing a replay

- **Area / grain:** F; package, preserving runtime-specific contracts.
- **Mechanism / files:** `packages/tooling/tool/cli/package.json:192` runs ordinary tests with `bunx --bun`; hosted Unit has Node 22.23.4 pin and coverage-output in `check.yml:737,792`. `vitest.shared.ts:35` chooses V8 for Node/Istanbul for Bun; `vitest.setup.ts` shims Bun APIs under Node. Identify tests whose Bun execution is a distinct runtime obligation versus accidental same-runtime duplicate. Match actual coverage runtime receipts (`C/Quality/internal/CoverageConfig.runtime.ts:49`) rather than shell launcher names. Harmonizing local Node version with hosted may reduce divergence, not proof workload.
- **Savings:** all four requested dimensions **0 credited**, CPU unknown. Future duplicate elimination ceiling is the removed replay's measured time; no currently proven removable replay.
- **Risk:** high if Node shim is treated as native Bun equivalence, or instrumentation/provider floors change. Maintain native Bun spawn/file/SQLite behavior checks and canonical Node/V8 counters.
- **Admission:** runtime/provider parity ledger, same census and failures plus negative runtime fixtures; no caching coverage or baseline migration by stealth.
- **Prior art / dependencies:** hosted coverage already fused with Unit; do not sell that again. Existing Node pin addresses runtime issue. Phase-1 T8 premise is wrong.
- **PR slices:** S corrected runtime documentation and receipt census; M dedupe only if evidence identifies identical obligations. No wholesale runtime migration proposed.
- **Confidence / questions:** high correction, low optimization; which verify paths actually repeat same runtime, same instrumentation and same census?

### 7. T10 — Measure cold doctest hub misses; retain full fleet

- **Area / grain:** F; package execution with repo-wide union.
- **Mechanism / files:** reuse existing doctest lane/config and collect task CPU/RSS/transform times on an authorized cold control and warm repeat. Existing `fsModuleCache` and two workers already configured in `vitest.shared.ts:240–289`; do not propose them anew. Dry run shows identity reaches 36 executable owners. After measurement, consider smaller scheduler-admitted package waves or qualification of reusable transform inputs, never a second doctest config/root file lane.
- **Savings:** hosted, critical, publish, verify **0 credited**; cold upper bound unknown. Hosted 104–154s historical warm jobs cannot establish cold performance. No extrapolation of 120s per-example timeout into a total duration.
- **Risk:** low instrumentation, medium transform-reuse correctness. Failure: stale example census or mode-crossed transforms. Preserve plugin/config/toolchain/input keys and full example discovery.
- **Admission:** A/B controls; cache qualification for any changed reuse. Capture cold failure as failure, never timeout-as-success.
- **Prior art / dependencies:** TTC rulings 20/22 retain full fleet and one canonical config; fsModuleCache already shipped. Measurement beyond this brief needs its normal scheduler lane.
- **PR slices:** S receipt instrumentation; M resource scheduling only after profiles. Confidence high gap/low saving; question is measured cold makespan, not operator policy.

### 8. T2 — Shard Property Laws for latency, budget extra compute explicitly

- **Area / grain:** F; package partitions with disjoint file shards for repo-cli, affected-set union on PR and full union on main.
- **Mechanism / files:** extend `C/Ci/CiLane.ts:1722`, partitions and `check.yml` with a fail-closed Property Laws aggregate, reusing #3007 measured sequencer/plan machinery. Start with **three** repo-cli shards and a residual owner bin; balance property-mode test-only durations, not Unit coverage timings or total job walls. Keep seed **20260708**, floor **400** in every shard, and retain nightly rotating seed/deeper floor. New files enter validated plan; no property lost to empty/no-tests success.
- **Savings:** hosted runner-min **−3 to −6 per fully executed run** (derived planning range, added setup/startup; CPU unknown/increases). At original 11.1–18.1m job wall with ~1.4–1.6m overhead, ideal three-way execution is ~4.6–7.1m before skew, queue and residual packages. Critical-path saving **0–11m**, conditional on lane being critical; 0 for required-context completion if Property is not required and blocks no required consumer. Publish 0; verify 0 unless property is explicitly included (then sharding via T9 only, no double credit).
- **Risk:** low/medium omission or seed/count drift. Preserve every marked file and all its cases initially; the separate T6 parity change can later remove incidental replay. Aggregate checks required shard census, failures and cancellation; skip-satisfied context always present.
- **Admission:** parity ledger + mutation fixtures for missing/duplicate shard, seed/floor mismatch, new file, failure and cancellation; A/B runner-minutes and queue time. Aim <=8m execution/job budget for headroom, but accept only measured <10m total jobs; push-to-required-green remains a separate graph target.
- **Prior art / dependencies:** #3007/#3005 are Unit/integration, not this lane. Property marker optimization and nightly I/O cap already shipped; do not lower floors or replace full checks with nightly-only assurance.
- **PR slices:** M planner/census tests; M matrix/aggregate. If modifying trusted heavy reusable interfaces, stage on main first; this proposed Property matrix lives in check.yml.
- **Confidence / questions:** high latency mechanism, medium compute estimate, low p95 guarantee. Why PR lane step 990s versus CLI task 683.81s? Measure dependency tasks/scheduling before selecting final shard count. This ranks last for net compute but is a first-wave latency requirement.

### Prerequisite, outside savings ranking: T5 — Close setup-file dependency hole

This ID denotes the **Turbo area's T5 glob gap**, as named in the task, not tests-map T5 (“land #3005/#3007”), which is excluded as already shipped.

- **Area / grain:** F/D; package task dependency closure.
- **Mechanism / files:** `vitest.setup.ts:36` imports `@beep/glob/GlobPattern`; test/property hash chains currently explicitly add utils only (`turbo.json:5352,5395`). Derive complete shared configuration/setup workspace import closure and ensure test, property, doctest and other consumers key it. An explicit glob transit edge is the minimal repair; audit indirect external inputs as well.
- **Savings:** 0 credited in every dimension; invalidation expands and may cost time. CPU unknown. This is trust repair, not an efficiency win.
- **Risk:** low for conservative edge addition; failure would be leaving another shared consumer unkeyed. Do not “repair” with cache disabling globally.
- **Admission:** cache-input mutation fixture / hash matrix: glob implementation edit must change all consumer keys and affected selection; unrelated nonconsumer control stays stable where applicable. Read-only dry run established 128 missing closures, not actual stale-green reproduction.
- **Prior art / dependencies:** phase-1 Turbo T5; blocks T3. No dependency on T1 to land safety correction.
- **PR slice:** S dependency edges and regression fixture; M generated setup closure if needed. Confidence high graph finding; open question is complete shared importer closure, not whether the observed missing edge exists.

## Rejected mechanisms considered

- **Partial hosted Unit or cached coverage / dropping --force (tests T4, P8):** current run/head/census and baseline obligations survive. Reopen only with a new approved evidence-binding design and complete provider/counter/baseline parity, not cache-hit potential. Not proposed here.
- **Bare test defaults to affected (P10/EF-20):** still rejected. T1 is a separate advisory entry; exact whole-fleet union and cache qualification preserve bare proof. Only explicit proof-contract revision could reopen the default change.
- **Hosted doctest affected, root file doctest, duplicate configs (TTC 20/22):** no new parity evidence; retained full fleet. A complete parity ledger plus approved rule revision would be necessary to reopen scope reduction.
- **Wholesale LPS width or two integration workers (#3007/#3005 failed controls), host-scaled coverage workers (P6):** clock correctness alone does not show CPU/memory headroom or native timing safety. Reopen only with matched full-census native deadline controls, topology parity and measured resource envelope.
- **Dropping non-property cases by test-name filter:** marker files can include helper-driven properties. Prefer T6 explicit source separation and census; reopening a generic predicate needs complete semantic property discovery and negative fixtures, not a regex title convention.
- **Export-signature-only hashing:** runtime body changes can preserve exports while changing test outcomes. No acceptable evidence in this pass. Complete consumption/input qualification, not unchanged types, could reopen a narrower form.
- **PGLite background acquisition, lazy setup imports, root projects/package merges:** prior env leaks, Bun shim breakage, lost package caching and small boot savings persist. New controlled isolation/compatibility evidence and positive net cost would be required; none collected.
- **Second scheduler / checker agent:** ruled out; all local work uses QualityScheduler. **Reduce seed/floor, skip canonical corpus, move PR obligations to nightly:** ruled out by binding trust instruction. No engineering shortcut reopens them.
- **Claiming #3005/#3007/#3009 savings again:** expressly excluded. New work must measure residuals after their merge; wider shards are not proof of lower runner-minutes.

## Contradictions with the inventory

1. Tests T8 says hosted Bun/Istanbul versus local Node/V8. Workflow Node 22.23.4, coverage runtime code and shared config contradict that blanket claim; ordinary tests do use Bun. Source comments still mention Bun qualification and should not override actual runtime receipts.
2. “Every Test Unit job under ten minutes” in tests T5 conflicts with its own **650s** #3007 sample. Under-ten remains unproven. Integration #3005's 5.9–9.0m sample does not prove push-to-green <10m including setup/dependencies/queue.
3. “No injected clock” is too broad: several citation suites already capture a supplied clock and use TestClock. T7 is residual migration, not new infrastructure.
4. Research-library 200–464s is not a universal file cost: this pass read **123.374s** in property mode. Runtime, instrumentation, concurrency and workload differ. Similar 16–20s cases do not establish real timeout waits.
5. 37 doctest script manifests versus **36 executable owners** in this identity-filtered dry run are different censuses; reconcile the missing owner before treating the manifest count as executable dependency closure. Do not claim one was removed.
6. Fleet economics returned **2,579** attempts, not inventory's 2,596. These are changing/compacted source populations. Use this pass's explicit window; no unexplained claim of throughput improvement.
7. “Tests T5” and “Turbo T5” collide; this report uses the user-requested setupFile meaning and excludes the already shipped PR lever.
8. Clock setup, fan-out, warm-cache observations and historical one-worker coverage weights cannot establish warm post-merge p95. No allowed benchmark in this pass could honestly close that gap.

## Operator-only questions

None blocks this research deliverable. The brief already fixes the target, floor/seed, full proof obligations and scheduler authority. Do not re-ask them. If implementation requires **additional paid runner capacity or a plan change** to absorb T2's extra occupancy, present measured incremental runner-minutes/dollars and request that money decision. No spending or capacity expansion is authorized here. All remaining questions above are engineering measurements, not facts the operator should supply.

```json
{
  "area": "F \u2014 tests",
  "levers": [
    {
      "id": "T6",
      "title": "Shorten and separate research library verification work",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": [
          0,
          5
        ],
        "criticalPathMinPerPrRun": [
          0,
          4
        ],
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": [
          0,
          3
        ],
        "basis": "guess; property file 123.374s measured; coverage file historical 200\u2013464s"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Lost assertions or shared mutable fixtures"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "medium mechanism; low savings"
    },
    {
      "id": "T9",
      "title": "Reuse complete local shard plans under QualityScheduler",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": [
          0,
          20
        ],
        "basis": "guess; historical long-pole coverage 2679.9s is not a post-merge control"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Missing shards, output collisions, topology divergence"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "medium mechanism; low savings"
    },
    {
      "id": "T7",
      "title": "Finish deadline tests at existing injected-clock boundaries",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": [
          0,
          2
        ],
        "criticalPathMinPerPrRun": [
          0,
          2
        ],
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": [
          0,
          5
        ],
        "basis": "guess; existing clock seams confirmed, residual wait unmeasured"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Fake clock bypasses native deadline or cleanup contract"
      },
      "admissionGate": "mutation fixture + parity ledger + A/B measurement with controls",
      "confidence": "medium"
    },
    {
      "id": "T3",
      "title": "Qualify narrower hub test input closures after T5",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": [
          0,
          10
        ],
        "basis": "guess; 198 executable identity-dependent tests, irrelevant fraction unknown"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Stale-green task key or missed affected owner"
      },
      "admissionGate": "cache qualification + route replay + mutation fixture",
      "confidence": "low"
    },
    {
      "id": "T1",
      "title": "Advisory related-tests mapping with whole-owner fallback",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; no mandatory-proof saving credited; advisory retry saving 0\u201320m, frequency unknown"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Misleading advisory green; must never satisfy full proof"
      },
      "admissionGate": "route replay + mutation fixture + parity ledger",
      "confidence": "medium design; low ROI"
    },
    {
      "id": "T8",
      "title": "Audit runtime obligations before deduplicating Bun and Node replays",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; no removable identical replay established"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Node shim mistaken for native Bun equivalence"
      },
      "admissionGate": "parity ledger + runtime mutation fixture",
      "confidence": "high correction; low savings"
    },
    {
      "id": "T10",
      "title": "Measure cold doctest hub misses while retaining full fleet",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess; cold cost unknown; 36 executable owners in dry-run, no execution control"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Stale transform or missing example census if later reuse changes"
      },
      "admissionGate": "A/B measurement with controls; cache qualification if reuse changes",
      "confidence": "high gap; low savings"
    },
    {
      "id": "T2",
      "title": "Shard Property Laws with fixed seed and unchanged floor",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": [
          -6,
          -3
        ],
        "criticalPathMinPerPrRun": [
          0,
          11
        ],
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived planning estimate; 11.1\u201318.1m baseline, three-way body split plus extra setup; no controlled trial"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Lost property cases, seed/floor drift or incomplete aggregate"
      },
      "admissionGate": "parity ledger + mutation fixture + A/B measurement with controls",
      "confidence": "high latency mechanism; medium compute estimate"
    },
    {
      "id": "T5",
      "title": "Repair shared setup glob dependency closure before narrowing hashes",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived; no savings claimed; 128/200 task nodes lack glob transit closure"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Another shared setup consumer remains outside hash closure"
      },
      "admissionGate": "cache qualification input mutation fixture + hash matrix",
      "confidence": "high graph finding"
    }
  ]
}
```
