# Evidence-grade trace: `lint-policy` / `lint:native-runtime`

## Scope and evidence rules

- Target source tree: `/home/elpresidank/YeeBois/projects/beep-effect2`.
- Analysis is read-only against that tree. This report is the only deliverable and is written in the isolated lane workspace.
- Incident statements supplied in the request are treated as leads. Claims below are tied to live-source `file:line` evidence; interpretation is labeled **Inference** where the source does not establish the runtime fact directly.

### Live checkout state

The inspected checkout resolves to `/home/elpresidank/YeeBois/projects/beep-effect2` at HEAD `287ff0afb9c1ab0b353b4795c1ac1b066d136da7` on local `main`, two commits behind `origin/main`. It already had unrelated modifications to `bun.lock` and `explorations/ATLAS.md`, plus untracked `explorations/ci-hang-observability/`; none was modified. This matters because the report describes the current on-disk implementation, which visibly contains anti-wedge logic and commentary that may postdate the supplied incident.

## 1. Workflow wrapper and lane dispatch

The `verify` matrix takes its runner and job timeout from each matrix row (`.github/workflows/check.yml:47-55`). The `lint-policy` row is exactly:

```yaml
- id: lint-policy
  name: Lint Policy
  runner: beep-ec2-heavy
  timeout_minutes: 50
  uses_turbo: "false"
  install_typos: "true"
```

This is `.github/workflows/check.yml:64-69`. Thus the live row confirms the 50-minute job timeout and repo-specific heavy runner label, but the source does not itself prove that a particular run used EC2 or was ephemeral.

The verification step begins with `set -euo pipefail` (`.github/workflows/check.yml:236-239`) and defines this exact wrapper (`.github/workflows/check.yml:253-262`):

```bash
run_lane() {
  setsid bun run beep "$@" < /dev/null &
  local pgid=$!
  local status=0
  wait "$pgid" || status=$?
  kill -TERM -- "-$pgid" 2>/dev/null || true
  sleep 2
  kill -KILL -- "-$pgid" 2>/dev/null || true
  return "$status"
}
```

Precisely: stdin is redirected from `/dev/null`; there is no stdout/stderr redirection, no `tee`, and no pipe in the lane invocation. `setsid ... &` makes it a background job/session leader; `$!` is retained as `pgid`; the shell waits for that leader, preserves its status, then sends `SIGTERM` to the negative process-group id, waits two seconds, sends `SIGKILL` to the group, and returns the leader status. There is no `trap` and no per-command `timeout` wrapper in this function. The only shell-wide timeout visible here is the matrix job's 50-minute GitHub Actions timeout (`.github/workflows/check.yml:50,64-69`). The live comments explicitly identify inherited stdio pipes and orphaned grandchildren as the reason for this session/group reap (`.github/workflows/check.yml:246-252`).

The case branch calls exactly `run_lane ci lane "${{ matrix.id }}"` for `lint-policy` (`.github/workflows/check.yml:272-278`), with no affected/summarize flags. The workflow-level environment makes Turbo logs streaming (`TURBO_LOG_ORDER: stream`) but the row has `uses_turbo: "false"` (`.github/workflows/check.yml:64-69,127-136`).

### CLI dispatch to the policy runner

`ciLaneCommand` parses a lane id and passes it to `runCiLane` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1188-1228,1245-1269`). `runCiLane` finds the repo root and sends every lane except `fallow` to `runCiStepLane` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1138-1148`). For `lint-policy`, the step inventory is a single outer step:

```ts
"lint-policy": () => [bunRunStep(repoRoot, "ci:lint-policy", ["beep", "lint", "policy", "--full"])],
```

(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:954-958`). `runCiStepLane` passes that step to `runQualityTaskStreamingStepGroup` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1095-1107`). The `--full` is intentional exact-hosted scope, independent of ambient `CI` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:954-958`).

`lintPolicyCommand` maps the `--full` flag directly to `runRootLintPolicyTask(full)` (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:568-574`) and registers `policy` in the lint subcommands (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:609-625`). The runner also computes `runFull = full || isCi()`; only a non-full, non-CI call scopes to changed files (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1927-1948`). In this path `--full` guarantees all 26 steps regardless of ambient `CI`.

## 2. Policy enumeration, scheduling, spawn, wait, and cancellation

### Enumeration and scheduling

`rootRepoLintPolicySteps` is one static array (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1835-1883`). In exact source order its 26 labels are:

1. `lint:deprecated-apis`
2. `lint:docgen`
3. `knowledge:semantic-delta`
4. `knowledge:refs-check`
5. `lint:schema-first`
6. `lint:terse-effect`
7. `lint:jsdoc`
8. `lint:native-runtime`
9. `lint:identity-registry`
10. `lint:frozen-grant-set`
11. `lint:circular`
12. `lint:effect-fn`
13. `lint:package-test-imports`
14. `lint:effect-imports`
15. `lint:package-test-typecheck`
16. `lint:tsgo-rules`
17. `lint:oxlint`
18. `lint:ecosystem-polarity`
19. `lint:allowlist`
20. `lint:jsdoc-module-tags`
21. `goals:doctor`
22. `goals:index-check`
23. `lint:reflection-artifacts`
24. `lint:roadmap-refs`
25. `lint:judge-rubric`
26. `lint:typos`

The source calls this a static LPT order derived from earlier timings and says it is descending by measured duration after the first named long poles (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1835-1838`). The concurrency constant is exactly 3; comments say the goal is to stay under the deprecated-APIs long pole and that the worst LPT co-resident trio fits the 64-GiB runner (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:153-161`). Execution is `Effect.forEach(resolvedSteps, worker, { concurrency })` with the original array as input (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1429-1443`). Therefore the scheduling mechanism is bounded Effect fiber concurrency of 3 over static LPT order: at most three step effects are active, and later array elements become eligible as slots free.

**Resource classes: NOT FOUND.** `QualityTaskStep` contains only `label`, `command`, `args`, `cwd`, optional `env`, optional `useLocalEnv`, and optional `flakeQuarantine` (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:233-246`). There is no per-step CPU/memory/resource-class field, semaphore class, weight, or admission rule in this policy scheduler. Resource compatibility exists only as the comment about the worst co-resident trio (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:153-161`).

### Exact child API and stdio

Each policy entry is represented as either `bun run ...` or `bunx ...`; `repoCliStep` is `bun run beep ...` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1512-1529`). Thus `lint:native-runtime` is exactly:

```text
bun run beep laws native-runtime --check
```

from `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1848-1851` plus the `repoCliStep`/`bunRunStep` constructors at `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1512-1529`.

For every inner policy step, `collectResolvedStepOutput` calls `runCaptured` with the step command/argv, repo cwd, `extendEnv: true`, `stdin: "inherit"`, `source: "all"`, a 256-KiB bound, and trimming (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1389`; bound definition `packages/tooling/tool/cli/src/internal/process/StepExec.ts:286-303`). `runCaptured` uses Effect v4 `ChildProcess.make(command, [...args], options)`, not Bun's process API, execa, or `exec`; it sets stdout to `"pipe"`, stderr to `"pipe"` for source `all`, and retains the inherited stdin (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:604-615`). No `shell` option is supplied, so the executable and argv are passed directly rather than through a shell.

The CLI supplies `BunServices.layer` as part of its base runtime (`packages/tooling/tool/cli/src/bin-main.ts:92-107,198-213,241-257`). The vendored Effect implementation makes Bun's child-process layer the node-shared spawner (`.repos/effect/packages/platform/bun/src/BunServices.ts:17-18,32-48`). That implementation ultimately calls Node `child_process.spawn(command.command, command.args, spawnOptions)` (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:334-347`). On non-Windows it defaults `detached` to `true` when the caller omits it and passes through `shell: options.shell` (`.repos/effect/packages/platform/node-shared/src/internal/nodeChildProcessSpawner.ts:4-15`). Therefore these Linux policy children are detached session/process-group leaders even though `StepExec` does not explicitly write `detached: true`.

The single outer `ci:lint-policy` step differs: `runCiStepLane` invokes the streaming group (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1095-1107`), whose default concurrency is 1 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1221-1265`). Its ordinary `runStep` uses `runToExit` with stdin/stdout/stderr all inherited (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:954-990`). `runToExit` also uses Effect `ChildProcess.make` and waits on `handle.exitCode` only (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:761-775`). Consequently the outer `bun run beep lint policy --full` writes directly into the workflow's stdio, while that child internally pipes each of its 26 policy grandchildren.

### What a step completion actually awaits (crux)

An inner policy step does **not** complete on exit code alone. `runCaptured` starts two concurrent effects in one `Effect.all`: (1) a fold over `handle.all`, the interleaved stdout/stderr stream, and (2) `handle.exitCode` (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:617-627`; `handle.all` selection at `packages/tooling/tool/cli/src/internal/process/StepExec.ts:451-462`). The fold completes normally only on stream EOF. Therefore the step await requires **both direct-child exit and captured stdout/stderr EOF/close**.

The current source explicitly documents the failure mode: EOF requires every inherited writer to close, not merely the direct child, so an orphaned grandchild can leave the fold waiting (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:488-504`). It now wraps the stream in `Stream.interruptWhen(capturePipeDeadline(...))` (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:616-624`). After the direct child's exit, that deadline waits two seconds, calls `handle.kill({ forceKillAfter: "1 second" })`, waits three more seconds, then dies with `CapturePipeWedgedError` if EOF still has not arrived (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:464-486,506-522`). This is a post-exit drain/reap watchdog in the live code; it does not bound a direct child that never exits.

Only after `collectResolvedStepOutput` has returned—that is, after both exit and capture completion—does the scheduler log the observed completion marker:

```ts
Effect.tap(([elapsed]) => Console.log(`[beep-cli] ${step.label}: done in ${Duration.toMillis(elapsed)}ms`))
```

(`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1434-1443`). Output is held in memory and printed later, after all step results resolve (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1406-1409,1445`). Thus absence of `lint:native-runtime: done in ...` is consistent with either (a) the direct process not exiting or (b) the capture fold not reaching EOF; it does not distinguish them.

### Timeouts, progress, and kill semantics

- **Per-step wall-clock timeout: NOT FOUND.** Neither `runStepGroup` nor the `lint:native-runtime` step supplies an `Effect.timeout`, command timeout, or `timeout(1)` wrapper (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1449,1835-1883`). The current capture guard starts only after `handle.exitCode` completes (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:506-522`).
- **Heartbeat/progress while a step runs: NOT FOUND.** The runner prints the group size and every command before scheduling (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1429-1433`), then only the `done in ...` marker after completion (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1434-1443`). Captured output is not tee'd in this call (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1376-1389`; `tee` defaults false at `packages/tooling/tool/cli/src/internal/process/StepExec.ts:619-623`), so the checker emits no live evidence through the parent during its await.
- **Normal successful child:** the Effect spawner does no scope-exit group cleanup for an already-exited zero-status child (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:484-497`), which is why the explicit capture deadline now reaps post-exit stragglers.
- **Nonzero child:** the spawner's exit handler best-effort signals the process group (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:513-517`), with default `SIGTERM` (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:428-434`).
- **Interrupted/still-running child:** the scope finalizer sends the signal to the negative pid (whole detached process group), falling back to the direct child only if group kill fails, then awaits the child's exit (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:362-384,501-509`). `runCaptured` does not set `forceKillAfter`; therefore this interruption cleanup is `SIGTERM` without a built-in escalation deadline. The explicit post-exit call does set a one-second `SIGKILL` escalation (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:510-513`).
- **Workflow layer:** after its outer session leader exits, `run_lane` sends `SIGTERM`, sleeps two seconds, then `SIGKILL` to that outer group (`.github/workflows/check.yml:253-262`). Because Effect's Linux children are themselves detached group leaders, the workflow comments correctly note that outer group reap cannot reach such nested groups (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:493-503`).
- **Zombie/orphan reaping:** direct-child exit is consumed through the spawner's Node `"exit"` event/deferred (`.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:342-355,536-544`). There is no subreaper/adoption loop for arbitrary escaped descendants. A descendant that double-forks or starts its own session can escape both group reapers; the current capture guard converts its still-open pipe into a defect after the grace windows (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:464-481,506-522`).

At top-level CLI teardown, current source also hard-exits on success because Bun runtime otherwise waits for event-loop handles left by children (`packages/tooling/tool/cli/src/bin-main.ts:168-182`). This protects the CLI process after its Effect program has completed, but it cannot make an Effect program complete while that program is still awaiting a child/capture.

## 3. `lint:native-runtime` end to end and recursive spawn inventory

### Checker behavior

The policy entry uses `repoCliStep(..., ["laws", "native-runtime", "--check"])` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1848-1851`), which expands to `bun run beep laws native-runtime --check` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1512-1529`). The `laws` command registers that subcommand (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:527-545`). Its handler:

1. decodes `--check`, `--exclude`, and `--include` into `NoNativeRuntimeRulesOptions` (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:443-461`);
2. awaits `runNoNativeRuntimeRules` (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:453-461`);
3. only after that returns prints mode, scanned/touched counts, warning/error/allowlist counts, and diagnostics (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:463-477`);
4. exits nonzero if `summary.strictFailure` (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:479-483`).

The actual law is synchronous syntax analysis inside one Bun process:

- It scans `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, and `infra/**/*.ts`, excluding docs (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:40-43`).
- It builds `new Project({ tsConfigFilePath: <cwd>/tsconfig.json, skipAddingFilesFromTsConfig: true })`, then calls `project.addSourceFilesAtPaths(...)` (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:565-587`).
- It enumerates project files, excludes ecosystem members and standard law exclusions, records repo-relative paths, and sorts them (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:578-600`).
- It decodes the generated allowlist snapshot through pure helpers (`packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts:23-38,77-94,116-140`) and classifies explicit native-runtime hotspot/error paths using static arrays/predicates (`packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts:29-34,50-60,78-98`).
- For each source file it walks every AST descendant and checks import declarations, `new` expressions, calls, equality/`typeof`, and `switch` statements (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:327-446,502-524`). Each file scan is an in-process `Effect.try`; the loop is serial (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:665-687`).
- It returns counts and fails strict mode when either warnings or errors are nonzero (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:689-699`).

The installed ts-morph code corroborates the in-process shape: its `Project` creates a transactional filesystem, tsconfig resolver, compiler option container, and language service (`node_modules/ts-morph/dist/ts-morph.js:20863-20894`); `addSourceFilesAtPaths` uses synchronous filesystem globbing and source-file creation (`node_modules/ts-morph/dist/ts-morph.js:19837-19850,20981-20983`). This is a TypeScript compiler language service embedded in the process—not `tsserver`, `tsgo`, or `@typescript-eslint/project-service`.

### Recursive process chain

| Level | Executed command/site | Spawn API and stdio | Can it outlive its parent? |
| --- | --- | --- | --- |
| Workflow | `setsid bun run beep ci lane lint-policy < /dev/null &` (`.github/workflows/check.yml:253-257`) | Bash background job/session; stdin `/dev/null`, stdout/stderr inherited | The shell waits for it; after it exits, the function reaps its group (`.github/workflows/check.yml:257-261`). |
| Root script | `beep` expands to `bun run packages/tooling/tool/cli/src/bin.ts --` (`package.json:303-310`) | Bun script runner; `bin.ts` dynamically imports `bin-main` (`packages/tooling/tool/cli/src/bin.ts:46-47`) | Bun's internal script-runner implementation is outside repo source; no stronger claim is made here. |
| CI lane → policy | `bun run beep lint policy --full` (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:954-958`) | Effect `ChildProcess.make` through Node `child_process.spawn`; inherited stdin/stdout/stderr (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:975-990`; `packages/tooling/tool/cli/src/internal/process/StepExec.ts:761-775`) | Yes in principle: Linux default is detached (`.repos/effect/packages/platform/node-shared/src/internal/nodeChildProcessSpawner.ts:4-15`). Effect scope cleanup targets its group, but the workflow's outer group does not include it. |
| Policy → native law | `bun run beep laws native-runtime --check` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1848-1851`) | Effect `ChildProcess.make`; stdin inherited (ultimately `/dev/null` in hosted path), stdout/stderr piped and merged via `handle.all` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1389`; `packages/tooling/tool/cli/src/internal/process/StepExec.ts:604-627`) | Yes in principle: it is a detached group leader. Current post-exit capture cleanup reaps its group; an independently re-sessioned descendant can escape (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:493-503`). |
| Native law internals | ts-morph project construction, glob, serial AST walk (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:565-699`) | **No subprocess API.** In-process filesystem/compiler operations | No child is created by repo code on this path. |

There are two syntactically present process paths that are **not reachable** here:

- `bin.ts` has `Bun.spawnSync` git probes only for the exact `lint --fix` two-argument fast path (`packages/tooling/tool/cli/src/bin.ts:14-43`); neither `ci lane`, `lint policy --full`, nor `laws native-runtime --check` matches it.
- `withLocalEnv` can run `op whoami`/wrap a step only when `step.useLocalEnv === true`; the policy's `repoCliStep` does not set that property, so it returns before that branch (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:954-973`; step construction `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1512-1529`). CI would disable the wrapper in any event (`packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:427-471`).

**Further child processes from the native checker: NOT FOUND.** Targeted live-source search over `NoNativeRuntime.ts`, its command handler, hotspot/allowlist/exclusion imports, and installed ts-morph found no reachable `Bun.spawn`, `Bun.spawnSync`, `node:child_process`, Effect `ChildProcess.make`, execa, `exec`/`execFile`, worker thread, or Worker construction. Specifically:

- **ESLint:** not invoked; `lint:jsdoc` is sibling step 7, not a descendant (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1848-1851`).
- **TypeScript projectService / tsserver / tsgo:** not invoked. ts-morph creates an in-process language service (`node_modules/ts-morph/dist/ts-morph.js:20863-20894`); `lint:tsgo-rules` is sibling step 16 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1862-1867`). Installed TypeScript contains separate server entrypoints with child-process imports, but this path imports ts-morph's compiler API, not those entrypoints.
- **Turbo / bunx:** not invoked below the checker. The native entry is `bun run`, and Turbo/`bunx` occur only in sibling policy entries (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1835-1883`).
- **git, portless, daemons, worker_threads:** NOT FOUND on the checker path.

### CI/local asymmetry

The checker function itself has **no CI branch, TTY check, `NO_COLOR`, Turbo, or daemon flag**: its executed body reads `cwd`, constructs/scans the project, and returns a summary (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:565-700`). The command handler likewise only maps flags and prints after completion (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:443-483`).

The concrete differences around it are:

- `runRootLintPolicyTask` treats `CI=true` as full scope, but hosted dispatch already passes explicit `--full` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:682,1927-1948`; `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:954-958`). The native checker without `--include` already defaults to the same whole-repo globs (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:40-43,581-587`). Therefore this branch does not explain a direct full native command taking ~10 seconds locally versus hanging hosted.
- Hosted policy execution runs the checker concurrently with up to two other LPT-ordered policy processes (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:153-161,1429-1443`); a direct local invocation does not. **Inference:** CPU, memory, filesystem, or Bun-runtime contention is possible, but the source contains no adaptive behavior or evidence proving it occurred.
- Hosted policy execution gives the native process pipe-backed stdout/stderr and noninteractive stdin (`.github/workflows/check.yml:253-255`; `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1376-1389`), whereas a direct terminal invocation normally has terminal stdio. This is the strongest source-proven behavioral asymmetry. The current parent does not tee captured chunks (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:619-623`), so all native summary output is delayed until the step resolves.
- Environment is inherited because `extendEnv: true` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1380-1388`; Effect environment merge at `.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:93-97`). No checker code reads `CI`, `GITHUB_ACTIONS`, `NO_COLOR`, or TTY state. `bin-main` only uses TTY state to restore terminal modes at teardown and always hard-exits success afterward (`packages/tooling/tool/cli/src/bin-main.ts:142-182`).

**Bottom line:** the 10-second standalone result proves the AST work can finish in that local environment. It does not exercise the policy parent's pipe-EOF await, detached-group topology, two concurrent siblings, or hosted runner filesystem/resource conditions. The live checker itself provides no alternate CI code path.

## 4. Observability inventory

| Signal | Live evidence | Finding |
| --- | --- | --- |
| Planned-step markers | Group count and all commands are logged before execution (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1429-1433`). | Present, but proves only planning/resolution, not spawn or progress. |
| Per-step timing/completion | `done in <ms>` after the combined capture+exit await (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1434-1443`). | Present. This is the incident's completion marker. It cannot distinguish exit wait from EOF wait. |
| Native checker counters | Mode, scanned/touched files, warning/error/allowlist totals, then diagnostics (`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:463-477`). | Present only after the entire scan returns; no phase/file progress. Parent capture buffers it until completion. |
| Live child output | `collectResolvedStepOutput` does not set `tee`; captured output is rendered only after all results (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1376-1389,1406-1409,1445`). | **NOT FOUND for policy steps while running.** |
| Structured per-step events | No JSON/event record at spawn, pid, exit, or pipe EOF in `runStepGroup`/`runCaptured` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1449`; `packages/tooling/tool/cli/src/internal/process/StepExec.ts:604-635`). | **NOT FOUND.** |
| OpenTelemetry spans/export | No `withSpan`, tracer, OTel SDK/exporter, span attributes, or metric emission occurs in the traced policy/native/process modules. Named `Effect.fn` wrappers are code labels, not evidence of an exported trace. | **NOT FOUND.** |
| Heartbeat | No periodic timer/log in the policy scheduler or native scan. | **NOT FOUND.** |
| Watchdog | Post-exit capture deadline: 2-second drain, group reap with 1-second force escalation, 3-second EOF grace, then defect (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:483-522`). | Present in current source, but starts only after direct-child exit. |
| Per-step timeout | No timeout around `collectResolvedStepOutput` or native scan (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1449`). | **NOT FOUND.** |
| Job timeout | 50 minutes for the `lint-policy` matrix row (`.github/workflows/check.yml:50,64-69`). | Present; coarse job-level only. |
| Group cleanup | Workflow `SIGTERM`, two-second grace, `SIGKILL` after leader exit (`.github/workflows/check.yml:253-262`); Effect group cleanup described above. | Present, with detached/escaped-descendant gaps. |
| Capture lifecycle tests | Fake spawner tests model successful child exit with a permanently held pipe, verify group reap, loud escaped-descendant failure, and clean EOF behavior (`packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts:10-15,46-102`). | Present as unit coverage of current guard; this trace did not execute tests. |
| Setup telemetry | Setup action records total/install time, versions, and cache metadata into the step summary (`.github/actions/setup-monorepo-ci/action.yml:21-24,107-115,132-176`). | Present, but completed before the lane and has no process state. |
| Hosted timing collector | `beep ci lane-timings` derives job/setup/install/pickup durations from Actions jobs (`packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:436-450,781-830`). Peak RSS defaults to `None`; source says Actions exposes none unless a runner-side report is supplied (`packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:452-501`). | Offline/operator telemetry, not emitted by this lane. |
| Runner memory/identity | Operator-only `fleet-lane-probe.yml` prints runner name, CPU count, and `free -g` (`.github/workflows/fleet-lane-probe.yml:25-40`). `fleet-shadow-check.yml` also prints host/kernel/CPU/memory (`.github/workflows/fleet-shadow-check.yml:14-26`). | Present in separate manually dispatched workflows, not the `check.yml` Lint Policy job. |
| Disk diagnostics | `check.yml` has before/after `df -h` only in cleanup for runners whose name does not start with `beep-` (`.github/workflows/check.yml:202-221`). | The `beep-ec2-heavy` lane is excluded; no lane-time disk sample. |
| Process/kernel dump | No `ps`, `pstree`, `/proc` snapshot, `lsof`, `dmesg`, `journalctl`, cgroup, OOM, stack, or open-fd dump in the verification job (`.github/workflows/check.yml:145-315`). | **NOT FOUND.** |
| Failure/cancellation post-mortem | For `lint-policy`, the Turbo-summary step is inapplicable because `uses_turbo` is false (`.github/workflows/check.yml:64-69,300-311`), and there is no always-run diagnostic/artifact step after verification (`.github/workflows/check.yml:298-315`). | **NOT FOUND.** Fallow's always-run envelopes/artifacts elsewhere in `check.yml` are unrelated to this matrix lane. |

## Top suspects

These are ranked against the supplied shape, not asserted root causes. The current checkout visibly contains mitigations that may not have existed at the incident SHA; without that exact SHA/log/process state, historical applicability is unverified.

1. **Captured stdout/stderr never reached EOF after the direct Bun child exited** — `packages/tooling/tool/cli/src/internal/process/StepExec.ts:617-627`, with the mechanism documented at `packages/tooling/tool/cli/src/internal/process/StepExec.ts:488-504`.

   Why it fits: the completion marker is downstream of both exit and EOF; direct terminal execution bypasses this parent capture; cleanup reportedly found lingering Bun processes; and the current source/tests explicitly describe this same success-exit/inherited-pipe class (`packages/tooling/tool/cli/src/internal/process/StepExec.ts:493-503`; `packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts:10-15`). **Inference:** a Bun script wrapper or descendant retained the pipe writer.

   Cheapest discriminator: instrument the two `Effect.all` branches separately with timestamped `pid`, `exitCode resolved`, and `capture EOF` events at `packages/tooling/tool/cli/src/internal/process/StepExec.ts:617-627`. If exit logs near 10 seconds and EOF does not, this suspect is proven. A bounded reproducer should run only `bun run beep laws native-runtime --check` through `runCaptured`, not the full 26-step battery.

2. **The direct native child itself never exited while blocked or starved in ts-morph project/glob/AST work** — `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:581-600,665-687`.

   Why it fits: the current post-exit guard cannot fire until `handle.exitCode`; hosted execution adds two co-resident policy processes; the checker has no internal progress. **Inference:** resource/filesystem contention is possible, but no source evidence shows a blocking API beyond synchronous project construction, globbing, and serial AST traversal.

   Cheapest discriminator: add four monotonic markers around `new Project`, `addSourceFilesAtPaths`, source-file inventory/sort, and every fixed number of scanned files at `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:581-600,665-687`; simultaneously sample `ps -o pid,ppid,pgid,sid,stat,etime,%cpu,%mem,wchan,cmd --forest`. Compare exact piped runs with policy concurrency 1 versus 3. A live PID with no exit event and a stalled phase refutes the pipe-only theory.

3. **A completed CLI remained alive on an event-loop handle** — current mitigation at `packages/tooling/tool/cli/src/bin-main.ts:168-182`.

   Why it fits: the current comment names child-left handles/stuck Bun wrappers as a class where work prints success but the CLI does not exit. It is lower-ranked because current live code calls `process.exit(0)` on success, and the incident lead says the native completion marker itself was absent (not whether native summary lines appeared).

   Cheapest discriminator: emit one marker immediately before `Runtime.defaultTeardown` and one immediately before `process.exit(0)` (`packages/tooling/tool/cli/src/bin-main.ts:171-182`), plus the process pid. If the native summary and teardown marker appear but the observed direct child never emits an exit event, inspect active handles immediately before hard exit; if the hard-exit marker appears and exit follows, this is refuted for current source.

4. **Detached process-group topology left a Bun descendant outside the workflow's cleanup reach** — default detachment at `.repos/effect/packages/platform/node-shared/src/internal/nodeChildProcessSpawner.ts:4-15`; outer wait/reap at `.github/workflows/check.yml:253-262`; explicit warning at `packages/tooling/tool/cli/src/internal/process/StepExec.ts:493-503`.

   Why it fits: each Effect child is a separate session leader, while the workflow reaps only the outer `setsid` group after its leader returns. An inner descendant that creates another session can also evade the native step's group reap. This explains lingering processes and pipe retention, but it is a topology enabling condition rather than proof of which process stayed alive.

   Cheapest discriminator: record `pid/ppid/pgid/sid` at each spawn and capture a `/proc` or `ps --forest` snapshot as soon as the native direct child exits. Any writer-bearing descendant with a different SID/PGID identifies the escape. `lsof -p <parent> -a -d 1,2` plus fd-inode matching can identify who holds the capture pipe.

5. **No wall-clock bound on a still-running policy child, plus unbounded SIGTERM cleanup** — `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1371-1449`, `packages/tooling/tool/cli/src/internal/process/StepExec.ts:506-522,721-730`, and spawner cleanup `.repos/effect/packages/platform/node-shared/src/NodeChildProcessSpawner.ts:501-509`.

   Why it fits: if the direct child never exits or ignores termination, the post-exit capture watchdog is irrelevant, and `runCaptured` supplies no `forceKillAfter` for scope interruption. This readily explains why only the 50-minute job timeout stopped the lane, but not why native-runtime alone behaved differently.

   Cheapest discriminator: add a diagnostic-only per-step deadline around `collectResolvedStepOutput` that first dumps the child/process tree, then interrupts with a finite force-kill escalation. If the timeout sees a live native direct child, suspect 2/3/5; if the direct child is already gone but the await persists, suspect 1/4.

The first experiment is decisive and cheapest: separately timestamp child exit and stream EOF at the exact dual-await site. The current single `done in` marker collapses those two states, which is the central observability defect.

