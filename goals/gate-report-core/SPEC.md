# Gate Report Core Spec

## Objective

Build the gate-neutral report model and its console renderer by porting vitest-agent's core into
`@beep/*` packages, and prove it on the `test` and `check` gates.

A gate runs its tool. An adapter turns the tool's output into events. The events reduce to one
typed gate report. A recorder writes the report and the raw log to disk. Every console is a
projection of the report. This goal delivers the model, the recorder, the agent and terminal
projections, a type-checker adapter and a Vitest adapter, the `test` and `check` wiring on the
repo CLI task path, and the first two queries of the planned `gate` command family on the repo
CLI.

The design is settled in the exploration packet. `explorations/agent-verification-output/BRIEF.md`
is the accepted pitch (decision `brief-accepted`),
`explorations/agent-verification-output/DECISIONS.md` holds the rulings,
`explorations/agent-verification-output/MAP.md` candidate 3 is this goal, and
`explorations/agent-verification-output/research/vitest-agent-core.md` is the port study, cited
against the reference checkout `.repos/vitest-agent` at `1cf1ab94`. This spec links them and makes
them precise; where it is more precise, it governs.

## Non-Goals

- Computing history labels and the fix-loop delta. `goals/gate-run-history` owns both; this goal
  renders their slots.
- Gates other than `test` and `check`, `YeetVerdict` and the issue index as consumers, the
  heartbeat and block-until-changed: `goals/gate-report-rollout`.
- The CI projection (job summary, grouped log), report upload and the CI-job adapter:
  `goals/ci-gate-reports`. Under CI this goal renders the agent projection.
- Upstream's TDD-session workflow, Ink live view, Claude Code hooks, sidecar binary and MCP server
  (decision `tdd-workflow-no-go`). No MCP tool and no hook is added to any harness
  (decision `agent-surface`).
- SARIF and CTRF emitters (decision `interchange-projections`, deferred). The model stays
  projectable to both without loss.
- Any wrapper around a command the repo does not own (decision `scope-gates-only`).
- The located fixes of `goals/gate-output-switch-on` and the census of
  `goals/agent-output-census`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

New packages. Each is created with `bun run beep create-package`, never by hand. Phase P0
confirmed each name and home with the architecture guardian; the decision files `model-home`,
`library-split` and `vitest-adapter-home` record the review.

| Name | Family / kind | Path | Holds |
| --- | --- | --- | --- |
| `@beep/gate-report` | foundation / modeling | `foundation/modeling/gate-report` | Report schemas, the event union, the reducer, shape and outcome classifiers, honest-count rules, failure signature, cause-folding table, the dispatch table and its cells producing a neutral console document |
| `@beep/repo-gate-record` | tooling / library | `tooling/library/repo-gate-record` | The record and log codec, the package and root path rules, newest-20 retention and the writes |
| `@beep/repo-gate-run` | tooling / library | `tooling/library/repo-gate-run` | Stream capture, console service (agent and terminal projections), audience selection, the type-checker text adapter, the `gate` query services |
| `@beep/repo-gate-vitest` | tooling / test-kit | `tooling/test-kit/repo-gate-vitest` | The Vitest reporter that emits gate events and writes the record through the record library |

Existing surfaces this goal changes:

- `vitest.shared.ts`: registers the Vitest adapter once, for every package config that re-exports
  it.
- `turbo.json`: the `test` and `check` tasks declare the package's `.beep/gates/**` as task
  outputs. Their inputs already exclude `.beep/**`.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: `runPackageTask`, `runRootTestTask`
  and `runRootTask` print the console from records for `test` and `check`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueParser.ts`: its TypeScript
  diagnostic pattern (`tsDiagnosticPattern`) moves into the type-checker adapter in the library;
  `IssueParser.ts` consumes the adapter. A tool may import a library; a library never imports a
  tool.
- A new `Gate` command directory under `packages/tooling/tool/cli/src/commands/` for the planned
  `gate` command family: show a run, show one item in full.

Reused without change: `@beep/cli-kit` (`Doc`, `Render`, `CliAudience`) in
`packages/foundation/capability/cli-kit`; `@beep/runtime-env` (`Audience`, `AudienceKind`) in
`packages/foundation/capability/runtime-env`; `OutputBound` in
`packages/tooling/library/repo-cli-kit/src/process/StepExec.ts`; `LiteralKit` from `@beep/schema`;
the composers of `@beep/identity`. Referenced: `@beep/github-reporting`
(`packages/foundation/modeling/github-reporting`, `GitHubMarkdown.ts`), the Markdown form the CI
goal builds on; `packages/tooling/tool/cli/src/commands/Ci/CiCoverage.reporter.ts`
(`CoverageRuntimeReporter`), the in-repo proof of the Vitest reporter seam.

## Constraints

### The model: gate, unit, item

Three levels, the same for every gate.

| Level | Test gate | Check gate | Meaning |
| --- | --- | --- | --- |
| Gate | `test` | `check` | One kind of verification, one report per run. |
| Unit | package, then file | package, then file | What the tool was asked to cover. Units form a tree at most two deep. |
| Item | test case | diagnostic | One result with an outcome. Items hang off leaf units. |

A report carries its gate, its subject (a package name or `workspace`), the units it collected,
the items, totals, a run reason, an outcome, the input fingerprint the task ran on, the head
commit, the branch, a sortable run id, the start time and the duration. It is versioned as
`gate-report/v1`. The input fingerprint is the Turbo task hash when the task ran under Turbo, and
otherwise a digest of the head commit and the subject's uncommitted changes; the history goal's
flaky rule compares on it.

An item carries:

- an outcome from the closed set below;
- a stable key: the file and the test full name for a test, so same-named tests in two files
  stay distinct (upstream's flat `fullName` map collides, study section 4); the file, the TS code
  or lint rule, and the message shape (literals and line numbers normalized out) for a
  diagnostic, with an occurrence ordinal from 2 when the same key repeats at another location in
  one run;
- an optional location `{ file, line, column }`;
- an optional detail: the first message line and a diff;
- optional `code`, `rule` and `severity`;
- an optional failure kind for failed items (`assertion`, `timeout`, `load`, `hook`,
  `unhandled`);
- the failure signature for failed items;
- the per-attempt outcomes when the runner retried the item (Vitest's retry, which upstream stores
  as a `flaky` flag and never reads);
- an optional label slot, filled only by the history service.

A diagnostic gate records only failing and warning items. A unit it checked with no item counts
every absent key as passed for that run. The history goal depends on this rule.

Closed sets, each a `LiteralKit` from `@beep/schema`:

| Set | Members | Upstream source |
| --- | --- | --- |
| Item outcome | `passed`, `failed`, `warned`, `skipped` | `TestState` (`.repos/vitest-agent/packages/sdk/src/schemas/Common.ts:37`); upstream `pending` maps to `skipped` |
| Run reason | `passed`, `failed`, `errored`, `cancelled` | `TestRunReason` (`Common.ts:47`); upstream `interrupted` maps to `cancelled` |
| Run outcome | `all-pass`, `some-fail`, `warnings-only`, `policy-violation`, `interrupted` | `RunOutcome` (`.repos/vitest-agent/packages/sdk/src/contracts/dispatcher.ts:27`) |
| Run shape | `item`, `unit`, `package`, `workspace` | `RunShape` (`dispatcher.ts:17`) |
| Failure kind | `assertion`, `timeout`, `load`, `hook`, `unhandled` | `FailureRecord.timedOut`, `failedFiles`, `unhandledErrors` |
| Label | `introduced-on-lane`, `red-on-main`, `persistent`, `flaky`, `recovered` | `TestClassification` (`Common.ts:57-63`) |

The verdict word is the run reason in capitals: `PASSED`, `FAILED`, `ERRORED`, `CANCELLED`. The run
outcome selects the dispatch cell. Outcome precedence follows upstream `classify.ts:75-94` and
extends it: `cancelled` gives `interrupted`; any failed item, any `errored` reason, any timeout,
load, hook or unhandled failure gives `some-fail`; a policy breach (coverage threshold, error
budget, maximum warnings) gives `policy-violation`; warnings and nothing worse give
`warnings-only`; otherwise `all-pass`. Failures always beat policy.

The widening table, from study section 7, as upstream type -> our type. Paths are upstream,
relative to `.repos/vitest-agent`.

| Upstream type -> our type | Change |
| --- | --- |
| `TestState` (`.repos/vitest-agent/packages/sdk/src/schemas/Common.ts:37`) -> `ItemOutcome` | adds `warned`; `pending` folds into `skipped` |
| `TestRunReason` (`Common.ts:47`) -> `RunReason` | adds `errored`; `interrupted` becomes `cancelled` |
| `ReportError` (`Common.ts:180`) -> `ItemDetail` | keeps the message and the diff; `location { file, line, column }`, `code`, `rule` and `severity` sit on the `Item`, where the item key reads them |
| `AgentReport` > `ModuleReport` > `TestReport` (`AgentReport.ts:33-88`) -> `GateReport` > `Unit` > `Item` | project > file > test becomes gate > unit (package, file, job) > item (test, diagnostic, step) |
| `RunEvent` (`RunEvent.ts:82-262`) -> `GateEvent` | `Module*`, `Test*`, `Suite*`, `Hook*` become `Unit*` and `Item*`; coverage and annotations become gate extensions |
| `RenderTotals` (`RenderState.ts:117`) -> `Totals` | adds `collected`, `warned`, `loadFailed`, `hookFailed`, `unhandled`, `errored` beside `passed`, `failed`, `skipped`, `timedOut`, `durationMs` |
| `FailureRecord` (`RenderState.ts:61`) -> `FailureEntry` | `modulePath`, `suitePath`, `testName` become unit, path segments, item label, location |
| `RunShape` (`dispatcher.ts:17`) -> `RunShape` | `single-test`, `single-file`, `single-project`, `workspace` become `item`, `unit`, `package`, `workspace` |
| `RunOutcome` (`dispatcher.ts:27`) -> `RunOutcome` | adds `warnings-only`, `interrupted`; `threshold-violation` becomes `policy-violation` |
| `CoverageRenderState` (`RenderState.ts:77`) -> `PolicyRenderState` | coverage, error budget and maximum warnings as one policy slot |
| footer strings (`.repos/vitest-agent/packages/ui/src/dispatcher/footer.ts:24-28`) -> `PointerTable` | MCP tool names become a per-gate table of repo CLI commands |
| `test_history` key (`.repos/vitest-agent/packages/engine/src/migrations/0003_run_retention.ts:93-106`) -> series key | project, module path, full name become gate, subject, item key, branch; the store is `goals/gate-run-history` |

The dispatch table is a total `Record<RunShape, Record<RunOutcome, Cell>>` built from the two
`LiteralKit` domains, so adding a member fails to compile until every cell exists. This closes the
half-typed totality the study names (section 9, item 6).

The model is shaped so CTRF and SARIF projections are lossless: the closed item outcome set,
stable rule and TS codes, file regions, and the item key as a fingerprint.

### The console contract

The agent projection prints, in order: the verdict line; the failure entries; fold lines; the
cap line; the delta line; the path line; the pointer line; the verdict line again. A green run
prints the verdict line alone. The ten laws are acceptance criteria `AC-L1` to `AC-L10` below.

The agent projection's budget is **8,000 characters** for the whole console of one command
invocation. Claude Code keeps a failing command's output inline up to about 10,000 characters and
past that keeps a head-and-tail excerpt with no file path; Codex cuts the middle of a larger
budget (a reported 10k-token default, about 40,000 bytes at its 4 bytes per token)
(`explorations/agent-verification-output/research/external-landscape.md`, section 5). The
smallest window is therefore about 10,000 characters. The 2,000 characters of margin hold what
prints outside the renderer in the same command: Bun's script echo line, the repo CLI banner, and
the harness's own excerpt marker. At the measured 2.28 characters per token of tool output, the
budget is about 3,500 tokens. Each line is at most 240 characters; a longer line ends with `...`.
A diff keeps at most 12 lines.

The terminal projection is the same line sequence with colour and one live progress line,
rewritten in place through `@beep/cli-kit`. Upstream's Ink view is not ported.

Audience comes from `@beep/runtime-env` `Audience` (agent beats CI beats human, `AI_AGENT` first)
and is overridden by the `--agent`, `--human` and `--ci` flags of `@beep/cli-kit` `CliAudience`.

### Records and Turbo

- A gate writes one record and one raw log. The package task writes
  `<package>/.beep/gates/<gate>/report.json` and `report.log`, overwritten each run. The root task
  path writes the run's aggregate record and log to `.beep/gates/<gate>/<run-id>.json` and
  `<run-id>.log` at the repository root and keeps the newest 20 runs per gate. `.beep/*` is
  ignored by git.
- The package record is a declared Turbo output of the `test` and `check` tasks. A cache hit
  restores the record, and the console is rendered from it, never from a replayed log
  (decision `record-is-the-source`). The record keeps its original run id, so a restored record
  is recognizably a replay.
- The raw tool stream goes to the log file in full. The recorder keeps an in-memory excerpt
  bounded by `OutputBound` for the `errored` fallback item.
- The console never renders from a tool's raw stream.

### The Vitest adapter

- It implements Vitest's reporter interface (`onTestRunStart`, `onTestModule*`, `onTestCase*`,
  `onHook*`, `onTestRunEnd`) and emits gate events. It reads reporter events and builds a report.
- It does not manage the reporter chain: it strips no reporter, patches no logger stream, zeroes
  no coverage reporter and mutates no Vitest config. It is one entry appended in
  `vitest.shared.ts`. Upstream's 3,141-line `.repos/vitest-agent/packages/plugin/src/reporter.ts` is read for its
  invariants and rebuilt small.
- A reporter runs in the Vitest main process, which is Bun under the generated
  `bunx --bun vitest run` script and Node for the five packages whose test script runs
  `bunx vitest`. Coverage runs pass their own reporters on the command line and write no gate
  record (decision `coverage-runs-write-no-record`). Test workers are Node processes. The adapter
  therefore loads under both runtimes and its import graph reaches no `bun:` module, which keeps
  the history store (on `bun:sqlite`) out of it.
- The generated `beep:test` script passes `--passWithNoTests`, so a package with no test files
  exits 0. The report still renders `ERRORED` with `0 tests collected` (law 4). Phase P0 counts the
  packages this affects and records whether the task exit code follows the report.

### Package homes and ceilings

- `foundation/modeling` may depend only on `foundation/primitive` and `foundation/modeling`
  (`standards/ARCHITECTURE.md`, "Family And Kind Dependency Rules"). The model package therefore
  takes `@beep/schema`, `@beep/identity` and Effect, and never `@beep/github-reporting`
  (decision `model-home`). It may not import `@beep/cli-kit`, which is `foundation/capability`. Its dispatch cells produce a
  model-owned neutral document (verdict, failure entry, fold, cap, delta, path, pointer); the
  library maps that document onto `@beep/cli-kit` `Doc` blocks and renders it with `Render`.
- `tooling/library` may depend on any foundation kind and `tooling/library`. The library takes
  the model, `@beep/cli-kit`, `@beep/runtime-env` and `@beep/repo-cli-kit`. It never imports a
  test kit; `@beep/memfs` stays out of its runtime graph, unlike upstream's engine.
- `tooling/test-kit` may depend on any foundation kind, `tooling/library`, `tooling/policy-pack`
  and `tooling/test-kit`. The adapter takes the model and the library's recorder module.
- A tool never imports a tool. The repo CLI consumes the library.
- If the guardian rejects `foundation/modeling` for the model, the model lands as a second module
  set of the library and the dependency rules above still hold. P0 records the outcome.
- `YeetVerdict`, `QualityIssueIndex` and `QualityTaskLaneRunReport` are run-level and lane-level
  records without unit and item structure. They keep their names and shapes here and become
  consumers of gate reports in `goals/gate-report-rollout` (decision `vocabulary-gate-report`).

### Port inventory

Paths are relative to `.repos/vitest-agent` at `1cf1ab94`.

Ported, widened along the seams above:

| Upstream | Into | Note |
| --- | --- | --- |
| `.repos/vitest-agent/packages/sdk/src/schemas/AgentReport.ts`, `Common.ts`, `RunEvent.ts`, `RenderState.ts`, `RunReportFile.ts`, `StrayOutput.ts` | model | Result, event, render-state and record-file schemas only |
| `.repos/vitest-agent/packages/sdk/src/contracts/dispatcher.ts` | model | Shape, outcome and cell contract |
| `.repos/vitest-agent/packages/sdk/src/utils/build-report.ts:324-371` | model and adapter | Honest-count rules to the model; Vitest `TestModule` duck typing to the adapter |
| `.repos/vitest-agent/packages/sdk/src/utils/stray-output.ts:62-184` | model and adapter | Summary schema and note text to the model; the recorder's install point to the adapter |
| `.repos/vitest-agent/packages/ui/src/reducer.ts` | model | Events reduce to a report |
| `.repos/vitest-agent/packages/ui/src/dispatcher/classify.ts:34-94` | model | Shape and outcome classifiers, widened |
| `.repos/vitest-agent/packages/ui/src/dispatcher/dispatch.ts:41-145`, `cells/`, `helpers.ts`, `cell-types.ts` | model | Twelve cells grow to twenty (four shapes by five outcomes) |
| `.repos/vitest-agent/packages/ui/src/dispatcher/footer.ts:24-82` | model | Dominance order kept; pointers become repo CLI commands |
| `.repos/vitest-agent/packages/ui/src/counts.ts`, `format-duration.ts` | model | Count and duration formatting |
| `.repos/vitest-agent/packages/engine/src/utils/failure-signature.ts:11-45` | model | Signature over error name, assertion shape, top frame and location bucket |
| `.repos/vitest-agent/packages/plugin/src/utils/process-failure.ts` | adapter | Top-frame selection |
| `.repos/vitest-agent/packages/ui/src/synthesize.ts` | adapter | Vitest task tree to events |
| `.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts:11-26` | `goals/gate-run-history` | Listed here so the inventory is whole |

Read for invariants only, not copied:

- `.repos/vitest-agent/packages/plugin/src/reporter.ts` and `.repos/vitest-agent/packages/plugin/src/plugin.ts`: render before persist
  (`reporter.ts:1948-1957`), one reporter per Vitest instance, fallback reports.
- `.repos/vitest-agent/packages/plugin/src/utils/strip-console-reporters.ts`: what the adapter must not do.
- `.repos/vitest-agent/packages/engine/src/layers/EnvironmentDetectorLive.ts`, `ExecutorResolverLive.ts`,
  `DetailResolverLive.ts`: `@beep/runtime-env` owns detection.
- `.repos/vitest-agent/packages/reporter/src/defaultReporter.ts:359-523` and `githubLog.ts:89-127`: the record file
  and summary layout; the CI projection itself is `goals/ci-gate-reports`.
- `.repos/vitest-agent/okf/decisions/45-suite-load-failures-count-as-failures.md`,
  `48-honest-run-reporting.md`, `47-rendering-never-depends-on-persistence.md`,
  `.repos/vitest-agent/okf/models/dispatcher-matrix.md`.
- `.repos/vitest-agent/packages/plugin/src/utils/vitest-diagnostics.ts` and `collect-performance-hints.ts`, copied by
  upstream from Vitest 5.0.5. Not ported by this goal. A file later derived from them carries the
  Vitest notice as well (attribution below).

Not ported (decisions `port-breadth`, `tdd-workflow-no-go`):

- `.repos/vitest-agent/packages/ui/src/ink/`, `.repos/vitest-agent/packages/reporter/src/liveView.ts`, `streamView.ts`: the Ink and live
  views.
- `.repos/vitest-agent/packages/mcp/`: the MCP server and its 30 tools.
- `.repos/vitest-agent/packages/cli/`, `.repos/vitest-agent/packages/sidecar` and the `sidecar-*` packages.
- `.repos/vitest-agent/plugin/`: Claude Code and Copilot hooks, skills and `.repos/vitest-agent/plugin/agents/tdd-task.md`.
- `.repos/vitest-agent/packages/sdk/src/schemas/Tdd.ts`, `Agent.ts`, `turns/`, `utils/validate-phase-transition.ts`,
  `internal-inject-env.ts`, `sidecar-dispatch.ts`, `utils/match-vitest-command.ts`.
- The session, turn, agent and TDD tables of `.repos/vitest-agent/packages/engine/src/migrations/0001_initial.ts`.
- The acorn function-boundary refinement of the signature (`utils/function-boundary.ts`): the model
  takes no parser dependency.

### Porting order and style

The order is the effected precedent
(`explorations/agent-verification-output/research/in-repo-inventory.md`, section 5): copy the
upstream module and its tests; clear every type, lint and tsgo diagnostic with the copied tests
green; then convert imports and identities; reviews come last. Tests are retargeted, never
weakened. Each module meets repo law before its PR merges:

- No root `effect` barrel and no nested barrel. Every Effect module is imported from its
  `effect/<Module>` leaf; `pipe`, `flow` and `identity` come from `effect/Function`. Upstream has
  170 source files on the root barrel.
- Functions returning effect generators use `Effect.fn` or `Effect.fnUntraced`. Upstream has 268
  `Effect.gen(function*` against 4 `Effect.fn`.
- `effect/HashMap`, `effect/HashSet`, `effect/MutableHashMap` and `effect/MutableHashSet` replace
  every native `Map` and `Set`. Upstream constructs 46.
- String-literal unions are `LiteralKit` domains from `@beep/schema`, never hand-rolled unions.
- Plain-data schemas are branded opaque schemas over an annotated struct, as current repo law has
  it; the class extend style, `class X extends Parent.extend<X>()({}) {}`, applies only where that
  law allows it. Upstream schemas are plain `Schema.Struct`.
- Every schema and service key takes an identity from the package's `@beep/identity` composer
  (`$I`), registered by `bun run beep create-package`.
- `Context.Service` contracts are schema-typed shapes, not interface literals.
- Exported symbols carry JSDoc with titled `**Example**` sections.

### Attribution

Each package that holds ported code carries:

- an MIT `LICENSE` with two copyright lines, `Copyright (c) 2026 beep-effect` and
  `Copyright (c) 2026 C. Spencer Beggs`, as in `packages/foundation/capability/walker/LICENSE`;
- a README `## Provenance` paragraph naming the upstream project, and a `### Attribution` list:
  upstream package and version, upstream commit `1cf1ab94` with the reference checkout
  `.repos/vitest-agent`, and the license link; deviations go in a `### Deviations` paragraph, as in
  `packages/foundation/capability/walker/README.md`.

No `NOTICE` file and no per-file header. A package holding code derived from upstream's two
Vitest-derived files also carries `Copyright (c) 2021-Present VoidZero Inc. and Vitest
contributors`. No `@vitest-agent/*` or `@effected/*` entry appears in any manifest
(decision `port-not-import`).

## Acceptance Criteria

The console laws. Each is a test in the library or the model package. Property tests generate
reports from the report schema's arbitrary.

- [ ] **AC-L1 Verdict first and last.** Property: for any report, the agent projection's first and
  last lines are both the verdict line (gate, subject, verdict word, counts, duration). The
  projection is the block rendered from a finished report. Lines a gate prints while it is still
  running (the heartbeat `goals/gate-report-rollout` adds) come before that block; nothing follows
  it.
- [ ] **AC-L2 Silent on success.** Property: an `all-pass` report projects to exactly one line.
  Measured: a green `test` run for `@beep/glob` (273 tests) prints one line of at most 120
  characters, against 13,450 characters through Turbo on 2026-11-18.
- [ ] **AC-L3 Failures only, bounded.** Property: for any report, the agent projection is at most
  8,000 characters and no line exceeds 240. Each failure entry is one line plus at most its first
  message line and a diff of at most 12 lines, never a stack. When entries are dropped, one cap
  line says `... N more in the record` with N equal to the number dropped.
- [ ] **AC-L4 Honest counts.** Tests: a report with nothing collected is `ERRORED`, never
  `PASSED`; timeouts, load failures, hook failures and unhandled errors each have their own
  total, cancellation renders `CANCELLED`, and none yields `all-pass`; a nonzero tool exit with no failed item is `ERRORED`
  with one item carrying the log excerpt; a zero exit with a failed item is `FAILED`. The ported
  `build-report` tests pass retargeted.
- [ ] **AC-L5 Labels from history.** Given labels from the history contract's test layer, every
  failure entry carries exactly one label from the closed set. Without a history service, or with
  one that fails, entries carry none and the projection is otherwise unchanged. The labels' values
  are acceptance of `goals/gate-run-history`.
- [ ] **AC-L6 Delta on re-run.** Given a delta from the history contract's test layer, one line
  `since last run: F fixed, S still failing, N new` renders before the path line; on a green run it
  is a suffix of the single verdict line. Its values are acceptance of `goals/gate-run-history`.
- [ ] **AC-L7 Causes fold.** The cause-folding table is keyed on diagnostic codes, TS6305 first.
  Fixture: the TS6305 cascade a package-local `check` prints on a fresh lane with unbuilt
  dependencies (701 lines for one cause in the census; the fixture is regenerated from the
  repository, never from transcript text) renders as one fold line with the count, the cause and
  the fix command, and the whole projection is at most 5 lines.
- [ ] **AC-L8 A path with its size.** Every non-green projection has one line naming the raw log
  and the record by repository-relative path with the log's size; a test reads both files back at
  those paths and checks the size.
- [ ] **AC-L9 Next steps are commands.** A test parses every pointer line of every cell against
  the repo CLI command tree and fails on an MCP tool name, a bare tool name or a pointer to
  documentation. `rg -n 'test_errors|failure_signature_get|file_coverage|test_coverage'` over the
  new packages finds nothing.
- [ ] **AC-L10 Rendering never waits.** With a recorder layer that fails, and with a history layer
  that fails or misses its deadline, the projection still begins and ends with the verdict line,
  adds one line naming what was not written, and the exit code is unchanged.

The model, the services and the wiring:

- [ ] Every row of the widening table has its widened type in the model, and a table test maps
  each upstream fixture value to it.
- [ ] A table test maps every item to a CTRF `status` and to a SARIF `level`, `ruleId`, region and
  `partialFingerprints`, and maps each back to an equal item.
- [ ] The dispatch table is total over `RunShape` by `RunOutcome` at the type level; a test renders
  all twenty cells.
- [ ] One renderer serves both gates: a test-gate fixture and a check-gate fixture render through
  the one console service, and the cells import nothing from either adapter.
- [ ] Property: the terminal projection, with ANSI escapes and the progress line removed, equals
  the agent projection for any report inside the agent budget.
- [ ] Running the `test` task for `@beep/glob` twice, the second a Turbo cache hit, prints
  byte-identical consoles; the same holds for `check`.
- [ ] `test` and `check` print the console contract for every package on the repo CLI task path,
  at the package directory and at the root.
- [ ] The Vitest adapter's package tests pass under Node and under Bun; the resolved Vitest
  reporter list equals Vitest's own default selection plus the adapter.
- [ ] The planned `gate` command family shows a run's record and one item in full.
- [ ] Each new package carries the dual-copyright `LICENSE` and the README `Provenance` and
  `Attribution` sections; no manifest lists `@vitest-agent/*` or `@effected/*`.
- [ ] `bun run beep quality package-verify` passes for every new and touched package, and
  `bun run beep lint identity-registry` passes.
- [ ] When `goals/agent-output-census` has landed, the census rows for characters per green run
  and log digs per run are cited before and after in `history/`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Console laws | the law tests in the model and library packages (`AC-L1` to `AC-L10`) | All pass |
| Package gates | `bun run beep quality package-verify <@beep/package>` for each new and touched package | Passes |
| Identity registry | `bun run beep lint identity-registry` | Passes |
| Green output size | `test` for `@beep/glob` under an agent variable, output measured with `wc -m` | One line, at most 120 characters |
| TS6305 fold | the cascade fixture through the check-gate console | At most 5 lines |
| Cache-hit parity | `test` and `check` for `@beep/glob`, run twice, outputs compared with `cmp` | Identical |
| No upstream dependency | `rg -n -e '"@vitest-agent/' -e '"@effected/' --glob 'package.json' packages` | No match |
| Attribution | `rg -c 'C. Spencer Beggs' <package>/LICENSE` and the README sections, per new package | Present |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Packet launcher size | `test "$(wc -m < goals/gate-report-core/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/gate-report-core/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/gate-report-core` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add gate-report-core --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-report-core`; add a `kind: decision` file there, never edit this block._

### Agents reach detail through files and repo CLI commands, never MCP or hooks, 2026-11-18

Every run writes one typed record and one raw log to disk. The console prints the verdict, the failures and both paths with the log's size. The planned `gate` command family on the repo CLI shows a run and one item in full. No MCP tool and no hook is added to any harness, and pointer lines name repo CLI commands instead of upstream's MCP tool names. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `agent-surface`.

Lane explore/agent-verification-output

Reverse: Add an MCP server over the gate records in a new goal

### One record, agent and terminal projections; the CI projection is ci-gate-reports, 2026-11-18

Audience is detected through `@beep/runtime-env` and overridden by the `@beep/cli-kit` audience flags. This goal builds the agent projection (plain, bounded, verdict at head and tail) and the terminal projection (the same lines with colour and one live progress line). The CI projection, a GitHub job summary plus a grouped log, is goals/ci-gate-reports; until it lands, CI renders the agent projection. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `audience-three-projections`.

Lane explore/agent-verification-output

Reverse: Drop the terminal projection and leave humans on raw tool output

### Cause folding ships here; the delta renders from a slot gate-run-history fills, 2026-11-18

Of the four enhancements the operator chose, this goal ships cause folding: a table keyed on diagnostic codes, TS6305 first, that collapses a cascade to one line with a count, the cause and the fix command. It renders the fix-loop delta from the history contract, which goals/gate-run-history implements. The heartbeat and block-until-changed belong to goals/gate-report-rollout. The verdict at head and tail and runnable next steps were never optional and are console laws here. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `core-enhancements`.

Lane explore/agent-verification-output

Reverse: Remove the cause-folding table and the delta slot from the console

### Test and check prove the contract first, through one renderer, 2026-11-18

The first vertical slice is P1 through P3: the model, the agent projection, and `test` plus `check` for one package printing the contract end to end. Vitest reaches the model through the ported report builder, the type checker through the diagnostic pattern moved out of IssueParser.ts, and both render through the same dispatch table. One test-shaped and one diagnostic-shaped gate through one renderer is the proof that the model is gate-neutral. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `first-slice`.

Lane explore/agent-verification-output

Reverse: Ship the test gate alone in the first slice and move check to P4

### The model stays lossless to SARIF and CTRF; no emitter is built yet, 2026-11-18

Deferred. The model keeps a closed item outcome set, stable rule and TS codes, file regions and the item key as a fingerprint, and a table test maps every item to CTRF and SARIF fields and back. Neither emitter is built until a consumer needs one; GitHub code scanning upload would be the first. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `interchange-projections` (DEFERRED).

Lane explore/agent-verification-output

Reverse: Build a SARIF or CTRF emitter in a new goal once a consumer exists

### Port the core into a gate-neutral model, not the whole project, 2026-11-18

The model (gate, unit, item) is designed first. The pure pieces are then ported into it: the shape-by-outcome dispatch table and its cells, the honest-count rules and the failure signature. The history classifier goes to goals/gate-run-history and the GitHub summary to goals/ci-gate-reports. Vitest is one adapter beside the type checker. Design order follows the repo law: schema, then service contract, then implementation. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `port-breadth`.

Lane explore/agent-verification-output

Reverse: Reopen the exploration and widen the port inventory in SPEC.md

### Port vitest-agent into @beep packages, never import it, 2026-11-18

The upstream code moves into canonical `@beep/*` packages with its MIT license and attribution. Nothing from `@vitest-agent/*` or `@effected/*` enters a manifest. Attribution follows the effected precedent: an MIT `LICENSE` carrying both copyright lines and a README `Provenance` paragraph with an `Attribution` list. A file derived from the two Vitest files upstream vendors keeps the VoidZero and Vitest contributors notice too. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `port-not-import`.

Lane explore/agent-verification-output

Reverse: Add @vitest-agent/* as a dependency and delete the ported modules

### The console renders from the record, never from a tool stream or a replayed log, 2026-11-18

A gate writes one typed, versioned record (`gate-report/v1`) and sends the raw stream to a log file whose path and size the console prints. The package record under `.beep/gates/` is a declared Turbo output of the `test` and `check` tasks, so a cache hit restores the record and the console is rendered from it. The console is then independent of which audience ran first. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `record-is-the-source`.

Lane explore/agent-verification-output

Reverse: Render from streams again and drop the task output declaration

### Upstream's TDD-session workflow is not carried, 2026-11-18

Goals, behaviors, hypotheses, notes and the `tdd-task` agent stay upstream, with the Ink live view, the Claude Code hooks, the sidecar binary and the MCP server. The SPEC port inventory lists their upstream paths under "Not ported". It is a separate product; an operator who wants it later opens a new exploration. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `tdd-workflow-no-go`.

Lane explore/agent-verification-output

Reverse: Open a new exploration for the TDD-session workflow

### The per-run record is a gate report; a verdict is only its one-line outcome, 2026-11-18

The packages follow the word: a gate-report model and a gate-run library. `YeetVerdict` keeps its name and later becomes a consumer that aggregates gate reports (goals/gate-report-rollout); "proof" stays the name of detached proof jobs and final-check receipts. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `vocabulary-gate-report`.

Lane explore/agent-verification-output

Reverse: Rename the model and packages and re-key their identities

### The agent budget stays 8,000 characters, 240 per line, 12 diff lines, 2026-11-19

Re-read against the harness limits in the exploration research (section 5 of the external landscape): Claude Code keeps about 10,000 characters of a failing command inline and Codex cuts the middle of a larger budget, so the smallest window is about 10,000 characters and 2,000 are left for what prints outside the renderer. The numbers are the default of a budget parameter, not constants in the model.

Lane feat/gate-report-core

Reverse: Change the default ConsoleBudget the library supplies.

### All twenty cells print one contract; upstream's tables and trailers are not ported, 2026-11-19

A green run prints its verdict line alone in every shape, so upstream's project table, module list, trend line, coverage table and action trailers are not ported. Stray output prints only on a red run. The single-item policy cell prints the verdict and the breach where upstream printed nothing, because law 1 needs a verdict. An unlabelled or recovered failure points at the failure command; a gate missing from the pointer table gets no pointer line. A run with exactly one diagnostic is scoped by its file in the verdict line.

Lane feat/gate-report-core

Reverse: Restore a per-cell body in the dispatch table.

### Coverage runs write no gate record in this goal, 2026-11-19

The coverage planner passes its own reporters on the command line, and a command-line reporter replaces the configured list, so the adapter does not run under the coverage commands. This goal leaves that as it is: a coverage run writes no record and the coverage gate keeps its own report. The spec sentence that expects the adapter under the Node coverage commands is narrowed to the five packages whose ordinary test script runs Vitest on Node. Putting the coverage gate on the contract is rollout work in `goals/gate-report-rollout`.

Lane feat/gate-report-core

Reverse: Have the coverage planner pass the gate reporter beside its own on the command line.

### An empty run renders ERRORED and the task exit code stays the tool's, 2026-11-19

Of 210 workspace manifests with a `beep:test` script, one has no test files: the Storybook app, whose Vitest config does not extend the shared config, so the adapter never runs there. 161 scripts pass `--passWithNoTests`. The report rule stands (nothing collected is `ERRORED`, law 4), and the exit code is not changed by this goal: it stays what the tool returned. No package changes behaviour today, and a gate that starts failing because its report says so is a policy change for `goals/gate-report-rollout` to make with the census in hand.

Lane feat/gate-report-core

Reverse: Make the task path exit non-zero when a record's reason is errored.

### Seven fixtures, each generated from the repository, 2026-11-19

The fixture set: a green test run of `@beep/glob`; a red test run with an assertion diff; a test timeout; a module that fails to load; an empty run; a check run with two diagnostics; and the TS6305 cascade a package check prints with unbuilt upstream declarations. Each is produced by running the real tool on repository code or on a small fixture package and capturing its events or output; none is copied from a session transcript. The cascade fixture is captured from a fixture package, never by removing declarations from the working tree: a compiler run on an unbuilt tree overwrites the package's own declarations.

Lane feat/gate-report-core

Reverse: Replace a generated fixture with a hand-written one and note why in the test.

### Reason precedence: cancelled, errored, failed, passed; a fallback item explains an unexplained failure, 2026-11-19

Totals are computed from the items, never taken from the runner. Load, hook and unhandled failures are fault items with their own totals, and `failed` counts ordinary failures only. A run is errored when the tool said so, when nothing was collected, or when a fallback was added. The fallback is one fault item carrying the log excerpt, added when no item failed and the exit code was nonzero or the tool reported a reason other than passed. Every item is recorded, passed ones included, so a later run can tell fixed from never seen.

Lane feat/gate-report-core

Reverse: Edit the settled-reason and fallback rules in the reducer.

### CTRF and SARIF stay lossless through an extension bag, 2026-11-19

Fields neither format has a native slot for travel in CTRF `extra` and SARIF `properties`. A warned item maps to CTRF `other` and SARIF `review`; a skipped item maps to SARIF `notApplicable`. SARIF `level` is `none` unless the item failed, and CTRF `flaky` is set only for a final pass after an earlier failed attempt. The mapping functions exist for the round-trip test only; the emitters stay deferred.

Lane feat/gate-report-core

Reverse: Change the interchange mapping module.

### The item key is a three-way union with an injective fingerprint and occurrence ordinals, 2026-11-19

An item key is one of test (file and full name), diagnostic (file, code or rule, normalized message shape) or fault (a load, hook or unhandled failure of a unit). Its fingerprint is the tag followed by each field with its length in front, so for any two keys the schema accepts the fingerprints are equal exactly when the keys are equal, whatever characters the fields contain. A diagnostic that repeats a file, code and message shape at another location in the same run gets an occurrence ordinal from the reducer, starting at 2 and absent on the first, so each occurrence is its own item and the key stays free of line numbers. The failure signature hashes with FNV-1a 64 instead of a SHA-256 prefix, which keeps the model synchronous and free of a crypto dependency; the function-boundary line is an optional input an adapter may supply.

Lane feat/gate-report-core

Reverse: Change the item key schema and its fingerprint function.

### The record writer is its own library, @beep/repo-gate-record, beside @beep/repo-gate-run, 2026-11-19

Two tooling libraries instead of one. `@beep/repo-gate-record` holds the record and log codec, the package and root path rules, newest-20 retention and the writes; it depends only on the model and Effect, and the caller supplies the platform layer. `@beep/repo-gate-run` holds stream capture, the console service, audience selection, the TypeScript diagnostic adapter and the query services, and may depend on `@beep/cli-kit`, `@beep/runtime-env` and the `process/StepExec` leaf of `@beep/repo-cli-kit`, never that package root. The reason is the test hash: the Vitest adapter must be a declared input of every `test` task, and through the gate-run library that closure would reach 32 packages, so an edit to the git or DuckDB drivers would rerun about 210 test tasks. Through the record library it stays near the size of `@beep/utils`. Command trees stay in the repo CLI; only query services live in the library.

Lane feat/gate-report-core

Reverse: Fold the record modules back into the gate-run library and point the Vitest adapter at it.

### The model package uses flat leaf modules, 2026-11-19

The scaffold exports every source file as a leaf, and the neighbouring modeling packages are flat, so the model keeps one module per concept at the top of its source folder with private helpers under an internal folder. Concept folders would need a hand-written export map.

Lane feat/gate-report-core

Reverse: Move each module into a concept folder with role files and write an export map.

### The model is @beep/gate-report in foundation/modeling, free of repo specifics, 2026-11-19

The architecture review approved `@beep/gate-report` at foundation/modeling/gate-report: it models a developer-artifact format, as `@beep/sbom`, `@beep/lockfiles` and `@beep/tsconfig` do, and foundation is the only family a product slice could reuse it from. Typed, pure console data is allowed there; `@beep/github-reporting` is the precedent. Three conditions hold. Repo specifics stay out: the pointer table is a schema whose command strings the library supplies, record paths live in tooling, and the input fingerprint is an opaque string. The console budget (8,000 characters, 240 per line, 12 diff lines) is a `ConsoleBudget` input with the agent default supplied by the library. The model does not depend on `@beep/github-reporting`: its closure is ten packages against four, and the CI projection in `goals/ci-gate-reports` should depend on both instead.

Lane feat/gate-report-core

Reverse: Move the model's modules into the gate-run library and delete the modeling package.

### The model owns the plain-text projection and the budget fit, 2026-11-19

The model turns a report into a console document and also into plain lines, so laws 1 to 3 are property-tested in the model with no service. The gate-run library maps the same fitted document onto `@beep/cli-kit` for colour. Fitting keeps fold lines first, then the longest run of failure entries that fits the budget; the cap line counts every dropped entry and fold. A budget must hold eight full lines and a line limit of at least 40 characters.

Lane feat/gate-report-core

Reverse: Move the projection module into the gate-run library and test the laws there.

### The first slice lands as two pull requests: the model, then the services and wiring, 2026-11-19

The plan lands P1 through P3 as one pull request. It is split so each is reviewable and green alone: first `@beep/gate-report` complete (schemas, reducer, classifiers, counts, signature, folding table, dispatch cells and the law tests that need no service), then the record and gate-run libraries, the Vitest adapter and the `test` and `check` wiring for `@beep/glob`. P4, P5 and the closeout follow as the third. The packet allows three open pull requests; these are sequential.

Lane feat/gate-report-core

Reverse: Open one pull request for P1 through P3 as the plan first said.

### Five spec statements corrected while building the model, 2026-11-19

Location, code, rule and severity sit on the item, where the item key reads them, not on the detail. Totals also carry load-failed, hook-failed and unhandled counts. Cancellation is a run reason, not a total. The model never takes the GitHub reporting package (decision `model-home`). Plain-data schemas are branded opaque schemas over an annotated struct, as current repo law has it; the class extend style applies only where that law allows it.

Lane feat/gate-report-core

Reverse: Restore the earlier wording in the spec.

### The Vitest adapter is a new test kit, @beep/repo-gate-vitest, loaded lazily and registered by specifier, 2026-11-19

A module of `@beep/test-runner` was rejected: that package has no runtime dependency on schema or identity so foundation tests can adopt it, 152 manifests depend on it, and the adapter would create dev-dependency cycles through `@beep/identity`. The adapter is its own test kit at tooling/test-kit/repo-gate-vitest and depends on the model, the record library, Effect and `@effect/platform-node` only. Rules: the registered reporter module has no workspace import at top level; it loads the implementation when Vitest starts and on any failure prints one stderr line, turns itself off and leaves the exit code alone. The root devDependencies name it, and the shared config appends it after the spread of Vitest's own default reporters, so the agent and GitHub reporters stay. It registers only outside doctest and deep property-sweep runs, which share the config but must not overwrite the test record. The `test` task depends on the adapter's transit task, as it does for `@beep/utils`, so the code that writes a cached record is in the hash. An import-boundary test proves no `bun:` module is reachable.

Lane feat/gate-report-core

Reverse: Remove the adapter from the shared Vitest config and delete the test kit.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
