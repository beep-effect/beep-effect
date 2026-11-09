# Area C — hosted CI, independent Astra audit

## Verdict

**Assuming #3005, #3007 and #3014 merged, p95 push-to-all-required-green below ten minutes is not established and the known execution envelope still exceeds it.** No measurement in this audit is a post-merge joint-control p95. The 650-second Unit shard observed on the #3007 candidate already exceeds ten minutes before Change Profile, pickup, and aggregation. Integration partitions at 5.9–9.0 minutes have little room for those serial costs. Property Laws and Lint Policy are separate Yeet-readiness problems, not directly required contexts. Lint Policy also occupies the two-slot heavy pool and can delay required Check/Docgen/Doctest.

Use `T_required = max(required DAG completion times) − push time`, including workflow pending, profile/admission, runner pickup, setup, work and aggregation. Do not add p95s of individual components and call that an end-to-end p95. API workflow creation is only a push-time proxy; collect the actual push timestamp for acceptance. Failed and cancelled heads must remain visible beside the success latency distribution.

**Main needs a correctness repair, independently of the savings ranking:** branch-keyed concurrency is a lossy pending queue. `cancel-in-progress: false` protects an executing run, not every pending SHA. Per-SHA main concurrency, exact-SHA checkout, durable missing-verdict reconciliation and cancellation-policy changes are necessary for every main commit to get a verdict. This will consume MORE compute than dropping commits. Keep the full main profile and PR supersession cancellation.

### Required contexts versus Yeet

Live `gh api repos/beep-effect/beep-effect/rulesets/10240248` matches `standards/branch-protection-contexts.json`: Codegen Drift; Commitlint; Heavy / Check; Heavy / Docgen; Heavy / Doctest; Heavy / Test Integration; JSDoc Ratchet; Lint; Nix Shell; Professional Desktop IPC Stdio; Repo Sanity; SAST; Secret Scanning; Security; Test Unit. Fifteen total.

Property Laws, Heavy / Lint Policy, Heavy / Build, Heavy / Coverage Regression, Labs, Shadcn and other optional jobs are not in that set. Normal Yeet merge-gate also holds optional pending/red checks: `packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts:804–833`. Explicit tolerances and relaxed S11 alter that behavior; neither establishes a green verdict. Successful, skipped and neutral conclusions are accepted at lines 668–685. Preserve literal required contexts and prove their skip-satisfied behavior against the live ruleset. The twenty-minute review window remains separate from this performance target.

### Queue term at standing heavy cap two

Reference PR 42637312401 has 20.067 heavy runner-minutes after removing the old Integration job: Policy 12.083, Check 1.400, Build 1.550, Docgen 2.467, Doctest 2.567. The burst-era sample is not a cap-two queue measurement. With five indivisible jobs and two slots, complete heavy work cannot finish sooner than `max(12.083,20.067/2)=12.083` minutes after work can start, even without existing backlog. Required heavy work alone totals 6.434 minutes, but optional work can occupy the slots first. No priority guarantee was found.

At sustained full-profile load, two slots provide 120 runner-minutes/hour: the reference residual workload supports at most **5.98 full heavy runs/hour**, ignoring main and other workflows, boot time and failures. The recent listing proxy is 4.21 PR runs/hour; if all resembled this reference it consumes 84.5 heavy minutes/hour, leaving only 35.5 for main and other work. This is capacity arithmetic, not measured utilization: docs skips and 42% cancellation materially change demand. Main every-SHA repair increases demand. Report `Q_heavy` separately; its standing-cap p95 is **unknown**, not zero and not the burst sample's 0–3.5 minutes. No capacity purchase or burst is proposed.

### Partition count and ceiling

The API confirms org plan `team`; permissions endpoint exposes allowed actions, not an effective job limit. The legacy billing endpoint returns HTTP 410. Official [Actions limits](https://docs.github.com/en/actions/reference/limits) documents **60 standard GitHub-hosted concurrent jobs** for Team and possible support increases. Thus 60 is a verified default, not a verified org-specific override. Self-hosted heavy slots are separate; do not subtract them from the standard-hosted limit.

28 Unit + 16 Integration leaves = 44 standard-hosted jobs before lint/property/security/setup jobs. One run can approach 60; two active runs demand 88 partition slots alone. Total workflow job count is not simultaneous demand because aggregates and coverage consumers have dependencies. More shards can reduce body time while increasing pickup and setup. Raising matrix width cannot prove the target under multi-PR load. Use measured task-only weights, actual runnable DAG width, and shared-org occupancy before changing counts. Existing #3005/#3007 content is not re-proposed here.

## Measured this pass

Read-only source/API/economics inspection; no task execution, install, proof, git write or tracked-file edit. Inspected the requested inventory sections, hosted rows of all compact maps, matching Astra components and rejection ledger. Did not inspect the parallel Opus output. Paths below are repository-relative; `C` abbreviates `packages/tooling/tool/cli/src/commands`.

- `gh run list --workflow check.yml --event pull_request --limit 100 --json createdAt,conclusion`: 100 runs, 2026-11-08 16:49:31Z through 2026-11-09 16:33:53Z (23.7394 hours); 79 on Nov 9, 21 on Nov 8 (both partial days); 46 success, 12 failure, 42 cancelled. Rate proxy **707.68 runs/week**, not a representative full week.
- Same listing with `--event push --branch main --limit 50`: 30 Nov 9 runs through 17:15:30Z; 23 cancelled, 3 success, 2 failure, 2 pending/queued. Five substantive terminal verdicts, not 28. API does not attribute cancellation actors.
- `gh run view 42637312401 --json jobs,createdAt`: 56 non-skipped jobs; sum of `completedAt-startedAt` = **315.30 runner-minutes**. Heavy six leaves = 58.617; other jobs = 256.683. Residual five heavy leaves after excluding old Integration = 20.067. Wall sums exclude queue and are not CPU seconds or billed rounded minutes.
- Ruleset/org/permissions/billing API results above. No secret values requested. API ceiling verification is partial.
- `bun run beep yeet economics`: 476 attempts; publish 188, verify 157, Aug 8–Nov 9; cheap p50/p95 4.0/11.6 minutes, pre-push 14.5/57.1. Approximately 14.2 publishes and 11.8 verifies/week. Fleet 2,596 is the supplied inventory count, not a fresh fleet census; do not apply this checkout's mix to it.
- Source: `check.yml:12–14` branch concurrency and PR-only cancel; `heavy.yml:105–180` job guards and late lane-gate; `C/Quality/internal/LintPolicyScope.ts:42–77,225–300` escalation classes; `C/Quality/Tasks.ts:3811–3820,3886,3966` serial knowledge doctor; `C/Ci/CiLane.ts:749–790,1722–1735` property seed/floor; `check.yml:1123–1200` Property Laws job.
- Phase-one receipts retained as source, not remeasured: property task 577 seconds/4,664 tests; job bodies 583/990/787 seconds across runs A/B/C; Policy medium 368 seconds, doctor 215, tail 59; 7/9 PRs escalated; ordinary hosted install 44–62 seconds. See sibling `SURFACE-INVENTORY.md`, hosted/lint components and Astra run ledger.

### Accounting baseline

Let **B** be a future matched PR run's total runner-minutes with all assumed PRs merged. **B is not measured.** The historical 315.30 reference includes candidate Unit repack but old 38.55-minute Integration. A transparent rough substitution gives `B ≈ 315.30 − 38.55 + (16 × 5.9..9.0) + aggregate − #3007 comparator saving = 371.15..420.75 + aggregate − comparator saving`. This is only a broad scenario using partition bounds, not a causal prediction, because input heads and workloads differ. Never claim #3005 reduces runner-minutes merely because it reduces latency. Each lever below reports total before **B**, after **B ± delta**, plus the affected component before/after. No overlapping deltas are additive without a combined control.

## Ranked levers

Ranking uses compute minutes/week, separately reporting latency. For a reproducible provisional score, risk divisors are low=1, medium=2, high=4. Use 707.68 PR runs/week and 14.2/11.8 local publish/verify attempts/week. Eligibility fractions are unmeasured: illustration below assumes 50% eligible for C1/C2/C3, explicitly a guess. Cancelled runs count only when the avoided work actually would have executed. Rank must be recomputed with per-lever eligible-run census; no precise fleet savings claim is made. Mandatory correctness repair C5 is sequenced first despite zero savings score.

### 1. C1 — Trim provisioning for short jobs without merging proof bins

- **Area/mechanism/grain:** hosted CI; package/affected-set dependency provisioning with repo-wide check semantics retained. Refine `.github/actions/setup-monorepo-ci/action.yml` and individual `check.yml` call sites so each short lane requests only required toolchain/native provisioning. Prefer already-built CI binary for commands that are genuinely self-contained. Do not merge Unit/Lint bins or relocate Unit to heavy.
- **Savings/before→after:** candidate five short jobs, each removes 0.3–0.6 minutes setup: component tax 1.5–3.0→0; total **B→B−1.5..3.0** eligible PR runner-minutes. Required critical path **0..0.6 min**, only if shortened setup is on its longest path; local publish/verify **0/0**; CPU-seconds unmeasured. **Guess**, bounded by observed 44–62s full install and 70–90% setup share. Ranking illustration midpoint 2.25 × .5 × 707.68 / low = **796 min/week/risk**.
- **Trust:** low for removing demonstrably unused setup, medium for filtered install. Missing native dependency or postinstall causes wrong execution; preserve frozen lock, runtime pins, patch/native fixture and canonical command. Never infer unused from one warm run.
- **Admission:** A/B measurement with cold controls and parity ledger for dependency closure; cache qualification if any cache boundary changes. No dependency archive introduced.
- **Prior/dependencies:** setup trimming #2551 and early selection #2751 shipped; old archive rejected. Coordinate dependency-area owner; assumed #3014 changes excluded.
- **PR slice:** “Trim proven unused CI provisioning,” action + 3–5 callers + focused route/runtime fixtures, M. Filtered-install work is a separate M slice if closure proof exists.
- **Confidence/open:** medium mechanism, low savings. Measure exact removable steps and consumer closure before choosing five jobs.

### 2. C2 — Narrow Lint Policy escalation by consumer, preserving global fallbacks

- **Area/mechanism/grain:** hosted CI, affected-set. In `C/Quality/internal/LintPolicyScope.ts`, replace only proven over-broad policy-seal and nested-config escalation with consumer-aware selection; global tsconfig/lock/task-graph changes, deletes/renames, deprecation consumers, unreadable seals retain conservative execution. Source currently escalates every sealed implementation path, every package manifest and every turbo.json. There is no evidence supporting blanket removal of these guards.
- **Savings/before→after:** eligible Policy **12.08→8.08..10.08 min**, total **B→B−2..4**; direct required critical-path saving **0**, indirect heavy queue relief unknown; local publish **0**, verify **0..2** (shared planner, affected attempts only). CPU-seconds unmeasured. **Guess**, anchored to 7/9 escalations and 368s medium graph, not a measured causal gain. Score illustration `(3×.5×707.68 + 1×.5×11.8)/medium = 534 min/week/risk`.
- **Trust:** medium/high stale-green risk from unchanged importers or discovery changes. Require explicit affected consumer graph, full membership joins and unknown→full fallback.
- **Admission:** route replay + mutation fixtures (deleted/renamed files, deprecated re-export, seal-only changes, nested/root config) and parity ledger; cache qualification where task inputs change.
- **Prior/dependencies:** affected Policy #2635 already shipped; #3014 does not fix this outer escalation. Coordinate lint-area owner and existing seal program; no partial JSDoc inventory.
- **PR slice:** “Scope one qualified lint-policy escalation,” scope planner + tests + evidence, M; one trigger family per PR. Full source-scanner optimizations belong to area E.
- **Confidence/open:** medium mechanism, low estimate. Need current eligibility distribution after #3014 and evidence that a narrowed trigger actually shortens medium makespan.

### 3. C3 — Overlap knowledge doctor with independent policy tail on the same runner

- **Area/mechanism/grain:** hosted CI, repo (affected-base semantics preserved). `C/Quality/Tasks.ts:3886,3966` currently creates a separate serial stage for doctor. Keep its semantic-delta prerequisite, seal/baseline guard, promoted-kind gates and uncached execution. Run it alongside the independent tail only after proving no shared outputs. Do not simply run ahead of semantic delta.
- **Savings/before→after:** measured historical doctor 215s plus tail 59s gives safe structural upper bound **59s**, not 215s, for tail-only overlap. Policy **12.08→11.10** ideally; total **B→B−0..0.983**. Required critical path direct **0**, queue relief unknown; local publish **0**, verify **0 credited** (local affected doctor exists, benefit unmeasured). CPU seconds approximately unchanged absent contention; **derived upper bound**, not achieved. Illustration .983 × .5 × 707.68 / medium = **174 min/week/risk** upper scenario.
- **Trust:** medium; racing generated reports, changed failure aggregation or starved work. Preserve all failures and baseline seal semantics; bound combined RSS/CPU through existing QualityScheduler when local, existing policy concurrency on hosted.
- **Admission:** parity ledger + A/B controls with equal full checks and failure injection; reject if overlap increases total work or compromises diagnostics.
- **Prior/dependencies:** #2997 already overlaps the tail. Doctor is not universally advisory: source notes baseline/promotions can enforce before baseline rollout. Coordinate #3015 ownership. Moving it to a separate job is a different option: adds setup, consumes capacity, and does not save its runner-minutes.
- **PR slice:** “Overlap independent knowledge and policy tail,” Tasks planner/stage tests/receipts, M.
- **Confidence/open:** high on serial structure, medium on independence, low on realized saving. Does the doctor consume any tail outputs? Do not assume.

### 4. C4 — Hoist already-proven heavy skip decisions before runner allocation

- **Area/mechanism/grain:** hosted CI, affected-set lane selection. Extend trusted `heavy.yml` literal job `if` guards from admitted-only to validated route skips and precomputed goals/docgen decisions. `check.yml` admission emits auditable receipts. Unknown/malformed classifications run the job; preserve literal context names and PR-only refinements.
- **Savings/before→after:** late-skipped heavy job overhead **s→0**, total **B→B−k×s**, where k is proven-skipped job count. Scenario k=2, s=.5 min gives **1 min/eligible PR**; s and eligibility are unmeasured, not full-run Check/Build durations. Critical-path **0..k×s plus pickup relief**, not bounded from existing data; local **0/0**; CPU unmeasured. **Guess**. Illustrative 10% eligible: 1×.1×707.68 / medium = **35 min/week/risk**.
- **Trust:** medium; absent context, accidentally skipping main or shadow routes. Retain full main, explicit fail-open defaults, route provenance; never drop matrix/context names. Native skipped context must actually be present and accepted, not just presumed from YAML.
- **Admission:** route replay + mutation fixture and hosted context/ruleset parity ledger, including docs/goals/no-diff/unreadable-base/shadow/revoked cases. This explicitly reopens the historical “lanes must start” implementation restriction only with new hosted evidence that the static skipped context preserves the obligation.
- **Prior/dependencies:** admitted=false already avoids allocation (heavy.yml header/guards); docs matrix pre-allocation #2935 already shipped. Do not claim those savings again. Heavy trusted @main interface lands before caller changes.
- **PR slices:** trusted skip inputs/guards + receipts (M), caller forwarding after merge (S).
- **Confidence/open:** high waste mechanism, low weekly estimate; count actual late-skips at cap two first.

### 5. C5 — Preserve every main SHA and reconcile missing verdicts

- **Area/mechanism/grain:** hosted CI, repo full profile per SHA. `check.yml:12–14`: retain PR-ref grouping with cancellation, use workflow+SHA for push grouping, no push in-progress cancellation. Keep tested checkout bound to event SHA even though trusted heavy workflow resolves @main; record both identities. Reconcile main commit census against completed substantive checks; retry runner-loss/missing/cancelled attempts rather than treating cancellation as verdict. Review cancellation tools/automations before rollout.
- **Savings/before→after:** PR **B→B**, local **0/0**, direct PR critical path **0**; main execution per fully executed SHA unchanged but newly preserved runs increase total occupancy. Main queue wait can move from branch pending to runner queue, not disappear. CPU/weekly saving **0 credited**; negative compute savings likely. **Derived** correctness effect, no speed guarantee.
- **Trust:** low semantic risk, medium operational cache/race risk. Concurrent trusted producers must remain immutable/content-addressed and cannot let an older SHA overwrite a mutable “latest” verdict or baseline. Never reuse one main SHA's verdict for another.
- **Admission:** parity ledger with at least three rapid main pushes proving all identities finish; cancelled/runner-lost retry fixture; full-profile assertions and cache writer race controls. Read-only audit cannot produce this proof.
- **Prior/dependencies:** do not disable PR supersession cancellation (rejected). New binding ruling explicitly requires every main commit. No merge queue or main-red admission hold. Preserve pending work without creating a second local admission authority.
- **PR slices:** “Keep main CI keyed by commit” (S workflow + fixture); “Reconcile missing main verdicts” (M existing CI tooling/telemetry). Mandatory before performance acceptance, despite rank score zero.
- **Confidence/open:** high concurrency defect; unknown cancellation actor for 42616399512. Every pushed intermediate commit may require explicit enumeration: a push event only directly names its tip. “Every main commit” cannot be proven by run-count equality alone.

### 6. C6 — Measure and optimize partition width against the shared ceiling

- **Area/mechanism/grain:** hosted CI, package partitions/affected-set. Extend existing `ci lane-timings` and partition timing evidence with runnable width, setup, pickup and required aggregate completion. Tune existing plans only from test-body weights and matched multi-run controls. No independent push governor, no new scheduler, no capacity change.
- **Savings/before→after:** **B→B initially; 0 credited** for PR runner-minutes, required critical path and local walls. Future width m→n changes setup by `(n−m)×s` and body tail roughly W/n only when work is divisible and capacity available; fewer shards may save setup but worsen latency. **Derived formula**, benefit unknown. Score zero until measured.
- **Trust:** low for telemetry, medium for plan changes; lost/duplicate files, weakened coverage identities. Keep exact canonical census, runtime, workers, seeds and aggregate failure semantics.
- **Admission:** A/B measurements with controls at one/two/multiple simultaneous PRs and main load; parity ledger for any repack. Actual push-to-context p95 and total runner-minutes are co-primary; cap-two heavy queue separate.
- **Prior/dependencies:** #3005/#3007 assumed merged, not a new partition proposal. Rejected merged bins and two-worker Integration remain rejected. A 60-job default is not proof of unused capacity.
- **PR slice:** “Record queue-aware partition acceptance” (M timing ingestion/report); subsequent S plan-only edit only if Pareto improvement demonstrated.
- **Confidence/open:** high necessity, no savings confidence. Verify effective org ceiling/support override through admin evidence; enumerate other repo workloads.

### 7. C7 — Shard Property Laws with exact seed and run-floor parity

- **Area/mechanism/grain:** hosted CI, file partitions within every selected package. Extend `C/Ci/CiLane.ts`, partition tooling, property runner and `check.yml`; split repo-cli by property test-body timing, retaining remaining package owners. Three is an experimental width, not an accepted optimum. Stable aggregate “Property Laws”; no fail-fast omission of evidence.
- **Savings/before→after:** using reference PR body **16.5 min** and job **18.067**, overhead s=1.567: ideal three equal bodies gives **7.067 min/shard**, sum **21.20**; total **B→B+3.13 plus aggregate**. Thus runner saving **−3.13**, Yeet property-branch latency saving **11.0 min**, REQUIRED critical-path saving **0 direct**. On 577s task, ideal body becomes 192s, but 577s is task wall across workers, not additive file work; balancing/scaling must be measured. Local **0/0**, CPU body ideally unchanged, setup CPU rises (unmeasured). **Derived ideal scenario**, not p95. At all-run eligibility compute score approximately **−1,108 min/week/risk** (medium), before aggregate; rank last by requested compute objective.
- **Trust:** medium; lost tests, seed divergence, accidental floor division, duplicated globals/fixtures. Every property still runs at least 400 cases with seed **20260708**, same runtime and case order semantics; never divide 400 by shard count. Compare canonical inventory and failing witness replay, not just count 4,664. Nightly rotating seed/deeper floors unchanged. Respect current worker/I/O caps.
- **Admission:** parity ledger plus mutation fixture and A/B cold controls; fingerprint test IDs, seed, runs, retries and per-shard completion; demonstrate complete disjoint union. A single huge file needs sub-file isolation or fixture optimization, not ever more file shards.
- **Prior/dependencies:** #2844 already caps property I/O; one-round-loop fixed-seed/floor rule binding. No proof reduction to nightly. Depends on C6 capacity envelope; not on heavy-pool money.
- **PR slices:** “Add deterministic property partition plan and parity census” (M), “Wire qualified Property Laws matrix and aggregate” (M).
- **Confidence/open:** high latency opportunity, medium/low achievable scaling. Largest property file and fixture setup distribution still unmeasured. Cannot claim this closes required-green SLO.

## Rejected mechanisms considered

- Raising cap, paid runners, moving short jobs to heavy: outside money scope; at cap two moving work there may worsen required pickup. Reopen only with operator budget authorization and matched capacity evidence.
- Merge Unit/Lint bins or put Unit on heavy: existing cold-body and economics rejection stands. New cold full-census timings proving both latency and compute improvement would be needed, not warm-cache numbers.
- Two Integration workers: #3005 contention/deadline failure stands. Reopen only with workload-equivalent runner/control evidence and unchanged deadline semantics.
- Archive dependency cache, shallow checkout, PR write token, persistent lint memos, cached coverage: still rejected. Respectively require restore-vs-install evidence, merge-base parity, a new trust decision, complete input qualification, or a new coverage policy; none supplied here. No lever assumes any of these.
- Skip draft matrices, new push governor/second scheduler, main-red hold: not proposed. Pending/queue suppression cannot hide push latency; existing QualityScheduler remains the local admission authority. A parked governor is not shipping infrastructure.
- Full or partial JSDoc inventory removal, blind escalation deletion, affected Doctest: no lost global discovery/consumer obligation is allowed. Reopen only with owning trust decision and complete parity/replay proof. C2 retains these boundaries.
- Route pruning that removes required contexts: rejected. C4 requires new static-context hosted parity evidence before replacing start-and-success mechanics.
- Move doctor to nightly or make it report-only: proof reduction, not optimization. C3 preserves actual seal/promotion enforcement and predecessor ordering.
- Merge queue before E8, disabling PR supersession cancellation, treating S11 as green: rejected. C5 changes only main retention to meet the new binding every-commit requirement.
- Re-proposing #3005/#3007/#3014, or claiming their body gains as new savings: out of scope. Coverage comparator overlap is area B's lever; do not double-count it here.

## Contradictions with the inventory

1. “Remaining jobs >10m are Property/Policy” does not identify required blockers: neither is required; candidate Unit max 650s plus queue/serial setup remains over target. An under-ten-minute job is insufficient for under-ten-minute push-to-green.
2. “Push runs never cancel” is only true of the in-progress flag's automatic cancellation semantics. Branch-keyed pending runs can be replaced; live 23/30 main cancellation count supersedes the earlier 12/15 or 13/15 sample. Actor attribution remains unknown for runs that actually executed.
3. “Yeet waits on every job” is the strict/default case, not unconditional: source supports optional tolerances and relaxed S11. Neither is used to claim this target achieved.
4. “60 ceiling” now has Team-plan/default-doc corroboration, but actual override remains unverified. Heavy runners are a separate pool; total jobs do not equal peak concurrent hosted jobs.
5. 256.7 reference PR minutes cover ordinary hosted jobs only. Total occupancy is 315.3 including heavy. Phase-one source distinctions must survive ranking.
6. Knowledge doctor is not universally hosted-only: affected local plans include it with base. It is not universally report-only either. Tail overlap saves at most ~59 seconds on the cited stage timings; claiming 215 seconds requires a larger dependency-preserving redesign.
7. Heavy admitted=false already skips before allocation. C4 addresses residual route/goals/docgen late decisions only, not all skips.
8. The existing escalation classifier does not blanket-escalate all `standards/**`; it names particular configurations/seals and loaded implementations. Narrow exact trigger families, not an imagined standards-wide guard.

## Operator-only questions

None blocks this research deliverable. The brief already settles required-context p95, full proof depth, standing cap two, no money levers and every-main-commit verdict. Effective ceiling, cancellation actors, largest property file, post-merge p95, eligible-skip rate and task closure are engineering evidence gaps, not questions to hand back to the operator. If measured full-profile demand exceeds fixed capacity after waste removal, report the infeasible queue budget; any later spending or proof-policy change needs a separate explicit decision. This audit requests neither.

Memory served only as a discovery pointer (`~/.codex/memories/MEMORY.md:114–130`, route receipt/fail-open history); current source superseded it. No unverified memory-derived runtime claim is used.

```json
{
  "area": "C: hosted CI",
  "levers": [
    {
      "id": "C1",
      "title": "Trim unused short-job provisioning",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": "1.5..3 eligible; 0 otherwise",
        "criticalPathMinPerPrRun": "0..0.6",
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Missing tool or dependency changes execution"
      },
      "admissionGate": "A/B measurement with controls + parity ledger",
      "confidence": "medium mechanism; low estimate"
    },
    {
      "id": "C2",
      "title": "Narrow qualified Policy escalation",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": "2..4 eligible; 0 otherwise",
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": "0..2",
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Unchanged consumers escape validation"
      },
      "admissionGate": "route replay + mutation fixture + parity ledger",
      "confidence": "medium mechanism; low estimate"
    },
    {
      "id": "C3",
      "title": "Overlap doctor with independent tail",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": "0..0.983",
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Shared-output race or lost gate failure"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "medium"
    },
    {
      "id": "C4",
      "title": "Hoist proven heavy skips",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": "k*s; example 1",
        "criticalPathMinPerPrRun": "unknown queue relief",
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Missing required context or invalid skip"
      },
      "admissionGate": "route replay + mutation fixture + hosted parity ledger",
      "confidence": "high mechanism; low estimate"
    },
    {
      "id": "C5",
      "title": "Preserve and reconcile every main verdict",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Concurrent main producers overwrite mutable evidence"
      },
      "admissionGate": "parity ledger + rapid-push and retry fixtures",
      "confidence": "high on defect"
    },
    {
      "id": "C6",
      "title": "Measure partition width against shared ceiling",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Telemetry-only phase; later repack could omit tests"
      },
      "admissionGate": "A/B measurement with controls + parity ledger",
      "confidence": "high necessity; savings unknown"
    },
    {
      "id": "C7",
      "title": "Shard Property Laws with seed and floor parity",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": -3.13,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Lost tests or divided run floor changes proof"
      },
      "admissionGate": "parity ledger + mutation fixture + A/B measurement with controls",
      "confidence": "medium-low scaling"
    }
  ]
}
```
