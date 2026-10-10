### sol-1-1
- file: scratchpad/effected/walker/Walker.ts:82
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and §14; `effect-tsgo/docs/rules/schema-number.md`   evidence: The pinned-oracle differential probe of `Walker.ascend("/a", { maxDepth: 0 })` returned an ordinary `Error` without `_tag` upstream, and a namespaced error with `_tag: "WalkerDefect"` in the port. Separately, decoding a tagged `DescendError` payload with `reason: "depthExceeded"` and `limit: Infinity` succeeded upstream and failed in the port because `Descend.ts:156` changes `Schema.Number` to `S.Finite`. Both the walker ledger row and README deviations section are empty.
- failure: Observable defect identity and accepted schema input differ from the oracle without the deviation record required by §14. The native-error law and `schemaNumber` diagnostic justify these changes, but passing their gates does not satisfy the deviation protocol.
- fix: Record the law-forced changes in the walker ledger and README, citing the native-error law and `schemaNumber`; add the smallest focused parity tests documenting the changed defect identity and non-finite-limit rejection.

### sol-1-2
- file: scratchpad/effected/walker/Descend.ts:36
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md §5; EFFECTED_PORT_GOAL.md D5   evidence: `DescendOptions`, `DescendRecordOptions` (:94), `UnreadableDirectory` (:108), `DescendResult` (:133), and `DescendFrame` (:198) remain plain data interfaces. `AscendOptions` in `Walker.ts:24` and `CompileAndExpandOptions` in `Expand.ts:34` also have no schema definitions. These are representable configuration, result, and traversal-state models, rather than service contracts or overload-only machinery.
- failure: Their runtime shapes, defaults, and invariants have no schema source of truth. For example, depth validity is independently implemented in upward and downward traversal, and result objects are constructed directly from interfaces. The green diagnostic gates have left this modeling requirement unenforced.
- fix: Define annotated schemas for these data models and derive their TypeScript types. Preserve the existing structural options and plain-object result contracts; keep invalid-option rejection in the defect channel, and use compatibility-preserving schema boundaries where needed.

### sol-1-3
- file: scratchpad/effected/walker/Descend.ts:156
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 20; standards/effect-first-development.md EF-13; standards/ARCHITECTURE.md §5   evidence: A read-only `S.decodeUnknownResult(DescendError)` probe accepted both `{ _tag: "DescendError", pattern: "**/*", path: "", reason: "depthExceeded" }` with no limit, and an `"unreadableDirectory"` payload carrying `limit: 1`. The message getter branches on `reason` at :160 and falls back to `"the depth cap"` when a depth-exhaustion payload lacks its limit.
- failure: The schema permits payload combinations contrary to the documented cases: depth exhaustion does not require its depth cap, and unreadability can carry the other case’s payload. Case-specific behavior operates directly on this optional-field bag.
- fix: Model the internal cases as a discriminated union with a required limit for depth exhaustion and no limit for unreadability. Preserve the upstream public bag at a compatibility boundary if required, normalize it before case-specific behavior, and record any externally observable tightening under §14.

### sol-1-4
- file: scratchpad/effected/walker/Descend.ts:159
- class: law   severity: required
- standard: standards/effect-first-development.md EF-3 and EF-19; AGENTS.md Code Laws   evidence: Native `JSON.stringify` remains in the `DescendError.message` getter at :159–162 and in `GlobExpansionError.message` at `Expand.ts:86`. A source scan confirms these calls at the reviewed commit; there is no walker entry in the runtime-law allowlist. The stated green gates therefore missed these remaining sites.
- failure: Both exported error classes still render their messages through native JSON serialization, contrary to the schema-codec requirement. Walker’s other diagnostic strings already use a schema JSON codec, leaving these getters inconsistent with the completed conversion.
- fix: Use a schema JSON-string codec with an explicit synchronous Result codec in the getters, preserving the oracle’s exact quoting, escaping, truncation, and message bytes.

### sol-1-5
- file: scratchpad/effected/walker/Descend.ts:402
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; standards/effect-first-development.md EF-38   evidence: The final matching-path order is produced by `results.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))`. This native array sort remains in production traversal code at the reviewed commit, and no walker runtime-law exception is recorded.
- failure: The walk’s sorting operation violates the explicit prohibition on native `Array.prototype.sort`, despite the reported green gates. This is a law finding, with no performance-regression claim.
- fix: Return the result of `A.sort(results, Order.String)` through `finish`, importing `effect/Array` as `A` and `effect/Order`. Preserve the existing lexical string ordering.

### sol-1-6
- file: scratchpad/effected/walker/Descend.ts:238
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2; AGENTS.md requirement to convert nullish absence to `Option` at boundaries   evidence: `typeOf` converts failed filesystem probes to `undefined` at :241 and returns `Effect<FileSystem.File.Info["type"] | undefined>`. `realPathOf` likewise returns `Effect<string | undefined, DescendError>` at :267–279. Those values flow into traversal decisions at :290, :303, :310, and :384.
- failure: Filesystem absence is carried through domain traversal as an undefined union instead of an `Option`. The platform boundary has already been crossed when the traversal branches on these sentinels.
- fix: Have the two internal probe helpers return `Option` values and consume them with Option combinators or guards. Preserve the current absorption policies, defect propagation, unreadable-directory recording, and returned public values.

### sol-1-7
- file: scratchpad/effected/walker/Expand.ts:94
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md Hard requirements, Carrier policy, and Kind-split Example law; operator deferral of S2   evidence: `compileAndExpand` retains `@remarks` at :94 and `@example` at :117, with no `@category` or `@since`. The same legacy carriers remain on Walker statics and Descend record-option documentation. Exported `DescendError`, `GlobExpansionError`, and `Walker` also lack the required value-level examples and export metadata.
- failure: The owning declarations do not yet satisfy the canonical JSDoc grammar and completeness requirements. The converted `descend` documentation covers only part of the module.
- fix: During S2, convert the remaining carriers to titled Example and Details/Gotchas sections, add canonical categories and `@since 0.0.0`, and provide meaningful error/class examples while retaining upstream explanatory content.

### sol-1-8
- file: scratchpad/effected/walker/README.md:51
- class: docs   severity: backlog
- standard: AGENTS.md Code Laws; standards/effect-laws-v1.md law 2 explicitly includes Markdown examples; operator deferral of documentation work   evidence: The quick-start example imports `{ Effect, Layer, Option, Path }` from the root `"effect"` barrel. The `findRoot` example repeats the root-barrel import at :70.
- failure: The carried README teaches imports prohibited by the port’s binding conventions.
- fix: Rewrite both examples to dedicated `effect/<Module>` imports, using the canonical `O` alias for Option, while preserving their behavior and explanatory prose.

### sol-1-9
- file: scratchpad/test/walker/Walker.test.ts:203
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; .patterns/testing-patterns.md “Choose assertions by value, not by tester”; operator deferral of S3   evidence: Option results are asserted with `assert.deepStrictEqual(found, O.some(...))` and `O.none()` throughout the upward suites. Invalid-depth tests assert only the Exit tag; `Descend.test.ts:111–112` also hand-checks the Failure tag and `Cause.hasDies`.
- failure: The tests use container equality and hand-written Exit checks instead of the canonical specialized assertions. Several invalid-depth assertions establish failure without independently checking the expected defect.
- fix: During S3, use `assertSome`/`assertNone` for Option results and the appropriate Exit assertion helpers with the expected defect Cause, retaining the existing payload and probe-order assertions.

### sol-1-10
- file: scratchpad/test/walker/Expand.test.ts:1
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and S3; standards/effect-first-development.md EF-10; operator deferral of S3   evidence: A scan of `scratchpad/test/walker/**` finds no property registrations, schema arbitraries, or `fcRuns` usage. The exported `DescendError` and `GlobExpansionError` schemas are exercised through example cases without encode/decode round-trip properties.
- failure: The module has not implemented the required property floor for its exported schemas. This is evidenced by the test source; no coverage percentage is inferred.
- fix: During S3, add canonical property tests for both exported error schemas using schema-derived arbitraries and `fcRuns`, asserting encode/decode fidelity for their supported payloads and nested causes.

REQUIRED: 6
BACKLOG: 4