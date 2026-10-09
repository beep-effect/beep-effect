### fable-1-1
- file: scratchpad/effected/lockfiles/internal/npm.ts:153
- class: law   severity: required
- standard: D9 + section 14 (deviation protocol); section 16 "never weaken a test"; D15 (what actually forced the change)   evidence: Oracle parseNpm: `Effect.try({ try: () => JSON.parse(content) as unknown, catch: syntaxFailure })`, comment names the V8 RangeError contract; oracle `__test__/hostile.test.ts:511` asserts `error.cause instanceof SyntaxError`. Port: `const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown))` (npm.ts:72) and `scratchpad/test/lockfiles/hostile.test.ts:515` now asserts `S.SchemaError`. `node_modules/effect/dist/SchemaGetter.js:936-942` shows `parseJson` catches every throw with `catch: () => new SchemaIssue.InvalidValue({ expected: "a valid JSON string" })`, so the thrown SyntaxError/RangeError (message, position) is discarded. Read-only probe: `Lockfile.parse("{ nope", {format:"npm"})` -> `LockfileParseError syntax`, cause `SchemaError` with message "Expected a valid JSON string". Commit 7ce805b25b ("drop casts and directives", message says "behaviour unchanged") removed `// @effect-diagnostics-next-line preferSchemaOverJson:off` whose rationale was "Syntax failures retain the original native throwable; Schema JSON decoding discards its identity and details" — that rationale still sits in `scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:27` for npm.ts:150, where no directive exists any more. Ledger `w3-lockfiles.deviations` is `[]`; README Port notes say "Deviations: None". The kit keeps the opposite decision for `config-file/JsonCodec.ts` (rows 16-18).
- failure: `LockfileParseError.cause` for malformed npm JSON no longer carries the engine's throwable (README: "cause ... carries whatever the delegated parsing engines throw"); the SyntaxError position/token detail and the RangeError identity are lost; an upstream oracle test was rewritten to match the regression with no recorded deviation, and the exceptions ledger documents a directive that no longer exists.
- fix: Restore `const raw = yield* Effect.try({ try: (): unknown => JSON.parse(content), catch: syntaxFailure })` (return annotation, no `as`, satisfies D15) under `// @effect-diagnostics-next-line preferSchemaOverJson:off` with the row-27 rationale; delete `decodeJson`; restore the upstream doc comment; restore `assert.instanceOf(error.cause, SyntaxError)` at hostile.test.ts:515; fix the line number in DIAGNOSTIC_EXCEPTIONS.md:27.

### fable-1-2
- file: scratchpad/effected/lockfiles/internal/shared.ts:305
- class: law   severity: required
- standard: D9 + section 14; tsgo rule `schemaNumber` (docs/rules/schema-number.md: "If non-finite values are intentional, disable this diagnostic for that line"); README "Supported lockfile versions" contract   evidence: Oracle `PnpmVersionProbe.lockfileVersion: Schema.Union([Schema.String, Schema.Number])` and `NpmVersionProbe`/`NpmLockfileRaw: Schema.Union([Schema.Number, Schema.String])`; port uses `S.Finite` at shared.ts:305, npm.ts:56 and npm.ts:62. `requireLockfileVersion` (shared.ts:278-290) deliberately handles non-finite input: `Number.isFinite(parsed) && parsed >= minimum` else `UnsupportedLockfileVersion`. Read-only probe of the port: `{"lockfileVersion":1e999,"packages":{}}` (npm) and `lockfileVersion: .inf` (pnpm) -> `LockfileParseError validation`, cause `SchemaError` "Expected a finite number at [lockfileVersion]", `isUnsupportedLockfileVersion(cause) === false`; upstream reaches the gate and yields the tagged `UnsupportedLockfileVersion` cause. Ledger deviations `[]`, README "Deviations: None". Kit precedent for the directive route: DIAGNOSTIC_EXCEPTIONS.md rows 22-24 (DetachedProcess.ts), 32 (TomlNode.ts), 41-42 (yaml util.ts).
- failure: For the two gated formats a non-finite `lockfileVersion` is reported as "malformed" instead of "too old/unsupported": the tag-based narrowing the README promises (`isUnsupportedLockfileVersion`) answers false where upstream answers true. Unrecorded observable deviation.
- fix: Restore `S.Number` at shared.ts:305, npm.ts:56 and npm.ts:62, each preceded by `// @effect-diagnostics-next-line schemaNumber:off` (reason: the version gate owns non-finite rejection and its tagged cause), and add the three rows to DIAGNOSTIC_EXCEPTIONS.md. If the integrator prefers keeping `S.Finite`, follow section 14 instead: ledger `deviations` entry `law:schemaNumber` first, then a focused witness test, then README Port notes.

### fable-1-3
- file: scratchpad/effected/lockfiles/internal/bun.ts:67
- class: law   severity: required
- standard: D9 + section 14; tsgo rule `schemaNumber`   evidence: Oracle `BunLockfileRaw.lockfileVersion: Schema.Number` and `YarnMetadata.version: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number]))`; port uses `S.Finite` at bun.ts:67 and yarn.ts:41. Neither format is version-gated; upstream stringifies the value (`String(raw.lockfileVersion)`, `String(metadata.version)`). Read-only probe of the port: bun `{"lockfileVersion":1e999}` and yarn `__metadata:\n  version: .inf` both fail with `LockfileParseError validation` / `SchemaError` "Expected a finite number"; upstream parses both and reports `lockfileVersion: "Infinity"`. Not in ledger deviations or README Port notes.
- failure: Documents upstream accepts are rejected by the port (accepted-input narrowing) with no recorded deviation, no law cause written down and no adjusted test cited.
- fix: Restore `S.Number` at bun.ts:67 and `S.Union([S.String, S.Number])` at yarn.ts:41 under `// @effect-diagnostics-next-line schemaNumber:off` plus DIAGNOSTIC_EXCEPTIONS.md rows; or record `law:schemaNumber` deviations per section 14 with witness tests.

### fable-1-4
- file: scratchpad/effected/lockfiles/internal/shared.ts:221
- class: bug   severity: required
- standard: D11 (bug); D15 spirit (declared type not honoured at runtime); kit precedent DIAGNOSTIC_EXCEPTIONS.md rows 20, 30, 31, 36 (`missingPipeableSignature:off` when call forms are ambiguous)   evidence: `peerDeclarations` was made `dual((args) => args.length >= 2 && !A.isArray(args[1]), ...)` to satisfy `missingPipeableSignature`. The declared data-last overload is `(meta, optionalPeers?: ReadonlyArray<string> | undefined) => (peers) => PeerDeclarations`. Passing the optional argument explicitly as `undefined` is type-valid but the predicate routes it data-first. Read-only probe: `peerDeclarations({ react: { optional: true } }, undefined)` returned `object` `{"peerDependencies":{"react":{"optional":true}},"peerDependenciesMeta":{}}` — the meta record is read as `peers`, while TypeScript types the result as a function. The ambiguity is inherent (`(X, undefined)` is both `(peers, meta)` and `(meta, optionalPeers)`), so no predicate can fix it. All six in-tree call sites (bun.ts:190/231, npm.ts:222/264, pnpm.ts:526, yarn.ts:128) are data-first, so the gate and tests do not exercise the broken form.
- failure: A caller using the exported data-last overload with an explicit `undefined` gets a `PeerDeclarations` object where the types promise a function; invoking it throws `TypeError`, and if the object is spread instead, peer *meta* records are emitted as `peerDependencies` ranges.
- fix: Drop the `dual`; keep the upstream fixed-arity signature `(peers, meta, optionalPeers?)` preceded by `// @effect-diagnostics-next-line missingPipeableSignature:off` and add a DIAGNOSTIC_EXCEPTIONS.md row ("optional optionalPeers makes the two call forms ambiguous"), exactly as env.ts:20 / errno.ts:109 already do.

### fable-1-5
- file: scratchpad/effected/lockfiles/internal/shared.ts:435
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 ("No native Object/Map/Set/Date in domain logic"); D5; section 16 "never use native Set/Map"   evidence: `extractWorkspaceDeps` keeps the oracle's native parameter type `workspaces: ReadonlyMap<string, WorkspaceEntry>` (shared.ts:435-442) while every caller builds a `MutableHashMap` and then reaches into its representation: `extractWorkspaceDeps(workspaceEntries.backing, workspaceNames)` at bun.ts:239, npm.ts:273, pnpm.ts:558, yarn.ts:148, each with the comment "the public backing preserves the sibling native-map contract". The gate missed it: `NoNativeRuntime.ts:396` only flags `new Map|Set|WeakMap|WeakSet` constructor calls (`MAP_SET_CTORS`); a native `Map` obtained through `MutableHashMap#backing` and a `ReadonlyMap`-typed parameter are invisible to it. `MutableHashMap` is itself `Iterable<[K, V]>` in insertion order (`dist/MutableHashMap.js:36-38` iterates `this.backing`), so nothing requires the native type.
- failure: Internal domain logic is typed over, and executed with, a native `Map` — the law the gate is supposed to enforce is circumvented rather than met, and four parsers couple themselves to `MutableHashMap`'s internal field.
- fix: Change the parameter (both overloads) to `workspaces: MutableHashMap.MutableHashMap<string, WorkspaceEntry>`; the body's `for (const [from, entry] of workspaces)` works unchanged; pass `workspaceEntries` directly at the four call sites and delete the four "public backing" comments.

### fable-1-6
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:505
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14 ("Use `Effect.fnUntraced(...)` for internal hot paths where tracing overhead is unnecessary"); the repo EffectFn law's own recommendation (EffectFn.ts:315: nested owner -> `Effect.fnUntraced`); D9 (upstream opened no span)   evidence: `const emit = Effect.fn("emit")(function*(instanceId, meta, edges) {...})` is a closure nested inside `toFields`, invoked once per `snapshots:` row and once per orphan `packages:` row (pnpm.ts:538, :549) — thousands of calls per real lockfile. Upstream `emit` was a plain `Effect.gen` closure with no span. `Effect.fn("name")` wraps each call in a span; the Effect.fn law classifies a non-top-level owner as an `Effect.fnUntraced` site, and EF-14 names internal hot paths explicitly.
- failure: Every package row of a pnpm lockfile opens and closes a tracing span named "emit" that upstream never created: per-row overhead on the parser's hottest loop and span noise with no diagnostic value (the public `Lockfile.parse` span already exists).
- fix: `const emit = Effect.fnUntraced(function* (instanceId, meta, edges) { ... })`.

### fable-1-7
- file: scratchpad/effected/lockfiles/LockfileFormat.ts:24
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; AGENTS.md Code Laws ("named `LiteralKit` internal domains ...; `S.Literals` for anonymous inline unions never referenced by name"); D5 (kits land in S4)   evidence: `export const LockfileFormat = S.Literals(["bun", "npm", "pnpm", "yarn"]).pipe($I.annoteSchema(...))` is a named, exported, identity-annotated literal domain referenced by name in `Lockfile`, both error classes, `dispatch` (`Match.value(format)`), `filenameFor`, `fromFilename` and the tests. Law 19 reserves `S.Literals` for anonymous inline unions. `LiteralKit` keeps `.literals` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:356 "Kit.literals for the tuple"`), so `fromFilename`'s `for (const format of LockfileFormat.literals)` is unaffected, and `.is`/`$match` become available for `dispatch`.
- failure: The module's central literal domain does not meet the mandatory kit convention; the gates do not check kit usage, so nothing else will catch it before promotion.
- fix: `export const LockfileFormat = LiteralKit(["bun", "npm", "pnpm", "yarn"]).pipe($I.annoteSchema("LockfileFormat", {...}))` (no `as const`), keeping the same-name type alias and literal order; optionally route `dispatch` through `LockfileFormat.$match`.

### fable-1-8
- file: scratchpad/effected/lockfiles/internal/bun.ts:129
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 ("No native Array.prototype.sort; use A.sort with explicit Order"); standards/effect-first-development.md EF-38   evidence: Native sorts remain at bun.ts:129 `prefixes.sort((a, b) => b.length - a.length)`, pnpm.ts:250 and :386 `[...unnameable].sort()`, yarn.ts:196 `[...unnameable].sort()`. The gate missed them: `NoNativeRuntime.ts:463` flags `.sort` only `if (inHotspotScope && propertyName === "sort" && objectName !== "A")`, and lockfiles is not a hotspot scope; no allowlist row names lockfiles (`rg lockfiles standards/effect-laws.allowlist.jsonc` is empty).
- failure: Four production sort sites violate an authoritative short law while the native-runtime gate reports green.
- fix: bun.ts:129: `const ordered = A.sort(prefixes, Order.mapInput(Order.reverse(Order.number), (s: string) => s.length))` and use `ordered` (stable, same deepest-first order); pnpm.ts:250/:386 and yarn.ts:196: `unresolvedEdges: A.sort([...unnameable], Order.string)` (`Order.string` compares UTF-16 code units exactly as the default sort does for strings).

### fable-1-9
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:154
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); EF-19   evidence: `snapshots[${yield* S.encodeEffect(JsonString)(key).pipe(Effect.mapError(validationFailure))}] is missing` (pnpmEnv.ts:154) and the same at :191 lift `JSON.stringify` of a plain string — a total, infallible operation — into the effect error channel and map its impossible failure to `validationFailure`; meanwhile shared.ts:288 still interpolates `JSON.stringify(raw)` directly (the tsgo rule only fires inside Effect contexts, so the gate is green either way).
- failure: Readability regression and a misattributed (unreachable) failure path: an encode failure of a message fragment would be reported as a lockfile validation failure; the module formats keys two different ways.
- fix: Add a pure local helper, e.g. `const quote = (s: string) => Result.getOrElse(S.encodeResult(JsonString)(s), () => s)` (or `JSON.stringify` outside the Effect context as shared.ts does), and drop the `yield*`/`mapError` from the two template literals.

### fable-1-10
- file: scratchpad/effected/lockfiles/internal/shared.ts:52
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21; tsgo rule `effectSucceedWithVoid`   evidence: `if (raw === undefined) return Effect.as(Effect.void, undefined);` is `Effect.succeed(undefined)` wearing a wrapper to get past `effectSucceedWithVoid`, allocating two effects where upstream allocated one. The four callers immediately re-wrap the result: `...O.getSomesStruct({ integrity: O.fromUndefinedOr(integrity) })` (bun.ts:229, npm.ts:260, pnpm.ts:524, yarn.ts:120).
- failure: Extra allocation per row and an `undefined`-shaped internal contract that every caller has to Option-ify again.
- fix: Return `Effect.Effect<O.Option<IntegrityHashBrand>, ParseFailure>`: `if (raw === undefined) return Effect.succeedNone;` and `S.decodeEffect(IntegrityHash)(raw).pipe(Effect.map(O.some), Effect.mapError(validationFailure))`; callers spread `...O.getSomesStruct({ integrity })`.

### fable-1-11
- file: scratchpad/effected/lockfiles/internal/bun.ts:177
- class: perf   severity: backlog
- standard: EF idiom for build-then-query collections (MutableHashSet); D11 (same complexity class, so backlog)   evidence: `let workspaceNames = HashSet.fromIterable<string>([])` followed by `workspaceNames = HashSet.add(workspaceNames, name)` inside loops at bun.ts:177, npm.ts:193, pnpm.ts:438 and :446, yarn.ts:100 — an immutable HAMT path-copied on every insert, only to be queried by `HashSet.has`. Upstream used one mutable set; the same file already uses `MutableHashSet` for the identical pattern (`keys`, `instanceIds`, `emitted`).
- failure: Per-workspace allocation churn and an inconsistent collection idiom inside one function; no behaviour change.
- fix: Use `MutableHashSet.empty<string>()` + `MutableHashSet.add` and type `extractWorkspaceDeps`'s `workspaceNames` as `MutableHashSet.MutableHashSet<string>`; or collect names into an array and call `HashSet.fromIterable` once. At minimum replace `HashSet.fromIterable<string>([])` with `HashSet.empty<string>()`.

### fable-1-12
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:16
- class: law   severity: backlog
- standard: section 14 (record law-forced deviations); standards/effect-laws-v1.md law 7; .patterns/error-handling.md (typed errors are exported, identity-annotated)   evidence: Oracle `unaccounted` wraps `new Error("pnpm-lock.yaml env preamble: ...")`; the port (law 7 forbids `new Error`) builds `PnpmEnvPreambleError.make({ message })`, a non-exported `S.TaggedError`. `cause.message` is unchanged so PnpmEnvLockfile.test.ts:112 `causeMessage` assertions stay green, but `cause._tag === "PnpmEnvPreambleError"` and the constructor differ from upstream. Ledger deviations `[]`, README "Deviations: None", README "Added exports": None.
- failure: An observable, law-forced deviation is unrecorded, and the new typed error is unreachable for consumers who want to narrow `LockfileParseError.cause` with `S.is(PnpmEnvPreambleError)`.
- fix: Add ledger `deviations` entry `law:effect-laws-v1#7` citing PnpmEnvLockfile.test.ts:112, mirror it in README Port notes -> Deviations; export `PnpmEnvPreambleError` from index.ts and list it under Port notes -> Added exports.

### fable-1-13
- file: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:27
- class: docs   severity: backlog
- standard: PORT_LEDGER note 2026-10-09 ("Every switched-off rule is listed in DIAGNOSTIC_EXCEPTIONS.md"); section 17 evidence hand-offs   evidence: Row 27 records a `preferSchemaOverJson` next-line directive at `effected/lockfiles/internal/npm.ts:150` with rationale "Syntax failures retain the original native throwable; Schema JSON decoding discards its identity and details". `rg '@effect-diagnostics' scratchpad/effected/lockfiles` finds no directive in module source; commit 7ce805b25b removed it and adopted the very decoding the rationale rejects.
- failure: The exceptions ledger asserts a switched-off rule that is not switched off, and documents a design decision the code no longer honours; the next reader cannot trust the file.
- fix: If fable-1-1 is applied, correct the line number of row 27; otherwise delete the row and record the deviation where section 14 says it belongs.

### fable-1-14
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:127
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14; D9 (upstream traced nothing below `Lockfile.parse`)   evidence: `parsePnpm` is `dual(2, Effect.fnUntraced(...))` while `parseBun`, `parseNpm`, `parseYarn` are `Effect.fn("parseBun"|"parseNpm"|"parseYarn")`; the four non-exported transforms are all `Effect.fn("toFields")` (bun.ts:153, npm.ts:169, pnpm.ts:401, yarn.ts:79), so their spans share one name and cannot be told apart in a trace; documents.ts and pnpmEnv.ts helpers are `Effect.fn` too. The public entry `Lockfile.parse` already carries the "Lockfile.parse" span.
- failure: Inconsistent tracing policy across one module and ambiguous span names; extra spans upstream never emitted.
- fix: Adopt one convention: `Effect.fnUntraced` for every internal parser/transform (keeping only the public `Lockfile.parse` / `PnpmEnvLockfile.*` spans), or format-qualified names (`"lockfiles.bun.toFields"`) if the spans are wanted.

### fable-1-15
- file: scratchpad/effected/lockfiles/internal/pnpmEnv.ts:189
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 6; D2 (beep-idiomatic shape allowed) vs D9 (upstream `ReadonlyMap` contract); section 14   evidence: `readPnpmConfigDependencies` builds `MutableHashMap.empty<string, ConfigDependencyLock>()` and returns `locks.backing` (pnpmEnv.ts:189, :194) so that the public `PnpmEnvLockfile.configDependencies` keeps upstream's `ReadonlyMap<string, ConfigDependencyLock>` type; PnpmEnvLockfile.test.ts:466 reads it with `.get(...)`. A native `Map` is therefore the module's public return value, reached through a representation field, and neither the gate nor the ledger notes it.
- failure: Public API hands consumers a native Map in a law-6 codebase via an internal field; whichever way this is resolved, it is currently undocumented.
- fix: Integrator decision, recorded either way: (a) keep `ReadonlyMap` for D9 and add an allowlist/ledger note naming the `.backing` reach-through as the accepted law-6 exception; or (b) return `HashMap.HashMap<string, ConfigDependencyLock>` (`HashMap.fromIterable(locks)`), adjust PnpmEnvLockfile.test.ts:466 to `HashMap.get`, and record `law:effect-laws-v1#6` in ledger + README per section 14.

REQUIRED: 8
BACKLOG: 7
