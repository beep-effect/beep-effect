# Independent Codex review: Bun/Turbo benchmark validity

Date: 2026-09-15. Scope: read-only configuration review, official documentation,
installed CLI help, and Turbo dry runs. No tests, benchmarks, builds, downloads,
or source/configuration changes were performed. This report is the only authored
deliverable. Findings are independent of other reviewers.

The experiment is not ready for timing. The main blockers are configuration and
workload equivalence, not an absence of Bun parallelism. Installed Bun 1.4.2
supports isolated files and parallel workers. A fair candidate can preserve those
guarantees, but the scratch adapter has additional correctness gaps.

## Verified baseline

- Installed versions: Bun 1.4.2, Turbo 2.10.12, Vitest 4.1.11,
  `@effect/vitest` 4.0.0-rc.113. Read via version commands/package metadata.
- `@beep/schema` ordinary/property scripts both delegate to `bunx --bun vitest
  run`; coverage delegates to `bunx vitest run --coverage`
  (`packages/foundation/modeling/schema/package.json:12,21–30`). Ordinary tests
  already use Bun as the runtime. Coverage's executable must still be recorded
  in each actual process receipt; `bunx` alone is not evidence of the child runtime.
- `turbo.json:275–313` uses transit dependencies for ordinary/property tests.
  Coverage uses `^build`, disables its own task cache, and writes `coverage/**`
  (`360–382`). Global configuration future flags are enabled (`3–7`).
- `vitest.shared.ts:217–247` supplies timeout/hook policies, setup, concurrent
  tests, ordinary selection and property-only file selection. Aliases come from
  generated mappings plus tsconfig paths (`172–193`).

## Prioritized findings

### P0: A cache hit can masquerade as a fast test run

Installed `turbo run --help` says `--no-cache` is equivalent to
`--cache=local:r,remote:r`: it disables writes, not reads. `--force` forces
execution but still writes locally/remotely. For execution trials use explicit
`--cache=local:,remote:` (validated by dry runs), strict environment mode, and a
run summary. Record task execution and runner-child start/completion, not just
replayed stdout. A fresh local cache directory alone does not disable remote hits.

Counterexample: a cached Vitest result returns in milliseconds while Bun runs
the suite, or the reverse. Both commands print passing tests; neither timing
ratio describes runner speed. Treat a realistic warm Turbo-cache scenario as a
separate later CI-cost population. Do not charge every PR an uncached test run.

The pinned official [Turbo run reference](https://raw.githubusercontent.com/vercel/turborepo/v2.10.12/apps/docs/content/docs/reference/run.mdx)
documents cache sources and dry-run/summary controls. Turbo cache, runner
transformation/bytecode cache, in-process module state, and OS filesystem cache
are separate. Use fresh processes for each trial and label warm/cold runtime
conditions; do not flush host caches or equate disabled Turbo caching with a cold OS.

### P0: A seed/floor setting changes both environment and selected workload

Ordinary Turbo `test` declares neither `BEEP_FC_SEED` nor `BEEP_FC_NUM_RUNS`;
`test:property` hashes/allows both. Coverage allows seed but not floor
(`turbo.json:275–313,363–368`). Strict mode can therefore drop a shell-exported
seed/floor before the baseline sees it, while a direct candidate sees it.
Passthrough alone would preserve the value but not hash it. The official
[environment guide](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)
distinguishes hashed inputs from passthrough and warns that missing variables
can still yield successful tasks.

Further, any positive floor activates the Vitest property-only file selector
(`vitest.shared.ts:75–80,116–147,247`) and allows zero tests (`223`). Thus adding
`BEEP_FC_NUM_RUNS=100` to make ordinary tests reproducible can silently turn them
into a smaller property subset. Do not use the same environmental recipe for
ordinary and property workloads without pinning selection independently. Capture
selected file lists and generated run/discard counts. A zero-test success is a
failed benchmark qualification, even though production property/coverage config
intentionally permits it.

Reuse `fcRuns` (`packages/tooling/test-kit/fc-runs/src/FastCheckRuns.ts:162–167`).
Keep the ordinary population separate from the deep property file population,
then fix seeds/floors and workload manifests for both runners. Do not replace
these checks with the scratch adapter's small default test suite.

### P0: The current graph omits a real selected-test dependency

JSONSchema imports `@beep/test-utils` at
`packages/foundation/modeling/schema/test/JSONSchema.test.ts:25`, but schema's
manifest dependencies/devDependencies (`package.json:34–55`) omit that package.
The read-only Turbo ordinary/property dry runs included data, fc-runs, identity,
types and utils transit nodes, but no test-utils node. Consequently the current
declared graph does not establish cache invalidation through this actual import.
Hoisted resolution/aliases can make tests pass while the dependency edge is absent.

Do not repair this by simply adding a schema devDependency: test-utils already
declares `@beep/schema` as a dependency
(`packages/tooling/test-kit/test-utils/package.json:62–66`). The reverse edge
would create a package cycle and, with recursive transit/build task dependencies,
can create task-graph cycles. This is an architectural constraint, not permission
for a pilot to reorganize packages.

For the pilot, preserve manifests and label the imported helper as an explicit
out-of-graph input. Record its resolved path and source hash, its barrel/import
closure, and the lockfile in the trial input manifest. Keep execution caches
disabled. If experimental Turbo hash accounting is needed, add explicit
`$TURBO_ROOT$` file inputs in isolated pilot configuration for the shared helper
closure (or conservatively test-utils source/manifest and its consumed workspace
sources), identically for both runners, without adding a recursive task edge.
Check the dry-run inputs and changed-file hashes. This establishes honest pilot
accounting, not a resolution of the repository's production dependency topology.

The dry run's schema test inputs included `vitest.shared.ts`, `vitest.setup.ts`,
and its package config, but not `vitest.aliases.generated.json`; coverage explicitly
includes the aliases file. A scratch adapter/preload outside the package is also
absent from these task inputs. Any experimental cacheable task must account for
the adapter, preload, resolver/facade, selection manifest, generated aliases,
shared helpers, lockfile/runtime pins, and output-affecting env. This is a baseline
hazard as well as a candidate hazard. Before later cache claims, use isolated
input-change dry-run hash checks, rather than assuming transit edges cover it.

### P0: Package filtering does not mean no builds

Sanitized dry-run commands were `turbo run <task> --filter=@beep/schema --dry=json
--cache=local:,remote: --env-mode=strict`. Results:

| Task | Graph tasks | Commands that would execute |
| --- | ---: | --- |
| test | 7 | schema test only; other nodes are transit |
| test:property | 7 | schema property test only; other nodes are transit |
| coverage | 7 | six package builds plus schema coverage |

Coverage's build closure even includes schema build through dependency edges.
Running a cold Turbo coverage graph against direct Bun coverage charges builds
to only one runner. Separate a package-runner microcomparison from complete
orchestration cost, or provide exactly the same prerequisite artifacts and graph.
Use the dry-run command list as an allowlist. Do not add `^build` to the candidate
by habit, and do not use Turbo `--parallel` to bypass the graph.

Workspace script blocks are generated (AGENTS.md Quality Operator); any eventual
production script change must go through `bun run beep lint package-scripts --write`.
Keep the pilot facade in scratch/isolated experimental configuration first.

### P0: Isolation and nested concurrency must be explicit on both sides

The installed Bun CLI and [official parallelism documentation](https://bun.sh/docs/test/parallel)
confirm three distinct controls: process-level file workers, file isolation, and
within-file concurrency. Plain Bun shares a module registry; `--parallel=N`
implies isolation; `--isolate` reevaluates preloads per file. Match isolated
files first. Do not label shared-module Bun versus isolated Vitest a pure runner
improvement. Qualify mock/global mutation and fixture ordering before accepting
any weaker-isolation tuning result.

Baseline `sequence.concurrent` is enabled outside doctests
(`vitest.shared.ts:242–244`). A single Turbo task can therefore launch multiple
runner workers, each overlapping tests; Turbo concurrency alone does not cap
the process tree. Explicitly cap task concurrency, file workers and test
concurrency under the same CPU/memory allowance. Avoid automatic host-core defaults
on this large workstation. A one-file pilot underrepresents file-worker startup.

Give Vitest a bounded tuning pass too. Its [official performance guide](https://vitest.dev/guide/improving-performance.html)
identifies isolation, file parallelism, transforms and setup as independent costs.
Start with preserved-isolation worker tuning; evaluate nonisolated variants only
as separately qualified configurations on both sides. Do not automatically run a
large tuning matrix or `vitest doctor`: every actual run consumes the shared budget.

### P0: Runner substitution must intercept transitive imports without weakening tests

JSONSchema's helper imports upstream assertions and requires `assert.deepInclude`
(`packages/tooling/test-kit/test-utils/src/Schema.ts:8,57`), absent from scratch's
assert facade. Protobuf needs `vi.fn` and `vi.spyOn`
(`ProtobufScalars.test.ts:314–328`). Whole-schema tests also need module resetting
(`TaggedError.equivalence.test.ts:258–274`) and type assertions (`Number.test.ts:44`,
`codecStatics.test.ts:18,49–58`). A top-level import rewrite alone is insufficient.

Use a tiny isolated runner facade/preload, then prove actual resolved adapter and
helper identities. The [official Bun mocks guide](https://bun.sh/docs/test/mocks)
explains why preloading before imports matters: late replacement cannot undo
module side effects. Do not use a broad module mock that inadvertently stubs the
code under test. Per-file isolated preload execution and module-reset behavior
need explicit sentinels. Maintain a no-skipped-tests manifest and retain test
typechecking outside runtime timing.

Scratch qualification also needs default-timeout interruption (`internal/internal.ts:338–348`),
throwing completion hooks (`95–113`), pure-property hook count (`443–455`), and
unnamed-layer lifetime (`530–545`). Passing the existing scratch suite does not
prove these contracts. These are prerequisite correctness receipts, not timing results.

### P0 for full replacement: Native coverage is not the existing contract

The [Bun configuration docs](https://bun.sh/docs/test/configuration) explicitly
state that thresholds enforce lines/functions and accept but do not enforce
`statements`. Native text/LCOV output alone does not prove equivalent branch and
statement metrics. Existing V8 coverage includes all schema source and emits JSON
summary (`vitest.shared.ts:249–267`); the committed ratchet has 94.42% statements
and 90.35% branches (`standards/coverage.regression-baseline.jsonc:29795–29805`).
These are historical committed values, not fresh measurements.

There is also a primary-documentation conflict: the configuration page says
thresholds apply with any reporter, while the [coverage page](https://bun.com/docs/test/code-coverage)
says a nonparallel LCOV-only run exits zero regardless of thresholds. Treat this
as unresolved for the installed runtime. Before accepting a coverage gate, run
the same deliberately undercovered fixture in serial and parallel modes with
text, LCOV-only, and both reporters; record exit codes and generated metrics.
No such runtime negative control was executed in this review.

Require all-source file denominator comparison, per-file branch/statement counts,
source mapping, unimported-source handling, and deliberate uncovered-branch and
statement-drop sentinels. Do not translate line percentages into those metrics.
Bounded native coverage remains informative, but until that gate is proven,
retain Node/V8 coverage under the user's partial-adoption option. Historical setup
comments document zero instrumentation with Istanbul under Bun-hosted Vitest
(`vitest.setup.ts:1–8`); do not repeat that variant as though it were a qualified
coverage baseline.

## Mandatory prebenchmark receipts

1. Freeze revision, dirty input hashes, installed binary versions, both resolved
   config/command paths, selected file names, property seeds/floors and expected
   check populations. Assert nonempty selections and unchanged assertion bodies.
2. Qualify the adapter sentinels and transitive imports. Record runtime assertion,
   typecheck, module-reset, timeout and cleanup obligations separately.
3. Inspect both Turbo dry graphs and sanitized environment declarations. No
   unexpected builds, missing imported-package edges or uncontrolled preload paths.
   New benchmark env inputs must survive strict mode and affect hashes when relevant.
4. Use fresh per-trial accounting scopes and explicit worker/test caps. Record
   actual runner-child execution, exit, retries/failures, cgroup memory peak and
   elapsed/CPU accounting. Do not export full environments or credential-bearing
   dry-run/summary sections; preserve sanitized proof fields only.
5. Disable Turbo reads/writes for execution comparisons. Keep trial-specific
   report/coverage paths, verify new artifact creation, and avoid output paths that
   enter the next trial's input hash. Cacheable adoption tasks must declare actual
   outputs; uncached trial receipts should never be accepted from restored artifacts.
6. Run interleaved paired trials, then bounded tuning, then bounded coverage;
   stop at 60 aggregate execution minutes including warmups and failed attempts.
   No new budget per runner or tuning variant. Failures consume cost and cannot be
   dropped from the analysis.

## Decision boundary

The local pilot can establish correctness feasibility and conditional resource
ratios, not a 10% reduction in total billed CI cost per successful PR. The eventual
cost model must include the migrated fraction of paid work, unchanged coverage,
setup/teardown, cache hit rates, retries, failed PR attempts, and shared runner
occupancy. Counterexample: halving a lane that is 10% of total cost saves only 5%
before migration overhead. Compare against the best qualified baseline, not an
untuned or accidentally expanded baseline.

An adoption recommendation must satisfy the user's lower uncertainty bound of
at least 10% total CI savings, no more than 10% time/memory regression, no new
OOM/correctness failures, and retained guarantees. Partial adoption is valid.
Insufficient samples or incompatible coverage are inconclusive for full adoption,
not reasons to lower the threshold.

Graft reported approximately 55,584 tokens saved in this review (one positive
retrieval; a second lookup returned no hits). Its older prose about FastCheck was
not treated as authoritative over live Arbitrary source.
