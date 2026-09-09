# P0e Instrumented Tester Lane Report

- Status: source implementation reviewable; focused cross-runtime proof complete; orchestrator package acceptance pending
- Ownership: `@beep/test-utils` instrumented Vitest public subpath, narrowly scoped roles/tests/fixtures, and this report only
- Model/effort: gpt-daybreak-blue-latest, medium (phase-specific user authorization)
- Boundaries: P0a-P0d detector, graph, inventories, packet docs, configurations, dependencies, and other packages remain read-only. The orchestrator owns inbox, git, package verification, final acceptance, and publication.

## Activity log

- 2026-09-08: Created the P0e report before implementation. No P0.5 adoption or unrelated test-package migration is authorized.
- 2026-09-08: Activating the schema-first, Effect-first, and JSDoc laws because this phase introduces a public Effect/Vitest wrapper, named failure data, service composition, and documented exports. Their concrete influence and verification will be recorded below.

## Design and public-seam review

### Grounded seam

- The rc.112 public `@effect/vitest` surface exposes `makeMethods`, `Vitest.Methods`, `Vitest.MethodsNonLive`, the complete tester family, and Vitest's public exports. Its implementation confirms that `each` passes only the case to the user callback, while effect properties pass generated values plus `TestContext`.
- Installed Vitest 4.1.11 exposes `TestRunner.getCurrentTest()` and `TestContext.task`. The current public `Test` supplies the resolved concrete `name`/`fullTestName` and `timeout`, including generated `each`/property task names. Instrumentation will resolve this task inside the running Effect instead of inferring it from registration arguments or inventing an `each` context parameter.
- The watchdog will reserve a small completion margin beneath a finite positive resolved task timeout. Disabled `0`/non-finite timeouts remain watchdog-disabled. It will race the body with a sleep backed by a captured live `Clock`, so the body keeps its installed `TestClock`; Effect race semantics interrupt the loser and retain body finalizers/errors.
- A per-execution capture logger and state cell will be allocated inside the test Effect. `Logger.layer(..., { mergeWithExisting: true })` preserves user loggers and captures the last body log without cross-test global state. Pretty trace logging is added only when `BEEP_TEST_TRACE=1` or CI is truthy. Start/end annotations include task identity, duration, and outcome; JSON reporter timing remains authoritative for later phases.
- Wrapping occurs at the public tester callback boundary. Call/skip/skipIf/runIf/only/each/fails/prop delegate to the original rc.112 methods with unchanged arguments and options. Layer delegates to the public layer implementation, then recursively instruments the supplied `MethodsNonLive`; nested methods therefore retain upstream acquisition, memo-map, TestEnv, hook-option, and scope behavior without gaining `live`.

### Proposed file roles

- `src/Vitest.ts`: the only public facade, documented `TestHang` schema error, instrumented `it`, and public types/options. It will not be exported from the root barrel; the existing `./*` export map supplies `@beep/test-utils/Vitest`.
- `src/internal/VitestInstrumentation.ts`: private callback/tester/method wrapping and watchdog/logging implementation if the facade cannot remain focused. No upstream private import or copied runner is permitted.
- `test/Vitest*.test.ts` plus isolated `test/fixtures/vitest-instrumentation/**`: compile/surface assertions and subprocess runtime cases whose intentional failure/hang must not contaminate the ordinary suite.

`beep architecture --help` and `beep architecture plan --help` were run with Bun 1.4.1 before adding any role. The planner accepts slice/concept/domain-kind/stage and has no operation for this existing test-kit helper role, so no fictitious slice is being created.

### Early ambiguity and boundary notes

- `Clock.Clock` is a public `Context.Reference` whose default runtime value is the live clock, but that default is not directly exported. The implementation must capture/access it through public `Clock`/`Effect` composition before rc.112 installs `TestClock`; it must not use `TestClock.withLive`, which fails when TestClock is absent in live or `excludeTestServices` modes.
- `@beep/test-utils` currently lists `@effect/vitest` only as a development dependency while `@beep/test-utils/Vitest` will be production source. Package-manifest ownership was not granted. Implementation and local package evidence can proceed, but publish-time dependency correctness may require a concrete orchestrator ownership extension rather than an unauthorized manifest edit.
- The loaded schema-first law puts the `TestHang` name/non-empty/timeout/log invariants at construction; Effect-first keeps interruption, finalization, and service provision explicit; JSDoc requires titled compilable examples through the supported `@beep/test-utils/Vitest` facade.

## Working-review acknowledgement

- 2026-09-08: Resumed after the orchestrator's intentional early design-review stop. This was not a handoff or acceptance result.
- The eager last-log defect is concrete: a watchdog failure must construct `TestHang` only after its live sleep. The current resumed source now defers that construction, but it is not closed until a distinctive body log and concurrent isolation pass in a real Vitest process.
- Lifecycle messages must execute under the same merge-preserving logger layer as the body. The current resumed source places start/body/end under that layer; final tests must prove trace-off, explicit trace-on, CI-on, failure, and watchdog output, and ensure lifecycle messages do not replace the last body log reported by a hang.
- The current `Effect.scoped(Layer.build(...))` wrapper is not accepted: it adds an avoidable whole-body scope. The correction will build the logger layer with the upstream test's existing `Scope`, then prove body finalizers and watchdog-loser cancellation retain upstream ownership.
- The finite-positive timeout rule needs a strict inequality for every positive value. Values at or below one millisecond cannot use `max(1, ...)`; the watchdog budget will be represented at nanosecond precision while `0` and non-finite task timeouts remain disabled.
- `TestRunner.getCurrentTest()` is public but backed by a module-global current test. It is not sufficient concurrency evidence. The wrapper will prefer the actual callback `TestContext` for call/prop variants and capture the current task synchronously at the public registration callback boundary for case-only `each`; real concurrent each/property/layer cases will verify distinct names, timeouts, and last logs.
- The lens charter and shared lane contract are grounding context only; they do not authorize P1/P2 adoption. Seven existing worked examples have separate compile proof. The instrumented-subpath example remains pending this lane's implementation and Bun/Node runtime evidence.
- Dependency disposition is resolved without expanding lane ownership: the orchestrator will move the existing rc.112 `@effect/vitest` pin to runtime dependencies and review its lockfile after source handoff. This lane will not edit either file.

## Implementation and correction progress

- Added the documented `@beep/test-utils/Vitest` facade without touching the root barrel, a schema-first `TestHang`, and private Vitest instrumentation/runtime roles. Only public `@effect/vitest`, Vitest, and Effect APIs are imported; no upstream private runner source is imported or copied.
- The wrapper delegates callable plain tests unchanged and instruments effect/live call, skip, skipIf, runIf, only, fails, property, each, and recursive layer surfaces. Nested layer callbacks receive only instrumented `MethodsNonLive`.
- Closed the eager-read defect by constructing the hang after the live sleep. Closed the extra-scope defect by building the logger layer with `Layer.buildWithScope` against the upstream per-test `Scope`. A cleanup fixture now proves watchdog interruption runs the body's release action.
- Finite positive timeouts at or below 25ms use half the actual task timeout; larger values reserve at least 25ms and at most 250ms. Thus a 1ms task computes 0.5ms, while `0` and non-finite values disable the watchdog. A stable 10ms runtime case proves the sub-margin branch; the 1ms arithmetic is source/type evidence because host timer granularity cannot guarantee ordering between two sub-millisecond timers.
- The first real concurrent-each probe reproduced cross-test metadata bleed from public `getCurrentTest`: alpha inherited beta's 228ms watchdog and reached Vitest's 180ms timeout first. The implementation no longer uses that module-global lookup. It delegates each input as a single-case call through the original public tester and closes over the exact newly collected public suite task before execution. The rerun proved alpha/beta names, 155/215ms budgets, and `last-alpha`/`last-beta` remain distinct.
- Lifecycle logging now runs inside a merge-preserving logger layer with the body. A per-test capture logger remains silent but records hang context; trace start/end messages are emitted only for `BEEP_TEST_TRACE=1` or CI, and carry matching annotations. A fixture-provided user logger proves trace-off silence, explicit/CI gating, diagnostic duration, and success/failure/interruption outcomes without replacing the user logger or TestConsole.
- Focused Bun-native supporting run after these corrections: `bunx --bun vitest run test/Vitest.runtime.test.ts --pool=threads`, exit 0, 1 file / 6 tests passed, 19.44s. This is not yet the required package-script or Node acceptance receipt.
- 2026-09-08 continuation acknowledgement: the working review also identifies a distinct property-deadline defect. A fresh full `task.timeout` watchdog per generated trial does not protect the aggregate property run. Final acceptance therefore requires a task-local absolute deadline captured at public registration/execution context, shared across trials and shrinking, with lifecycle diagnostics emitted once for the property run rather than once per sample. The prior single-trial property fixture is supporting surface evidence only until this is implemented and exercised with cumulative short trials.
- Implemented registration-local property-run state: the first actual `TestContext` fixes one live monotonic deadline, all generated trials and shrinking consume the remaining budget, and the same context's public `onTestFinished` hook emits one end lifecycle record. The state is held in the individual property registration closure, so concurrent properties cannot share task identity, deadline, log, or outcome data.
- Added cumulative short-trial and delayed-layer concurrent-property subprocess cases. The first correction run exposed two fixture defects rather than production regressions: `Effect.promise` had been given a Promise-constructor resolver instead of its required `() => Promise` thunk, and a 10ms OS-timer fixture lost to Vitest before its mathematically correct 5ms watchdog on this run. Corrected the API usage and used the same half-budget branch at 25ms. Targeted rerun: 1 file passed, 3 corrected tests passed / 5 skipped, exit 0, 8.23s.
- The direct Effect compiler initially rejected the foreign Vitest callable because its exported multi-argument signatures had no pipeable counterparts. The facade now supplies implemented callback-first and options-first data-last forms while retaining the original data-first delegation; no diagnostic directive or tsconfig change was used. Direct compiler exit is now 0.
- A repo-cli audit inbox row surfaced during this lane. It is unrelated to the owned `@beep/test-utils` surface, and the contract assigns inbox acknowledgement/waiver to the orchestrator, so this lane neither acknowledged nor mutated it.
- 2026-09-08 final working-review acknowledgement: the aggregate property correction is accepted only with whole-run deadline, seed/run-count/shrinking preservation, one lifecycle, and real concurrent isolation evidence. The targeted cumulative and concurrent-property subprocesses now cover those mechanics, but they remain subject to the final cross-runtime suite.
- The current single-case `each` registration is not acceptance-ready because it restarts Vitest's `%#`/`%$` formatter index for every case. This is a concrete semantic regression independent of the solved metadata bleed. The final public seam must preserve one original collection call—including tuple/object interpolation, escaped-percent rendering, duplicate values, task options, and callback case-only arity—while binding each collected task to the matching callback execution without a private runner import or copied implementation.
- The earlier alpha/beta run is retained as a reproduced failure: the module-global current-test lookup gave alpha beta's metadata and allowed Vitest's outer timeout to win. It is not being downgraded to a theoretical concern; final `each` collection and concurrent execution evidence must close both that isolation failure and title/index fidelity together.

## Final design and correction closure

### Public integration seam

- The implementation imports only public `@effect/vitest`, Vitest, and Effect APIs. It does not import or reproduce rc.112 private runner code. Ordinary callback-bearing methods use their supplied public `TestContext`; effect properties retain one registration-local state shared by the callbacks FastCheck invokes for that task.
- Case-only `each` cannot receive a fabricated context. At collection time the wrapper asks the original enhanced tester to provisionally collect the whole case array, retaining Vitest's own formatted public task names and options. It then removes only those provisional collector tasks, registers the real cases individually so each execution closes over its own collected task, and restores the exact Vitest-formatted name before suite finalization. This keeps callback arity/case values intact and avoids the runtime-global current-test lookup.
- The fixture independently collects original and instrumented tasks and compares their names and complete options before execution. It covers duplicate tuple values, `%#`, `%$`, `%%`, `%s`/`%d`, object `$label` and nested interpolation, concurrency, and all eight original/instrumented callbacks. The first hardcoded expected-name oracle omitted Vitest's trailing case rendering; the direct original-versus-instrumented comparison already passed, and the corrected rc.112/Vitest 4.1.11 oracle then passed.
- Properties use the first real `TestContext.task` to fix an absolute live-monotonic deadline. Every generated trial and shrink consumes the remaining deadline instead of receiving a fresh timeout. The same public context registers one `onTestFinished` lifecycle completion. State, last log, deadline, outcome, and completion callback live in the individual property registration closure, not module-global storage.
- The public callable retains the original data-first Vitest surface and adds implemented callback-first and options-first data-last forms required by the Effect compiler. All effect/live call, skip, skipIf, runIf, only, each, fails, and prop methods delegate to the original public tester. Layer callbacks recursively instrument `MethodsNonLive` without adding `live`.

### Working-review defects

| Review item | Closure and evidence |
| --- | --- |
| Eager watchdog log read | `TestHang` is constructed only after the live sleep expires. The frozen-TestClock fixture reports `distinctive-watchdog-log`; concurrent each/property fixtures retain distinct last logs. |
| Lifecycle outside logger | Start, end, outcome, duration, and watchdog diagnostics run under the merge-preserving logger layer. Trace-off, `BEEP_TEST_TRACE=1`, CI, success, ordinary failure, defect, interruption, and watchdog cases are exercised. Diagnostic logs are gated; the typed failure still propagates with tracing off. |
| Added whole-body scope | Logger construction uses `Layer.buildWithScope` against the upstream test `Scope`; it does not wrap the body in a replacement `Effect.scoped`. The watchdog fixture proves body release on loser interruption, and nested layer tests prove per-test finalizers. |
| Tiny positive timeout | Every finite positive task timeout gets a strictly smaller budget; values through 25ms use half, so 1ms maps to 0.5ms. Zero and Infinity disable the watchdog. A 25ms real-run case proves the branch without claiming sub-millisecond host timer precision. |
| Module-global task lookup | Removed from runtime execution. The reproduced failure was alpha inheriting beta metadata and reaching Vitest's 180ms timeout. Final concurrent fixtures prove separate names, 155/215ms each budgets, property deadlines, and last logs. |
| Whole-property timeout | Cumulative 60ms trials under a 180ms task fail through the shared watchdog near its 155ms deadline rather than Vitest's outer timeout. The final receipt retains seed 4242 and one shrink, one lifecycle start/end, finalizer/log evidence, and concurrent isolation. |
| `each` index/title reset | The original public tester now performs whole-array formatting before isolated execution registration. Original and instrumented task names/options match for indexed, escaped, tuple, object, nested, and duplicate cases; all cases execute. |

### Behavior matrix

| Contract surface | Final proof |
| --- | --- |
| Callable/plain and pipeable | Plain Vitest callback plus callback-first/options-first data-last registrations pass; Effect compiler accepts the exported overloads without a directive. |
| Conditional/selection/failure | skip, skipIf, runIf, expected-failure, and an isolated real `.only --allowOnly` run pass. |
| each/property | Case-only each arity, original titles/options, duplicates, seeds, `fcRuns` floors, shrinking, generated values plus `TestContext`, aggregate deadlines, and concurrency pass. |
| named/unnamed/nested layer | Shared acquisition occurs once, per-test cleanup completes, nested layer sees the same provided service/memoized outer layer, unnamed registration works, and nested methods have no `live`. |
| timeout/source identity | Concrete public task names and resolved task timeout—not hook timeout or registration guesses—drive failures. A 1s layer hook with a 200ms test yields a 175ms watchdog. |
| environments | Frozen `TestClock`, live mode, explicit TestEnv, and `excludeTestServices` all pass without requiring `TestClock.withLive` or replacing the body clock. |
| failure semantics | Success, typed failure, defect, interruption, watchdog loser cancellation, body finalization, and preserved original failure text pass. |
| tracing | User logger remains merged; local capture does not bleed between concurrent tasks; trace/CI gating and success/failure/interrupted/watchdog outcomes pass. Duration is diagnostic only; reporter timing remains authoritative for P1/P2. |

`TestHang` is an annotated schema-first tagged error with a non-empty resolved name, finite positive budget, and optional last log. Its message now includes those fields so Vitest's JSON reporter retains actionable evidence; direct and FastCheck-wrapped failures keep their original error semantics.

## Verification receipts

- Runtime selection: Bun `1.4.1` from the command-scoped requested directory; Vitest `4.1.11`; Node `~/.nvm/versions/node/v24.20.0/bin/node`, version `v24.20.0`.
- Required unmodified package command: `bun run test`, exit 1 after 60.01s. Vitest's default fork pool failed to start workers for all 10 files (`Timeout waiting for worker to respond`); no test body ran. This is the same managed-sandbox pool startup condition reproduced earlier, not a source assertion receipt, and the command was not blindly repeated.
- Bun-native package-script proof on final source: `bun run test -- --pool=threads`, exit 0; 10 files passed; 66 passed, 1 expected failure, 9 skipped (76); 34.41s. This still executes the authoritative package `bun run test` script with Bun-native Vitest, changing only the public pool runtime argument needed in this sandbox.
- Node-native focused proof on final source: `node ../../../../node_modules/vitest/vitest.mjs run test/Vitest.test.ts test/Vitest.runtime.test.ts --pool=threads`, exit 0; 2 files passed; 23 passed, 1 expected failure, 2 skipped (26); 57.07s. Nested fixtures use the same `process.execPath`, so the integration subprocesses also ran under Node.
- Node harness attribution: Effect child-process combined and separate output streams were empty under the Node Vitest worker despite correct exits/file effects. The final portable fixture runner uses public `node:child_process.spawn` inside `Effect.callback`, kills the child on interruption, and transports assertions through Vitest's explicit JSON output file. This is test harness code only; production behavior is unchanged.
- Direct Effect compiler: `node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc -p packages/tooling/test-kit/test-utils/tsconfig.check.json`, final exit 0 in 0.49s. The managed `bun run check` launcher had separately failed with environment-only `spawnSync ~/.nvm/versions/node/v24.20.0/bin/node EPERM`; the same compiler executable is the successful supporting proof.
- Changed-file Biome: `bunx --bun biome check src/Vitest.ts src/Vitest.errors.ts src/internal/VitestInstrumentation.ts src/internal/VitestRuntime.ts test/Vitest.test.ts test/Vitest.runtime.test.ts --max-diagnostics=100`, exit 0; 6 files checked, no fixes required (final formatting pass 0.98s).
- Package docgen: `bun run docgen`, final exit 0; 13 modules checked and 36 examples typechecked. The first run correctly rejected the new example's root `assertTrue` import; changing it to the supported `@effect/vitest/utils` facade closed the introduced defect. Normal package docs/proof files were regenerated only as command output, not hand-authored lane changes.

## Changed paths

- `packages/tooling/test-kit/test-utils/src/Vitest.ts`
- `packages/tooling/test-kit/test-utils/src/Vitest.errors.ts`
- `packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts`
- `packages/tooling/test-kit/test-utils/src/internal/VitestRuntime.ts`
- `packages/tooling/test-kit/test-utils/test/Vitest.test.ts`
- `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts`
- `packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/runtime.test.ts.txt`
- `goals/effect-vitest-canon/history/lanes/p0e-instrumented-it.md`

No root barrel, manifest, lockfile, config, timeout/floor, detector, graph, baseline, MemoryFileSystem, packet/charter, or other package source was edited by this lane.

## Remaining orchestrator acceptance

- Move the existing pinned `@effect/vitest` declaration from devDependencies to dependencies and review the lockfile, as already approved; this lane did not edit either.
- Run mandatory full `package-verify @beep/test-utils` and evaluate the unmodified default-fork package command in the orchestrator environment. The repo-cli P0 inbox row remains unacknowledged and orchestrator-owned.
- Revalidate the instrumented-subpath charter worked example and complete P0e acceptance/publication. No P0.5 adoption, migration, PR gating, or later-phase work was performed here.

## Root final-source regression acknowledgement

- 2026-09-08: resumed the same P0e source lane after the successful property-budget handoff. Root's independent comparisons found two introduced regressions; the earlier green focused receipts remain supporting evidence but are not final acceptance.
- The `each` provisional whole-array collection, task-array truncation, and per-case recollection are invalid. They preserve only the rewritten display name: later cases retain the first case's `index`/`ordinal` in `fullName` and `fullTestName`, while the earlier `task.options` comparison inspected a nonexistent field. The correction must retain the one original public collection and compare actual `timeout`, `concurrent`, `retry`, `repeats`, `mode`, `fails`, `meta`, and `tags` fields without mutating collected tasks or registries.
- Registration-local property state is also invalid across Vitest `repeat`/`retry` executions. Root reproduced an immediate second-execution `TestHang` with the placeholder `5e-324ms` budget. The correction must allocate state per real Vitest execution, share it only across that execution's FastCheck trials and shrinking, reset lifecycle/last-log state on later executions, and report a meaningful configured budget after deadline exhaustion.
- The source-backed candidate seam is Vitest's public `aroundEach` `TestContext` combined with an execution-local context carrier. The standard `node:async_hooks` API is explicitly authorized for this Node/Bun package, but it is acceptable only with delayed/concurrent Bun and Node proof. `TestRunner.setTestFn` is not a setter and will not be used. No silent uninstrumented fallback, private runner copy, collected-task mutation, or global TestEnv/configuration change is accepted.

## Execution-context correction progress

- Vitest 4.1.11 runner source confirms `callAroundEachHooks` is inside both the repeat and retry loops and supplies the concrete `test.context`. The correction registers the public `aroundEach` hook and carries that context with standard `AsyncLocalStorage`; it does not use `getCurrentTest`, `setTestFn`, a task registry, or a private runner import.
- `each` now delegates the complete original case array exactly once. No provisional tasks are collected, removed, renamed, or re-collected. The case-only Effect callback reads its own execution context from the async-local boundary, so Vitest remains the sole owner of `%#`/`%$`, escaped-percent, tuple/object interpolation, duplicate values, full names, and collected options.
- Each public repeat/retry attempt receives a fresh execution-local property-state map. A property registration is only the lookup key within that attempt; all FastCheck trials and shrinking in the attempt share its deadline, lifecycle, last body log, and sticky failure outcome. The property `TestHang` reports the original configured watchdog budget after the absolute deadline is exhausted, never `Number.MIN_VALUE`.
- Lifecycle and watchdog logs remain under the merged diagnostic logger, but the last-log capture logger now wraps only the user body. Consequently trace start/end/watchdog messages cannot turn a no-body-log hang from `None` into wrapper-generated evidence.
- Unchanged root probes: the corrected invocation using the probe directory as Vitest root passed identity 5/5 (exit 0, 4.76s reported) and repeat 2/2 (exit 0, 4.86s reported) with Bun 1.4.1/Vitest 4.1.11. An initial identity invocation from repository root found no files because the probe config's relative include was resolved there; it exited before collection and was immediately attributed rather than treated as source evidence.
- Owned regressions now project actual `name`, `fullName`, `fullTestName`, `timeout`, `concurrent`, `retry`, `repeats`, `mode`, `fails`, `meta`, and `tags` from original and instrumented collected tasks. Separate real repeat/retry fixtures assert attempt-local lifecycle counts, a 75ms configured budget, `None` after a no-body-log repeated hang, and distinct retry body logs. The focused two-case rerun passed 2/2 (exit 0, 10.71s reported).

## Final execution-context handoff

This section supersedes the earlier provisional-collection design text while retaining its receipts as historical evidence. The final implementation has no provisional collection, suite-task truncation, task renaming, per-case recollection, `getCurrentTest`, `setTestFn`, or silent `task === undefined` return-self path.

### Corrected public seam

- Public Vitest `aroundEach` establishes one `AsyncLocalStorage` value per actual repeat/retry attempt. The installed runner calls this hook inside both nested execution loops and supplies the concrete `TestContext`; the async-local value remains isolated through delayed promises and Effect fiber execution on both Bun and Node.
- The instrumented `each` invokes the original enhanced tester's `each(cases)` once with the entire original case collection and its original callback. Vitest therefore constructs every task identity and option itself. The case-only callback gets no fabricated argument; it reads only its execution's public context from the async-local carrier.
- Each property registration contributes only an opaque lookup key. Every execution has a new map from that key to a new state, so retries and repeats reset start/deadline/outcome/last-log/finish data. Within one execution, FastCheck trials and shrinking resolve the same state and absolute deadline. A prior failure outcome is sticky across later shrink calls.
- A missing async-local context for `each` or property is now a schema-first `TestContextUnavailable` typed failure. Supported methods cannot silently bypass instrumentation. Ordinary call/skip/only/fails/conditional callbacks continue to use the `TestContext` they receive directly.
- The capture logger surrounds only the user body. Trace lifecycle and watchdog messages still run beneath the configured merge-preserving logger layer, but cannot overwrite the body's last-log evidence. The repeated no-body-log watchdog encoded `lastLogLine: None`; its first execution's body log did not leak into the second.

### Regression closure

| Reproduced regression | Final evidence |
| --- | --- |
| Later `each` cases retained index zero in `fullName`/`fullTestName` | Unchanged independent identity probe passed 5/5. The owned original-versus-instrumented fixture also passed after comparing the real name/full-name fields and actual timeout/concurrency/retry/repeat/mode/fails/meta/tags fields. Duplicate tuple values, object interpolation, `%#`, `%$`, and escaped percent formatting remain owned by the one original collection. |
| Property deadline survived a Vitest repeat and produced `5e-324ms` | Unchanged independent repeat probe passed 2/2. Owned repeat/retry fixtures passed: the repeat's second no-body-log execution reported the configured `timeoutMillis: 75` and `None`, while retry attempt logs and one start/end lifecycle per attempt remained distinct. |
| Concurrent metadata previously bled alpha into beta | The async-local carrier replaces the module-global lookup and was exercised by the complete concurrent each/property/delayed-layer matrix in both final runtime runs. Concrete identities, timeouts, and body logs remained isolated. |
| Wrapper diagnostics could become the last body log | Capture is now body-only. Trace-enabled repeat evidence contains lifecycle/watchdog events in the sink while the typed hang retains `None`; existing watchdog and concurrent cases retain their distinctive body logs. |

The first owned correction run exposed two fixture-oracle issues and exited 1: an undeclared Vitest tag is rejected before collection, and FastCheck's JSON failure wrapper omits the nested typed error text while the explicit trace sink preserves its structured fields. The fixture now compares the valid collected `tags` field without requesting an undeclared tag and asserts the structured `timeoutMillis`/`lastLogLine` receipt. The corrected focused rerun passed. These were test-fixture corrections; production behavior was unchanged between the two runs.

### Final commands and receipts

- Runtime selection: command-scoped Bun resolved to `~/.local/share/mise/installs/bun/1.4.1/bin/bun`, version `1.4.1`; Vitest `4.1.11`. Node resolved to `~/.nvm/versions/node/v24.20.0/bin/node`, version `v24.20.0`.
- Unchanged identity probe: `bunx --bun vitest run --root .beep/p0e-independent-review --config vitest.config.mjs`, exit 0; 1 file, 5/5 tests, Vitest duration 4.76s. The earlier root-cwd invocation exited 1 with no files collected because the unchanged relative include was resolved against the wrong root; it is invocation attribution only.
- Unchanged repeat probe: `bunx --bun vitest run --root .beep/p0e-independent-review --config repeat.config.mjs`, exit 0; 1 file, 2/2 tests, Vitest duration 4.86s.
- Corrected owned regression selection: `bunx --bun vitest run test/Vitest.runtime.test.ts --pool=threads -t 'resets property lifecycle|preserves public each collection'`, exit 0; 1 file, 2 passed / 9 skipped, Vitest duration 10.71s.
- Final Bun-native package-script proof: `bun run test -- --pool=threads`, exit 0; 10 files passed; 67 passed, 1 expected failure, 9 skipped (77 total); Vitest duration 40.13s. The yielded command was followed through its own session to the real exit rather than inferred from another process namespace.
- Final Node proof: `node ../../../../node_modules/vitest/vitest.mjs run test/Vitest.test.ts test/Vitest.runtime.test.ts --pool=threads`, exit 0; 2 files passed; 24 passed, 1 expected failure, 2 skipped (27 total); Vitest duration 69.39s. The subprocess fixtures inherited Node through `process.execPath`, including concurrent/delayed layer, each, property, retry, and repeat cases.
- Direct Effect compiler: `../../../../node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc -p tsconfig.check.json`, exit 0, 0.97s.
- Changed-file Biome: `bunx --bun biome check src/Vitest.ts src/Vitest.errors.ts src/internal/VitestInstrumentation.ts src/internal/VitestRuntime.ts test/Vitest.test.ts test/Vitest.runtime.test.ts --max-diagnostics=100`, exit 0; 6 files checked, 0.98s reported by Biome.
- Package docgen: `bun run docgen`, exit 0; 13 modules and 37 titled examples checked, 3.19s wall time.

### Final changed paths

- `packages/tooling/test-kit/test-utils/src/Vitest.ts`
- `packages/tooling/test-kit/test-utils/src/Vitest.errors.ts`
- `packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts`
- `packages/tooling/test-kit/test-utils/src/internal/VitestRuntime.ts`
- `packages/tooling/test-kit/test-utils/test/Vitest.test.ts`
- `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts`
- `packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/runtime.test.ts.txt`
- `goals/effect-vitest-canon/history/lanes/p0e-instrumented-it.md`

No manifest, lockfile, root barrel, Vitest/global configuration, timeout/property floor, MemoryFileSystem, detector, graph, baseline, packet/charter, or other package source was edited by this correction. Root's separately reviewed dependency declaration move is preserved.

### Remaining root acceptance

- Run the mandatory aggregate `package-verify @beep/test-utils` on this final source and own any P0 inbox interaction. This lane did not run or acknowledge that gate.
- Revalidate the instrumented-subpath charter example and complete P0e acceptance/publication. No P0.5 adoption or later-phase work was started.

## Plain callable compatibility acknowledgement

- 2026-09-08: resumed the same source session after root's completed aggregate package audit for one narrow callable correction. The completed async-local instrumentation, identity/repeat fixes, and their successful/failing receipts remain frozen.
- Root's unchanged probe establishes an introduced overload regression: public Vitest accepts `it(function namedTitle() {})` as a Function title with an omitted handler and registers a named todo. The facade currently intercepts every single Function argument as callback-first currying, returns a function, and registers no task.
- Original data-first Vitest behavior takes precedence. The correction will delegate a lone Function directly to the original callable. Callback-first currying remains only where an explicit numeric timeout disambiguates it; options-first currying remains distinguishable by its object first argument. No fake registration, task mutation, instrumentation redesign, or compiler suppression is permitted.

## Plain callable compatibility handoff

- Corrected `makeInstrumentedIt` without touching the frozen instrumentation/error roles. Runtime dispatch now selects callback-first currying only for `(Function, number)`. A lone Function, `(Function, handler)`, and every other original data-first shape delegate directly to the public Vitest callable. Object-options-first and zero-argument data-last construction remain separate from Function-title dispatch.
- The original data-first overloads remain ordered before their Effect-required companion signatures. Thus `it(function namedTitle() {})` is statically `void` and dynamically registers the original todo, while the existing explicit-timeout callback-first form remains a function from title to registration. The first declaration-narrowing attempt made the runtime distinction but caused the Effect compiler's `missingPipeableSignature` diagnostic; restoring the required companion declarations while preserving the precise runtime predicate closed that introduced type-law failure without suppression.
- Added an owned public registration/type regression in `test/Vitest.test.ts`. It captures the current public suite around `it(function instrumentedFunctionTitle() {})`, verifies exactly one task named `instrumentedFunctionTitle` in `todo` mode, and asserts the call result is `void`. Existing explicit-timeout callback-first and object-options-first tests remain unchanged and green.
- The unchanged root callable probe was not edited. Final command: `bunx --bun vitest run --root .beep/p0e-independent-review --config callable.config.mjs`, exit 0; 1 file, 1 passed / 2 todo (3), Vitest duration 1.58s.
- Final Bun package-script selection: `bun run test -- test/Vitest.test.ts --pool=threads`, exit 0; 1 file, 14 passed / 1 expected failure / 2 skipped / 1 todo (18), Vitest duration 1.73s.
- Final Node selection: `node ../../../../node_modules/vitest/vitest.mjs run test/Vitest.test.ts --pool=threads`, exit 0; 1 file, 14 passed / 1 expected failure / 2 skipped / 1 todo (18), Vitest duration 3.59s.
- Final direct Effect compiler: `../../../../node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc -p tsconfig.check.json`, exit 0, 0.47s.
- Final changed-file Biome: `bunx --bun biome check src/internal/VitestRuntime.ts test/Vitest.test.ts --max-diagnostics=100`, exit 0; 2 files checked, no fixes required.
- Final package docgen: `bun run docgen`, exit 0; 13 modules and 37 examples checked.
- The full Effect runtime matrix, independent identity/repeat probes, and aggregate package-audit receipts recorded above remain valid supporting evidence: this correction did not edit `VitestInstrumentation.ts`, `Vitest.errors.ts`, `Vitest.runtime.test.ts`, or the instrumentation fixture. Root retains final aggregate verification after this source handoff.

Changed in this correction:

- `packages/tooling/test-kit/test-utils/src/internal/VitestRuntime.ts`
- `packages/tooling/test-kit/test-utils/test/Vitest.test.ts`
- `goals/effect-vitest-canon/history/lanes/p0e-instrumented-it.md`

No public facade JSDoc change was necessary. No task registry, probe, fixture, generated artifact, manifest, lockfile, configuration, dependency, detector, graph, packet/charter, timeout/property floor, MemoryFileSystem, or unrelated source was changed.
