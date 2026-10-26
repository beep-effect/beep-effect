### fable-1-1
- file: scratchpad/effected/github-actions/Action.ts:134
- class: law   severity: required
- standard: D9 (behaviour-preserving; deviation only when a law forces it); standards/effect-laws-v1.md law 22 and standards/effect-first-development.md EF-14 both accept `Effect.fnUntraced`   evidence: Upstream `withStepDebugLogLevel` was a plain `Effect.gen` wrapper; the port chose traced `Effect.fn("withStepDebugLogLevel")`. node_modules/effect/dist/internal/effect.js:880-927 shows `Effect.fn(name)` wraps the body in `useSpan(name)` and pushes a `CurrentStackFrame`; `causePrettyError` (same file :184-247) renders those frames. Probe (`bun -e`, Effect.runPromiseExit + Cause.pretty on `Effect.fail(Boom.make(...))`): the `Effect.gen` form prints 4 lines, the `Effect.fn` form adds `    at withStepDebugLogLevel (...)` and `    at withStepDebugLogLevel (definition) (...)`; a `Effect.die("boom")` goes from `Error: boom` to three lines. `Action.run` prints `Cause.pretty(exit.cause)` as the `::debug::` block (Action.ts:272-274), so every failed action's runner output differs from upstream, and any installed Tracer now sees the whole user program under a new span. scratchpad/test/github-actions/Action.test.ts:145-151 only asserts that some `::debug::` line exists, so the gate missed it. No ledger/README deviation entry exists (README.md:337 `None`).
- failure: The `::debug::` diagnostics `Action.run` emits for every failing action gain two `at withStepDebugLogLevel` frames upstream never printed, and the caller's entire program is wrapped in an unrequested span named after a private helper; an unforced, unrecorded D9 deviation.
- fix: `const withStepDebugLogLevel = Effect.fnUntraced(function* <A, E, R>(program: Effect.Effect<A, E, R>) { ... })` — satisfies law 22 / EF-14 with no span and no stack frame, restoring upstream output byte-for-byte.

### fable-1-2
- file: scratchpad/effected/github-actions/ActionLogger.ts:299
- class: law   severity: required
- standard: D9; standards/effect-laws-v1.md law 22 and standards/effect-first-development.md EF-14 (`Effect.fnUntraced` for internal paths where tracing is not wanted)   evidence: Upstream `withBuffer` was `(label, effect, options) => Effect.gen(...)`; the port made it `Effect.fn("withBuffer")`. `withBuffer` is the public buffered step renderer (`withStep` at :339 delegates to it), so the caller's `effect` now runs inside a span named "withBuffer" with a `CurrentStackFrame` pushed; per the probe in fable-1-1 every failure raised inside a step gains `at withBuffer (...)` / `at withBuffer (definition)` lines in `Cause.pretty`, which `Action.run` prints as `::debug::`. No test asserts the exact `::debug::` body; no deviation is recorded.
- failure: Every `withStep`/`withBuffer` failure renders extra frames upstream never printed, and each step becomes a tracer span named after a private helper rather than the step label; unforced D9 deviation.
- fix: `const withBuffer = Effect.fnUntraced(function* <A, E, R>(label: string, effect: Effect.Effect<A, E, R>, options?: WithBufferOptions) { ... })`.

### fable-1-3
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:263
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 ("Do not `throw` ... in production domain logic") and the Schema section lines 101-104 / 491-492 ("Prefer Effect codecs by default ... map them into the boundary's typed error with `Effect.mapError`"; "Use `S.decodeResult` ... only for deliberately synchronous, non-throwing local paths")   evidence: `payload` does `Effect.try({ try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error), catch: ... })`: a non-throwing `Result` is unwrapped by throwing the `SchemaError` so that `Effect.try` can catch it again. Probe: `String(cause)` is now `SchemaError(Expected a valid JSON string)` where upstream rendered `SyntaxError: ...`, so the `detail` text also changed (ActionEnvironment.test.ts:216-222 asserts only `reason`/`name`). The tsgo `preferSchemaOverJson` rule forced dropping `JSON.parse`, not this throw-to-catch shape.
- failure: Domain code throws on the happy path of an Effect codec; the SchemaError round-trips through the JS exception channel instead of the typed channel, and the error detail diverges from upstream without a ledger entry.
- fix: `return yield* S.decodeEffect(Json)(raw).pipe(Effect.mapError((cause) => ActionEnvironmentError.make({ reason: "malformed", name: "GITHUB_EVENT_PATH", detail: `not valid JSON: ${cause.message}` })));` and drop the `Effect.try`.

### fable-1-4
- file: scratchpad/effected/github-actions/ActionInput.ts:337
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw` in domain logic); Schema section lines 101-104 and 491-492 (Effect codecs + `Effect.mapError`; Result codecs only for non-throwing paths)   evidence: `ActionInput.list` (:335-343) and `ActionInput.schema` (:428-432) both do `try { parsed = Result.getOrThrowWith(S.decodeResult(Json)(x), (error) => error) } catch { return Effect.fail(configError(...)) }` — a `Result` is thrown to be caught by a native `try/catch` inside `Config.mapEffect`. Upstream had `JSON.parse` here; `preferSchemaOverJson` forced the codec, not the throw.
- failure: Two production paths rely on a synchronous throw/catch of a SchemaError to branch, the exact pattern EF-1 and the Result-codec guidance forbid; the failure never enters the typed channel.
- fix: `list`: `const decoded = S.decodeResult(Json)(trimmed); if (Result.isFailure(decoded)) { return Effect.fail(configError(`Input "${name}" looks like JSON but could not be parsed`, raw)); } return S.is(StringList)(decoded.success) ? Effect.succeed<ReadonlyArray<string>>(decoded.success) : Effect.fail(configError(...not an array of strings...));` — same shape for `schema` at :429 (`Result.isFailure` → `Effect.fail(configError("is not valid JSON"))`, else `S.decodeUnknownEffect(schema)(decoded.success)`).

### fable-1-5
- file: scratchpad/effected/github-actions/ActionState.ts:143
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw`); Schema section lines 101-104 and 491-492 (prefer `S.encodeEffect`/`S.decodeEffect` + `Effect.mapError`; Result codecs only for non-throwing helpers)   evidence: `save` (:141-147) wraps two `Result.getOrThrowWith(S.encodeResult(Json)(...))` / `S.decodeResult(Json)(...)` calls in `Effect.try` so the thrown `SchemaError` can be re-caught as `notPlainJson`; `saveSecret` (:163) calls `Result.getOrThrowWith(S.encodeResult(Json)(secret), ...)` inside a plain `Effect.flatMap` callback, a throw site in pure code. Upstream used `JSON.stringify`/`JSON.parse`; `preferSchemaOverJson` forced the codec, not the throw-to-catch idiom. ActionState.test.ts:171-177 / :204-206 assert only `reason`/`key`.
- failure: The notPlainJson round-trip and the secret serialisation route through JS exceptions instead of the typed channel; `saveSecret` carries a latent throw in a non-generator callback.
- fix: `save`: `const serialized = yield* S.encodeEffect(Json)(encoded).pipe(notPlain); const parsed = yield* S.decodeEffect(Json)(serialized).pipe(notPlain);` with `const notPlain = Effect.mapError((cause: S.SchemaError) => ActionStateError.make({ reason: "notPlainJson", key, cause }))`, dropping the `Effect.try`. `saveSecret`: `Effect.flatMap(outputs.setSecret(secret), () => Effect.flatMap(S.encodeEffect(Json)(secret).pipe(Effect.mapError((cause) => ActionStateError.make({ reason: "writeFailed", key, cause }))), (serialized) => write(key, serialized)))`.

### fable-1-6
- file: scratchpad/effected/github-actions/Artifact.ts:379
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1 (no `throw` in domain logic); Schema section line 491-492 (Result codecs only for non-throwing synchronous helpers)   evidence: Inside the `zip` generator the error detail is built as `${Result.getOrThrowWith(S.encodeResult(Json)(unrepresentable), (error) => error)}` — a throwing unwrap of a Result inside an Effect generator, used only to JSON-quote a string. Upstream used `JSON.stringify(unrepresentable)`; `preferSchemaOverJson` forced the codec, not the throw.
- failure: A throw site sits on the invalidOptions path of `Artifact.upload`; the quoting step bypasses the Effect channel the generator already provides.
- fix: `const quoted = yield* S.encodeEffect(Json)(unrepresentable).pipe(Effect.orDie); return yield* ArtifactError.make({ reason: "invalidOptions", artifact, detail: `a file path may not contain a line break: ${quoted}` });` (a string always encodes, so `orDie` is the honest total-ness claim).

### fable-1-7
- file: scratchpad/effected/github-actions/ActionCache.ts:186
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14 (`Effect.fn("Name")` for public functions, `fnUntraced` for internals) and node_modules/effect/CLAUDE.md ("The name string should match the function name", service example `Effect.fn("Database.query")`); upstream convention `Effect.fn("ActionCache.save")`, `"BlobStore.get"`   evidence: Port-introduced traced spans with bare names: ActionCache.ts:186 `make`, :217 `call`, :239 `tar`; Artifact.ts:256 `make`, :300 `call`, :325 `archive`, :362 `zip`; BlobStore.githubCache.ts:57 `make`, :71 `call`, :91 `get`, :100 `put`; ActionState.ts:130 `save`; ActionEnvironment.ts:191 `make`. Upstream's 29 `Effect.fn` names are all `Service.member` (rg over the oracle), and the sibling memory store already uses `BlobStore.get`/`BlobStore.put` (BlobStore.ts:196-209). Four layers now emit a span literally named "make" and three emit "call"; each adds `at call`/`at tar` frames to `Cause.pretty` inside regions upstream traced only at the public member.
- failure: Traces and `::debug::` renders cannot tell which service's `make`/`call`/`get` failed; internal helpers appear as tracing boundaries upstream never exposed.
- fix: Internal helpers (`make`, `call`, `tar`, `zip`, `archive`) → `Effect.fnUntraced`; public members keep spans but namespaced: `Effect.fn("GitHubCacheBlobStore.get")`, `"GitHubCacheBlobStore.put"`, `"ActionState.save"`.

### fable-1-8
- file: scratchpad/effected/github-actions/Action.ts:260
- class: type-safety   severity: backlog
- standard: D15 (zero unsafe type assertions; the runner scans `as`/`!`/`<T>`/`any`) — `Context.makeUnsafe<ActionServices | R>(context.mapUnsafe)` is the upstream `as Layer.Layer<ActionServices | R>` cast relocated into an unchecked constructor the scan does not see   evidence: Upstream: `Effect.provide(composed as Layer.Layer<ActionServices | R>)`. Lab: `Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(composed, scope), (context) => Effect.provideContext(leveled, Context.makeUnsafe<ActionServices | R>(context.mapUnsafe))))`, which is exactly `provideLayer` in node_modules/effect/dist/internal/layer.js:6 plus an asserted type. The comment admits it ("trusts the caller's layer for R"). The upstream rationale comment about memoization ("Both halves name the same layer value...") was deleted with it.
- failure: The port passes the D15 gate while keeping the same unchecked widening of the context type; a caller omitting a service still defects at use with no type signal, and a reader loses the memoization rationale.
- fix: `const composed = Layer.mergeAll(ActionRuntime.layer, Layer.provide(extra ?? Layer.empty, ActionRuntime.layer));` (Layer.empty is `Layer<never>`, so the merge infers `Layer<ActionServices | R, never, never>`) then `const runnable = Effect.provide(leveled, composed).pipe(Effect.exit, ...)`; no cast, no `makeUnsafe`; restore the memoization comment.

### fable-1-9
- file: scratchpad/effected/github-actions/ActionInput.ts:244
- class: perf   severity: backlog
- standard: AGENTS.md Code Laws (prefer named schema building blocks; derived `S.is(...)` guards) — no measurement taken, so backlog under D11   evidence: `Config.mapEffect((raw) => S.is(S.Literals(allowed))(raw) ? ...)` constructs a new `S.Literals` union and compiles an `is` guard on every config read; upstream used `allowed.includes(raw)` with an `as L[number]` cast that D15 removed. `allowed` is fixed per `literals` call (signature at :238 is `readonly [string, ...Array<string>]`), so the schema is loop-invariant.
- failure: Each read of a literal input rebuilds and compiles a schema; harmless for one read, wasteful for inputs read repeatedly.
- fix: Hoist: `const isAllowed = S.is(S.Literals(allowed));` before the `Config.String(...).pipe(...)`, then `isAllowed(raw) ? Effect.succeed(raw) : ...`.

### fable-1-10
- file: scratchpad/effected/github-actions/Artifact.ts:461
- class: effect-idiom   severity: backlog
- standard: crispen rubric (absorb invariants; no dead fallback branches); standards/effect-first-development.md Option guidance (model absence as Option, not a sentinel)   evidence: :452 `const now = options?.retentionDays === undefined ? undefined : yield* Clock.currentTimeMillis;` then :461 `DateTime.makeUnsafe((now ?? 0) + retentionDays * 86_400_000)`. The `?? 0` branch is unreachable today (it only runs when `retentionDays` is defined, which is exactly when `now` was read) but if the two conditions ever drift it silently files an `expiresAt` in January 1970 instead of failing. The `globalDateInEffect` rule forced `Clock`, not the sentinel.
- failure: A latent epoch-zero expiry hides behind a nullish fallback that exists only to satisfy the type checker.
- fix: `const expiresAt = options?.retentionDays === undefined ? O.none<string>() : O.some(DateTime.formatIso(DateTime.makeUnsafe((yield* Clock.currentTimeMillis) + options.retentionDays * 86_400_000)));` then `...O.getSomesStruct({ expiresAt })` in the body; delete `now`.

### fable-1-11
- file: scratchpad/effected/github-actions/ActionLogger.ts:70
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws ("Prefer the tersest equivalent helper form when behavior is unchanged")   evidence: `readAnnotations` spreads six separate `O.getSomesStruct({ k: O.fromUndefinedOr(v) })` calls (:70-75). `getSomesStruct` (packages/foundation/modeling/utils/src/Option.ts:112) takes a whole `OptionStruct`, so one call with six keys yields the same object.
- failure: Six record builds and spreads where one suffices; readers must verify six identical shapes.
- fix: `return O.getSomesStruct({ title: O.fromUndefinedOr(title), file: O.fromUndefinedOr(file), startLine: O.fromUndefinedOr(startLine), endLine: O.fromUndefinedOr(endLine), startColumn: O.fromUndefinedOr(startColumn), endColumn: O.fromUndefinedOr(endColumn) });`

### fable-1-12
- file: scratchpad/effected/github-actions/README.md:337
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 (ledger `deviations` entry first, then README *Port notes → Deviations*, citing the adjusted upstream test) and the 2026-10-09 ruling (one ledger + README entry per module per systemic class: S.Finite, tagged errors, native-runtime replacements)   evidence: README.md:337 says `None` and PORT_LEDGER.json row `w5-github-actions` has `deviations: []`, yet the port carries diagnostic-forced, observable deviations: (1) `lazyEffect` (tsconfig.base.json:165 at error) turned `ArtifactShape.list` from `() => Effect` into an `Effect` value (Artifact.ts:194, :482, :622) and rewrote six `artifacts.list()` sites in scratchpad/test/github-actions/Artifact.test.ts — a public-contract change any downstream `artifacts.list()` caller hits as a TypeError; (2) `schemaNumber` put `S.Finite` on GitHubContext.runId/runAttempt (ActionEnvironment.ts:78,80), ActionCacheError.status (:48), ArtifactError.status (Artifact.ts:62), UnsupportedBlobEnvelopeVersionError.version (BlobEnvelope.ts:47) — probe: `new X({ n: NaN })` throws `Schema validation failed` under `S.Finite` and succeeds under `S.Number`; (3) `payload` malformed `detail` now reads `not valid JSON: SchemaError(Expected a valid JSON string)` instead of `SyntaxError: ...`; (4) `ActionStateError.cause` for an unusable key is an `InvalidActionStateNameError` instead of `Error` (ActionState.ts:113); (5) `expiresAt` is derived from `Clock.currentTimeMillis` (Artifact.ts:452), so it follows a TestClock where upstream used wall time.
- failure: The ledger row cannot truthfully close (`ledger --verify` reads these entries) and a later reviewer or promoter has no record that `Artifact.list` and the numeric constructors changed contract.
- fix: Add one `deviations` entry per class to PORT_LEDGER.json (`law:lazyEffect` citing Artifact.test.ts; `law:schemaNumber` listing the five fields; `law:preferSchemaOverJson` for the detail text; `law:native-runtime` for the tagged cause; `law:globalDateInEffect` for Clock) and mirror them under README *Port notes → Deviations*.

### fable-1-13
- file: scratchpad/effected/github-actions/ActionState.ts:18
- class: docs   severity: backlog
- standard: D2 (additions allowed but listed under README *Port notes → Added exports* and ledger `exportsAdded`); standards/effect-first-development.md EF-1 (public failures are `S.TaggedError` exports consumers can name)   evidence: `export class InvalidActionStateNameError` is new (upstream used `new Error(...)` at the same site; the beep native-runtime `native-error` kind forced the change). README.md:333 says `Added exports: None`, the ledger row has `exportsAdded: []`, and index.ts:62 exports only `ActionState, ActionStateError, ActionStateShape`, so the class is reachable only by deep import. Its doc block lacks the `@public`/`@internal` marker every sibling error carries, and no test pins `error.cause` (ActionState.test.ts:80-86 assert `reason`/`key` only).
- failure: A consumer inspecting `ActionStateError.cause` for an unusable key cannot import or narrow the new error through the package entry, and the port record understates the public surface.
- fix: Add `InvalidActionStateNameError` to the index.ts:62 export line, to README *Added exports* and ledger `exportsAdded`; add `@public` to its doc block; at S3, assert `S.is(InvalidActionStateNameError)(error.cause)` in the unusable-key test.

REQUIRED: 6
BACKLOG: 7
