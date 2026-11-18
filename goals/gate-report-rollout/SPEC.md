# Gate Report Rollout Spec

## Objective

Put every remaining gate on the gate-report contract, make Yeet read gate reports instead of
streams, and remove the reasons agents poll: a heartbeat on long gates and a block-until-changed
mode on the status commands.

`gate-report-core` builds the gate report (gate > unit > item), the gate-run services (recorder,
agent and terminal console projections) and the first two gates, `test` and `check`. This goal
puts every other gate the repo owns on the same report: each lint, build, docgen and repo-law
lane, and the aggregates that run them (`quality package-verify`, Yeet `final-check`,
`cheap-gates`, `publish`). Yeet's own records stop parsing streams and read gate reports. Long
gates print a heartbeat. The gate table, `job wait` and the readiness monitor gain a mode that
blocks until state changes and prints only what changed. Agent guidance then says gates are read
whole.

The design is settled in the exploration: `explorations/agent-verification-output/BRIEF.md` (the
console contract and its ten laws), `explorations/agent-verification-output/MAP.md` (candidate 5)
and `explorations/agent-verification-output/DECISIONS.md` (`core-enhancements`,
`scope-gates-only`).

## Non-Goals

- The report model, the renderer, the Vitest adapter, the tsgo adapter and the `test` and `check`
  wiring. `gate-report-core` owns them; this goal consumes them.
- History labels and the fix-loop delta (`gate-run-history`).
- The CI projection, report upload and the CI-log command (`ci-gate-reports`).
- The five located fixes of `gate-output-switch-on` (Turbo agent pass-through, errors-only task
  logs, `--help` global flags, lane envelopes on stdout, the monitor submit line).
- Output of commands an agent chooses for itself (`rg`, `cat`, `git`): decision `scope-gates-only`.
- A wrapper around tools the repo does not run as a gate.

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

All repo CLI paths are under `packages/tooling/tool/cli/src/commands/`.

- Lane catalog: `Quality/internal/GithubChecks.ts` (every `githubCheckLane` call,
  `githubCheckFallowLanes`, `githubCheckLanesForModeForTesting`) and `GithubCheckLaneSpec` in
  `Quality/Quality.schemas.ts`.
- Quality task path: `Quality/Tasks.ts` (`runQualityTaskStreamingStepGroup`, the lane-report emit)
  and `QUALITY_TASK_NAMES` in `packages/tooling/tool/cli/src/internal/dispatch/Dispatch.manifest.ts`.
- CI lanes run locally: `CI_LANE_ID_VALUES` and the lane bodies in `Ci/CiLane.ts`.
- Repo-owned lint lanes and their typed findings: `Lint/`, `Laws/` (for example
  `PrivateHomePathFinding` in `Laws/PrivateHomePaths.model.ts`, `MarkdownFenceDiagnostic` in
  `Laws/MarkdownFences.model.ts`).
- Docgen: `Docgen/internal/Local.ts`.
- Aggregates: `Quality/internal/PackageVerify.ts` (`renderPackageVerifyReportForTesting`),
  `Yeet/internal/FinalCheck.ts` and `FinalCheckGate` in `Yeet/internal/FinalCheck.schemas.ts`.
- Yeet consumers: `YeetVerdict` and `YeetVerdictLane` in `Yeet/internal/Verdict.ts`;
  `QualityIssueIndex` in `Yeet/Yeet.schemas.ts`; `qualityIssuesFromStepResult` in
  `Yeet/internal/IssueParser.ts`; `executeStepWithArtifacts` in `Yeet/internal/IssueArtifacts.ts`;
  `Yeet/internal/QualityIssueIndex.ts`; `readInnerLaneReports` in
  `Yeet/internal/InnerLaneReports.ts`; `QualityTaskLaneRunReport` in `Quality/Quality.schemas.ts`.
- Status commands: `GateTableReport`, `renderGateTableReport` and `runYeetGateTable` in
  `Yeet/internal/GateTable.ts`; `ProofJobWaitOptions` in `Yeet/internal/ProofJob.ts` and the
  `wait` command in `Yeet/Yeet.command.ts`; `reportMonitorObservation` in
  `Yeet/internal/MonitorLoop.ts` and `renderYeetStatusSummary` in `Yeet/internal/Status.ts`.
- The gate-run services and the planned `gate` command family from `gate-report-core`.
- Guidance: `AGENTS.md`, `.claude/skills/yeet/SKILL.md` and its `references/`,
  `.claude/skills/orchestrate/SKILL.md`.

## The gates, by adapter kind

The live lane catalog at this checkout holds 55 lane ids across the `cheap-gates` and `pre-push`
tiers (static count of `githubCheckLane` calls in `Quality/internal/GithubChecks.ts`), plus 24
`CiLaneId` values and the six root task names (`build`, `check`, `test`, `lint`, `audit`,
`coverage`). The conformance test reads the catalog at run time; this table is the design.

| Kind | Unit > item | Gates |
| --- | --- | --- |
| Test-shaped | package > file > test case | `quality:test-unit`, `quality:test-integration`, `quality:coverage`, `quality:doctest`, `quality:desktop-ipc`, `quality:storybook`; CI lanes `test-unit`, `test-integration`, `coverage`, `doctest`, `desktop-ipc`, `storybook`, `property`; root `test`, `coverage` |
| Diagnostic-shaped, third-party tool | package > file > diagnostic | `quality:lint` and CI lane `lint` (Biome under Turbo), `lint:oxlint`, `quality:check` and CI lane `check` (tsgo under Turbo), `repo-sanity:config-typecheck`, `repo-sanity:goals-ops-typecheck` (tsgo text), `fallow:audit`, `fallow:dead-code`, `fallow:health`, `repo-sanity:syncpack`, `repo-sanity:sherif`, `quality:commitlint`, `quality:secrets`, `quality:security`, `quality:sast`, `repo-sanity:bun-audit` |
| Diagnostic-shaped, repo-owned | rule > file > finding | every `lint:*` lane (`effect-imports`, `effect-imports-markdown`, `markdown-fences`, `retired-effect-paths`, `entity-kit-freeze`, `retired-iri-authorities`, `private-home-paths`, `tracked-shell-allowlist`, `no-tracked-python`, `schema-tag-idioms`, `holds`, `schema-first`, `effect-vitest`, `allowlist`, `schema-catalog`), `goals:doctor`, `goals:index-check`, `explore:atlas-check`, `observability:catalog-check`, `version-sync:check-runtime`, `repo-sanity:versions`, `repo-sanity:tsconfig-sync`, `repo-sanity:changeset-graph`, `repo-sanity:fallow-boundaries-config`, `quality:changeset-status`, `quality:cache-policy`, `quality:catalog-usage`, `quality:jsdoc-ratchet`, `quality:jsdoc-ratchet:regenerated`, `quality:docgen`; CI lanes `docgen`, `jsdoc-ratchet`, `commitlint`, `secrets`, `security`, `sast`; root `audit` |
| Build-shaped | package task > diagnostic | `quality:build`, `quality:codegen`, `quality:nix`; CI lanes `build`, `codegen`, `nix`; root `build` |
| Aggregate | gate > child gate | `quality:lint-policy`; CI lanes `lint-policy`, `docs-policy`, `repo-sanity`, `labs`, `ecosystem`, `fallow`; root `lint`; `bun run beep quality package-verify`; `bun run beep yeet final-check` (the `FinalCheckGate` set); `bun run beep quality github-checks cheap-gates`; Yeet `verify`, `repair` and `publish` |

An aggregate's report is the fold of its children's reports: one unit per child gate, each child's
items under it, totals summed by the model's rules. An aggregate never re-parses a child's
stream.

## Machine formats the tools already emit

Adapters read a machine format wherever the tool offers one. Installed versions at this checkout:

| Tool | Installed | Machine output | Adapter input |
| --- | --- | --- | --- |
| Biome | `@biomejs/biome` 2.5.6 | `--reporter=` `json`, `json-pretty` (marked experimental upstream), `sarif`, `rdjson`, `junit`, `checkstyle`, `gitlab`, `github`, plus `--reporter-file=PATH` | `sarif` or `rdjson` to a reporter file; P0 picks one; never the experimental `json` |
| oxlint | `oxlint` 1.94.0 | `--format` `json`, `sarif`, `junit`, `checkstyle`, `gitlab`, `github`, `unix`, `agent` (chosen automatically under an agent) | `json` or `sarif`, P0 picks; the `agent` text is a console, not an input |
| Fallow | `fallow` 3.34.1 | `--format json`; the repo wrappers already write `--out .beep/fallow/<analysis>.check.json` | the envelope file |
| tsgo / tsrs | `tsrs` 0.25.0-ts7.1.0-beta | text only; `--pretty false` gives `file(line,col): error TSxxxx: msg` | core's tsgo text adapter |
| Turbo | `turbo` 2.11.11 | `--summarize` run summaries (`.turbo/runs/*.json`), `--json` NDJSON | the run summary, read as `taskOutcomesOf` in `Ci/CiTaskOutcomes.ts` already does |
| Vitest | `vitest` 5.1.0 | reporter events | core's Vitest adapter |
| commitlint | `@commitlint/cli` 21.2.4 | `--format` takes a formatter module | a formatter that emits gate events, or the text adapter; P0 decides |
| syncpack | `syncpack` 15.3.3 | text | text adapter keyed on its line shape |
| sherif, gitleaks, SAST, `bun audit` | run through `bunx` or the CI image, not under `node_modules` | P0 records each one's machine mode | machine mode where one exists, else text |

Repo-owned lanes have no text to parse: their commands already build typed findings (the
`Laws/*.model.ts` finding classes and the `format*Finding` functions beside them). Those lanes
emit gate events in-process from the typed findings. A text adapter is the fallback only for a tool with no machine
mode, and each text adapter is keyed on stable codes, never on prose.

## Yeet records consume gate reports

- `qualityIssuesFromStepResult` builds `QualityIssue` rows from gate-report items for any step
  whose gate wrote a report. Its line parsers over `result.output` stay only inside the text
  adapters, where the same lines become gate events first.
- `YeetVerdictLane` gains an optional key naming the lane's gate-report path. A verdict written
  before the key decodes unchanged.
- `QualityTaskLaneRunReport` and `readInnerLaneReports` keep their timing facts. A lane's outcome
  and counts come from its gate report, so the lane report and the gate report never disagree.
- `QualityIssueIndex.rawOutputRefs` names the raw logs beside each gate report, not stream
  captures.
- `renderPackageVerifyReportForTesting` prints one verdict line per step from its gate report,
  with the log path and size, instead of each failed step's whole captured output.
- `final-check`, `cheap-gates` and `publish` print the aggregate's console projection: the
  verdict first and last, one line per red child gate, the record path.

## Heartbeat

- The gate-run supervisor owns the heartbeat, never the tool. Under Turbo the outermost gate prints
  it; inner gates print none.
- A gate whose run passes 60 seconds prints one heartbeat line, then one every 60 seconds until it
  finishes. Both numbers are configuration with these defaults.
- Fields, in order: gate, subject, `running`, the current step, elapsed time, time since last
  activity, and the activity source. Example:
  `lint @beep/repo-cli: running  step biome  elapsed 3m00s  last activity 4s ago (cpu)`.
  A line is at most 120 characters.
- Activity is the newest of three signals: a gate event from the adapter, a byte the tool writes
  to its raw log, and growth in the tool process tree's CPU time. A tool that buffers its output
  (tsrs, a reporter file, Turbo's grouped logs) still shows activity through CPU time. Where CPU
  time cannot be read, the line says `activity unknown`; it never prints a number it did not
  measure. P0 settles the CPU source (the MAP's open point "heartbeat transport").
- The agent projection prints heartbeat lines before the verdict block and never after it, so
  the last line of output is still the verdict. The terminal projection shows the same fields on
  its live progress line. Heartbeats are console events; the record keeps only timings.

## Block until changed

One mode, the same rules, on three status commands. Flag names are settled in P3 (working name:
a planned `--until-changed` flag).

- **Gate table.** The mode persists the last `GateTableReport` under the Yeet state root, polls
  every 240 seconds, so it spends no more than the loop it replaces, and returns at the first
  change. A row's change key is every verdict-bearing cell: draft, base, head, mergeable state, required
  green count, threads, `RED`, `PENDING`, `STATUS-RED`, `GATE-MET`, `HOLD`, plus added and removed
  pull requests. The `window` countdown is excluded; its elapse already flips `GATE-MET`. Output is the header line plus the
  changed rows. When the wait ends with no change it prints one line:
  `# gate-table <ts>: no change (N open, M GATE-MET)`.
- **Job wait.** `job wait` already blocks until a job settles or an inbox wave arrives
  (`ProofJobWaitOutcome`). The mode also returns on a phase change, prints one line per
  transition, and on a `--timeout` expiry prints one line: `job <id>: no change (<phase>,
  elapsed <t>, last activity <t> ago)`. A settled job prints its gate report's verdict line and
  record path.
- **Readiness monitor.** In `--until-ready` text mode, `reportMonitorObservation` prints a poll
  only when the snapshot's verdict-bearing fields differ from the previous poll's; the window
  countdown is excluded. `--watch` NDJSON already emits per transition and is unchanged.
- Each mode spends no more GitHub requests per hour than the loop it replaces, measured with
  `bun run beep github ledger report`.

## Guidance

- `AGENTS.md` is always loaded. It gains one or two lines: gates print a bounded verdict, so run
  them whole and read the record path they print; never pipe a gate through `tail`, `head` or
  `grep`.
- The yeet skill (`.claude/skills/yeet/SKILL.md`, `references/detached-jobs.md`,
  `references/monitor-and-inbox.md`, `references/run-artifacts.md`) names the gate report as the
  first read and the block-until-changed mode for waits; `job logs --tail 100` stops being the
  first suggestion.
- The orchestrate skill's four-minute `yeet gate-table` loop (`while true; ...; sleep 240`) becomes
  a loop over the block-until-changed mode with no sleep.
- After any skill edit, `bun run beep skills update` refreshes the lock and mirrors in the same PR.

## Constraints

- Design order is the repo law: the adapter-kind schema and the lane-to-adapter registry first,
  then the gate-run service contracts consumed from `gate-report-core`, then implementation.
- No console renders from a tool's raw stream (BRIEF no-go). The raw stream goes to the log file
  whose path and size the console prints.
- The registry from lane id to adapter kind is total. A lane spec without an adapter does not
  type-check, and the conformance test fails on any catalog id with no entry.
- Package scripts are generated. A reporter flag on `beep:lint` changes in the generator, applied
  with `bun run beep lint package-scripts --write`, never by hand.
- `YeetVerdict` keeps its name and schema version tag; it aggregates gate reports (decision
  `vocabulary-gate-report`). New keys are optional so old records decode.
- Cause folding extends core's table with lint and build cascades only where a code-keyed cascade
  is known; no general inference.
- Every edited workspace package passes `bun run beep quality package-verify <@beep/package>`
  before hand-off.

## Acceptance Criteria

- [ ] A conformance test enumerates the live catalog (both tiers of
  `githubCheckLanesForModeForTesting`, every `CiLaneId`, every `QUALITY_TASK_NAMES` entry, every
  `FinalCheckGate`), asserts each id maps to exactly one adapter kind, and runs each id through the
  lane runner with a stub step that replays its adapter's fixture. Every id leaves a decodable gate
  report under `.beep/gates/`. Adding a catalog id without an adapter fails it.
- [ ] Each third-party adapter has a fixture test fed the tool's recorded machine output (Biome
  SARIF or rdjson, oxlint JSON or SARIF, the Fallow envelope, a Turbo run summary) that asserts
  unit and item counts, outcomes, rule codes and locations. Biome and oxlint lanes write their
  machine output to a file; no lane parses their console text.
- [ ] Every repo-owned `lint:*`, `goals:*`, drift-check and docgen lane emits items from its typed
  findings; a test per finding model proves one finding becomes one item with its file, line and
  rule.
- [ ] For every adapter kind, the agent console of a failing fixture equals core's projection of
  the decoded record, byte for byte.
- [ ] `qualityIssuesFromStepResult` given a step whose output holds decoy diagnostic lines and
  whose gate report holds none returns no issue; given a report with N failed items it returns N
  issues with the same locations.
- [ ] A `YeetVerdict` written by the code at this goal's merge base decodes unchanged; a new verdict
  names a gate-report path for every lane that ran.
- [ ] `renderPackageVerifyReportForTesting` on a two-step report with one red step prints one
  verdict line per step and the red step's failures within core's agent budget, plus its log path
  and size, and no captured output.
- [ ] `final-check`, `cheap-gates` and `publish` print the verdict line first and last; a fixture
  aggregate with one red child prints that child's verdict and failures and no other child's
  output.
- [ ] Heartbeat, under `TestClock`: a stub gate that runs 150 seconds prints exactly two heartbeat
  lines (at 60 and 120 seconds) before its verdict block; a gate that ends in 50 seconds prints
  none; a stub that writes no output but accrues CPU time reports `(cpu)` activity; a host
  without a CPU source prints `activity unknown`. No heartbeat line follows the verdict block.
- [ ] Gate table: given two `GateTableReport` fixtures that differ only in `window`, the mode
  prints exactly one line (the no-change line); given a `RED` added on one row, it prints the
  header and that row only.
- [ ] Job wait: a `--timeout` expiry with no phase change prints exactly one line; a phase change
  prints one transition line.
- [ ] Readiness monitor: three polls with identical verdict-bearing fields and a falling window
  print one summary, not three.
- [ ] The block-until-changed gate table spends no more requests per hour than the 240-second loop
  on the same open-PR set, compared with `bun run beep github ledger report`.
- [ ] `AGENTS.md` changes by at most two lines; the yeet and orchestrate skills describe the new
  reads; `bun run beep skills update --check` passes.
- [ ] Census, once the planned census command of `agent-output-census` exists, over seven days
  starting after the guidance merges: the share of runs piped through `tail`, `head` or `grep`
  falls to 30% or less for each of Yeet (96% on 2026-11-18), lint (89%) and quality (97%); the
  gate table's share of Yeet output falls from about 6% to under 1%. Until the command exists,
  fixtures stand in: an unchanged gate table prints one line of at most 80 characters, and a
  green lint lane prints one line.
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/gate-report-rollout/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/gate-report-rollout/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/gate-report-rollout` | Passes |
| Lane conformance | the new conformance test in `packages/tooling/tool/cli/test/`, run by `bun run beep quality package-verify @beep/repo-cli` | Every catalog id writes a report |
| Adapter fixtures | adapter fixture tests, same package-verify run | Counts, codes and locations match |
| Yeet consumers | verdict decode, issue-index and package-verify render tests | Pass |
| Heartbeat | `TestClock` heartbeat tests | Two lines at 150 s, none after the verdict |
| Block until changed | gate-table, job-wait and monitor delta tests | Window-only change prints one line |
| GitHub spend | `bun run beep github ledger report` before and after | Not higher |
| Skills | `bun run beep skills update --check` | Passes |
| Census | the planned census command, seven-day window | Rows at or under the targets above |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add gate-report-rollout --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-report-rollout`; add a `kind: decision` file there, never edit this block._

### Heartbeat and block-until-changed carried from core-enhancements, 2026-11-18

The operator selected all four enhancements in `explorations/agent-verification-output/DECISIONS.md`, entry `core-enhancements`. This goal carries three of them. The heartbeat: a gate that outlives a threshold prints one progress line at a fixed interval, naming the step, elapsed time and time since last activity. Block until changed: the gate table, `job wait` and the readiness monitor gain a mode that returns only when state changes and prints only the changed rows. Cause folding extended: the cascade table core starts with grows lint and build cascades where a code-keyed cascade is known. The fix-loop delta is carried by `goals/gate-run-history`. Each removes a measured cost in the census: kill-and-rerun on gates that look hung, and gate-table rows re-polled every four minutes (about 6% of Yeet output).

Lane explore/agent-verification-output

Reverse: Drop the heartbeat and the block-until-changed mode and restore the polled status output

### Gates only: the rollout wraps no command the repo does not own, 2026-11-18

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `scope-gates-only`: the packet covers verification gates (test, check, lint, build, docgen, quality, Yeet and CI logs) under one verdict contract. This goal therefore puts every gate the repo owns on the gate report and wraps nothing else. Output of commands an agent chooses for itself (`rg`, `cat`, `git`) stays out; it is deferred to its own exploration (entry `search-read-output`). A tool appears here only as the engine of a repo gate, and its adapter reads its machine format.

Lane explore/agent-verification-output

Reverse: Widen the rollout to a general command wrapper in a new exploration

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
