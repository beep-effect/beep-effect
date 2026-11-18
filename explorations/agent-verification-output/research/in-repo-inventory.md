# In-Repo Inventory: What Verification Prints Today

Dated 2026-11-18, read-only, against the `explore/agent-verification-output` worktree (head
`93c373f0ddb`). Every claim cites `path:line`. `node_modules/...` paths are the installed
packages in this checkout. `NOT FOUND` means searched for and absent.

Installed versions: vitest 5.1.0 (`node_modules/vitest/package.json`), std-env 4.3.0, turbo
2.11.11, effect 4.1.4, tsrs `0.25.0-ts7.1.0-beta` ("a Rust port of the TypeScript 7 compiler",
`node_modules/tsrs/package.json`).

## 1. How each gate runs and what it prints

### Dispatch shape

- Root scripts `test`, `check`, `lint`, `build` call `beep-cli <task>` (`package.json:347`, `:351`,
  `:384`, `:408`); `beep` is `bun run packages/tooling/tool/cli/src/bin.ts --` (`:345`).
- `build|check|test|lint|audit|coverage` are not `effect/cli` commands but a raw-argv quality-task
  path (`packages/tooling/tool/cli/src/internal/dispatch/Dispatch.manifest.ts:318`, predicate
  `.../Dispatch.ts:78-81`, run at `.../bin-main.ts:273-274`). Other arguments pass through to
  turbo; there is no `--quiet`, `--json` or `--format`. Inside a package directory the task runs
  that package's script (`runPackageTask`, `.../commands/Quality/Tasks.ts:5071-5108`); at the root
  it builds turbo steps.
- Every step prints a banner, `[beep-cli] <label>: <full command>`, then inherits stdio
  (`Tasks.ts:1653-1674`). A failure adds `[beep-cli] <label>: failed N step(s)` plus each exit
  code and command (`Tasks.ts:1676-1687`). Streaming groups also print
  `[beep-cli] <label>: ok|failed in Nms` (`Tasks.ts:2114`, `:2129`). Success has no closing
  verdict line.

### Test

- Package script `beep:test` = `bunx --bun vitest run`
  (`packages/foundation/primitive/data/package.json:27`; all scripts are generated). Root
  `runRootTestTask` runs `turbo run test`, then the integration lanes (`Tasks.ts:5111-5150`).
- 106 configs under `packages/*/*/` re-export `vitest.shared.ts` (for example
  `packages/agents/client/vitest.config.ts`), collected by the root `vitest.config.ts:10-17`.
  `vitest.shared.ts:278-379` sets no `reporters`, only coverage ones (`:361`: `text`, `html`,
  `lcov`, `json-summary`), and no package overrides them, so Vitest's defaults decide.
- Vitest 5.1.0 picks the reporter by agent detection. The defaults are `minimal` for an agent,
  else `default`, plus `github-actions` when `GITHUB_ACTIONS=true`
  (`node_modules/vitest/dist/chunks/defaults.B1FCaFfh.js:67`; watch is off for agents, `:53`).
  `agent` is a registered reporter name mapped to `MinimalReporter`
  (`.../chunks/cli-api.COfZo8lK.js:10655-10656`), exported as `AgentReporter` from `vitest/node`
  (`node_modules/vitest/dist/node.js:4`). `MinimalReporter` sets `summary: false` and
  `silent: "passed-only"` and prints only failed modules and tests (`cli-api.COfZo8lK.js:10498-10521`).
  For agents Vitest also drops colour (`.../chunks/index.Di8au7q4.js:4162`,
  `.../chunks/cac.BYbt0aJp.js:2255`) and gives `text` coverage `skipFull` plus a `text-summary`
  (`index.Di8au7q4.js:8933-8940`). `isAgent` is std-env 4.3.0's
  (`node_modules/std-env/dist/index.mjs:1`): `AI_AGENT` wins, then `CLAUDECODE`/`CLAUDE_CODE`,
  `CODEX_SANDBOX`/`CODEX_THREAD_ID`, `JUNIE_DATA`, `CURSOR_AGENT` and others.
- Likely gap, unverified: turbo `global.passThroughEnv` (`turbo.json:26-60`) passes through
  `CODEX_THREAD_ID` and `CLAUDE_CODE_*` but not `CLAUDECODE` or `AI_AGENT`, and the `test` task
  adds only two variables (`turbo.json:5477-5482`). Under Turbo's default strict env mode, a Claude
  shell running `beep test` may hand Vitest no agent marker, so Vitest falls back to the `default`
  reporter. That would explain the 3,206 `Tests N passed` lines in the audit
  (`transcript-audit.md:132-133`). This shell does set `CLAUDECODE` and `AI_AGENT`.
- CI coverage partitions pass `--reporter=default --reporter=json
  --outputFile=coverage/unit-results.json` (`.../commands/Ci/CiCoverage.ts:749-760`). They also
  pass a custom reporter (`CiCoverage.ts:494-495`; see section 2).

### Check (typecheck)

- Package: `beep:check` = `tsrs -p tsconfig.json --emitDeclarationOnly && bun run beep:check:tests`.
  `beep:check:tests` = `tsrs -p tsconfig.test.json --noEmit` (`.../primitive/data/package.json:22`,
  `:28`). No `--pretty false`, so output format follows TTY detection.
- Root: `rootCheckSteps` runs `turbo run check` (`turbo.json` `check` depends on `^build` and
  `build`), then `beep quality tsgo-smoke` (`Tasks.ts:3628-3648`). A flake quarantine for
  location-less TS2589 captures this step's output and tees it (`Tasks.ts:1729-1735`).
- `tsgo` is `node_modules/.bin/tsgo` → `tools/tsgo-shim` ("runs the exact compiler artifact
  shipped by @effect/tsgo"). Repo-CLI lanes call it with `--pretty false` where they parse output
  (`.../commands/Quality/CheckCensus.ts:416`, `.../commands/Laws/MarkdownFences.ts:569`).
  `check:configs` uses `tsrs ... --noEmit --pretty false` (`package.json:352`).

### Lint

- Package: `beep:lint` = `biome check .` (`.../primitive/data/package.json:25`). `biome.jsonc`
  sets no reporter or `maxDiagnostics`.
- Root: `rootLintStages` = `turbo run lint --continue=dependencies-successful` followed by policy
  stages (`Tasks.ts:4486-4498`). Policy stages are turbo steps with `--summarize`
  (`Tasks.ts:3653-3675`).
- `lint:oxlint` passes `--quiet` (`package.json:389`). `lint:deprecated-imports` uses biome
  `--reporter=summary` (`package.json:391`), the only root script with a summary reporter.
- `beep lint` has 24 subcommands (`package-scripts` … `tsconfig-overlay`; source
  `.../commands/Lint/Lint.command.ts`). Format flags are per command: `--json` exists in about 35
  command files, and `--quiet` only in `.../Quality/FallowQuality.command.ts`. No global
  `--format` exists.

### Build and docgen

- Build: package `beep:build` = `tsrs -p tsconfig.json --emitDeclarationOnly`
  (`.../primitive/data/package.json:21`); root `rootBuildSteps` → `turbo run build` (`Tasks.ts:3617`).
- Docgen: package `beep:docgen` = `bunx --bun --no-install docgen` (`.../data/package.json:23`,
  tool `packages/tooling/tool/docgen`). Root `docgen` / `docgen:local` = `beep docgen local
  [--full]` (`package.json:363-364`), with turbo args `--ui=stream --no-daemon` plus `--summarize`
  in CI only (`.../Docgen/internal/Local.ts:460-479`), printing `[docgen:local] <label>: started`
  and `exited N after T` banners (`Local.ts:751`, `:771`).

### Turbo

- `turbo.json:3` `"agentGuidance": false` stops Turbo 2.11.5+ writing an `AGENTS.md` under an
  agent shell (`packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts:158-160`).
  `turbo.json:10` `global.ui: "tui"` is overridden by `TURBO_UI=false` on every repo-CLI spawn
  (`packages/tooling/library/repo-cli-kit/src/cli/EnvConfig.ts:739-743`, `:793`, `:815`).
- `outputLogs`: NOT FOUND in `turbo.json` or the 27 package `turbo.json` files, so tasks print
  full logs and replay cache hits in full.
- Flags passed in code: `--output-logs=none` in `quality test-tsgo`
  (`.../Quality/Quality.command.ts:1875`); `--output-logs=errors-only`
  (`.../Cache/Cache.r2.live.ts:129`); `--output-logs=full --log-order=grouped --ui=stream`
  (`.../Cache/Cache.pilot.ts:1161-1164`). Yeet feedback lanes use `--concurrency=3
  --continue=dependencies-successful --summarize --ui=stream`
  (`.../Yeet/internal/Planner.ts:140-145`) with `TURBO_LOG_ORDER=stream` (`Planner.ts:466`), as
  does CI (`.github/actions/setup-monorepo-ci/action.yml:33`, `.../Ci/CiOperational.service.ts:491`).
- `--summarize` run summaries (`.turbo/runs/*.json`) are written by most root steps
  (`Tasks.ts:3401`, `:3667`, `:4700`).

### `beep quality package-verify`

Source `.../commands/Quality/internal/PackageVerify.ts`; the only flag is `--quick` (lint +
check). The check step first runs `bun x turbo run build --filter=<pkg>^...` (`:638-647`). The
renderer is the closest thing to a verdict today (`:933-955`): a header `pkg-verify <name> (<dir>)
[quick]`, then one line such as `ok lint 5.4s   fail check 9.1s`, then each failed step's full
captured output under `-------- <step> (failed) --------`, with no excerpt and no log pointer.
Results also go to the local-shard inbox (`:1006-1008`).

### `beep yeet`

Source root `packages/tooling/tool/cli/src/commands/Yeet/`.

- **Help.** Every subcommand carries a 25-flag shared block (`yeet --help`). `--json`'s shared
  description reads "Render plan output as JSON" even on `job wait` and `inbox`
  (`Yeet.command.ts:138`).
- **Steps.** `repair`, `verify`, `publish` and `open` run plan steps through
  `executeStepWithArtifacts`. Merged output streams live to the agent and is copied to
  `.beep/yeet/runs/<branch>/logs/<step>.log` (`internal/IssueArtifacts.ts:110-117`, `:160-183`).
  Every run writes `verdict.json` (`YeetVerdict`, `internal/Verdict.ts:644-683`; written at
  `internal/Handler.ts:2637-2644`) and `quality-issue-index.json` (`IssueArtifacts.ts:221-228`).
  The verdict sits on disk and its path is not printed as the run's last line. `--plan`, `--json`,
  `--collect-all` and `--no-fail-fast` apply.
- **`cheap-gates`.** This is a tier (`--tier cheap-gates`) and the command `beep quality
  github-checks cheap-gates` (`internal/FinalCheck.ts:462-465`). It is not a subcommand of
  `yeet`. Lanes print `[beep-cli] <label>: running lane <id>` (`Tasks.ts:2724`), stream their
  output, then print the one-line JSON envelope (section 8c).
- **`final-check`.** Each gate prints `[yeet] final-check <gate>: <command>` and runs with stdio
  inherited (`internal/FinalCheck.ts:1135-1141`). Then comes a summary of one line per step,
  `<status> <label> (<dur>): <hosted context>` (`FinalCheck.ts:1311-1322`), and
  `[yeet] final-check receipt: <file>` (`FinalCheck.ts:2036-2038`). Flags: `--gates`, `--skip`,
  `--dry-run`, `--fail-fast`, `--resume`, `--force-local`.
- **`publish` / `open` / `monitor`.** `publish` and `open` end with `[yeet] pull request: <url>`
  and `[yeet] readiness monitor job: <id>` plus `wait with:` (`Handler.ts:1366-1368`,
  `:1205-1206`, `:1394`). `monitor` ends with `[yeet] merge-ready: yes; …` or
  `[yeet] not merge-ready: blocked on …` (`internal/MonitorLoop.ts:1334-1336`); flags
  `--until-ready|--until-merged|--watch` (NDJSON)`|--until-event|--summary`.
- **`job wait`.** Prints `job <id>: <phase>`, `unit:`, `log:` and the wait command, or the encoded
  `ProofJobRecord` with `--json` (`Yeet.command.ts:968-979`, `:1098-1126`). Wave rows add one line
  from `renderYeetPrWaveLine` (`internal/InboxView.ts:702`). `job logs --tail N` defaults to 100
  lines (`Yeet.command.ts:1127-1141`).
- **Others.** `gate-table` prints tab-separated rows, or `yeet-gate-table/v1` with `--json`
  (`internal/GateTable.ts:597-654`, `:831-848`). `inbox` takes `--json`, `--severity
  all|P0|P1|P2` and `--unacked`, with `list|ack|append` (`Yeet.command.ts:1592-1622`).
  `economics --json` emits `yeet-economics/v4` (`internal/Economics.schemas.ts:1405`). `gh` runs
  REST-first PR, label, checks and rate-limit operations (`Gh.command.ts:72-177`).

## 2. Structured-output bricks that already exist

All under `packages/tooling/tool/cli/src/commands/` unless the path says otherwise.

| Brick | Path | Schema type |
| --- | --- | --- |
| Lane-run envelope `[beep-quality-task-lane-run] ` | prefix `Quality/Quality.schemas.ts:185`; emit `Quality/Tasks.ts:3171-3178` | `QualityTaskLaneRun` `:2206`, `QualityTaskLaneRunReport` `:2246` (`quality-task-lane-run/v1`) |
| Durable copy of the lane report | env `BEEP_YEET_INNER_LANE_REPORT_PATH` (`Quality.schemas.ts:201`), append `Tasks.ts:3109-3136`, read `Yeet/internal/InnerLaneReports.ts` | same |
| GitHub-check envelope `[beep-github-check-run] ` | prefix `Quality.schemas.ts:168`; emit `Tasks.ts:3199-3209` | `GithubCheckRunReport` `Quality.schemas.ts:2311` |
| Yeet run verdict | `.beep/yeet/runs/<branch>/verdict.json`, `Yeet/internal/Verdict.ts:644` | `YeetVerdict` (`yeet-verdict/v2`; lanes, repair commands, `failedStepId`) |
| Quality issue index + packets | `Yeet/internal/IssueArtifacts.ts:221-228`, parser `Yeet/internal/IssueParser.ts:37-38`, `:463` | `QualityIssueIndex` `Yeet/Yeet.schemas.ts:322` (`yeet-quality-issue-index/v1`) |
| Final-check receipt | `.beep/yeet/final-check/<head>.json`, `Yeet/internal/FinalCheck.ts:245` | `FinalCheckReceipt` `Yeet/internal/FinalCheck.schemas.ts:448` (`yeet-final-check/v2`) |
| P0 inbox | `.beep/inbox/failures.ndjson` + `acks/<id>` (`Yeet/internal/Inbox.ts:1-13`) | `YeetInboxRow` union `Inbox.ts:909`; view `YeetInboxView` `Yeet/internal/InboxView.ts:274` |
| Local-shard outcome (poison rows) | `Yeet/internal/LocalShardPoison.ts:46` | `YeetLocalShardOutcome` (command, exitCode, headSha, shard) |
| Attempt journal | `Yeet/internal/AttemptJournal.ts:68`, `:122`, `:158` | `yeet-attempt-journal/v1` events, carries `YeetVerdict` |
| Detached job records | `.beep/yeet/jobs/<id>.json` + `.log` (`Yeet/internal/ProofJob.ts:946`; root `Yeet/internal/ProofJobLauncher.ts:381`) | `ProofJobRecord` `ProofJob.ts:998` |
| `yeet economics` | `Yeet/internal/Economics.ts`, `Economics.schemas.ts:1405` | `yeet-economics/v4` report with attempt, lane and first-failure rows |
| Gate table | `Yeet/internal/GateTable.ts:324`, `:359`, `:386` | `GateTableEntry`, `GateTableReport` (`yeet-gate-table/v1`) |
| Flake quarantine incidents | `Quality/internal/FlakeQuarantine.ts:214` | `yeet-flake-quarantine/v1` |
| `.beep/ci` artifacts | jsdoc inventory `Ci/CiLane.ts:112`; coverage roots `Ci/CiCoverage.ts:471`, `:720` | per-artifact schemas |
| Per-task outcome records | `beep ci task-outcomes` → `.beep/ci-task-outcomes/record.json` (`.github/workflows/check.yml:418`), `Ci/CiTaskOutcomes.ts:93-95` | `TaskOutcomeRecord` (`task-outcomes/v1`); hosted read `HostedTaskOutcome` `Ci/Route.schemas.ts:590` |
| CI coverage reporter (an in-repo Vitest `Reporter`) | `Ci/CiCoverage.reporter.ts:75-120`, wired by `--reporter=<path>` (`Ci/CiCoverage.ts:494-495`) | writes `CoverageRuntimeReceipt` `Quality/internal/CoverageArtifacts.schemas.ts:248` (`coverage-runtime/v1`) |
| Turbo summary → step summary | `Ci/Ci.command.ts:166-175`, `:299-305` (`beep ci append-turbo-summary`) | reads `.turbo/runs/*.json` |
| Observability catalog | `Observability/Observability.command.ts:1-3`, `Observability.schemas.ts:362`, `:409` | `InstrumentationCatalogDocument`, `InstrumentationCatalogShard` |
| CI-log failure isolator | `Yeet/internal/MonitorLoop.ts:326` (`stripYeetMonitorLogDecoration`), `:441` (`isolateYeetMonitorJobLogFailure`), `:1042-1080` | none (string → `Option<string>` region) |
| Output bound | `packages/tooling/library/repo-cli-kit/src/process/StepExec.ts:314-318` | `OutputBound` (512 KiB, head-tail retention) |
| Audience-aware document IR | `packages/foundation/capability/cli-kit/src/Doc.ts:1234`, `Render.ts:1-2` | renders `plain` for agents and `githubLog` for CI |
| Palantiri parcels (agent summaries) | `packages/tooling/library/palantiri`, MCP `commands/Palantiri/Palantiri.tools.ts:1-2` | schema-typed, freshness-checked parcels |

## 3. Environment detection that already exists

- **Agent, in a library.** `@beep/runtime-env` copies std-env 4.3.0's agent table in order
  (`packages/foundation/capability/runtime-env/src/internal/agentCi.ts:1`, `:78-83`). `AI_AGENT`
  wins and is folded to its family (`agentCi.ts:108-120`). The `AudienceKind` literal domain is
  `human|agent|ci` (`.../runtime-env/src/Audience.ts:43`). `@beep/cli-kit` adds
  `--audience/--agent/--human/--ci` flags
  (`packages/foundation/capability/cli-kit/src/CliAudience.ts:300-305`). The repo CLI does not use
  them: nothing under `packages/tooling/tool/cli/src` imports `CliAudience`, and only 9 files
  import `@beep/cli-kit` at all (mostly `Fmt`, `CliRuntime`).
- **Agent, ad hoc in the repo CLI.** `CODEX_THREAD_ID` and `CLAUDE_CODE_*` are read for
  attribution, not output shape: `.../Yeet/internal/Provenance.ts:1325-1329`, `:1460`;
  `.../Yeet/internal/AttemptJournal.ts:391-412`; `.../Session/SessionLedger.service.ts:321`;
  `.../Session/Presence.service.ts:297`; `.../Drawings/Drawings.critics.ts:121-122`;
  `.../Palantiri/Palantiri.runtime.ts:117`;
  `packages/tooling/library/ai-metrics/src/internal/cowork-hook-source.ts:10`. `gh` 2.105 prints
  advice when `AI_AGENT`/`CLAUDECODE` is set, and stdout is now read apart from it
  (`.../internal/github/GhCommand.ts:78`, `.../internal/repo-run/RepoRun.executor.ts:209`).
- **Agent, third party.** Vitest via std-env (section 1). Turbo's binary contains `AI_AGENT` and
  `CLAUDECODE` (`node_modules/@turbo/linux-64/bin/turbo`) for `agentGuidance`.
- **CI.** `RuntimeEnv.ci` (`.../runtime-env/src/RuntimeEnv.ts:76`); `Config.Boolean("CI")` in
  `packages/tooling/test-kit/test-runner/src/internal/VitestInstrumentation.ts:28` and
  `packages/tooling/infra/infra-hosts/src/HostsStage.ts:110`;
  `packages/tooling/library/repo-workspaces/src/PackedInstall.ts:2321`. `GITHUB_STEP_SUMMARY`
  doubles as an "on a runner" probe (`.../Ci/Ci.command.ts:170`, `.../Quality/CheckCensus.ts:989`,
  `.../Ci/CiRerunRunnerLoss.ts:449`).
- **TTY.** `.../tool/cli/src/bin-main.ts:105-115` (terminal restore);
  `.../repo-cli-kit/src/cli/Progress.ts:56` (progress only on a TTY);
  `.../repo-cli-kit/src/cli/Stdin.ts:79`. Colour level is `@beep/runtime-env` `ColorLevel.ts`,
  delegated to by `@beep/chalk`
  (`packages/foundation/capability/chalk/src/internal/SupportsColor.ts:229-253`).
- **Compute profile.** `packages/tooling/tool/cli/src/internal/repo-run/ComputeProfile.ts:1-8`
  (memory ceiling, with a `BEEP_COMPUTE_PROFILE` override that can only tighten to `worker`).
  Resolve at `ComputeProfile.ts:227`, `:285`. Used by the scheduler
  (`.../repo-run/QualityScheduler.ts:3651-3657`) and by `yeet open`/`publish` posture
  (`.../Yeet/Yeet.command.ts:878-890`).

## 4. GitHub Actions

- 32 workflows in `.github/workflows/`, chiefly `check.yml` (2,579 lines) and `heavy.yml` (992),
  plus 3 composite actions (`fetch-beep-ci`, `setup-bun`, `setup-monorepo-ci`). Job logs are raw
  streams of `bun run beep ci lane ...` and turbo with `TURBO_LOG_ORDER=stream`
  (`.github/actions/setup-monorepo-ci/action.yml:33`). Vitest adds its `github-actions` reporter
  when `GITHUB_ACTIONS=true` (`defaults.B1FCaFfh.js:67`), which turbo passes through (`turbo.json:46`).
- Step summaries: `beep ci append-turbo-summary` after each test or lint job
  (`.github/workflows/check.yml:639-641`, `:766-768`, `:1152-1154`, `:1363-1365`, `:1866-1868`).
  Other sources are a Fallow summary in `jq` (`check.yml:2039-2051`), the check-census gate table
  (`.../Quality/CheckCensus.ts:986-998`), the rerun decision (`.../Ci/CiRerunRunnerLoss.ts:432`),
  and the writer `.../Ci/CiRunnerOutputs.ts:29`. By file, `GITHUB_STEP_SUMMARY` appears 6 times in
  `beep-ci-binary.yml`, 3 in `catalog-regeneration.yml` and 2 in `check.yml`.
- Annotations: hand-written `::error::` in `.../Ci/DependencyReviewCommand.ts:60`, `:68` and
  `.../Ci/CiCachePilotHost.ts:174`, `:251`, plus 69 `::error|::warning|::group` lines in
  workflows and actions (19 in `release-desktop.yml`). Typed helpers exist:
  `GithubAnnotation.format` (`packages/foundation/capability/cli-kit/src/GithubAnnotation.ts:131-140`)
  and `@beep/github-commands` (`packages/foundation/modeling/github-commands/src/WorkflowCommand.ts`),
  used in `Ci/CiLanePartitions.ts`, `Ci/CiOperational.service.ts`, `Quality/internal/CoverageScope.ts`.
- Problem matchers: NOT FOUND (no `add-matcher` or `problemMatcher` under `.github/`).
- Documented log fetch for agents: `gh api --allow-escape-sequences
  repos/<o>/<r>/actions/jobs/<id>/logs` (`.claude/skills/yeet/references/gh-rest.md:65-71`;
  `AGENTS.md:299-300`). That is the raw whole-job log with no filter. The monitor already does
  better internally: `gh run view --job <id> --log-failed`, then the REST endpoint cut down by
  `isolateYeetMonitorJobLogFailure` (`.../Yeet/internal/MonitorLoop.ts:1042-1080`). No `beep`
  command exposes that excerpt to agents: NOT FOUND.

## 5. Effected ports already in the repo

30 packages carry `## Provenance` / `### Attribution` sections; each README's "Upstream package"
line names the `@effected/*` source and its version at port time. The ports that vitest-agent
needs are in the next table. The rest:

| Package | Path | Upstream @ port |
| --- | --- | --- |
| `@beep/github`, `@beep/github-actions` | `packages/drivers/github`, `packages/drivers/github-actions` | `github` 0.15.1 (README:395), `github-actions` 0.20.0 (README:281) |
| `@beep/github-commands`, `-references`, `-reporting` | `packages/foundation/modeling/github-*` | `github-commands` 0.1.0, `github-references` 0.7.0, `github-actions` 0.20.0 |
| `@beep/jsonl`, `@beep/lockfiles`, `@beep/managed-section`, `@beep/markdown` | `packages/foundation/modeling/*` | `jsonl` 0.9.0, `lockfiles` 0.15.0, `templates` 0.10.0, `markdown` 0.15.1 |
| `@beep/npm-spec`, `@beep/sbom`, `@beep/schema-org`, `@beep/semver`, `@beep/spdx`, `@beep/tsconfig` | `packages/foundation/modeling/*` | `npm` 0.20.0, `sbom` 0.10.0, `schema-org` 0.7.0, `semver` 0.11.0, `spdx` 0.11.0, `tsconfig-json` 0.13.0 |
| `@beep/repo-tsconfig` | `packages/tooling/library/repo-tsconfig` | `tsconfig-json` 0.13.0 (loader half, README:112) |

### The kits vitest-agent depends on

Deps from `.repos/vitest-agent/packages/*/package.json`, all `catalog:effected:exact`. Current
upstream versions are from `.repos/effected/packages/*/package.json`.

| Kit | Status | In-repo home / concept match | Port → now |
| --- | --- | --- | --- |
| walker | FOUND | `@beep/walker`, `packages/foundation/capability/walker` (README:101) | 0.15.0 → 0.25.1 |
| glob | FOUND | `@beep/glob`, `packages/foundation/modeling/glob` (README:155) | 0.10.0 → 0.19.0 |
| workspaces | FOUND | `@beep/repo-workspaces`, `packages/tooling/library/repo-workspaces` (README:448) | 0.32.0 → 0.43.0 |
| env | FOUND | `@beep/runtime-env`, `packages/foundation/capability/runtime-env` (README:108) | 0.1.0 → 0.11.0 |
| cli-kit | FOUND, ported from `@effected/cli` | `@beep/cli-kit`, `packages/foundation/capability/cli-kit` (README:244) | cli 0.13.0 → cli-kit 0.27.0 |
| memfs | FOUND, but kind `test-kit` | `@beep/memfs`, `packages/tooling/test-kit/memfs` (README:378) | 0.14.0 → 0.24.0 |
| kit | NOT FOUND | "distribution identity, remediation, launch context, crash guards": no package | — → 0.13.0 |
| commands | FOUND | `@beep/commands`, `packages/drivers/commands` (README:96) | 0.11.0 → 0.20.0 |
| git | FOUND | `@beep/git`, `packages/drivers/git` (README:181) | 0.20.0 → 0.30.0 |
| config-file | FOUND | `@beep/config-file`, `packages/foundation/capability/config-file` (README:301) | 0.14.2 → 0.25.0 |
| yaml | FOUND | `@beep/yaml`, `packages/foundation/modeling/yaml` (README:217) | 0.19.1 → 0.29.0 |
| xdg | FOUND | `@beep/xdg`, `packages/foundation/capability/xdg` (README:203) | 0.9.0 → 0.19.1 |
| toml | FOUND | `@beep/toml`, `packages/foundation/modeling/toml` (README:156) | 0.11.1 → 0.19.1 |
| store | NOT FOUND | concept only: driver `@beep/sqlite` (`packages/drivers/sqlite`, `@effect/sql-sqlite-bun`); `@beep/agent-memory-store` (`packages/tooling/library/agent-memory-store`, append-only log on `@beep/sqlite`); `Goals/Graph.sqlite.ts` | — → 0.24.0 |
| plugin | NOT FOUND | the effected CLI+MCP install bundle; no counterpart needed | — → 0.2.0 |
| package-json | FOUND | `@beep/package-json`, `packages/foundation/modeling/package-json` (README:309) | 0.20.0 → 0.30.0 |
| mcp-kit | NOT FOUND as a port | `@beep/mcp-kit` (`packages/foundation/capability/mcp-kit`) is an in-repo MCP host kit with a different API (credential-keyed toolkits, tier gates); effected `engine` was deferred to fold into it (archived SPEC D-05) | — → 0.14.0 |
| jsonc | FOUND | `@beep/jsonc`, `packages/foundation/modeling/jsonc` (README:247) | 0.15.1 → 0.24.0 |
| app | NOT FOUND | concept pieces exist: `@beep/xdg` + `@beep/config-file` + `@beep/sqlite`; no layer wires them together | — → 0.31.1 |

Every FOUND port is about 10 minor versions behind the kit vitest-agent pins. The port commit is
`af7566a9da2` (for example `packages/foundation/capability/walker/README.md:102`), while
`.repos/effected` HEAD is `eaad1d451d4`. The ports were also reshaped on promotion, with branded
`S.Opaque` options and renamed modules (`.../walker/README.md:107`), so vitest-agent call sites will
not compile against them unchanged.

### Attribution precedent

- **`LICENSE`:** MIT with two copyright lines, "2026 beep-effect" and "2026 C. Spencer Beggs"
  (`packages/foundation/capability/walker/LICENSE:1-4`; the same in all 30). Required by the
  archived SPEC (`.repos/goals-archive/goals/effected-promotion/SPEC.md:68-69`).
- **README:** a `## Provenance` paragraph (source, promotion wave, identity re-key) and a
  `### Attribution` list (upstream package and version, upstream commit plus reference checkout,
  license link) (`.../walker/README.md:95-111`). Deviations go in "Port notes" (`SPEC.md:65-67`).
- **Not used:** `NOTICE` files (NOT FOUND), per-file source headers (`src/Walker.ts:1-13` has
  none), and an effected row in `THIRD_PARTY_NOTICES.md` (NOT FOUND; it lists Free Law Project
  material only). `.repos/vitest-agent/LICENSE:1-3` is MIT by the same author, so the same
  pattern applies.

### Porting procedure the effected goal used

Paths are relative to `.repos/goals-archive/goals/effected-promotion/`.

1. Lab first: the kit was copied into `scratchpad/effected/<module>` on a `@lab/effected` branch,
   published 2026-10-09 (`history/lab-archive/CACHE_BASELINE_REVIEW.md:1-14`). Each module was
   ported to repo law with review rounds archived under `history/port-reviews/<module>/`
   (29 modules) and canon-exception files (`SPEC.md:17-18`, D-18).
2. P0 research: map every module to a package home under the family ceilings, sweep for reuse
   sites, record decisions D-01..D-18 (`PLAN.md:9-11`; `research/promotion-map-2026-10-20.md`).
3. Promote in topological waves, one PR per wave, each package via `bun run beep create-package`.
   A promotion script moves `src`/`test`, rewrites imports, re-keys identities and derives the
   manifest dependencies (`PLAN.md:23-60`, `:182-189`).
4. Capability packages land only with two or more named importers (`SPEC.md:63-64`). Promotion is
   behaviour-preserving; tests are retargeted, never weakened (`SPEC.md:65-67`).
5. Differential oracles against upstream or conformance suites (`ops/*-differential.ts`). Check
   expected values, not only byte parity (headline finding, `goals/effected-promotion/README.md`).
6. Adoption PRs then retire the duplicates ("one owner per concept"). Verification: `quality
   package-verify` per package plus `lint identity-registry` (`PLAN.md:194-202`).

## 6. Where new packages would live

Rules, all from `standards/ARCHITECTURE.md`:

- Families: foundation `primitive|modeling|capability|ui-system`, drivers, tooling
  `library|tool|policy-pack|test-kit|infra`, ecosystem (`:866-871`). Route specific homes first:
  external engines go to `drivers`, repo operations to `tooling` (`:877-886`). The capability gate
  requires no product semantics, no wrapped external engine, nothing repo-operational, and
  multiple real consumers (`:888-896`).
- Names: `@beep/repo-<purpose>` for tooling libraries and test kits, `@beep/beep-<group>` for
  command tools composed by `@beep/beep` (`:930-935`, `:1045-1048`). No `@beep/beep` package
  exists yet (NOT FOUND); `beep` is still `@beep/repo-cli`.
- Ceilings: `tooling/library` may depend on foundation and `tooling/library` only, `test-kit` also
  on `policy-pack` and `test-kit` (`:1037-1043`). Tools never import tools (`:1045-1047`). Tooling
  may take a driver only as a narrow operational adapter (`:1050-1055`). Ecosystem members carry
  no `@beep/*` runtime dependency (`:1057-1066`). `.mcp.ts` is a slice host role (`:472`).

Candidate homes (not decided):

- **(a) Reporter / output-contract library.** A `tooling/library` `@beep/repo-<purpose>`, next to
  `@beep/repo-cli-kit`, which already holds process steps, output bounds and artifacts
  (`packages/tooling/library/repo-cli-kit`). Pure verdict schemas could sit in `foundation/modeling`,
  as `@beep/github-reporting` does for check documents. Or extend the already audience-aware
  `@beep/cli-kit` (`foundation/capability`), which has to pass the multiple-consumer gate.
- **(b) Run-history store.** A `tooling/library` on driver `@beep/sqlite`, the
  `@beep/agent-memory-store` precedent. A ported `store` kit wraps SQLite, an external engine, so
  it fails the capability gate and lands in `drivers` or a tooling library plus a driver.
- **(c) Vitest plugin / reporter.** `tooling/test-kit`, the `@beep/test-runner` precedent
  ("instrumented Effect Vitest runner", `packages/tooling/test-kit/test-runner`). `ecosystem` only
  works by dropping every `@beep/*` runtime dependency, which rules out reusing the ported kits.
- **(d) MCP server.** A repo-CLI subcommand, as `beep palantiri mcp` does on stdio with
  `@beep/mcp-kit` and `effect/ai/McpServer`
  (`packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.tools.ts:1-13`); a thin driver host
  (`packages/drivers/uspto-mcp`); or an app (`apps/practice-kg-mcp`).
- Ceiling trap: vitest-agent's `engine` depends on `@effected/memfs` at runtime
  (`.repos/vitest-agent/packages/engine/package.json`, used in `src/stores.ts`). In-repo
  `@beep/memfs` is kind `test-kit`, which a `tooling/library` may not depend on (`:1039`).

## 7. Guidance that shapes agents' output habits

- **SessionStart hooks** (`.claude/settings.json:180` onward, each gated on
  `$CLAUDE_PROJECT_DIR/.claude/hooks`): `scripts/cloud/bootstrap.sh` (no-op locally);
  `.claude/hooks/packet-projections.sh`, which runs `beep goals index --write` and
  `beep explore atlas --write` into `/dev/null` and prints nothing (`packet-projections.sh:9-10`);
  `.claude/hooks/yeet-inbox.sh claude` for inbox context, never GitHub (`yeet-inbox.sh:2-5`);
  `.claude/hooks/hook-pulse.sh`; and `.claude/hooks/session-ledger.sh`, which prints live
  session-ledger rows and `[palantiri] hot parcels as of …` lines (`session-ledger.sh:1-27`).
  Codex has its own `.codex/hooks.json` with a `SessionStart` key.
- **The "repo operating manual" that recommends `zsh -ic`** is not repo content: `rg` finds
  "operating manual" nowhere in the checkout. It is the TokenEconomizer plugin's learned
  injection, headed `# repo operating manual (<repo>) — learned from …` (`distiller.py:741-744`
  under `~/.claude/plugins/cache/tokeneconomizer/tokeneconomizer/0.1.0/lib/tokeneconomizer/microskills/`).
  Its facts live in `~/.tokeneconomizer/repos/beep-effect-47ed120ba1/_shared/injection.json`.
  They include "run `zsh -ic 'bun install --frozen-lockfile'`, then … `zsh -ic 'bunx turbo run
  build --filter="@beep/<pkg>^..."'`" for fresh worktrees, and a fact about `zsh -ic` printing
  gitstatus errors. This contradicts `~/.claude/rules/machine.md` ("Do not wrap routine
  development commands in `zsh -ic`").
- **`AGENTS.md` gate lines.** Yeet is the canonical path, with `job wait` (`AGENTS.md:247-262`);
  the 10-minute local-compute rule and `final-check --skip` (`:270-284`); detached proofs
  (`:285-288`); `docgen:local` for edit loops (`:293-295`); attribute failures before repairing
  (`:296-298`); read red job logs through REST at once (`:299-300`); block on the readiness
  monitor until `merge-ready: yes` (`:333-340`); run `quality package-verify` before handing work
  back (`:346-350`). Nothing says how to read gate output or forbids `tail`/`grep`: NOT FOUND.
- **Skills.** `.claude/skills/yeet/references/run-artifacts.md:6`, `:13` point at `verdict.json`
  and the issue index; `.../yeet/references/failure-handling.md:92-104` says to prefer the
  verdict's `repairCommand` over rerunning; `.../yeet/references/detached-jobs.md:20` gives
  `job logs <id> --tail 100`. `.claude/skills/orchestrate/SKILL.md:302-306` polls
  `yeet gate-table` every 240 s in a `while true` loop read through `journalctl`, and
  `SKILL.md:145-146` names it one of only two tables the orchestrator reads directly.

## 8. Four defects to locate

**(a) TS6305 cascade.**
- Producer: a package-local typecheck in a fresh worktree whose upstream `dist/` is unbuilt.
  `tsrs -p` (not `-b`) plus `composite`/`incremental` project references
  (`tsconfig.base.json:7-12`) fails once per missing upstream output. This is intended:
  "`tsc -p` … fails loud (TS6305) when an upstream dist is missing"
  (`packages/tooling/tool/cli/test/single-project-emit.test.ts:22-23`).
- Entry points that skip `^build`: `bun run check` (or `beep-cli check`) inside a package, which
  `runPackageTask` turns into `bun run beep:check` (`Tasks.ts:5071-5108`); `beep:check:tests`; and
  ad-hoc `tsgo -p tsconfig.check.json`
  (`goals/compute-profile-gate-routing/research/2026-11-13-worker-host-acceptance.md:355`). Root
  `turbo run check` is safe (`check` depends on `^build`), and so is `package-verify`, which runs
  a `build-closure` step first (`PackageVerify.ts:638-647`).
- Guard to reuse: `assertCheckCensusTreeBuilt` (`.../Quality/CheckCensus.ts:575-606`), a
  filesystem-only check of each referenced project's `<outDir>/index.d.ts` that "runs before any
  compiler spawns". Smallest fix: in `runPackageTask` for `check`, run package-verify's
  build-closure step, or run that probe and print one line (`N upstream declaration outputs
  missing (first: …); run bun run beep quality package-verify <pkg>`) instead of spawning. Fallback:
  fold a failed check's TS6305 lines into one count line.

**(b) Global-flag boilerplate on every `--help`.**
- The module is now `effect/cli` (`node_modules/effect/src/cli/`), not the former unstable CLI path. Its
  five built-ins (`Help, Version, Wizard, Completions, LogLevel`,
  `node_modules/effect/src/cli/GlobalFlag.ts:323-330`) render on every subcommand's help, as
  `yeet --help` and `yeet monitor --help` show.
- Suppressible in 4.1.4: `CliOutput.defaultFormatter({ globalFlags: "summary" | "none" })`
  (`.../cli/CliOutput.ts:453-466`, `:550-551`); `"summary"` prints
  `Run '<root> --help' for global flags` instead (`CliOutput.ts:818-819`). The repo never sets it:
  `bin-main.ts:158-162` passes no `env` to `CliRuntime.main`, so core's default formatter applies,
  and the kit layer builds `defaultFormatter({ colors })` only
  (`packages/foundation/capability/cli-kit/src/CliColor.ts:102-108`).
- Smallest fix: accept formatter options in `CliColor.formatterLayer` (or provide
  `CliOutput.layer(CliOutput.defaultFormatter({ globalFlags: "summary" }))`) around the program
  in `bin-main.ts`. Root help keeps the full list.

**(c) Single-line JSON envelopes on stdout.**
1. *Readiness-monitor submit.* `publish`/`open` run the step `bun run beep yeet monitor
   --until-ready --detach --json` (`Yeet/internal/Planner.ts:764`, `:768-774`). The step streams
   merged output live (`IssueArtifacts.ts:177-180`), so the child's `renderJob(record, true)` JSON
   line (`Yeet.command.ts:968-974`, `:1033`) reaches the agent. The parent then decodes that same
   last line (`Handler.ts:1481-1486`) and prints a human version (`Handler.ts:1205-1206`, `:1394`).
   Smallest fix: run `MONITOR_READY_SUBMIT_STEP_ID` (`Planner.ts:742`) through the split,
   non-streaming executor already used for `MONITOR_CONTEXT_STEP_ID` (`IssueArtifacts.ts:179`),
   so the line stays in the step log only.
2. *Lane envelopes.* `[beep-quality-task-lane-run]` and `[beep-github-check-run]` are always
   `Console.log`ged (`Tasks.ts:3177`, `:3209`). Inside Yeet each lane report is also appended to
   `BEEP_YEET_INNER_LANE_REPORT_PATH` (`Tasks.ts:3109-3136`; set at `Handler.ts:2859-2860`), and
   Yeet's issue classifier filters the prefixes back out as noise
   (`Yeet/internal/IssueClassification.ts:556`, `:587`). No production code parses them from
   stdout; only tests reference them (`test/yeet*.test.ts`). Smallest fix: skip the stdout line
   when the artifact path env is set, and print a one-line human verdict instead.

**(d) `yeet gate-table` rows polled repeatedly.**
- `renderGateTableReport` reprints a header plus every open PR on each call
  (`Yeet/internal/GateTable.ts:646-654`), and `window=` shows remaining minutes
  (`GateTable.ts:549-558`), so every row changes on every poll. The orchestrate skill runs it every
  240 s forever (`.claude/skills/orchestrate/SKILL.md:302-306`).
- Smallest fix: a `--changed` (delta) mode. Persist the last `GateTableReport` under the Yeet
  state root, already JSON-codable (`GateTable.ts:386`), and print only rows whose
  verdict-bearing cells changed (draft, mergeable, ok, threads, RED, PENDING, GATE-MET, HOLD).
  Leave `window` out of the diff and render it as `open|ok`. Alternatively a `--met-only` filter.
  An unchanged table prints just `# gate-table <ts>: no change (N open, M GATE-MET)`.
