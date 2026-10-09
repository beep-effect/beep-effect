### sol-1-1
- file: scratchpad/effected/commands/ToolDiscovery.ts:291
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`); the negative-evidence contract at `ToolDiscovery.ts:283–287` and `scratchpad/test/commands/ToolDiscovery.test.ts:370`.   evidence: A read-only `bun -e` probe ran the same sequence against the pinned oracle and the port: resolve with the global tool present and the local tool absent; make the scripted local tool available; resolve with `source: "local"`. Both returned `{ first: "global", second: "ToolNotFoundError", afterInvalidate: "local" }`. The second resolve performed no new probe. The infinite TTL condition uses `global.found || local.found`, retaining the missing location whenever the other location exists.
- failure: A local tool installed during the process remains unavailable indefinitely when a global copy was already found. The reverse case also retains stale global absence. This is a verified upstream bug, rather than a port regression; the existing installation test covers only initially absent tools in both locations.
- fix: Give incomplete evidence a zero TTL whenever a probed location is missing. Preserve infinite TTL for complete positive evidence. Add the partial-install regression, adjust the existing partial-evidence probe-count assertion at `ToolDiscovery.test.ts:366`, and record the change under section 14 as an `upstream-bug` deviation.

### sol-1-2
- file: scratchpad/effected/commands/Tool.ts:16
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: `ToolSource` and `MismatchPolicy` are named, reused, annotation-bearing domains built with `S.Literals`. The same pattern appears in `LocalExec.ts:24` (`Launcher`) and `ToolDiscovery.ts:38` (`ResolvedSource`). A read-only runtime probe confirmed that all four lack `.Enum`, `.is`, and `.$match`.
- failure: The port retains named literal domains in the form reserved for anonymous inline unions, leaving the required LiteralKit surface unavailable. These declarations remain present at the commit whose supplied gates are green.
- fix: Replace these four named `S.Literals(...)` declarations with `LiteralKit(...)`, retaining their literals, annotations, and same-name type exports. Leave anonymous inline unions unchanged.

### sol-1-3
- file: scratchpad/effected/commands/ToolDiscovery.ts:199
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3 explicitly forbids native `JSON.parse` and permits synchronous, non-throwing Schema Result/Option codecs.   evidence: `extractVersion` still executes `JSON.parse(stdout)` inside a native `try/catch`. This ordinary synchronous helper remains in the reviewed green source; replacing JSON parsing in `Run.ts` did not cover this path.
- failure: JSON version discovery bypasses the required Schema codec boundary and implements its own exception-to-absence conversion.
- fix: Decode with `S.decodeUnknownOption(S.UnknownFromJsonString)` or the equivalent Result codec. Return `O.none()` on decoding failure and retain the existing dotted-path traversal and string check.

### sol-1-4
- file: scratchpad/effected/commands/ToolDiscovery.ts:158
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-12b.   evidence: `Probe` and `Evidence` at lines 158 and 164 are named pure-data models, constructed by the probe and cache lookup and reused by resolution policy. Both exist only as interfaces. They contain no service methods, overloads, or other type-level machinery covered by the interface carve-out.
- failure: The cached discovery model has no owning runtime schema; its shape is defined solely by erased interfaces and separately constructed object literals.
- fix: Define module-local, identity-annotated schemas for `Probe` and `Evidence`, with same-name derived types. `S.Struct` can preserve the current plain-object representation without changing cache behavior.

### sol-1-5
- file: scratchpad/effected/commands/internal/capture.ts:16
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 7 requires typed errors to extend `S.TaggedError` directly.   evidence: `OutputTooLarge` remains a `Data.TaggedError` with a type-only `limit` field and no IdentityComposer identity. Its “never escapes” rationale is contradicted by `Run.ts:324`, which puts this exact error into the public `CommandOutputError.cause`.
- failure: The capture failure exposed through the public error’s cause lacks the required schema-backed error model and identity.
- fix: Convert `OutputTooLarge` to an identity-annotated `S.TaggedError` with an annotated `limit` field, preserving its `_tag` and payload. Update its construction site accordingly.

### sol-1-6
- file: scratchpad/effected/commands/Run.ts:11
- class: law   severity: required
- standard: AGENTS.md “Code Laws”; `standards/effect-laws-v1.md` law 2; the operator’s Imports step requires one Effect module per import.   evidence: `Run.ts` imports both `ChildProcess` and `ChildProcessSpawner` from the `effect/process` barrel. The same barrel imports remain in `LocalExec.ts`, `ScriptedSpawner.ts`, `ToolDiscovery.ts`, and the corresponding tests; tests also import `TestClock` through `effect/testing`. A read-only import probe confirmed that `effect/process/ChildProcess`, `effect/process/ChildProcessSpawner`, and `effect/testing/TestClock` resolve successfully.
- failure: The dedicated-module import conversion is incomplete despite the supplied green gates.
- fix: Use dedicated namespace imports for each referenced Effect module, preserving type-only imports where appropriate.

### sol-1-7
- file: scratchpad/effected/commands/Run.ts:27
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; S2 is deferred by operator order.   evidence: The module retains `@remarks` and `@example` carriers throughout its source. Public declarations such as `DEFAULT_MAX_OUTPUT_BYTES`, `CommandOutput`, and the error classes lack the required canonical category, since tag, and value-level Example.
- failure: The carried upstream JSDoc does not yet satisfy the repository’s documentation grammar and export documentation requirements.
- fix: During S2, convert legacy carriers to titled body sections, retain all upstream prose, and add meaningful Examples, canonical `@category`, and `@since 0.0.0` to owning public declarations.

### sol-1-8
- file: scratchpad/effected/commands/README.md:109
- class: docs   severity: backlog
- standard: D9 and section 14 require law-forced observable deviations to be recorded in README Port notes and the ledger; documentation findings are backlog by operator order.   evidence: README Deviations says `None`, and the commands ledger row has `deviations: []`. Read-only differential probes showed malformed JSON changing from a `SyntaxError` cause in the oracle to a `SchemaError` cause in the port, and `CommandOutput.make` accepting `NaN`/±`Infinity` upstream but throwing in the port. The exported `SECRET_FLAGS` also changes from `ReadonlySet<string>` to `MutableHashSet<string>`.
- failure: Callers cannot discover the law-forced changes to error causes, numeric acceptance, and the public collection surface from the required deviation records.
- fix: Record these changes with their forcing rules, affected APIs, and focused compatibility evidence. Preserve the law-compliant implementations.

### sol-1-9
- file: scratchpad/effected/commands/README.md:51
- class: docs   severity: backlog
- standard: AGENTS.md “Code Laws”; `standards/effect-laws-v1.md` law 2 also applies to Markdown examples; S2 is deferred.   evidence: Both Quick start examples still import from the root `effect` barrel, at lines 51 and 65, and demonstrate `@effected/commands` rather than the lab port.
- failure: The adapted README teaches forbidden Effect import syntax and directs readers to the upstream package instead of exercising the port.
- fix: During S2, use dedicated Effect module imports and the lab’s supported entrypoint in the runnable examples.

### sol-1-10
- file: scratchpad/effected/commands/Tool.ts:16
- class: test   severity: backlog
- standard: D10’s per-exported-schema round-trip property floor; S3 is deferred.   evidence: Searching all commands tests for property testers and Arbitrary usage found only the two Redaction properties. There are no generated encode/decode round-trip properties for the exported schemas, including the literal domains, version-probe variants, `Tool`, `ExecContext`, `ResolvedTool`, or command result/error schemas.
- failure: The required schema properties are absent; the retained example tests do not establish the round-trip contract across generated values.
- fix: During S3, add schema-derived round-trip properties for each exported schema, comparing decoded values with schema-derived equivalence and using `fcRuns(...)`.

### sol-1-11
- file: scratchpad/test/commands/Redaction.test.ts:103
- class: test   severity: backlog
- standard: D10; `goals/effect-vitest-canon/SPEC.md` section 1.3 requires explicit `{ arbitrary: fcRuns(n) }` options; S3 is deferred.   evidence: Neither Redaction property passes Arbitrary options, and the commands tests contain no `fcRuns` import or call.
- failure: These properties use the tester’s default run configuration and do not inherit the repository’s required CI run floor and seed through `@beep/fc-runs`.
- fix: Add `{ arbitrary: fcRuns(400) }` to both properties during S3.

### sol-1-12
- file: scratchpad/test/commands/LocalExec.test.ts:120
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5; `.patterns/testing-patterns.md`, “Choose assertions by value”; S3 is deferred.   evidence: Tests assert Option containers through `O.isNone`, manual fail-and-narrow branches, and deep equality against `O.some`. Examples also occur in `ToolDiscovery.test.ts:64–66`. `ScriptedSpawner.test.ts:131` uses an Exit predicate assertion instead of the canonical Exit helper.
- failure: The tests retain upstream container assertion idioms rather than the required public `@effect/vitest/utils` helpers.
- fix: During S3, use `assertNone`, `assertSome`, and the appropriate Exit helpers, preserving payload assertions and subsequent narrowing.

### sol-1-13
- file: scratchpad/test/commands/ToolDiscovery.test.ts:51
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14 requires `it.layer` for effectful layers and permits per-test provision only for pure stubs; S3 is deferred.   evidence: The `run` helper supplies `ToolDiscovery.layer` through per-test `Effect.provide`; that production layer is explicitly built with `Layer.effect` at `ToolDiscovery.ts:433`. The file-wide `strictEffectProvide` suppression leaves this migration outside the supplied diagnostic proof.
- failure: An effectful discovery layer is still built through the per-test provision pattern excluded by the test canon.
- fix: During S3, use scenario-specific `it.layer` blocks for discovery-layer tests. Preserve fresh scripted state and cache isolation between independent scenarios, and retain per-test provision for pure `Layer.succeed` stubs.

REQUIRED: 6
BACKLOG: 7