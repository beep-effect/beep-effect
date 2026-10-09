### sol-1-1
- file: scratchpad/effected/cli/CliLogger.ts:132
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11 and D15; callable signatures must describe their runtime result.   evidence: An in-memory TypeScript probe assigned `makeCliLogger` to `(underActions?: (fiber: Fiber.Fiber<unknown, unknown>) => boolean) => (options?: CliLoggerOptions) => Logger.Logger<unknown, void>` and called `curried()({})`, with **zero semantic diagnostics**. Executing that call threw `TypeError: … is not a function`; supplying an actual `underActions` function succeeded.
- failure: The new curried overload promises a function when its optional argument is omitted or `undefined`. The dispatch predicate at line 133 selects the data-first implementation for those values, returning a logger object instead. A caller can therefore typecheck without assertions and fail at runtime.
- fix: Make `underActions` required in the curried overload. Preserve the existing data-first overload and its valid zero-argument logger constructor.

### sol-1-2
- file: scratchpad/effected/cli/CliLog.ts:229
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `readLevel`’s documented invalid-value behavior.   evidence: A read-only probe ran both the pinned upstream oracle and the port with `CliLog.layer({ format: "json", envVar: "TEST_LOG_LEVEL", plainLogger: false })`. For `constructor`, `CliLog.Level` was a **function**; for `__proto__`, it was an **object**. Both inputs emitted an error diagnostic and produced no invalid-level warning. The control input `invalid` returned `"None"`, warned once, and emitted no diagnostic.
- failure: Indexing the ordinary `LEVELS` object accepts inherited properties as log levels. These invalid environment values escape the declared `LogLevel` domain and enable diagnostics instead of taking the warning-and-`None` fallback. This is an upstream bug retained by the port and missed by the existing tests.
- fix: Normalize the key once and require `R.has(LEVELS, key)` before reading its value. Otherwise take the existing invalid-value branch. Add regressions for `constructor` and `__proto__`, and record the verified upstream deviation under §14.

### sol-1-3
- file: scratchpad/effected/cli/CliExit.ts:11
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; EFFECTED_PORT_GOAL.md operator step 4, requiring identity and annotations on schemas and fields.   evidence: `InvalidExitCodeError` supplies the composed identifier but omits the `$I.annote(...)` argument and leaves `message` unannotated. A read-only probe captured the defect from `CliExit.set(256)` and inspected its constructor: schema annotations contained only `identifier` and `~sentinels`; `message.ast.annotations` was absent. `AudienceConflictError` at `CliAudience.ts:19` has the same omission. `CliRuntimeError` has schema annotations, but its `message` field at `CliRuntime.ts:47` is also unannotated.
- failure: These newly introduced schemas do not satisfy the completed identity/annotation step. Tooling inspecting their ASTs receives no domain title or description for the first two errors and no field description for any of the three message fields. This is schema metadata work from step 4, separate from deferred S2 JSDoc conversion.
- fix: Add meaningful `$I.annote(...)` metadata to `InvalidExitCodeError` and `AudienceConflictError`, and annotate the three `message` fields with their domain meaning. Preserve their tags, fields, and error behavior.

### sol-1-4
- file: scratchpad/effected/cli/Cancelled.ts:11
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; S2 deferral in the review brief.   evidence: An exact-commit scan found legacy `@remarks`/`@example` carriers in **all 16 focus files**, with zero `@category` and zero `@since` tags in each. `Cancelled` also lacks the required value-level Example.
- failure: The carried documentation does not yet satisfy the repository’s carrier grammar, public-export metadata requirements, or value-level Example requirement. The green S1 gates do not establish S2 compliance.
- fix: During S2, convert the carriers to `**Details**` and titled `**Example** (Title)` sections, add canonical categories and `@since 0.0.0`, and supply meaningful Examples for value-level exports while retaining the upstream prose.

### sol-1-5
- file: scratchpad/effected/cli/ConfigIssueRenderer.ts:26
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Example quality and compilation”; EFFECTED_PORT_GOAL.md D4; S2 deferral in the review brief.   evidence: An in-memory compilation of the carried Example, using the port’s actual imports, reported `TS2304: Cannot find name 'configFile'`. The subsequent `catchTag` expression also reported TS2345 because the missing producer leaves no usable typed error channel.
- failure: The Example references a configuration loader that it neither defines nor imports, so it cannot serve as a compiling usage example.
- fix: Define a small, correctly typed configuration-loading effect or import and instantiate the intended loader before the `catchTag` call. Keep the example’s observable issue-rendering behavior.

### sol-1-6
- file: scratchpad/test/cli/CliFailure.test.ts:57
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md prohibition on `Effect.runSync` in tests; goals/effect-vitest-canon/SPEC.md D14; S3 deferral in the review brief.   evidence: `contextFor` calls `Effect.runSync` to build effectful rendering layers, and line 164 similarly runs an effectful schema decode synchronously. The first helper is called by the suite’s ordinary synchronous tests.
- failure: Effectful setup and decoding run outside the canonical Effect test lifecycle. Their services and execution are hidden inside synchronous helpers instead of being managed by the tester and layer harness.
- fix: Make the helpers return Effects, migrate their callers to `it.effect`, and provide the effectful setup through `it.layer` during S3.

### sol-1-7
- file: scratchpad/test/cli/CliTest.test.ts:18
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14; S3 deferral in the review brief.   evidence: All four tests in this file install `NodeServices.layer` using per-test `.pipe(Effect.scoped, Effect.provide(NodeServices.layer))`, at lines 18, 27, 35, and 46.
- failure: The scoped filesystem/process setup bypasses the required `it.layer` harness. These are effectful platform services, beyond D14’s allowance for per-test pure `Layer.succeed` or `Layer.mock` stubs.
- fix: Move `NodeServices.layer` into an `it.layer` suite and retain a per-test scope for the sandbox directory and child process resources.

### sol-1-8
- file: scratchpad/test/cli/Cancelled.test.ts:66
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10, requiring schema-derived encode/decode round-trip properties; S3 deferral in the review brief.   evidence: The suite contains fixed decode/encode assertions and enumerates both cancellation reasons, but has no schema-derived property, `Arbitrary` integration, or `fcRuns` configuration.
- failure: The exported `Cancelled` schema’s explicit property floor remains unmet. The existing examples provide useful coverage of its finite reason domain, but do not implement the required round-trip property.
- fix: Add a canonical schema-derived property that encodes and decodes `Cancelled`, checks schema equality and the preserved exit-code behavior, and uses `fcRuns(n)`. Retain the existing fixed assertions.

REQUIRED: 3
BACKLOG: 5