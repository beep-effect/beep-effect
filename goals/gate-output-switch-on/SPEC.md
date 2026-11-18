# Gate Output: Switch On What Exists Spec

## Objective

Land the six located fixes that need no new model, so agents get shorter gate output this week.

Each fix switches on a behaviour that already exists in a tool or in the repo and is blocked by
one setting or one code path. The design is settled in the exploration packet:
`explorations/agent-verification-output/BRIEF.md` ("What ships first, without the model"),
`explorations/agent-verification-output/MAP.md` (candidate 1) and
`explorations/agent-verification-output/DECISIONS.md`. Evidence for each site is in
`explorations/agent-verification-output/research/in-repo-inventory.md` sections 1 and 8.

The six fixes:

1. The agent signal reaches tools through Turbo, and Bun's quiet mode also switches on under Codex.
2. Under a detected agent, Turbo replays errors only, so a cached green task prints nothing.
3. `--help` prints the global-flag block on the root command only.
4. Lane envelopes stay in their durable file and leave stdout.
5. The readiness-monitor submit step keeps its JSON line in the step log.
6. A package-local `check` probes for unbuilt upstream declarations before it spawns the compiler.

## Non-Goals

- The gate-report model, its renderer, history labels and the CI projection. They belong to
  `gate-report-core`, `gate-run-history`, `gate-report-rollout` and `ci-gate-reports`.
- Any console rendered from a tool's raw stream. These fixes only switch existing tool modes on and
  remove lines nobody reads (BRIEF no-go).
- A delta mode for `yeet gate-table`. It is block-until-changed work in `gate-report-rollout`.
- Output of commands an agent chooses for itself (`rg`, `cat`, `git`), and any wrapper around
  commands the repo does not own (decision `scope-gates-only`).
- MCP tools or hooks in any harness.
- The out-of-repo session-start manual that recommends `zsh -ic`. A user-level plugin injects it.

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

State of each site at head `93c373f0ddb`, verified for this spec.

| Fix | Site | State today |
| --- | --- | --- |
| 1 | `turbo.json` `global.passThroughEnv` | Carries `CODEX_THREAD_ID` and `CLAUDE_CODE_*` names; not `AI_AGENT`, `CLAUDECODE`, `CLAUDE_CODE`, `CODEX_SANDBOX`, `AGENT` or the other agent keys. The `test` task adds only `GITHUB_STEP_SUMMARY` and `BEEP_CREATE_PACKAGE_BUN_ARGS_FILE`. |
| 1 | `packages/foundation/capability/runtime-env/src/internal/agentCi.ts` (`AGENT_RULES`) | The std-env agent table, internal and not exported. Rows `pi` and `devin` test `PATH` and `EDITOR` values, not dedicated keys. |
| 1, 2 | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`turboStep`, `turboRunArgs`) | `turboStep` builds every root Turbo step; `turboRunArgs` assembles `turbo run` argv. Neither sets `AGENT` nor `--output-logs`. |
| 3 | `node_modules/effect/src/cli/CliOutput.ts` (`defaultFormatter`) | Accepts `globalFlags: "full" \| "summary" \| "none"`; the default is `"full"`. A command that declares global flags always lists them. |
| 3 | `packages/foundation/capability/cli-kit/src/CliColor.ts` (`CliColor.formatterLayer`) | Builds `CliOutput.defaultFormatter({ colors })` only and takes formatter method overrides, so `globalFlags` cannot be passed. |
| 3 | `packages/foundation/capability/cli-kit/src/CliRuntime.ts` (`CliRuntime.main`), `packages/tooling/tool/cli/src/bin-main.ts` | `main` installs `CliColor.formatterLayer` only when its `env` option is set; `bin-main.ts` passes no `env`, so core's default formatter applies. |
| 4 | `Tasks.ts` (`emitQualityTaskLaneRunReport`, `runQualityTaskGithubCheckLaneWaves`, `appendQualityTaskLaneRun`) | Both envelopes are always `Console.log`ged. Only the lane-run report has a durable copy, under `BEEP_YEET_INNER_LANE_REPORT_PATH`; the GitHub-check report has none. |
| 4 | `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts` (`QUALITY_TASK_LANE_RUN_REPORT_PREFIX`, `GITHUB_CHECK_RUN_REPORT_PREFIX`, `QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV`) | The prefixes and the env name. No production code parses either prefix from stdout; `Yeet/internal/IssueClassification.ts` (`LANE_REPORT_PREFIXES`) filters them out as noise. |
| 5 | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` (`MONITOR_READY_SUBMIT_STEP_ID`) | Defines the submit step. |
| 5 | `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueArtifacts.ts` (`executeStepWithArtifacts`) | Chooses the executor: only `MONITOR_CONTEXT_STEP_ID` runs through `executeRepoPlanStepSplit`; the submit step streams its JSON line live. |
| 6 | `packages/tooling/tool/cli/src/commands/Quality/CheckCensus.ts` (`assertCheckCensusTreeBuilt`, `missingReferenceOutputs`) | A filesystem-only probe of each referenced project's `<outDir>/index.d.ts`. Used by `quality check-census` only. It fails with a multi-line message listing up to 40 missing outputs. |
| 6 | `Tasks.ts` (`runPackageTask`) | Runs a package's `beep:check` script when `beep-cli check` is invoked inside a package directory. No probe. |
| 6 | `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts` | Generates package scripts. All 186 package `check` scripts are `bun run beep:check`, so `bun run check` inside a package never reaches `runPackageTask`. |

Other surfaces this goal may change:

- `standards/cache-baseline/_root.json`, re-recorded when `turbo.json`'s global configuration
  changes, and per-package baselines under `standards/cache-baseline/@beep/` when a generated
  `check` command changes.
- Tests that pin the values above (see Constraints).

## Constraints

- **Turbo replays the first audience's log.** `passThroughEnv` values are not part of a task hash.
  A cached task replays the log recorded by whichever audience ran first, so a human run followed
  by an agent cache hit replays the full human log. Fix 1 alone cannot shorten a cache hit; fix 2
  is required for that. Measured on `@beep/glob`'s 273 green tests: 282 characters from Vitest
  with an agent variable set, 10,853 without, and 13,450 through
  `turbo run test --filter=@beep/glob --only --force` with the variable set in the shell.
- **One agent table.** The keys added to Turbo's pass-through list are derived from the
  `@beep/runtime-env` table, plus `AI_AGENT` and `AGENT`. They are not hand-copied: the table gains
  a public export of its keys and a test compares it with `turbo.json`. `PATH` already reaches
  tasks; `EDITOR` (the `devin` row) is added with the rest.
- **Detection has one owner.** The task path decides "agent" through `@beep/runtime-env`, never
  through an ad hoc variable check. When it decides agent, it exports `AGENT=1` to children (Bun's
  quiet mode reads `AGENT`, `CLAUDECODE` and `REPL_ID`, not `AI_AGENT` or `CODEX_*`) and passes
  `--output-logs=errors-only` unless the caller passed an `--output-logs` argument. A
  caller-owned argument stays caller-owned, as `turboCacheArgsFor` already treats `--cache`.
- **Help summary is a formatter option.** `CliColor.formatterLayer` gains the `defaultFormatter`
  options (`globalFlags`, `inheritedFlags`) beside its overrides; the repo CLI selects
  `globalFlags: "summary"`. Root help keeps the full list.
- **The record is the source** (decision `record-is-the-source`). Where a durable file exists,
  stdout does not repeat it. The GitHub-check report gets a durable file beside the lane report
  before its stdout line goes. Without the artifact env (a bare terminal run), output is unchanged.
- **The probe never spawns a compiler.** Fix 6 reuses `missingReferenceOutputs` and the
  declaration-index rule of `assertCheckCensusTreeBuilt`. It prints exactly one line: the missing
  count, the first missing output, and the build-closure command. It covers both entry points:
  `bun run check` inside a package and `beep-cli check` inside a package. Which of the generated
  script or a `beep-cli` route carries it is decided in P0 and recorded as a decision file.
- **Cache policy.** `bun run beep cache audit` compares `turbo.json` with
  `standards/cache-baseline/_root.json` and reports `global-configuration-drift` when the global
  pass-through list changes (`Cache.governance.policy.ts`). A changed generated command reports
  `configuration-drift` per task. Each such change re-records the baseline in the same PR through
  `bun run beep cache baseline --request <reviewed request>`.
- **Tests that pin these values.** `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`
  pins per-root-task `passThroughEnv` and `agentGuidance`;
  `packages/tooling/tool/cli/test/doctest-turbo-inputs.test.ts` decodes the global `env` and
  `passThroughEnv` block; `packages/tooling/tool/cli/test/quality-tasks.test.ts` pins `turbo run`
  argv and parses the lane envelope from stdout with the artifact env set;
  `packages/tooling/policy-pack/repo-configs/test/CacheQualification.policy.test.ts` and
  `CacheBaselineRecord.policy.test.ts` pin the drift rules for `passThroughEnv`, `outputLogs` and
  the command digest. Expectations change with the behaviour, in the same PR, never by loosening a
  drift rule.
- **Repo laws.** Effect modules are imported as `effect/<Module>` leaves. A package edit is handed
  back after `bun run beep quality package-verify <@beep/package>`. Generated package scripts change
  only through the generator and `bun run beep lint package-scripts --write`.

## Acceptance Criteria

- [ ] **AC1 Agent keys pass through.** `turbo.json` `global.passThroughEnv` contains every key of the
  `@beep/runtime-env` agent table plus `AI_AGENT`, `AGENT` and `EDITOR`. A test fails when the table
  gains a key the list lacks.
- [ ] **AC2 Green test under Turbo is short.** With only `CLAUDECODE=1` set as an agent marker,
  `turbo run test --filter=@beep/glob --only --force` prints under 600 characters (stdout plus
  stderr, `wc -m`), against 13,450 at baseline. The same holds with only `CODEX_THREAD_ID` set.
- [ ] **AC3 Bun quiet under Codex.** When `@beep/runtime-env` detects an agent, every step the task
  path builds carries `AGENT=1` in its environment; with no agent detected it does not. Unit test
  over `turboStep`.
- [ ] **AC4 Cache hit replays nothing.** Under a detected agent the task path's `turbo run` argv
  carries `--output-logs=errors-only`, and a caller's own `--output-logs` wins. Measured: run the
  `@beep/glob` test task once with no agent variable (cache miss), then through the task path with
  `CLAUDECODE=1` (cache hit); the second run prints under 600 characters and contains no
  `Test Files` line.
- [ ] **AC5 Help without boilerplate.** The root `--help` lists the five built-in global flags.
  Every other command's `--help` contains none of `--wizard`, `--completions` or `--log-level` and
  contains the line `Run 'beep-cli --help' for global flags`. A test walks the full command tree.
  `CliColor.formatterLayer` accepts the formatter options, tested in
  `packages/foundation/capability/cli-kit/test/CliColor.test.ts`.
- [ ] **AC6 Envelopes stay in files.** With `BEEP_YEET_INNER_LANE_REPORT_PATH` set, stdout carries
  no line starting with `[beep-quality-task-lane-run] ` or `[beep-github-check-run] `; the lane
  report is in its file and the GitHub-check report is in its own durable file. Without the env,
  stdout is unchanged. Tests in `quality-tasks.test.ts`.
- [ ] **AC7 Monitor submit stays in its log.** `executeStepWithArtifacts` runs
  `MONITOR_READY_SUBMIT_STEP_ID` through the split executor. The submit JSON line appears in the
  step's log under `.beep/yeet/runs/<branch>/logs/` and not on the console; the parent still prints
  `[yeet] readiness monitor job: <id>`. Test beside `yeet-artifact-writers.test.ts`.
- [ ] **AC8 One line for an unbuilt tree.** In a package whose referenced project lacks its
  declaration index, both `bun run check` and `beep-cli check` print exactly one line naming the
  count, the first missing output and the build-closure command, exit non-zero, and spawn no
  compiler. Fixture test; a built tree runs the check unchanged.
- [ ] **AC9 Cache policy holds.** `bun run beep cache audit` passes with the re-recorded baseline.
- [ ] **AC10 Packages verified.** `bun run beep quality package-verify` passes for every touched
  package (`@beep/repo-cli`, `@beep/cli-kit`, `@beep/runtime-env`, and `@beep/repo-cli-kit` when
  the script generator changes).
- [ ] No unrelated refactors or formatting churn.

Once `agent-output-census` lands, the closeout also cites its rows for this goal's window: test,
check and Yeet output characters per run, and the share of runs piped through a filter. The census
does not gate this goal.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/gate-output-switch-on/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/gate-output-switch-on/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/gate-output-switch-on` | Passes |
| AC1, AC3, AC4 argv, AC6, AC8 | `quality-tasks.test.ts` and the new pass-through test in `@beep/repo-cli` | Pass |
| AC2, AC4 measured | `turbo run test --filter=@beep/glob --only --force` and the task-path cache hit, piped to `wc -m`, numbers recorded in `history/` | Under 600 each |
| AC5 | Command-tree help test; `CliColor.test.ts` | Pass |
| AC7 | Yeet artifact-writer test | Passes |
| AC9 | `bun run beep cache audit` | Passes |
| AC10 | `bun run beep quality package-verify <@beep/package>` per touched package | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add gate-output-switch-on --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-output-switch-on`; add a `kind: decision` file there, never edit this block._

### The GitHub-check report's durable file sits beside the inner-lane report, 2026-11-18

Settles the open P0 point for fix 4. The report is appended to `github-check-runs.ndjson` in the directory that `BEEP_YEET_INNER_LANE_REPORT_PATH` names: no new environment variable, the same append-only one-line-per-battery format as the lane report, and each line carries `parentLaneId` so the writing proof step is known. Yeet deletes it with the lane report at the start of each attempt. No production code read either envelope from stdout; the issue classifier only filtered them out. The helper that rebuilt the stdout lane envelope from the file had no remaining caller and was removed with its two tests.

Lane fix/gate-output-quiet-surfaces

Reverse: Print the envelope to stdout again and drop the file-name constant and its delete in the Yeet handler.

### The durable file is the record; stdout does not repeat it, 2026-11-18

Where a gate already writes a durable record, its stdout carries no copy: the lane-run and GitHub-check envelopes stay in their files when the artifact path is set, and the readiness-monitor submit line stays in its step log. The GitHub-check report gains a durable file first, because only the lane-run report has one today. Ruling: explorations/agent-verification-output/DECISIONS.md, entry record-is-the-source.

Reverse: Print the lane and GitHub-check envelopes and the monitor submit line to stdout again

### Global flags print on root help through a formatter layer in the dispatch context, 2026-11-18

The CLI entry does not pass an environment to the runtime's main, so `globalFlags: "summary"` is provided as a formatter layer merged into the context the command program builds. Help colour now follows the shared colour decision in `@beep/cli-kit` instead of the core TTY check. The quality-task names (`check`, `test`, `lint`, `build`) are not commands, so their `--help` still shows root help with the full list.

Lane fix/gate-output-quiet-surfaces

Reverse: Remove the formatter layer from the dispatch context; every help page prints the five global flags again.

### Gates only: the fixes touch output of gates the repo owns, 2026-11-18

This goal changes only what repo-owned gates print: test, check, lint, build, docgen, quality, Yeet and CI logs. Output of commands an agent chooses for itself (rg, cat, git) and any wrapper around commands the repo does not own stay out of scope; that larger problem has its own exploration entry in explorations/INBOX.md. Ruling: explorations/agent-verification-output/DECISIONS.md, entry scope-gates-only.

Reverse: Widen SPEC.md Non-Goals to admit a wrapper around agent-chosen commands

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
