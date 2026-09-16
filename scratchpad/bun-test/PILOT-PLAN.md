# Local Bun test pilot plan

Date: 2026-09-15. Status: qualification executed; native full-package comparison
stopped at correctness failures. This document preserves the planned protocol;
[PILOT-RESULTS.md](PILOT-RESULTS.md) records what actually ran and what was deferred.

The operator agreed to qualification before measurement. The user-set scope,
60-minute aggregate benchmark budget, eventual 10% total CI savings threshold,
uncertainty requirement, and regression limits are recorded in
[BENCHMARK.md](BENCHMARK.md). Numbers below concerning workers, repetitions,
analysis, and allocation are technical defaults for this local pilot, not new
user-set adoption criteria.

## Deliverable

Produce a reproducible local report for `@beep/schema` containing:

- qualified and unsupported runtime contracts, with exact reproductions;
- ordinary and property runner time, CPU, and aggregate peak memory results;
- a bounded coverage compatibility/resource comparison;
- the actual Turbo task graphs and command/input provenance;
- raw attempt records, including failures, timeouts, and incomplete pairs;
- a recommendation to stop, refine locally, or design a bounded CI study.

This milestone creates no canonical package and changes no hosted workflow.
It cannot claim repository-wide compatibility, EC2 emulation, or billed savings.
The eventual package belongs in `tooling/test-kit`, subject to the package
scaffold, generator, and architecture review at that later milestone.

## 1. Freeze inputs and prepare an isolated experiment

The inspected checkout is `d142324fe0ff4288bb57debd4381c5bec11975dc`.
Installed Bun is 1.4.2, Turbo 2.10.12, Vitest 4.1.11, and Effect/
`@effect/vitest` rc.113. The workstation's default Node is 24.20.0;
coverage must use the already cached Node 22.22.3 binary to match hosted
coverage. Reverify versions and binary identities before any trial.

Use a disposable sibling worktree with the existing workspace topology. Never
put a checkout under `/tmp`. Capture the base revision, approved dirty overlay,
lockfile, resolved binaries, test/source hashes, and experimental changes.
The user's working checkout remains the authoring location for the adapter,
harness, and reports; arm-specific task/configuration changes live in the
experimental worktree. Record every such change in the input manifest.

Installed Turbo exposes no alternate root `turbo.json` switch. Do not invent
`turbo --config scratchpad/turbo.json`, or hide replacement behind a `bunx`
PATH shim. Keep the existing `@beep/schema` package identity and real Turbo
package scheduling in the experimental checkout. Adapt its script mapping
through the canonical generator in that checkout, then run
`bun run beep lint package-scripts --write`. Dry-run the result and reject any
unintended package command changes. Avoid a repository-wide native default.
Preserve and review the generator diff as experimental implementation cost.

Implementation finding: the generator preserves package-owned `beep:*`
implementations. A later eligible trial can change only schema's experimental
`beep:test` implementation and regenerate the task-facing block; changing shared
generator defaults is unnecessary. No script mapping was changed in this pilot
because native correctness qualification failed first.

Keep one frozen configuration artifact per arm. Do not switch manifests or
configs while any child is alive. Store output outside hashed source inputs;
exclude prior receipts and coverage from the next trial's input manifest.
Keep public reports sanitized; raw logs and sanitized machine-readable receipts
belong under the ignored experiment artifact directory.

Implement the smallest scratchpad Effect program using existing admission and
resource helpers, with schema-defined manifests, trial records, and failures.
Use existing live source/barrel discovery before adding helpers. Give the
adapter/harness a focused TypeScript project; retain schema test typechecking.
Do not use a passing broad scratchpad check as a substitute for test typechecking.

## 2. Qualify each comparison before timing it

Implement the [configuration contract](research/configuration-adjudication.md).
Start with adapter controls and the JSONSchema/Protobuf suites, then require
the complete schema workload for any result labeled a full-package comparison.

The control suite must cover:

1. Config/preload selection, alias and helper resolution, explicit nonempty
   file populations, matching case/skip/todo inventories, and an excluded-file
   sentinel. A zero-test success is a failure of the experiment.
2. A known failing assertion, the transitive `assert.deepInclude` helper,
   mocks/spies and restoration, representative equality, and retained type
   assertions. Do not add equality machinery without an observed difference.
3. Explicit and default timeout interruption, resource finalization, throwing
   completion hooks, synchronous test-body throws, property hook counts, and
   named/unnamed Layer lifetimes.
4. File-to-file global/module isolation and the Float16 test's within-file
   module reset. Between-file isolation is not a substitute for the latter.
5. Property floors, compatible seed types, replay/shrinking, and actual generated
   work. Instrumentation used only for qualification must be absent from both
   timed arms, or identically present and disclosed.
6. Turbo graph/input/env checks and fresh runner-child execution. Hash probes
   cover adapter, preload, aliases, actual helper closure, config, and seed/floor.

Correct failures within the adapter/facade and experiment wiring where possible.
Do not silently remove tests, weaken assertions, or change production schemas.
If qualification requires an architectural package refactor or cannot preserve
a contract, report that blocker and stop the affected comparison. Partial
adoption allows retaining a workload on Vitest; it does not allow reporting a
smaller Bun workload as equivalent to the complete package.

Qualification is per comparison. A native coverage contract failure does not
invalidate qualified ordinary/property timing. Native coverage may still be
reported as a non-equivalent diagnostic, never as a drop-in coverage speedup.

## 3. Resource and configuration defaults

| Setting | Initial matched comparison |
| --- | --- |
| Simultaneous experiment arms | One |
| Turbo executable package tasks | One (`--concurrency=1`); inspect dependency commands separately |
| CPU allowance | Four CPU equivalents (`CPUQuota=400%`) |
| Memory | `MemoryMax=16G`, `MemorySwapMax=0`, read back before child start |
| File workers | Four on both runners |
| Within-file concurrency | Explicit cap of five on both runners, preserving serial test declarations |
| File isolation | Enabled on both runners |
| Timeouts | Existing ordinary/property/coverage and hook policies, including adapter interruption behavior |
| Retries and reruns | Disabled for timing; unexpected retry behavior is a qualification failure |
| Task-result cache | Local/remote reads and writes disabled |
| Filesystem cache | Left intact; fresh processes with labeled first-run/warmed conditions |

These are controlled local limits, not a claim to reproduce an EC2 runner.
Refresh host availability and admission state before execution. If the envelope
cannot be admitted safely, stop with an environment finding; never lower only
one arm's allowance or change the shared slice.

`withQualityAdmission` from `@beep/repo-cli/test/RepoRun` provides admission.
Its token estimates do not impose hard cgroup limits. Existing `enterRunScope`
sets the slice/PIDs/collection policy but has no CPU/memory-limit parameters and
can warn rather than fail on attachment. The pilot must require a real scope,
apply and read back its own scope's limits before starting the measured child,
and fail closed if attachment or enforcement is unavailable. Use a fresh
admitted trial process/scope for each attempt, never the shared slice's peak.

Capture elapsed time, child executable/exit, `MemoryPeak`, `cpu.stat`,
`memory.events`, and cleanup status while the trial scope is alive. Record
aggregate cgroup peak as such; `/usr/bin/time` largest-process RSS is only a
secondary diagnostic. Read accounting before automatic scope collection.

Give each runner the same bounded tuning search: file workers 1, 2, and 4,
with isolation and within-file cap unchanged. Use one exploratory run per
setting/workload/runner, within a shared ten-minute tuning allowance. Four-worker
qualification/warm-up can supply the exploratory four-worker observation.
Complete symmetric comparisons; never pick Bun's best result against Vitest's
untuned result. If tuning cannot finish, retain the matched four-worker setup.

Freeze any chosen tuned settings before fresh confirmation trials. Keep the
matched-resource receipts separately; discovery/tuning runs are not confirmatory
samples. Defer `--smol`, shared-module isolation changes, and larger matrices
unless the initial report justifies a separate experiment.

## 4. Workload and command matrix

| Workload | Baseline | Candidate | Population |
| --- | --- | --- | --- |
| Ordinary | Installed Vitest CLI hosted by Bun | Native Bun with adapter/facade | Entire ordinary schema test manifest |
| Property | Installed Vitest CLI hosted by Bun | Native Bun with adapter/facade | Exactly the existing property-selected schema files, floor 400 |
| Coverage reference | Vitest V8 on Node 22.22.3 | None; this remains the reference | Entire schema test population and all-source inclusion contract |
| Coverage candidate 1 | Same reference | Vitest V8 hosted by Bun | Same tests and coverage configuration; qualification required |
| Coverage candidate 2 | Same reference | Native Bun coverage | Same tests; metrics/guarantees compared explicitly, diagnostic if non-equivalent |

Use `BEEP_FC_SEED=20260708` as the initial qualification seed. Ordinary timing
keeps the property floor unset; hash/allow its seed explicitly in experimental
strict-mode configuration. Property timing sets floor 400 and preserves the
property-only file manifest. Confirm actual effective options at the helper
boundary; do not infer them from the parent shell.

For repeated ordinary/property measurements, predeclare a ten-entry integer
seed schedule beginning with 20260708. Each baseline/candidate pair uses the
same seed, and the selection remains fixed. Keep property seeds distinct from
Bun's optional test-order randomization seed. Failure controls use separate
fixed seeds and are not timed observations.

The actual package-task launch shape, inside the bounded admitted trial, is:

```sh
bunx --no-install turbo run test \
  --cwd <experimental-root> --filter=@beep/schema \
  --concurrency=1 --env-mode=strict \
  --cache=local:,remote: --summarize
```

Repeat with `test:property` for property trials. Before execution, use
`--dry-run=json` and check the planned child command. The task's generated
command selects the frozen runner/config and explicit worker limits.
Installed `bun test --parallel=4 --isolate --concurrent --max-concurrency=5`
and Vitest's `maxWorkers: 4`, `isolate: true`, `maxConcurrency: 5`, and existing
concurrent sequencing describe the initial settings; resolved config and actual
behavior must still pass qualification.

Coverage's existing `^build` graph is accounted for separately. Prepare identical
artifacts once, record that setup cost, and time the package coverage commands
directly with those artifacts already present. Label coverage explicitly as a
package-runner measurement; ordinary/property trials exercise actual Turbo
package scheduling. Record dry graphs for the complete Turbo coverage lane.
Do not run cache-disabled prerequisite builds on only the baseline
or repeatedly count builds as coverage-runner work. Full end-to-end coverage
lane measurement belongs to the later CI study.

Explicitly record the coverage child runtime; `bunx` without `--bun` is not proof
that the intended Node executable was used. Resolve the installed CLI and cached
Node binary without downloads or runtime upgrades. Unsupported Bun-hosted V8 is
a compatibility result, not permission to replace the reference silently.

## 5. Repetitions, budget, and stopping

The hard cap is 3,600 aggregate seconds of experiment test execution across all
arms. Count warm-ups, tuning, qualification test controls, full-package validation,
failed attempts, retries, and timeouts conservatively in this ledger. Implementation,
static typechecking, analysis, and prerequisite builds are reported separately;
they are not test-runner speedup evidence. Do not reset the ledger after a fix.
Runtime tests invoked by mandatory package verification also count. Identify
the required handoff commands and reserve their execution time before tuning;
do not discover a large mandatory test lane after consuming the budget. For a
small experimental script-mapping change, assess whether package verification's
documented `--quick` mode plus focused generator controls is justified. Record
that choice and its limits; do not silently omit an applicable quality gate.

Reserve up to twelve minutes of the remaining ledger for bounded coverage.
The ordinary/property target is ten complete confirmation pairs per workload,
interleaved to avoid spending the entire budget on one workload. Predeclare a
balanced randomized AB/BA order and the analysis seed before confirmation.
One fresh process per attempt; one warm-up per newly frozen configuration.

Choose a confirmation configuration before collecting its confirmation data.
If tuning picks a different worker count for each runner, label those results
as independently tuned under the same resource ceiling; do not call them a
matched-worker comparison. Do not combine differently configured observations.

Bound each whole-package attempt by ten minutes and the remaining aggregate
budget, in addition to per-test timeouts. Do not start a pair when recent
durations make completion within the remaining allocation implausible. Preserve
any incomplete pair and its consumed time; exclude it only from paired ratios,
never from the execution ledger or reliability findings.

Stop early for a contract failure, new OOM, missing accounting, configuration
drift, unreaped child, or exhausted budget. After the target confirmation pairs,
stop if the result is clear; do not keep running to improve a favorable estimate.
Do not repeatedly inspect a conventional confidence interval and stop at the
first apparent win. An early budget stop yields exploratory/inconclusive data.

Coverage gets one fresh reference/candidate pass initially, with an order fixed
before timing; repeat up to three passes per eligible arm only if the coverage
allocation allows it. Coverage compatibility and artifact checks take priority
over repetitions. One to three passes are diagnostic, not a tight performance
confidence claim.

## 6. Analysis and the local review decision

Report raw attempts, arithmetic mean elapsed/CPU/peak memory, median, range,
maximum observed memory, and paired candidate/baseline ratios per workload.
For ten completed confirmation pairs, use a predeclared paired bootstrap with
10,000 resamples and a fixed analysis seed to estimate a 95% interval for the
ratio of arithmetic means. Resample whole pairs. Label the interval conditional
on this machine, resource envelope, source revision, and seed schedule; a small
local sample does not establish fleet tail risk or CI reliability.

Failures are a correctness/reliability result, not fast successful samples.
Keep their durations and costs visible. A fix changes the configuration version
and starts a new confirmation set, without replenishing the execution budget.
With fewer than ten complete pairs, retain descriptive/exploratory results and
make no conclusive threshold claim from this pilot.

The review has three outcomes:

- **Stop this migration path:** a necessary contract cannot be preserved within
  the adapter/experiment scope, or resource/correctness regressions outweigh
  its measured benefit. Preserve a minimal reproduction.
- **Refine locally:** qualification or sample size is incomplete, intervals are
  wide, or benefits depend on unresolved configuration/tuning. State the exact
  missing evidence; do not lower the user's adoption threshold.
- **Propose a bounded CI study:** at least one qualified workload has a repeatable
  useful resource improvement, there are no new correctness/OOM failures, local
  memory is compatible with the agreed limit, and the cost sensitivity model
  shows a credible path to total savings. This proposal includes a spend cap,
  representative workloads and cache conditions, and existing-fleet placement.

A local 10% runtime reduction is not the adoption gate. Let `s` be a measured
fractional saving in an eligible execution component and `f` its eventual share
of total attributable paid CI cost. Under unchanged rates/occupancy and ignoring
added overhead, the simple modeled saving is `f * s`. Show required shares
`f >= 0.10 / s` as sensitivity, not as observed billing. If the component's paid
share is unknown, say so. Memory savings only become billed savings if they
change measured worker occupancy, sizing, or failures without breaking limits.

The eventual CI denominator is attributable CI expenditure divided by successful
PRs in a predeclared representative cohort. Include failed/retried attempts and
allocated setup/idle/teardown costs; report AWS and any billed GitHub-hosted
compute separately before combining. Do not charge free hosted minutes a
fictional rate or count queue latency as worker occupancy automatically. Cohort
assignment, successful-PR definition, fixed/shared-cost allocation, and spend
authorization are finalized only if the local review warrants that study.

Eventual adoption still requires an uncertainty range supporting at least 10%
total CI cost reduction, at most 10% regression in CI completion time and local
peak memory, no new OOM/correctness regressions, and retained coverage guarantees.
Partial adoption remains allowed. Typechecking and other unchanged lanes stay
in the cost denominator.

## 7. Completion evidence

Before handing back implementation, run the focused adapter/harness typecheck,
qualification controls, retained schema test typecheck, and the appropriate
package verification for any workspace package touched. Preserve each command's
exit and classify failures as introduced, inherited, unrelated, or environmental.
Do not claim broad quality gates were run when only focused checks were run.

Write the sanitized report and reproduction instructions beside this plan;
keep raw receipts under the ignored artifact root with an explicit inventory.
The report must list qualified, failed, unexecuted, and inconclusive items
separately, show the consumed execution budget, and disclose all experimental
generator/configuration changes. No commit, publication, paid CI run, or
canonical migration is part of this local plan.

## References

- [Configuration adjudication](research/configuration-adjudication.md) and its
  linked independent reports contain the source anchors and corrected claims.
- [Bun parallelism](https://bun.com/docs/test/parallel) distinguishes file workers,
  file isolation, and within-file concurrency.
- [Vitest maxWorkers](https://vitest.dev/config/maxworkers) and
  [maxConcurrency](https://vitest.dev/config/maxconcurrency) define the baseline
  controls. Installed behavior remains the qualification target.
