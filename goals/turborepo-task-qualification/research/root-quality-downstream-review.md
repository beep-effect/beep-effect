# Root Quality downstream argument review

Authority: source review and eleven pure planner observations at `9480eaf486`.
No planned subprocess was executed. Reproduce with
`bun goals/turborepo-task-qualification/research/refresh-root-quality-plans.ts`.
The private snapshot and source digests are bound in the runtime boundary receipt.

| Invocation | Downstream interpretation |
| --- | --- |
| `audit`, `audit packages` | Both select the package Turbo audit graph. `packages` is consumed as a mode, not forwarded as a task argument. |
| `audit packages --force` | Selects the same graph and forwards `--force`; the observed plan omits the default cache-mode flag. |
| `audit github quality` | Runs `quality github-checks quality` through the repository CLI. |
| `audit github` | Defaults to `quality github-checks pre-push`. |
| `build`, `check`, `lint` | Static planners return subprocess steps; check additionally includes test-tsgo, and lint includes repository policy work. |
| `test`, `coverage` | Static planner returns no steps because runtime runners determine the work. An empty static plan is not a successful or absent execution. |
| `lint --fix` | Static aggregate plan selects `lint:fix`, but the actual runner can instead inspect changed Git files and run a bounded fixer or return without execution. |

`runQualityTask` first resolves the current directory to the repository and
nearest package. Package mode reads that package's manifest, chooses its mapped
`beep:*` script, forwards arguments and returns a reported no-op when the script
is absent. Root mode dispatches test, lint and coverage to specialized runners.
Thus root and package invocations of the same verb are different computation
boundaries.

Coverage parsing removes `--write-baseline`, `--replace-all` and forwarding
separators from Turbo arguments. Those flags control later baseline behavior;
they are not proof that the wrapper is read-only. Affected scope, explicit
filters, changed Git paths and baseline rows still need runtime interpretation.

The snapshot reflects the invoking local environment. CI/cache/concurrency
branches can produce different plans. This review closes the interpretation of
the listed static audit selectors; it does not exhaust all arguments, runtime
selection, external verdicts, or actual subprocess reads and writes. The census
must retain its unresolved runtime obligations. No computation is qualified.

## Runtime test and coverage boundaries

The same recipe now retains five pure test-lane selector observations: no
selector enables both lanes, either explicit selector enables only that lane,
both selectors enable both, and the forwarding separator/selection flags are
removed while concurrency arguments remain. These observations execute no tests.

Source review of `runRootTestTask` shows unit failures are collected before
integration work. Integration discovers workspace scripts, includes unsplit
integration owners when no explicit scope is supplied, and then acquires a
scoped default SQL integration resource for the serial lane. The final wrapper
aggregates unit and integration failures. Workspace membership, arguments,
service availability and the external test verdict therefore remain inputs;
a unit-test cache hit cannot replace the wrapper's resource lifecycle or verdict.

`resolveCoverageTaskOptions` rejects replacement without baseline-write mode,
replacement on scoped runs, and affected selection combined with explicit
filter/since arguments. Affected coverage requires `TURBO_SCM_BASE`, compares
that ref to `HEAD`, inspects baseline-row changes and selects full, selected or
no-op scope. No-op returns before output cleanup and test execution.

For executing scopes, `runRootCoverageTask` cleans existing regression outputs,
then runs selected work or discovers coverage owners for weighted shards with a
prebuild. Afterwards it either writes the baseline or compares it against fresh
results. `VITEST_COVERAGE_REPORT_ONLY=1` is rejected outside baseline generation.
Git resolution, owner discovery, output cleanup/materialization and baseline
comparison must stay distinct from any separately qualified package computation.

This is a reviewed source classification, not proof that each runtime branch
executed successfully. SQL acquisition, Git-selected coverage scope, actual
output effects and final hosted verdicts remain with their existing proof owners.
