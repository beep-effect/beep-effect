# Bun test migration experiment

Status: local pilot executed through qualification and bounded coverage
diagnostics. Full native schema qualification failed; confirmation sampling and
CI measurement did not start. See [PILOT-RESULTS.md](PILOT-RESULTS.md).
This document records decisions for the scratchpad experiment; it does not
change the repository's production test-runner policy. The implementation
sequence and measurement defaults are in [PILOT-PLAN.md](PILOT-PLAN.md).

## Question

Would adopting this Bun test adapter as a canonical repository package reduce
CI cost enough to justify migration and ongoing maintenance, while preserving
test guarantees? Measure local execution time and memory alongside CI outcomes.

## Decisions

### 2026-09-15: primary outcome

- Question: Which outcome carries the most weight when CI cost, completion
  time, and local memory improve by different amounts?
- Answer: Lower CI cost per successful PR.
- Rationale: The operator identified CI spending as the main reason for this
  experiment. Completion time and peak memory remain reported outcomes.
- Rejected alternatives: prioritizing feedback time or workstation peak memory
  above CI cost.

### 2026-09-15: partial adoption

- Question: Is partial adoption acceptable if native Bun saves resources but
  Vitest remains necessary for coverage guarantees?
- Answer: Adopt wherever the measured benefit justifies it.
- Rationale: A useful result may retain the existing coverage path while
  replacing other test execution paths. Full replacement is not a prerequisite
  for adoption.
- Rejected alternative: adoption only if Bun replaces every package test and
  coverage path.

### 2026-09-15: first milestone

- Question: What should the first milestone deliver?
- Answer: A local `@beep/schema` pilot, followed by a review of whether CI
  measurement is justified.
- Rationale: Establish compatibility and local resource measurements before
  investing in hosted comparisons. The local pilot can support modeled CI
  savings but cannot establish observed billed savings.
- Rejected alternative: requiring local and bounded CI measurements before
  the first review.

### 2026-09-15: adoption savings threshold

- Question: What minimum reduction in total CI cost per successful PR justifies
  adopting and maintaining the adapter after representative CI measurement?
- Answer: At least 10%.
- Rationale: The operator accepts a smaller durable cost improvement than the
  proposed 20% threshold. Evaluate the reduction across total attributable CI
  cost per successful PR, not just the migrated test command or one package.
- Rejected alternatives: minimum reductions of 20% or 35%.
- Evidence boundary: this is an eventual adoption criterion. A local package
  pilot does not establish that the criterion has been met.

### 2026-09-15: regression limits

- Question: If the cost target is met, how much regression is acceptable in CI
  completion time or local peak memory?
- Answer: At most 10% in either metric, with no new OOMs or correctness
  regressions.
- Rationale: Lower cost may justify a bounded resource or latency tradeoff;
  reliability and test guarantees must be preserved.
- Rejected alternatives: accepting no regression beyond measurement noise, or
  allowing regressions up to 25%.

### 2026-09-15: local pilot workloads

- Question: Which workloads should the local `@beep/schema` pilot include?
- Answer: Ordinary tests, the property workload, and a bounded coverage
  comparison.
- Rationale: Coverage directly affects a paid CI lane and belongs in the
  feasibility study. Report ordinary, property, and coverage measurements
  separately; coverage timing does not establish equivalent coverage guarantees.
- Rejected alternative: measuring ordinary tests and the property workload
  first while deferring coverage.

### 2026-09-15: local execution budget

- Question: How much aggregate benchmark execution time should the local pilot
  use before stopping for review, excluding implementation and analysis?
- Answer: Up to 60 minutes, stopping earlier if the result is clear.
- Rationale: Bound the local study while allowing repeated measurements across
  ordinary, property, and coverage workloads.
- Rejected alternatives: a 30-minute feasibility budget or a two-hour budget
  for more repetitions and configurations.
- Accounting: the budget is shared across runners and workloads, not renewed
  for each variant. Include warm-ups and failed or timed-out benchmark attempts.

### 2026-09-15: uncertainty requirement

- Question: Must an eventual adoption recommendation clear the 10% savings
  threshold after accounting for measurement uncertainty?
- Answer: Yes; the uncertainty range must support at least 10% savings.
- Rationale: A central estimate above the threshold is insufficient when the
  uncertainty range includes smaller savings. Such evidence is inconclusive
  for adoption.
- Rejected alternative: accepting a repeatable central estimate of at least
  10% without the uncertainty range also supporting the threshold.

### 2026-09-15: adversarial configuration qualification

- Question: How do we prevent monorepo misconfiguration from skewing the
  benchmark?
- Answer: Independently investigate the Bun/Turbo configuration with Grok and
  Codex before trusting performance measurements.
- Rationale: The operator requires a properly configured candidate. Qualify
  the baseline as well, so a baseline configuration defect cannot manufacture
  a candidate win. Static review identifies necessary checks; executable
  qualification establishes their behavior for the pinned versions.

### 2026-09-15: qualification-first pilot

- Question: Make proper configuration an executable acceptance gate, then
  measure matched workloads with equal resources and bounded tuning?
- Answer: The operator agreed after reviewing the reconciled Codex/Grok
  findings and six proposed qualification requirements.
- Rationale: Test selection, property work, runtime semantics, task execution,
  and coverage obligations must be established before accepting speed results.
  Apply the requirements to both runners.
- Rejected alternative: timing default configurations immediately and treating
  static review or successful logs as sufficient proof of equivalence.
- Scope: this records agreement to the approach. It does not assert any
  qualification has passed or authorize repository-wide migration.

## Proposed measurement approach

The following approach is agreed. [PILOT-PLAN.md](PILOT-PLAN.md) states the
technical defaults and evidence required to implement it.

- Begin with `@beep/schema`: qualify the JSONSchema suite, then measure the
  complete package to include module loading and worker overhead.
- Compare ordinary native Bun tests against the existing Bun-hosted Vitest
  baseline. Compare coverage separately against its actual Node/V8 baseline.
- Prove equivalent test selection, property runs and seeds, assertions,
  cancellation, cleanup, and fixture lifetimes before accepting speed results.
- Hold source revision, workload, CPU allowance, memory budget, and isolation
  constant for the initial paired comparison. Evaluate tuning separately.
- Measure complete-process-group elapsed time, CPU time, and peak memory.
  Preserve failed, timed-out, cancelled, and retried attempts in cost accounting.
- Distinguish package measurements, modeled CI savings, and observed billed
  savings. Account for paid runner setup and teardown; queue latency is a
  separate measurement. Do not extrapolate a test speedup to the whole AWS bill.

## Remaining boundaries

- No additional operator preference is needed to prepare the local pilot.
  Repeat counts, resource limits, coverage arms, analysis, and stopping rules
  have explicit proposed defaults in the pilot plan, separate from user-set
  adoption thresholds.
- A hosted study's runner allocation, cohort, duration, and spend are deferred
  to the local results review. The local milestone does not dispatch CI or
  establish total billed savings.
- Canonical package creation and fleet migration remain later decisions,
  conditional on compatibility evidence and the agreed cost threshold.

## Configuration qualification before measurement

The independent reviews are recorded in
[research/codex-turbo-review.md](research/codex-turbo-review.md) and
[research/grok-turbo-review.md](research/grok-turbo-review.md). The
[adjudication and configuration contract](research/configuration-adjudication.md)
resolve disagreements and specify the required executable evidence. Grok did
not complete its primary-document fetches; its output includes claims corrected
by the adjudication. These requirements address found risks; they do not assert
the configuration has already passed qualification.

- Use both a runner execution comparison and the actual Turbo task graph.
  Keep prerequisite builds, task scheduling, and cache-hit behavior visible in
  the later CI cost model. Direct runner timing alone is not lane timing.
- For uncached execution trials, explicitly disable Turbo local/remote reads
  and writes with `--cache=local:,remote:` and verify fresh runner-child
  start/completion receipts. Installed Turbo 2.10.12 accepts this form.
  `--no-cache` still allows reads; `--force` still allows writes.
- Freeze exact, nonempty file populations separately for ordinary, property,
  and coverage runs. A positive `BEEP_FC_NUM_RUNS` activates the existing
  property-only file selector; do not introduce it into ordinary runs and
  assume the population stays unchanged.
- Pin working directory, config and preload paths, alias resolution, and
  approved nonsecret environment values. Prove config discovery and excluded
  files rather than relying on defaults. The root Bun config uses `exclude`,
  while current docs and installed help specify `pathIgnorePatterns`; the
  existing key has not been qualified. Account for automatic dotenv loading
  without reading or recording secret values.
- Prove intended nonsecret environment settings reach each child under Turbo
  strict mode and affect hashes where they affect results. Ordinary `test`
  currently declares neither property floor nor seed; `test:property` declares
  both, and `coverage` declares seed but not floor.
- Account for actual imports, generated aliases, adapter, preload, selection
  manifest, runtime pins, and shared helpers in the experimental task graph
  and hash inputs. Schema tests import `@beep/test-utils` without a declared
  manifest edge, and the current dry graph omits that package. Record that as
  inherited configuration debt; do not silently credit fixing it to Bun.
  Test-utils already depends on schema, so adding the reverse dependency would
  create a cycle. For this pilot, explicitly inventory/hash the resolved helper
  closure as out-of-graph inputs in isolated configuration, equally for both
  runners, without changing production manifests or recursive task edges.
- Give both runners equivalent prerequisite artifacts. A coverage dry run
  schedules dependency builds even with `--filter=@beep/schema`; ordinary and
  property tasks use transit nodes instead.
- Match Turbo task concurrency, file-worker count, within-file concurrency,
  isolation, timeouts, setup, and transitive adapter resolution explicitly.
  Give both runners a bounded tuning opportunity within the same limits.
  Start with preserved file isolation; Bun supports it in the installed version.
  Between-file isolation does not prove the within-test module-reset behavior
  required by the schema Float16 test.
- Keep Turbo result caches, runner transformation caches, module state, and
  filesystem page cache distinct. Never flush host caches for the experiment.
  Runtime variants use fresh processes and labeled cache conditions.
- Use per-trial output directories and prove fresh artifacts. Verify coverage
  source inclusion and statement/branch denominators with deliberate failures.
  Bun's configuration and coverage docs disagree about LCOV-only threshold
  enforcement; installed-runtime negative controls must resolve it.

Keep equality qualification, but do not treat the scratch adapter's no-op
`addEqualityTesters` as a proven regression: the installed upstream function
registers an empty tester array. Likewise, the historical zero-instrumentation
comment concerns Istanbul under Bun, not a measured failure of V8 under Bun.
Absence of performance evidence leaves the migration hypothesis untested.

Read-only dry runs confirmed the current property task hash changes when its
floor or seed changes. The ordinary task hash changes for neither; coverage
changes for seed only. No tasks or test children executed in those dry runs.

## Pilot feasibility findings

Read-only inspection on September 15 established the following planning inputs;
none are benchmark results.

- Ordinary schema tests already run Vitest on Bun. Typechecking runs separately
  through `beep:check` and `beep:check:tests`; preserve those obligations when
  comparing runtime test execution.
- Runner substitution must cover transitive test helpers. JSONSchema tests use
  `@beep/test-utils`, whose Schema helper imports upstream assertions and calls
  `assert.deepInclude`. Protobuf tests also use mock functions and spies.
- Full-package qualification must handle module-reset tests, type assertions,
  and Layers. Unsupported tests cannot disappear from the workload.
- Reuse `fcRuns` for property floors and seeds. Record actual generated checks;
  a test-case count alone does not capture loops over multiple schemas.
- Use a fresh per-trial cgroup for aggregate resource accounting. The existing
  repo RunScope helper reads `MemoryPeak`; Yeet's `/usr/bin/time` RSS field is
  not an equivalent measurement of simultaneous worker memory. Cgroup peak
  memory includes more than process RSS and must be labeled accordingly.
- The existing quality admission boundary creates scopes under
  `agent-runs.slice`. Reuse admission and capture trial accounting before scope
  collection. Do not measure the shared slice, which includes unrelated work.
- The host exposes cgroup v2 and a reachable user systemd manager. No trial
  scope was created to verify execution. Resource availability must be checked
  again before measurements.

## Evidence anchors

- `packages/foundation/modeling/schema/package.json`: ordinary tests use
  `bunx --bun vitest run`; coverage uses `bunx vitest run --coverage`.
- `.github/workflows/heavy.yml`: integration and coverage use the EC2-heavy
  runner; coverage pins Node 22.22.3 in this checkout.
- `docs/runbooks/aws-cost-operations.md`: the September 15 policy preserves a
  two-worker Spot pool and a $200 monthly target. The cap limits simultaneous
  spend, not aggregate monthly worker hours. These are documented policies,
  not a live AWS verification performed for this experiment.
- `standards/architecture/08-testing.md`: Vitest is the current production
  runner policy. Adoption would require a deliberate policy update.

Runtime and workflow versions must be captured again for each measurement.
