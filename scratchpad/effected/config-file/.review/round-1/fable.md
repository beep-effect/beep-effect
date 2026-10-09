### fable-1-1
- file: scratchpad/effected/config-file/JsonCodec.ts:6
- class: bug   severity: required
- standard: D9 (behaviour-preserving), section 14; upstream contract ConfigCodec.ts:10-12 'The underlying failure is preserved structurally in cause'; tsgo rule prefer-schema-over-json (the diagnostic that forced the rewrite)   evidence: Read-only bun probe: S.decodeResult(S.fromJsonString(S.Unknown))('{ not json') fails with SchemaError whose issue has keys [_tag, ast, issue] and issue.cause === undefined, message 'Expected a valid JSON string'; the host SyntaxError (position, token) is not reachable from error.cause. S.encodeResult(S.fromJsonString(S.Unknown,{space:2})) on a circular/BigInt value likewise yields a SchemaError with no cause; on undefined it fails where upstream JSON.stringify returned undefined. Seven upstream assertions were rewritten from SyntaxError/TypeError to S.SchemaError: upstream __test__/JsonCodec.test.ts:29,39, ConfigCodecPath.test.ts:59,68, EncryptedCodec.test.ts:135, ConfigMigration.test.ts:73 -> lab JsonCodec.test.ts:36,46, ConfigCodecPath.test.ts:64,74, EncryptedCodec.test.ts:146, ConfigMigration.test.ts:83. The upstream EncryptedCodec test comment ('the SyntaxError JSON.parse threw must reach the caller intact') was rewritten to match. JSON.parse is not banned by the native-runtime law (NoNativeRuntime.ts has no JSON rule) and a plain try/catch outside an Effect passes the same tsgo gate: scratchpad/effected/workspaces/internal/packedInstallPlan.ts:236-241 (module reports check/lint green, S1 held only by env-bound tests).
- failure: Consumers lose the parser's SyntaxError/TypeError by identity: ConfigCodecError.cause for a corrupt JSON config is an opaque SchemaError ('Expected a valid JSON string') instead of the host error naming the offending token and position; stringify of a top-level undefined now fails instead of succeeding; the error-channel contract documented on ConfigCodecError and in the README ('carries its cause structurally') no longer holds for the default codec.
- fix: Restore upstream semantics without the diagnostic: parse/stringify through a plain Result-returning try/catch outside the Effect (the packedInstallPlan.ts:236 shape: `let parsed: unknown; try { parsed = JSON.parse(raw) } catch (cause) { return Result.fail(ConfigCodecError.make({ codec: 'json', operation: 'parse', cause })) }` then Effect.fromResult; same for JSON.stringify(value, null, 2)), restore the six upstream cause assertions and the JsonCodec doc prose. If the schema route is kept instead, it must be recorded under D9 section 14 as law:tsgo/prefer-schema-over-json in the ledger and README, citing the rewritten tests, and the 'preserved structurally' prose on ConfigCodecError/README corrected.

### fable-1-2
- file: scratchpad/effected/config-file/JsoncCodec.ts:27
- class: law   severity: required
- standard: D9 / section 14; operator ruling 2026-10-09 ('lab changes no law, diagnostic or ruling forced: restore the upstream shape and the upstream tests they rewrote'); D4/10.1 carried prose   evidence: Upstream stringify is Effect.try({ try: () => JSON.stringify(value, null, 2), catch: TypeError-preserving }) with an @remarks block explaining why JSON.stringify is called directly; the port calls Jsonc.stringify(value) from the lab jsonc port and rewrote the prose (lines 10-14). Upstream __test__/JsoncCodec.test.ts:65 `assert.instanceOf(error.cause, TypeError)` became lab JsoncCodec.test.ts:68 `JsoncStringifyError`. Probe: Jsonc.stringify output is byte-identical for representable values, but Jsonc.stringifyResult(undefined) fails TopLevelUnrepresentable where JSON.stringify returned undefined, and cause is a JsoncStringifyError instead of the host TypeError. README Port notes: 'Deviations: None'; ledger row deviations: [].
- failure: Observable deviation: the cause carried on a jsonc stringify failure is a JsoncStringifyError rather than the host TypeError upstream documents and tests; top-level undefined now fails; the upstream remark that teaches the design was dropped. None of it is recorded.
- fix: Restore the upstream Effect.try/JSON.stringify shape via the same Result-returning try/catch as fable-1-1 (passes the tsgo gate), restore JsoncCodec.test.ts:68 to TypeError and the @remarks prose; or, if Jsonc.stringify is the chosen seam, record it in the ledger deviations and README Port notes with reason law:tsgo/prefer-schema-over-json and the adjusted test cited, and keep the upstream sentence that comments never survive a round-trip.

### fable-1-3
- file: scratchpad/effected/config-file/README.md:246
- class: law   severity: required
- standard: D9, section 14 procedure (ledger deviations entry first, adjusted test cited, README Port notes -> Deviations); grilling 2026-10-09 'one ledger plus README deviation entry per module per systemic class (identity keys, S.Finite, tagged errors, the native-runtime replacements)'   evidence: README Port notes read 'Deviations: None'; PORT_LEDGER.json:5378 `"deviations": []` for w3-config-file. Observable deviations present on this commit: (a) identity keys: every public error's name/String() is the composed $I id (probe: String(ConfigCodecError.make(...)) === '@beep/scratchpad/effected/config-file/ConfigCodec/ConfigCodecError: x parse failed' vs upstream 'ConfigCodecError: x parse failed'); ConfigEvents key '@effected/config-file/ConfigEvents' -> $I`ConfigEvents` (ConfigEvent.ts:129); test key rewritten at scratchpad/test/config-file/ConfigFileKeyTyping.test.ts:15 (tsgo deterministic-keys). (b) S.Finite: ConfigMigrationError.version (ConfigMigration.ts:22) was Schema.Number upstream (src/ConfigMigration.ts:16); non-finite versions now rejected by .make. (c) tagged errors: VersionAccessError (ConfigMigration.ts:65) and CiphertextTooShortError (EncryptedCodec.ts:14) replace new Error(...) per law #7 / tsgo global-error-in-effect-failure. (d) native-runtime replacements: deepMerge.ts:73 `{ __proto__: ... }` for Object.create, R.keys/R.has/R.toEntries, HashSet FORBIDDEN, crypto.ts:109 A.* for Array.from. (e) schema-over-JSON: fable-1-1/1-2 with seven rewritten tests.
- failure: The module's accepted-deviation record is empty while upstream tests were adjusted and public rendering/keys changed; later rounds cannot tell recorded from unrecorded changes, and the section 14 'do not re-raise a recorded deviation' rule has nothing to point at.
- fix: Write one ledger deviations entry per systemic class ({ test, upstreamBehaviour, labBehaviour, reason: 'law:<id>' } citing the adjusted test lines above) and mirror them under README Port notes -> Deviations (the codemod-generated form the grilling specified is fine).

### fable-1-4
- file: scratchpad/effected/config-file/ConfigFile.ts:12
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1: 'Use A/O/P/R/S aliases only: import * as S from "effect/Schema"'   evidence: ConfigFile.ts:12 `import * as Schema from "effect/Schema"` and ~40 `Schema.` sites; every other file in the module uses `S`. The effect-imports gate passed: packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts maps module names (lines 423-428) and preserves aliases (657, 853) but does not check the alias itself, so the gate missed it (the same alias survives in yaml/internal/composer/*.ts and github-actions/GitHubMarkdown.ts).
- failure: Law 1 violation that the gate does not catch; the file reads differently from the rest of the module and from every beep package.
- fix: Rename the namespace import to `S` and the `Schema.` references in ConfigFile.ts (mechanical).

### fable-1-5
- file: scratchpad/effected/config-file/ConfigFile.ts:430
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14 ('Effect.fnUntraced for internal hot paths where tracing overhead is unnecessary'); D9; effect-laws-v1 law 22   evidence: `onSome: Effect.fn("onSome")(function* (svc) {...})` inside emit. Upstream (src/ConfigFile.ts:416-421) was an untraced Effect.gen; emit runs for Discovered/Parsed/Validated/Resolved/Loaded on every load when events are wired. The design note at lines 413-421 promises the hook is cheap ('no context lookup, no DateTime.now' when absent). Every other internal helper in the file (mergeAndEmit, encodeTo, encodeAndWrite, saveTo) was converted to Effect.fnUntraced.
- failure: A span literally named 'onSome' is opened per published event, a tracing-visible change upstream never made, with a name that identifies nothing.
- fix: Replace with `onSome: Effect.fnUntraced(function* (svc) { ... })`.

### fable-1-6
- file: scratchpad/effected/config-file/ConfigResolver.ts:343
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14; D9   evidence: isGitRoot (line 343) and isWorkspaceRoot (line 353) became Effect.fn("isGitRoot") / Effect.fn("isWorkspaceRoot"); upstream (src/ConfigResolver.ts:332-357) were untraced Effect.gen. Both are internal predicates handed to rootAnchored and evaluated once per directory of the upward walk (Walker), so a resolve from a deep cwd opens one bare-named span per ancestor directory; the public resolvers themselves open no span.
- failure: Tracing-visible span fan-out per probed directory that upstream did not produce, under names that are not qualified like the module's public spans (ConfigFile.load etc.).
- fix: Use Effect.fnUntraced for both helpers (keep the explicit function type annotations).

### fable-1-7
- file: scratchpad/effected/config-file/ConfigMigration.ts:66
- class: effect-idiom   severity: required
- standard: operator ruling 2026-10-09 (lab changes no law forced are restored); .patterns/error-handling.md (tagged errors identify themselves by tag); effect-laws-v1 law 7   evidence: `override name = "Error"` on VersionAccessError (and copied into the test-local class at scratchpad/test/config-file/ConfigMigration.test.ts:146). Probe: a TaggedError with the override renders String(e) === 'Error: m' and gains an own enumerable `name` key (Object.keys -> ['_tag','name']) where the default has only ['_tag']. No test asserts cause.name: upstream __test__/ConfigMigration.test.ts:215-220 asserts instanceOf(cause, Error) and cause.message only, and the lab test (lines 234-240) does the same; the only `.name` assertions in the suite are ConfigMigrationError.name (the step name).
- failure: A tagged error masquerades as a native Error in Cause.pretty/log output, its tag is hidden from the rendering, and the extra own key leaks into structural equality and JSON of the error; the override exists only to mimic upstream's `new Error` rendering, which is exactly the tagged-error deviation D9 says to record instead.
- fix: Delete the override in ConfigMigration.ts:66 and in the test-local class at ConfigMigration.test.ts:146; record the tagged-error deviation (fable-1-3).

### fable-1-8
- file: scratchpad/effected/config-file/ConfigMigration.ts:121
- class: effect-idiom   severity: backlog
- standard: EF-14 naming convention (examples use 'Module.method'); module convention ConfigFile.ts:457-668 ('ConfigFile.load'...), jsonc port Effect.fn("Jsonc.stringify")   evidence: `parse: Effect.fn("parse")(function* (raw: string)` opens a span named just 'parse'; upstream (src/ConfigMigration.ts:109-110) was an untraced Effect.gen. The same bare name is used by EncryptedCodec (fable-1-15), so traces cannot tell the two codecs apart.
- failure: Ambiguous span name in traces; a behaviour (tracing) addition upstream did not make.
- fix: Effect.fn("ConfigMigration.parse") (or Effect.fnUntraced to match upstream's untraced codec).

### fable-1-15
- file: scratchpad/effected/config-file/EncryptedCodec.ts:154
- class: effect-idiom   severity: backlog
- standard: EF-14 naming convention; module convention 'Module.method'   evidence: `parse: Effect.fn("parse")` (line 154) and `stringify: Effect.fn("stringify")` (line 170); upstream (src/EncryptedCodec.ts:140-171) were untraced Effect.gen. Bare names collide with ConfigMigration's 'parse' span.
- failure: Ambiguous span names; tracing addition upstream did not make.
- fix: Effect.fn("EncryptedCodec.parse") / Effect.fn("EncryptedCodec.stringify") (or fnUntraced).

### fable-1-9
- file: scratchpad/effected/config-file/ConfigMigration.ts:77
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21 (tersest equivalent form); crispen   evidence: `set: (raw, version) => Effect.succeed({ ...(P.isObjectKeyword(raw) ? raw : P.isString(raw) ? Str.split(raw, "") : {}), version })` reproduces `{ ...(raw as Record) }` spread semantics for a string argument (index keys) via Str.split; probe confirms P.isObjectKeyword covers objects, arrays and functions, so the string branch is the only extra case and is unreachable for any migration that returns a document.
- failure: Readers must reverse-engineer why a version writer splits strings into characters; the branch encodes an upstream cast artefact, not a requirement.
- fix: `{ ...(P.isObjectKeyword(raw) ? raw : {}), version }`, noting in the deviation record that a string document (never produced by a real `up`) now gets `{ version }` rather than character keys; or keep as is with a one-line comment.

### fable-1-10
- file: scratchpad/effected/config-file/ConfigMigration.ts:114
- class: type-safety   severity: backlog
- standard: crispen (dead generics); D2 superset export rule unaffected   evidence: `const make: (options: ConfigMigrationOptions) => ConfigCodec<...> = <EM, EV>(options: ConfigMigrationOptions<EM, EV>) => ...` erases the implementation's type parameters at the public type, so ConfigFileMigration<E>, VersionAccess<E> and ConfigMigrationOptions<EM, EV> (lines 45, 58, 84) are only ever instantiated at their `unknown` defaults by callers; the explicit `runPhase<number, EV | VersionAccessError>` (line 125) exists only to type the union of `access.get` function types.
- failure: Three public interfaces grew type parameters that no public signature can bind; readers assume typed error flow that does not exist.
- fix: Either drop the generics (upstream shape: unknown error channels) or expose them on `make` (`<EM, EV>(options: ConfigMigrationOptions<EM, EV>) => ConfigCodec<ConfigCodecError | ConfigMigrationError>`); if exposed, list the widened signatures under README Port notes -> Added exports.

### fable-1-11
- file: scratchpad/effected/config-file/MergeStrategy.ts:85
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 law 21; crispen (guards absorbed, no helper walls)   evidence: `canMerge(merged, higher) && P.isObject(higher) && P.isObject(merged) ? deepMerge(higher, merged) : higher` — canMerge already requires both operands to be record-like (deepMerge.ts:44-45), so the two P.isObject checks are redundant at runtime and exist only to narrow `A` to `object` for deepMerge's `Record<string, unknown>` parameter (upstream used casts, removed under D15).
- failure: Duplicated predicate logic that can drift from canMerge; the narrowing lives at the call site rather than on the guard.
- fix: Export `isRecordLike` as the refinement and write the merge condition as `isRecordLike(merged) && isRecordLike(higher) && Object.getPrototypeOf(merged) === Object.getPrototypeOf(higher)` (narrowing both), or give canMerge an overload that narrows a `readonly [unknown, unknown]` pair; drop the P.isObject repeats.

### fable-1-12
- file: scratchpad/effected/config-file/ConfigEvent.ts:44
- class: schema   severity: backlog
- standard: operator revision step 4 ('identity ... with annotations on fields and schemas'); schema-first-development (annotated building blocks)   evidence: The twelve inline S.TaggedStruct members of ConfigEventPayload (lines 44-66) carry no annotateKey descriptions on path/resolver/codec/error/sources/strategy although every other field in the module is annotated from its upstream comment; the same for CiphertextTooShortError.message (EncryptedCodec.ts:15).
- failure: Inconsistent annotation coverage: the event union, the one schema consumers decode themselves, is the only unannotated one.
- fix: Add `.annotateKey({ description })` from the existing `/** */` comments to each member field, and to CiphertextTooShortError.message.

### fable-1-13
- file: scratchpad/effected/config-file/internal/crypto.ts:1
- class: docs   severity: backlog
- standard: D4 ('every JSDoc body (converted carriers, never dropped)'); section 10.1 'carried, not replaced'   evidence: Upstream src/internal/crypto.ts:1-14 opens with a file-level block ('AES-GCM primitives over WebCrypto ... imports nothing from the rest of the package ... Failures surface as the plain CryptoFailure record; the public module lifts them into ConfigEncryptionError', @internal). The lab file starts at the imports; the block is gone.
- failure: The rationale for the module's dependency-free design and its failure contract is no longer in the source.
- fix: Restore the block as the module's lead comment with the @remarks carrier converted to **Details** (S2 may do the carrier conversion, the prose must come back now).

### fable-1-14
- file: scratchpad/effected/config-file/README.md:3
- class: docs   severity: backlog
- standard: section 10.3 README adaptation; effect-laws-v1 law 2 (root `effect` barrel not used, including Markdown examples)   evidence: README keeps the npm/License/Node/TypeScript badges (lines 3-6), the pre-1.0.0 stability block with the pnpm-plugin-effect reference (10-14), the Install section (26), and every example imports from "@effected/config-file" and the root "effect" barrel (49-51, 83-84, 106-108, 125-126, 164-165, 193); only the title and Port notes were adapted.
- failure: The README does not describe the lab module and its examples break law 2 and D13 (no @effected/* specifiers in the lab).
- fix: Apply 10.3: drop badges/Install/stability block/pnpm-plugin-effect, rewrite example imports to lab relative paths and per-module effect imports.

REQUIRED: 7
BACKLOG: 8
