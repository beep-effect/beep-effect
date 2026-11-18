# vitest-agent core: source study for the port

Reference checkout: `~/YeeBois/references/effect/vitest-agent` at `1cf1ab94` (2026-11-17).
Every `path:line` is relative to that repo root; `node_modules/...` points at an installed
dependency. LOC are `wc -l` of `*.ts`/`*.tsx` (comments included) outside `__test__/`, `dist/`
and `node_modules/`.

## 1. Package inventory

Targets: Effect `4.1.4` and every `@effect/*` at `4.1.4`, served by the `effected` catalog of a
pnpm config plugin (`node_modules/.pnpm-config/@effected/pnpm-plugin-effected/index.js:3-85`,
declared in `pnpm-workspace.yaml:2-4`). Vitest comes from the silk plugin's `test` catalog,
`^5.0.5` dev and `^5.0.0` peers (`node_modules/.pnpm-config/@savvy-web/pnpm-plugin-silk/index.js:43-57`);
installed `vitest@5.1.0`. Vitest 4 is refused at runtime (`packages/plugin/src/plugin.ts:393`,
`okf/decisions/65-drop-vitest-4-require-vitest-5.md`). Node floor `>=24.11.0` in every
manifest (`package.json` `engines`). Ink `^8.0.0`, React `^19.3.1`
(`.../pnpm-plugin-effected/index.js:97-98`). Both runtimes match beep-effect, so there is no
version gap to bridge.

| Package | src LOC | test LOC | Workspace deps | `@effected/*` (use) | Notable 3rd-party | Purpose |
| --- | ---: | ---: | --- | --- | --- | --- |
| `sdk` (rank 1) | 5,717 | 6,266 | none | none | `acorn`, `acorn-typescript` (function boundaries) | Schemas, contracts, errors, pure utils, `./dispatch` |
| `ui` (rank 2) | 4,288 (1,606 tsx) | 6,943 | sdk | peers: `cli-kit` (Doc, Fmt, theme), `env`, `glob`, `walker` | `ink`, `react` (peers, `src/ink/` only) | Reducer, 4x3 dispatcher, synthesizers, Ink cells |
| `reporter` (rank 3) | 1,098 | 1,851 | sdk, ui | peers: `cli-kit` (Render.markdown, githubLog, live view), `env`, `glob`, `walker` | `ink`, `react` (lazy) | Default reporter, GFM summary, report files |
| `engine` (rank 3) | 13,291 | 15,652 | sdk | `store` (SQLite, ledger), `xdg` (data dir), `env` (audience), `config-file`/`toml`, `git`, `walker`/`glob`/`workspaces`, `package-json`, `kit`, `app`, `memfs`, `jsonc`/`yaml` (declared, unimported), `cli-kit` | `@effect/platform-node`, `@effect/sql-sqlite-node` (`node:sqlite`) | Services, Live layers, SQLite, migrations, paths |
| `cli` (rank 4) | 1,561 | 1,694 | engine, sdk, sidecar | `cli-kit` (CliRuntime), `kit`, `workspaces`, `env`, `config-file`, `glob`, `walker` | platform-node, sql-sqlite-node | `vitest-agent` bin |
| `mcp` (rank 4) | 8,073 | 11,307 | engine, sdk | `mcp-kit` (toolkit, stdio, guards), `kit` (ProcessScope, Exclusive), `git`, `commands` (ModuleResolution), `walker`, `glob` | platform-node; `vitest` peer | `vitest-agent-mcp`, 30 tools |
| `plugin` (rank 5, carrier) | 8,901 | 13,511 | cli, mcp, reporter, engine, sdk | `walker`, `workspaces` (discovery), `commands` (RunOnce lock), `env`, `glob`, `cli-kit` | `magic-string` (tag prelude); `vitest` + coverage peers | `AgentPlugin`, `AgentReporter`, coverage, config checks |
| `sidecar` + 4 `sidecar-*` | 121 + 4x43 | 219 | optional platform children | `commands` (PrebuiltBinary) | SEA binary per platform | Native `inject-env` |
| agent plugin `plugin/` | 2,494 sh/ts + 1,683 md | 2,398 bats | consumes bins | `pluginfinity` | `jq` | Claude Code and Copilot hooks, skills, agent |

Ranks: `CLAUDE.md:28-36`, enforced by `layers.json` and
`packages/plugin/__test__/workspace-layering.test.ts`. The `@effected/*` kits are a separate
MIT project by the same author (`packages/engine/node_modules/@effected/env/LICENSE:1-3`).

## 2. The output design

### 2.1 Environment and executor

- `Environment = agent-shell | terminal | ci-github | ci-generic`, `Executor = human | agent | ci`
  (`packages/sdk/src/schemas/Common.ts:140,150`).
- `classifyEnvironment` maps `@effected/env`'s `Audience.detect`: agent to `agent-shell`, CI
  named `github-actions` to `ci-github`, other CI to `ci-generic`, human to `terminal`
  (`packages/engine/src/layers/EnvironmentDetectorLive.ts:8,22-31`).
- `Audience.detect`: agent beats CI beats human (`packages/engine/node_modules/@effected/env/Audience.js:90`).
  `AI_AGENT` wins, else env keys such as `CLAUDECODE`, `CODEX_SANDBOX`/`CODEX_THREAD_ID`,
  `GEMINI_CLI`, `JUNIE_DATA`, `CURSOR_AGENT`, `COPILOT_CLI` (12 rules,
  `.../@effected/env/internal/agentCi.js:5-18,33-39`); GitHub CI is `GITHUB_ACTIONS` (`ci.js:6-7`).
- `ExecutorResolverLive`: `agent-shell -> agent`, `terminal -> human`, both CI values `-> ci`
  (`packages/engine/src/layers/ExecutorResolverLive.ts:12-21`).
- `DetailResolverLive`: explicit wins; agent or CI is always `verbose`; a human gets `verbose`
  on failures, `standard` below targets, `neutral` without targets, else `minimal`
  (`packages/engine/src/layers/DetailResolverLive.ts:5-18`).
- Console modes: human `passthrough|silent|stream|agent`, agent `passthrough|silent|agent`, CI
  `passthrough|silent|ci-annotations` (`Common.ts:95-113`). Defaults: human `passthrough`,
  agent `agent`, CI `passthrough` (`packages/plugin/src/plugin.ts:152-157`).
  `VITEST_AGENT_CONSOLE` overrides only with a value legal for the detected executor
  (`plugin.ts:170`). `ci-annotations` is accepted but not emitted yet (`Common.ts:90-92`).
- Every mode but `passthrough` owns stdout: Vitest's console reporters (`default, verbose,
  tree, dot, tap, tap-flat, hanging-process, agent, minimal`) are stripped and
  `coverage.reporter` is zeroed; `json`, `junit`, `blob`, `github-actions` stay
  (`plugin.ts:190,457-471`, `packages/plugin/src/utils/strip-console-reporters.ts:16-52`).

### 2.2 Dispatcher matrix

`RunShape = single-test | single-file | single-project | workspace`,
`RunOutcome = all-pass | some-fail | threshold-violation`
(`packages/sdk/src/contracts/dispatcher.ts:17,27`). Both are pure functions of the reduced
`RenderState` (`packages/ui/src/dispatcher/classify.ts:34-94`):

- Shape: more than one project is `workspace`; known `collectedModules > 1` is
  `single-project` (checked first, since a replay reduces only failing modules); one module
  with one test is `single-test`; one module with several is `single-file`; else
  `single-project` (`classify.ts:34-53`).
- Outcome: `failCount > 0`, then any `unhandledErrors`, then `timeoutCount > 0` give
  `some-fail`; then coverage `violations` or `globShortfalls` give `threshold-violation`; else
  `all-pass` (`classify.ts:75-94`). Failures always beat coverage.

The table is a total `Record<RunShape, Record<RunOutcome, Cell>>`, one file per cell
(`packages/ui/src/dispatcher/dispatch.ts:41-62`):

| Shape | all-pass | some-fail | threshold-violation |
| --- | --- | --- | --- |
| single-test | the test and its duration | test, first error line, diff | empty string (documented no-op) |
| single-file | `<file>: N tests passed (ms)` | totals, failures inline | totals, `Coverage: x N file below...` |
| single-project | `Tests:` totals, `N modules all-passed.` | totals, `Failures:`, `Modules:` | totals, coverage, glob shortfalls |
| workspace | `Projects (N):` table, `Total:` | projects, `Failures:`, trend, `Total:` | projects, coverage |

Cells: `packages/ui/src/dispatcher/cells/*.ts` (e.g. `single-project-pass.ts:7-31`,
`single-project-fail.ts:8-31`, `workspace-fail.ts:8-24`). A failure prints
`modulePath > suite > test [classification]`, then only the first message line and the diff,
never the stack (`packages/ui/src/dispatcher/helpers.ts:111-130`). `dispatch` itself appends
the run-level trailers, never a cell: the scoped-coverage note ("Coverage thresholds skipped:
partial run (N of M test files)"), `Actions:`, the stray-output note, console leaks
(`dispatch.ts:73-145`). An action renders `- <severity>: <title> (tool: <tool>)` plus an
indented detail (`helpers.ts:346-354`). Ink cells paint the agent strings, so the two render
paths cannot disagree (`okf/models/dispatcher-matrix.md`, "The 12 cells").

### 2.3 Footer and suggested actions

`buildFooter` (`packages/ui/src/dispatcher/footer.ts:24-28,64-82`):

| Condition | Footer |
| --- | --- |
| all-pass, non-empty `belowTarget` | ``Use `file_coverage` to find uncovered functions.`` |
| some-fail, dominant `new-failure` or `persistent` | ``Use `test_errors` for failure detail; `failure_signature_get` to check known patterns.`` |
| some-fail, dominant `flaky` | ``Use `failure_signature_get` to confirm the flakiness signature.`` |
| threshold-violation | ``Use `test_coverage` for the workspace coverage breakdown.`` |

Dominance order is `new-failure > persistent > flaky > recovered > stable` (`footer.ts:41-52`).
The pointers name MCP tools literally, so the output contract is coupled to the tool surface.
Actions come from config validation (`plugin.ts:527`) and run diagnostics
(`packages/sdk/src/utils/run-diagnostics-actions.ts`), via
`ReporterRenderInput.suggestedActions` (`packages/sdk/src/contracts/reporter.ts:158`).

### 2.4 Honest counts

- An empty run is never green: `0 tests collected. A zero-test run usually means a wrong working
  directory, a filter that matched nothing, or a load-time error - verify before trusting it.`
  (`packages/ui/src/dispatcher/cells/single-project-pass.ts:13-18`). The collected module count
  is carried, not inferred (`packages/sdk/src/schemas/AgentReport.ts:11-18`, `RunEvent.ts:219-237`).
- Timeouts get their own count in every denominator and, like unhandled errors, route to
  `some-fail` (`classify.ts:79-84`, `okf/decisions/48-honest-run-reporting.md:35-68`). A
  caller's `passed` becomes `failed` when the walk found failed files or unhandled errors
  (`packages/sdk/src/utils/build-report.ts:337`); each project row derives its own `reason`.
- Load failures and `beforeAll`/`afterAll` throws land in `failed[]`; `countSuiteFailures`
  feeds render and health while `summary.failed` stays a pure test-case count for history math
  (`build-report.ts:371`, `okf/decisions/45-suite-load-failures-count-as-failures.md:28-76`).
- Rendering never waits on persistence: fallback reports exist before any DB work, and a DB
  failure only sets `persistDisabled` (`packages/plugin/src/reporter.ts:1948-1957`,
  `okf/decisions/47-rendering-never-depends-on-persistence.md:39-63`).
- `consoleLeaks` counts only non-failing tests' output; failing tests' output goes to
  `fromFailingTests`, so red runs do not cry wolf
  (`okf/decisions/57-partition-the-consoleleaks-signal-by-test-outcome.md:41-63`).

### 2.5 Stray-output capture (Decision 79)

Vitest 5's forks pools pipe worker stdout and stderr into `vitest.logger`'s two streams
(`okf/decisions/79-capture-stray-output-at-vitest-logger-streams.md:64-70`). When the plugin
owns stdout it wraps both with a pass-through `Writable` recording per-stream line counts,
bytes and the first 5 lines at up to 160 characters; escape-only writes pass unrecorded
(`plugin.ts:478`, `packages/sdk/src/utils/stray-output.ts:29-34,62-64`). The recorder is
published under `Symbol.for("vitest-agent/stray-output")` so `run_tests` can read it
(`stray-output.ts:142,158`); it resets at `onTestRunStart` and is snapshotted onto
`RunFinished` and every report (`decisions/79...:89-93`). Whole lines go to an optional
`printStrayLine`, but only for real terminal streams, so a live frame prints them above itself
(`contracts/reporter.ts:222`). Note text: `Stray output: tests wrote N lines directly to
<streams>, bypassing Vitest's console capture. A child process with inherited stdio is the
usual cause; pass stdio: "pipe".` plus up to 3 samples (`stray-output.ts:174-184`). Persisted
on `test_runs` since migration 0004 (`packages/engine/src/migrations/0004_stray_output.ts:182-186`).

### 2.6 GFM for GitHub Actions (Decision 10)

The step summary is on when `env === ci-github` and the mode is not `silent`; there is no
separate toggle (`plugin.ts:497`, `okf/decisions/10-gfm-output-for-github-actions.md:57-65`).
Vitest's `github-actions` reporter keeps its annotations but has `jobSummary.enabled` forced
off (`decisions/10...:67-75`). `buildSummaryMarkdown` always returns `## vitest-agent` and a
`### Totals` table, then `Classifications`, `Coverage` (10 rows max), `Trend` and
`Stray output` when non-empty (`packages/reporter/src/defaultReporter.ts:241-402`). The same
markdown becomes `.vitest/<scope>/summary.md` beside a versioned `run.json`
(`defaultReporter.ts:502-523`, `okf/interfaces/report-files.md:30,71`). A collapsed
`::group::vitest-agent` log block repeats per-project counts, below-target files,
classification counts, stray output and `db: <path>` (`packages/reporter/src/githubLog.ts:89-127`).

### 2.7 Rendered examples

Green (`packages/ui/__test__/snapshots/dispatcher/single-project-pass.snap.txt:1-3`):

```text
Tests: 2/2 passed (90ms)

2 modules all-passed.
```

Red (`packages/ui/__test__/snapshots/dispatcher/single-project-fail.snap.txt:1-17`):

```text
Tests: 2/4 passed, 1 failed, 1 skipped (100ms)

Failures:
- src/math.test.ts > math > divides [new-failure]
  expected 0.5 to equal 0.5000001
  - 0.5000001
  + 0.5

Modules:
- src/math.test.ts: 1 passed, 1 failed
- src/strings.test.ts: 1 passed, 1 skipped

Use `test_errors` for failure detail; `failure_signature_get` to check known patterns.

Actions:
- warn: Investigate floating-point comparison
  Use Number.EPSILON instead of strict equality for 0.5 vs 0.5000001
```

GFM has no golden fixture; tests only assert `toContain("### Totals")`
(`packages/reporter/__test__/default-reporter.test.ts:175,191-194`). Shape implied by
`defaultReporter.ts:359-401` and `okf/decisions/10-gfm-output-for-github-actions.md:78-80`
(values illustrative; `### Classifications` etc. follow when non-empty):

```markdown
## vitest-agent

### Totals

| Project | Passed | Failed | Timed out | Skipped | Duration |
| --- | --- | --- | --- | --- | --- |
| sdk | 855 | 0 | 0 | 0 | 5.4s |
| plugin | 192 | 2 | 0 | 0 | 3.4s |
| **Total** | 1047 | 2 | 0 | 0 | 8.8s |
```

## 3. Data model

### 3.1 Key SDK schemas

All are plain `Schema.Struct` with `annotate({ identifier })`: no classes, no brands.

- `AgentReport { timestamp, project?, reason, summary, failed: ModuleReport[], unhandledErrors,
  failedFiles, coverage?, tagCounts?, consoleLeaks?, strayOutput? }`
  (`packages/sdk/src/schemas/AgentReport.ts:76-88`), `ModuleReport { file, state, duration?,
  errors?, tests }` (`:50`), `TestReport { name, fullName, state, duration?, flaky?, slow?,
  errors?, classification? }` (`:33`). Only failed modules are carried; green ones are a count.
- `ReportError { message, stack?, diff?, expected?, received? }` (`Common.ts:180-186`): no
  location, code or rule.
- `RunEvent`, a 23-member tagged union (run, module, test, suite, hook, console, timeout,
  annotation, artifact, watcher, trend, coverage, threshold, classification, action, finish;
  `packages/sdk/src/schemas/RunEvent.ts:82-262`), reduced into `RenderState`
  (`packages/sdk/src/schemas/RenderState.ts:138-194`) with `FailureRecord { modulePath,
  testName, suitePath, error?, timedOut?, classification }` (`:61`) and `RenderTotals { pass,
  fail, skip, timeout, durationMs }` (`:117`).
- `StrayOutput { total, stdout, stderr, bytes, samples[] }` (`schemas/StrayOutput.ts:32`);
  `RunReportFile { $schema?, schemaVersion: 1, generatedAt, reports, runDiagnostics? }`
  (`schemas/RunReportFile.ts:61`); `TestClassification` (`Common.ts:57-63`).

### 3.2 SQLite tables and migrations

- Three databases: per-project `data.db`, per-client `sessions.db` under
  `${CLAUDE_PLUGIN_DATA}`, global `registry.db` under the XDG root
  (`okf/models/sqlite-schema.md:24,254,268`).
- `0001_initial`: 44 tables plus FTS5 on notes (`packages/engine/src/migrations/0001_initial.ts:40-834`):
  run results (`test_runs` > `test_modules` > `test_suites` > `test_cases`, `test_errors`,
  `stack_frames`, `console_logs`), history and coverage (`test_history`, `coverage_*`,
  `file_coverage`, `failure_signatures`), git (`commits`, `run_changed_files`), agent taxonomy
  (`sessions`, `agents`, `turns`, `file_edits`, `hypotheses`, `notes`) and TDD (`tdd_*`).
- `0002` recreates dead `test_annotations` and widens `test_artifacts`/`attachments`
  (`0002_test_artifacts.ts:29-57`); `0003` rebuilds `test_history` with `run_id ... ON DELETE
  SET NULL` so run pruning keeps history, and indexes every FK child
  (`0003_run_retention.ts:92-155`); `0004` adds `stray_*` columns (`0004_stray_output.ts:182-186`).
  Registry: `migrations/index.ts:23-28`.
- `test_runs` already records `git_branch`, `git_commit_sha`, `git_dirty`, `git_worktree_dir`,
  host and agent attribution (`packages/engine/src/layers/DataStoreLive.ts:217`).
- Retention: newest 200 runs per project by default, pruned inside the persist transaction;
  history keeps its own newest 10 per series (`okf/models/sqlite-schema.md:341-392`).

### 3.3 Failure classification, exactly

`classifyTest(current, priorRuns)` with prior runs newest first
(`packages/sdk/src/utils/classify-test.ts:11-26`):

| Current | Prior runs in window | Result |
| --- | --- | --- |
| failed | none, or all passed | `new-failure` |
| failed | newest prior failed | `persistent` |
| failed | some failed, newest passed | `flaky` |
| passed | none, or none failed | `stable` |
| passed | any failed | `recovered` |

- Window: `HistoryTrackerLive` prepends the run and keeps `WINDOW_SIZE = 10`
  (`packages/engine/src/layers/HistoryTrackerLive.ts:13,22,38-41`). `getHistory` reads 20 per
  series (`DataReaderLive.ts:498`) but `writeHistory` deletes all but the newest 10
  (`DataStoreLive.ts:458`), so the effective window is 10 and `recovered` sticks for up to 9
  green runs after one red.
- Inputs: only `passed`/`failed` cases (`reporter.ts:2740-2749`, `DataReaderLive.ts:526-527`),
  keyed `JSON.stringify([modulePath, fullName])` with `modulePath = relativeModuleId`
  (`packages/engine/src/services/HistoryTracker.ts:26`, `reporter.ts:2743`). Vitest's retry
  `flaky` flag is stored but unused.
- The MCP flaky query is a different rule: passes and fails in the window and a fail at or after
  the earliest pass (`DataReaderLive.ts:711-730`).
- Signature: first 16 hex of SHA-256 over `errorName | assertion shape | top-frame function |
  fb:<function boundary line>` (else `raw:<line rounded to 10>`); the shape is a regex over 17
  matcher names with argument type tags (`packages/engine/src/utils/failure-signature.ts:11-45`).
  The top frame skips `node_modules`, `vitest/dist`, `@vitest/`, `node:`
  (`packages/plugin/src/utils/process-failure.ts:38-42,118`). `failure_signatures` counts
  occurrences (`DataStoreLive.ts:839`).

### 3.4 Database path, worktrees, concurrent writers

- Precedence: programmatic `cacheDir`, `cacheDir` in `vitest-agent.config.toml`, `projectKey` in
  that file, then a key from the nearest `package.json` above `projectDir`; the directory is the
  `AppDirs` data root (`$XDG_DATA_HOME/vitest-agent`, else `~/.local/share/vitest-agent`) plus
  the key (`packages/engine/src/utils/resolve-data-path.ts:69-113`).
- The cwd key prefers `repository.url` canonicalized to `host__path`, then the normalized `name`
  (`@org/pkg` to `@org__pkg`), then the cwd basename, then `anonymous-project`
  (`packages/engine/src/utils/resolve-project-key-from-cwd.ts:17-38,77-89`). `CLAUDE.md:174-176`
  still says `name`.
- `projectDir` = `VITEST_AGENT_PROJECT_DIR`, `VITEST_AGENT_REPORTER_PROJECT_DIR`,
  `CLAUDE_PROJECT_DIR`, then cwd (`packages/engine/src/project-dir.ts:7-30`).
- Worktrees by design share one database: "two checkouts (worktrees) of the same repository
  share history under a name-keyed path" (`okf/decisions/31-deterministic-xdg-path-resolution.md:117-125`).
  Series are keyed by project, module and test only, so a red test on a feature worktree makes
  the same green test on `main` read `recovered`, and a later failure there `flaky`. Branch and
  worktree are recorded on `test_runs` and never used as a partition.
- MCP `run_tests` refuses a sibling-worktree mismatch between caller cwd and server root, and
  chdirs into a validated `projectRoot` for the run (`okf/modules/mcp.md:546-575,644-660`).
- Per connection: WAL (driver, `.../@effect/sql-sqlite-node/dist/SqliteClient.js:90`), 5 s busy
  timeout, `foreign_keys = ON`, `synchronous = NORMAL` on `data.db` (`packages/engine/src/stores.ts:44-85`).
- In one process: migrations run once per real path via a `globalThis` registry, since Vite can
  load the plugin twice (`okf/decisions/28-process-level-migration-coordination-via-globalthis-cache.md:46-63`);
  the run persist is one transaction under `References.PreventSchedulerYield`, so a second
  synchronous connection cannot deadlock in the busy handler
  (`packages/engine/src/utils/persist-transaction.ts:175`,
  `okf/invariants/persist-transaction-no-yield.md:27-56`). Hooks, MCP and CLI autocommit.
- Across processes: only WAL and the busy timeout; a concurrent first open of a missing file can
  die untyped at the WAL switch (`okf/limitations/concurrent-first-open-wal-switch.md:28-52`).
  The only file lock is the `runScript` build lock (`RunOnce`, liveness takeover after 60 s;
  `okf/decisions/52-serialize-runscript-builds-with-a-file-based-advisory-lock.md:39-82`).

## 4. Reporter contract and Vitest integration

- `AgentPlugin()` returns a Vite plugin `{ name, configResolved, configureVitest, transform? }`
  (`packages/plugin/src/plugin.ts:314,356-375,718-722`). `configureVitest` (Vitest 5 plugin
  API): requires `ctx.defineCacheKeyGenerator` (absent means Vitest < 5), registers a tag
  cache key, resolves environment, executor and mode, mutates `vitest.config.reporters`,
  installs stray capture on `vitest.logger`, normalizes `github-actions`, runs
  `ConfigValidation`, isolates the coverage directory, and pushes one `AgentReporter` per
  Vitest instance, deduped across per-project calls (`plugin.ts:393-697`). `transform` adds a
  tag prelude with `magic-string` (`okf/decisions/23-vitest-native-tag-classification.md`).
- `AgentReporter` (`packages/plugin/src/reporter.ts:650`) implements the Vitest 5 reporter API
  (`onInit`, `onTestRunStart`, `onTestModule*`, `onTestCase*`, `onTestSuite*`, `onHook*`,
  `onUserConsoleLog`, `onProcessTimeout`, `onWatcher*`, `onCoverage`, `onTestRunEnd`;
  `reporter.ts:896-1676`), publishing a `RunEvent` per callback to the `PubSub` the factory gets
  as `kit.runEvents` (`packages/sdk/src/contracts/reporter.ts:118-136`). At run end: fallback
  reports, one persist transaction, classification, then `render(input, kit)`, whose outputs
  route to `stdout`, `github-summary` or `report`.
- Contract: `VitestAgentReporterFactory = (kit) => VitestAgentReporter | VitestAgentReporter[]`
  (`contracts/reporter.ts:244`), `VitestAgentReporter { render, close?, printStrayLine? }`
  (`:193-223`), `ReporterRenderInput { reports, classifications, suggestedActions?,
  runDiagnostics?, trendSummary? }` (`:149-171`). Reporters see `AgentReport[]`, never Vitest
  objects, so the render side is already runner-neutral.
- `ReporterRenderInput.classifications` is flattened to a `fullName` key
  (`reporter.ts:2990-3002`); same-named tests in two files collide there, and the GFM
  classification counts read that map (`defaultReporter.ts:241-249`).
- Ported Vitest code: the performance-hint helpers, copied from Vitest 5.0.5 because Vitest
  strips them with its reporters and does not export them
  (`packages/plugin/src/utils/vitest-diagnostics.ts:1-12`,
  `okf/conventions/ported-vitest-diagnostics.md:23-43`).

## 5. CLI and MCP surface

CLI tree: `okf/interfaces/cli.md:49-73`. Exit codes `0`, `64` usage, `130` cancel, `1` failure
(`cli.md:129-140`). `--audience|--human|--agent|--ci` and `VITEST_AGENT_AUDIENCE` (`cli.md:84-93`).

| Command | What | Tag |
| --- | --- | --- |
| `doctor`; `db path\|prune\|reset\|query <sql>` | Health; locate, retain, wipe, read-only SQL | generic |
| `agent triage`, `agent wrapup` | Orientation brief; stop/compact nudge | generic |
| `agent record turn\|session-start\|session-end\|run-trigger\|run-workspace-changes`, `agent register-agent\|end-agent` | Session, turn, run, git and agent rows | generic |
| `agent record tdd-artifact\|test-case-turns` | TDD evidence binding | test-specific |
| `agent inject-env\|sidecar-path`, `agent check-test-path <path>` | Vitest env rewrite; test-layout rule | test-specific |

MCP: 30 tools (23 `Tool.make`, 7 union `Tool.dynamic`), every input strict (`CLAUDE.md:78-87`,
`okf/interfaces/mcp-tools.md:80-112`, one file each in `packages/mcp/src/tools/`):

| Tool | What | Tag |
| --- | --- | --- |
| `ping`, `help` | Liveness; families and discriminants | generic |
| `test_status`, `test_overview` | Latest run per project, stray output | generic (rename) |
| `test_history`, `test_errors`, `failure_signature_get` | Series; errors by type; signature counts | generic |
| `test_trends`, `test_coverage`, `file_coverage` | Coverage trend and breakdowns | test-specific |
| `cache_health`, `commit_changes`, `turn_search`, `register_agent` | DB health; changed files; turns; agents | generic |
| `settings_list`, `configure` | Captured Vitest settings | test-specific |
| `acceptance_metrics` | TDD workflow ratios | test-specific |
| `inventory` (`project\|module\|suite\|session\|tag`) | Counted lists | mixed |
| `test` (`list\|get\|for_file\|for_tag\|annotations\|artifacts`) | Test lookup, refuses ambiguity | test-specific |
| `note`, `hypothesis` | Notes with FTS5; hypothesis record/validate | generic |
| `tdd_task`, `tdd_goal`, `tdd_behavior`, `tdd_phase_transition_request`, `tdd_artifact_list`, `tdd_progress_push` | TDD loop | test-specific |
| `triage_brief`, `wrapup_prompt` | Same text as the CLI | generic |
| `run_tests` | In-process Vitest run returning `AgentReport`, `scopedNote`, actions | test-specific |

Six framing-only prompts: `triage`, `why-flaky`, `regression-since-pass`, `explain-failure`,
`tdd-resume`, `wrapup` (`okf/interfaces/mcp-tools.md:192-197`).

## 6. Claude plugin

Hooks are declared in `plugin/pluginfinity.config.ts:20-111`. Each sources pluginfinity's
`hook.sh` first, about 50 ms with `jq`/`mktemp`/`cat` forks
(`okf/measurements/pluginfinity-hook-latency-2026-10-09.md:33-37,57-59`).

| Event (script) | Does | Cost per call |
| --- | --- | --- |
| SessionStart (`session/start.sh`) | `agent triage` into context, `register-agent`, sidecar path, session env, lockfile hash | 2-3 Node CLI spawns, once |
| UserPromptSubmit (`record.sh`, `lockfile/check.sh`) | Prompt turn, `agent wrapup` nudge, lockfile drift warning | Node spawn + hash |
| PreToolUse all (`record.sh`) | `agent record turn` tool_call | 1 Node spawn per tool call (`plugin/hooks/pre-tool-use/record.sh:22-40`) |
| PreToolUse Bash (`bash.sh`) | 3-layer `inject-env`: regex, main-agent skip, sidecar or JS | skip 63.5 ms p95; JS 492 ms p95 |
| PreToolUse Bash/Edit/Write (`bash-tdd.sh`) | In `tdd-task` only: deny `-u`, `--bail`, `-t`, silent reporter, `.snap` edits | library load |
| PreToolUse Read/Write/Edit (`test-location.sh`) | Deny new tests at invalid paths | Node spawn on match |
| PreToolUse MCP (`mcp.sh`, `mcp-run-tests.sh`, `tdd-restricted.sh`) | Auto-allow safe tools, inject `_callerCwd`, gate TDD deletes | library load |
| PostToolUse all (`record.sh`) | tool_result turn, plus file_edit for edits | 1-2 Node spawns (`post-tool-use/record.sh:30-77`) |
| PostToolUse Bash (`test-run.sh`) | On test commands: run trigger, bind cases; nonzero exit injects guidance toward MCP tools | 2 spawns on match (`test-run.sh:26-56`) |
| PostToolUse (`git-commit.sh`, `tdd-artifact.sh`, `test-quality.sh`) | Commits; TDD evidence; `test_weakened` on `.skip`/`.todo` | spawn on match |
| Stop, PreCompact, SessionEnd | Wrapup nudges; turn rows; detached end worker | Node spawn |
| SubagentStart/Stop (`subagent/*-tdd.sh`) | Register and end the orchestrator | Node spawn |

Roles and gates: `okf/modules/claude-code-plugin.md:168-238`. Without the sidecar every tool call
pays at least two synchronous Node cold starts that open SQLite, plus the library load.

Sidecar: `inject-env` prefixes a Vitest command (matched directly or through a `package.json`
script) with `VITEST_AGENT_CONVERSATION_ID`, `VITEST_AGENT_AGENT_ID` and optionally
`VITEST_AGENT_PARENT_AGENT_ID`, so a subagent's run is attributed to that subagent
(`packages/sdk/src/internal-inject-env.ts:42-57`). It is native because the hook fires on every
Bash call and a Node cold start of the `effect`/`effect/cli`/`sql-sqlite-node` graph sat on the
agent's inner loop (`okf/decisions/42-three-layer-sidecar-performance-fix.md:32-42`). The binary
holds only the pure `@vitest-agent/sdk/dispatch` core, ships as four `os`/`cpu` optional packages
(`okf/modules/sidecar.md:46-79`, `CLAUDE.md:19`). Both latency gates fail today
(`okf/measurements/pluginfinity-hook-latency-2026-10-09.md:50-59`).

Skills and agent: 17 skills (the `tdd` entry, nine preloaded TDD primitives, path-triggered
`test-discovery`, four references, user-invoked `setup`/`configure`). `agents/tdd-task.md`
splits a goal into behaviors, one red-green-refactor cycle each; hooks, never the agent, write
the evidence rows that phase transitions are judged on
(`okf/modules/claude-code-plugin.md:252-316`).

## 7. Generalization seams

Gate-neutral already, given a neutral event stream:

- Environment, executor and detail resolvers and the mode slots (§2.1).
- `classifyTest` for any `(key, passed|failed)` series: typecheck `(package, file, TS code)`,
  lint `(file, rule)`, CI `(workflow, job, step)` (`classify-test.ts:11-26`).
- Honest-count rules, render-before-persist, the persist transaction, the stray-output
  recorder (only its install point is Vitest's logger; `stray-output.ts:62-184`).
- Reducer, classify, `dispatch`, trailers and footer once widened; GFM, `::group::` and report
  files, which read only `AgentReport` (`defaultReporter.ts:359-426`, `githubLog.ts:89-127`).
- Retention, `db query`, triage/wrapup, `failure_signatures`, notes, hypotheses, session/turn
  taxonomy, agent attribution.

Vitest-specific (behind an adapter): all of `packages/plugin/src` (lifecycle, reporter
stripping, coverage, tags, discovery, ConfigValidation, ported diagnostics);
`buildAgentReport` and `synthesizeRunEvents`, which duck-type Vitest `TestModule`
(`build-report.ts:324`, `packages/ui/src/synthesize.ts`); console-leak collection over Vitest's
task tree; `processFailure` and the matcher-name regex (`failure-signature.ts:11-33`);
`run_tests`, `inject-env` matching, `classifyTestPath`, all `tdd_*`.

Types to widen:

| Type | Now | Widen to |
| --- | --- | --- |
| `TestState`, `TestRunReason` (`Common.ts:37,47`) | passed/failed/skipped/pending; passed/failed/interrupted | item outcome with `warning`; run reason with `errored`, `cancelled` |
| `ReportError` (`Common.ts:180`) | message, stack, diff, expected, received | plus `location { file, line, column }`, `code`, `rule`, `severity` |
| `AgentReport` tree (`AgentReport.ts:33-88`) | project > file > test | gate > unit (package, file, job) > item (test, diagnostic, step) |
| `RunEvent` (`RunEvent.ts:82-262`) | Module, Test, Suite, Hook, Coverage events | `Unit*`, `Item*`; coverage and annotations as gate extensions |
| `RenderTotals` (`RenderState.ts:117`) | pass, fail, skip, timeout | plus `warnCount`, `errorCount` |
| `FailureRecord` (`RenderState.ts:61`) | modulePath, suitePath, testName | unit, path segments, item label, location |
| `RunShape` (`dispatcher.ts:17`) | test, file, project, workspace | item, unit, package, workspace |
| `RunOutcome` (`dispatcher.ts:27`) | all-pass, some-fail, threshold-violation | plus `warnings-only`, `interrupted`; rename to `policy-violation` |
| `CoverageRenderState` (`RenderState.ts:77`) | coverage metrics | a `PolicyRenderState` (coverage, error budget, max warnings) |
| footer strings (`footer.ts:24-28`) | hard-coded MCP tool names | a per-gate pointer table (CLI command or tool) |
| `test_history` key (`0003_run_retention.ts:93-106`) | project, module_path, full_name | gate, subject, check, plus branch scope |

## 8. Port cost notes

Ranked easiest to hardest:

1. **sdk**: pure, no `node:` imports, boundary-tested (`CLAUDE.md:331-335`); only `acorn`.
2. **ui, agent half**: pure string cells on cli-kit `Doc`/`Fmt`; defer `src/ink/` (1,606 lines).
3. **reporter**: small, but GFM and `::group::` go through cli-kit `Render.markdown` and
   `Render.githubLog` (with workflow-command neutralization); we need our own renderer.
4. **cli**: small; rebuild the `0/64/130/1` exit contract on `effect/cli`.
5. **engine**: 13k lines on `@effect/sql-sqlite-node` over `node:sqlite` `DatabaseSync`
   (`.../sql-sqlite-node/dist/SqliteClient.js:34`). For Bun use `@effect/sql-sqlite-bun` (same
   catalog, `.../pnpm-plugin-effected/index.js:24`) and verify before assuming either driver.
   `bun:sqlite` is synchronous too, so keep the `PreventSchedulerYield` invariant. Replace
   `@effected/store`'s ledger adoption, `migrateOnce` and WAL checkpoint. Most of 0001 is
   TDD/session taxonomy we may not want.
6. **mcp**: replace `@effected/mcp-kit` (strict unions, `ToolRefusal`, crash guards) with
   `effect/ai` `McpServer` directly. `run_tests` mutates `process.cwd()` and `process.env` in a
   one-permit `Exclusive` lane and re-resolves the project's `vitest/node` per call
   (`okf/modules/mcp.md:617-670`).
7. **plugin**: hardest. `reporter.ts` is 3,141 lines over Vitest's lifecycle: reporter-array
   mutation, logger stream patching, `node:fs/os/crypto/stream/module`, temp coverage dirs, a
   `globalThis` migration registry, a fresh `ReporterLive` per run (`reporter.ts:3019`,
   `okf/limitations/per-call-layer-construction.md`). Vitest workers stay Node processes even
   when launched from Bun.
8. **sidecar and agent plugin**: shell on pluginfinity plus `jq` and a Node SEA per platform;
   `bun build --compile` replaces SEA. Rebuild, do not port.

Style deltas against beep-effect laws: 170 src files import the root `effect` barrel, MCP imports
the `effect/ai` barrel, 268 `Effect.gen(function*` against 4 `Effect.fn`, 46 native
`new Map<`/`new Set<`, interface-literal `Context.Service` shapes. Unusual APIs:
`References.PreventSchedulerYield` (`persist-transaction.ts:175`),
`Effect.provide(layer, { local: true })` to avoid MemoMap reuse
(`okf/gotchas/effect-provide-inherits-memo-map.md`), `PubSub` as the event channel,
`Tool.dynamic` unions.

## 9. Weaknesses and enhancement candidates

What I would fix in the port, most valuable first:

1. History ignores branch and worktree (§3.4): partition by branch, fall back to a
   default-branch baseline, keep one DB.
2. Two flaky rules disagree (`classify-test.ts:15-20` vs `DataReaderLive.ts:711-730`), Vitest's
   retry flag is unused, and the window (10, read 20) is a constant with a 9-run sticky
   `recovered` (`HistoryTrackerLive.ts:13`): one rule, retries folded in, window as config.
3. Hook cost: about 50 ms library load per hook plus Node spawns per tool call, both gates fail
   (`okf/measurements/pluginfinity-hook-latency-2026-10-09.md:50-69`): one long-lived recorder.
4. Correctness leftovers: the flat `fullName` classifications map collides (§4); coverage is one
   workspace map copied under every project (`okf/limitations/coverage-shared-across-projects.md`);
   a fresh layer per run (`okf/limitations/per-call-layer-construction.md`); an untyped
   first-open WAL failure (`okf/limitations/concurrent-first-open-wal-switch.md:34-52`).
5. Unbuilt surface: `ci-annotations` (`Common.ts:90-92`), the `file` target
   (`okf/limitations/file-output-target-reserved.md`); agent/CI modes paint only at run end
   (`okf/limitations/end-of-run-rendering.md`), so a hanging gate needs a heartbeat line.
6. Dispatcher totality is half-typed: nothing forces `classify.ts` or the footer to cover a new
   axis value (`okf/models/dispatcher-matrix.md`, "What a new shape or outcome must add").
7. Smaller: filename-strip source mapping (`okf/limitations/convention-based-source-mapping.md`);
   a non-idempotent "idempotent" tool (`okf/gotchas/phase-transition-not-idempotent.md`); stale
   modules in a long-lived MCP server (`okf/gotchas/stale-mcp-server-modules.md`); manual
   re-diff of ported diagnostics (`okf/conventions/ported-vitest-diagnostics.md:42-43`); older
   installs cannot open newer DBs (`okf/limitations/older-installs-cannot-open-newer-databases.md`).
8. Doc drift: `okf/limitations/stray-output-not-persisted-or-on-ci.md` says "not persisted" but
   `0004_stray_output.ts:182-186` persists it; `CLAUDE.md:174-176` says the key is `name`;
   `resolveWorkspaceKey` has no caller (`okf/decisions/31-deterministic-xdg-path-resolution.md:100-108`).
9. The one incident (stranded live-view headers) was first blamed on terminal width; the cause
   was a test's `git worktree add` with inherited stdio
   (`okf/incidents/2026-10-07-stranded-live-view-headers.md:36-63`). A child with inherited
   stdio is the default suspect when a gate's output is corrupted.

No `TODO`/`FIXME` in `packages/*/src` or `plugin/hooks`; `okf/roadmaps/` is empty.

## 10. License and attribution facts

- `LICENSE:1-3`: "MIT License", "Copyright (c) 2026 C. Spencer Beggs". Every manifest says
  `"license": "MIT"` (`packages/*/package.json:16`, `plugin/package.json:6`).
- `DCO:1-4`: Developer Certificate of Origin 1.1; contributors sign off commits
  (`CONTRIBUTING.md:163-176`). It governs upstream contributions, not a port.
- No `NOTICE` or third-party license file outside `node_modules`. MIT requires the copyright and
  permission notice in "all copies or substantial portions": keep a header in ported files or
  ship the license text with an attribution line.
- Vendored code: `packages/plugin/src/utils/vitest-diagnostics.ts:1-12` and
  `collect-performance-hints.ts` are ported from Vitest 5.0.5, MIT, "Copyright (c) 2021-Present
  VoidZero Inc. and Vitest contributors" (`node_modules/.pnpm/vitest@5.1.0_.../vitest/LICENSE.md:4-6`).
  Porting them means carrying both notices. `.repos/effect` and `.repos/vitest` are shallow
  reference submodules, not shipped (`.gitmodules:1-8`).
- Anything taken from the `@effected/*` kits (Audience rules, `CliUi.routeStream` line
  buffering, `RunOnce`) needs that project's MIT notice
  (`packages/engine/node_modules/@effected/store/LICENSE:1-3`).
