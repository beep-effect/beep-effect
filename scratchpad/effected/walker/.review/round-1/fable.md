### fable-1-1
- file: scratchpad/effected/walker/Descend.ts:402
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; standards/effect-first-development.md EF-38   evidence: `results.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))` is native Array.prototype.sort in runtime source. The gate missed it: NoNativeRuntime.ts:463 emits `nativeSort` only when `inHotspotScope`, and walker is not a hotspot (`beep laws native-runtime --check` on the four source files: errors=0). Installed effect 4.0.2: `A.sort` copies then sorts (Array.js:1787-1791) and `Order.String` is `self < that ? -1 : 1` (Order.js:83); `results` never holds duplicates (each frame's entries are unique names, so every pushed `relative` is distinct), so the order is byte-identical to upstream.
- failure: Explicit law violation in production traversal code that the native-runtime gate cannot see; the same sort would be flagged the moment walker enters hotspot scope or is promoted.
- fix: `import * as A from "effect/Array"; import * as Order from "effect/Order";` and replace lines 402-403 with `return finish(A.sort(results, Order.String));` (A.sort returns a new array, so the local `results` needs no mutation).

### fable-1-2
- file: scratchpad/effected/walker/Descend.ts:159
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-3 ("Never use JSON.parse / JSON.stringify; use schema JSON codecs") and EF-19   evidence: `JSON.stringify` remains at Descend.ts:159, :161, :162 (`DescendError.message`) and Expand.ts:86 (`GlobExpansionError.message`). No law detects it (NoNativeRuntime.ts has no JSON pattern; `rg JSON packages/tooling/tool/cli/src/commands/Laws/*.ts` finds only CLI-output mentions), so the green gate proves nothing here. The port already applied EF-19 to the identical quoting use in Walker.ts:17/:89-90/:147-148 (commit cef8540629), leaving the module inconsistent with itself.
- failure: Both exported error classes render diagnostics through the forbidden native serializer while the rest of the module uses the schema codec; a consumer reading walker as the beep-native reference learns two conventions.
- fix: Add a module-level `const quoted = S.encodeResult(S.fromJsonString(S.String));` (import `Result` from `effect/Result`) in Descend.ts and Expand.ts and use `Result.getOrElse(quoted(value), () => value)` in the two getters. Encoding a string through `fromJsonString(S.String)` is exactly `JSON.stringify(value)`, so every message byte the upstream tests assert is unchanged, and the getters stay synchronous and non-throwing as EF-3 permits for local paths.

### fable-1-3
- file: scratchpad/effected/walker/Descend.ts:148
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14 (deviation protocol; "write the ledger deviations entry first"); operator ruling 2026-10-09 ("one ledger plus README deviation entry per module per systemic class: identity keys, S.Finite, tagged errors, native-runtime replacements")   evidence: Read-only bun probe against the lab module: `DescendError.make({...}).name` = "@beep/scratchpad/effected/walker/Descend/DescendError" and `String(e)` starts with that identifier (upstream `Schema.TaggedError<DescendError>()` gives name "DescendError"); same for `GlobExpansionError` (Expand.ts:69). `Cause.squash` of `Walker.ascend("/a/b/c", { stopAt: "b" })` yields `_tag: "WalkerDefect"`, name "@beep/scratchpad/effected/walker/Walker/WalkerDefect" (upstream: plain `Error`, Walker.ts:11-15 and Descend.ts:25-29 for `DescendDefect`). `S.decodeUnknownResult(DescendError)({..., limit: Infinity})._tag` = "Failure" (upstream `Schema.Number` accepts; lab `S.Finite` at Descend.ts:156). Yet README.md:117-119 says `Deviations: None` and the ledger row `w2-walker` has `deviations: []`. No `packages/**` source overrides `name` on `$I`-identified errors, so the long name is the repo idiom (law-forced via D5), not a walker bug to revert.
- failure: Four observable differences from the pinned oracle (error `name`/`toString`, defect tag and name, accepted `limit` input) exist with no section-14 record, so the next reviewer or consumer cannot tell a law-forced change from a regression, and `ledger --verify` carries no trace of them.
- fix: Add ledger `deviations` entries on row `w2-walker` and a matching README *Port notes -> Deviations* list, one per systemic class as the ruling prescribes: `law:D5 identity keys` (sites Descend.ts:148, Expand.ts:69; observable `name`/`toString`), `law:7 tagged defects` (Walker.ts:11, Descend.ts:25; `_tag` WalkerDefect/DescendDefect, name), `law:tsgo schemaNumber S.Finite` (Descend.ts:156; `limit` must be finite), citing that no upstream test asserts the changed bytes. If the defect classes are to be reachable by consumers, export them and list them under *Added exports*.

### fable-1-4
- file: scratchpad/effected/walker/Descend.ts:108
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; .claude/skills/schema-first-development/references/repo-laws.md section 1 ("Do not introduce exported pure-data interface declarations") and section 2; EFFECTED_PORT_GOAL.md D5 (full beep-native bar, kits and S.Class land in S4)   evidence: Exported pure-data models remain TS interfaces: `UnreadableDirectory` (Descend.ts:108), `DescendResult` (:133), `AscendOptions` (Walker.ts:24), `CompileAndExpandOptions` (Expand.ts:34). The repo's `lint schema-first` inventory covers `packages/**` only (SchemaFirst.ts included globs; the command has no `--include`), so the walker audit never runs it. Every ingredient is a schema already: `PlatformError` is a schema class (effect/dist/PlatformError.d.ts:146), `GlobPatternOptions` is `S.Class` (glob/GlobPattern.ts:63). `DescendOptions`/`DescendRecordOptions` are the return-type discriminators the doc block at Descend.ts:81-90 describes, i.e. EF-33's "overload-only surfaces" exception.
- failure: Walker's result and config shapes have no schema source of truth, no identity annotations, and cannot take part in the D10 property floor or in `GlobExpansionError`-style composition; the module fails the D5 end-state bar it is being reviewed against.
- fix: Define `UnreadableDirectory`, `DescendResult` and `AscendOptions` as `S.Struct` schemas with `$I.annote` and export `type X = typeof X.Type` under the same names (repo-laws section 2 sanctions `S.Struct` when the plain object is the real output, which keeps the upstream `deepStrictEqual` assertions and object-literal call sites valid with no deviation). Build the record result through `DescendResult.makeUnsafe({ matches, unreadable })` at Descend.ts:284. Leave `DescendOptions`/`DescendRecordOptions` (and `CompileAndExpandOptions`, which extends them) as interfaces under the overload exception, or convert them together in a follow-up if the integrator prefers one shape.

### fable-1-5
- file: scratchpad/effected/walker/Descend.ts:53
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 19; EFFECTED_PORT_GOAL.md D5 ("LiteralKit for literal domains")   evidence: The `onUnreadable` mode `"fail" | "skip" | "record"` is spelled three times as inline unions (Descend.ts:53, :96, :212) and compared as raw strings at :270-276 and :338-344; `DescendError.reason` is `S.Literals(["unreadableDirectory", "depthExceeded"])` at :152 and branched on at :160. Sibling ports already name such domains with `LiteralKit` (glob/internal/types.ts, semver/SemVer.ts, jsonc/JsoncNode.ts). Law 19's letter permits `S.Literals` for anonymous unions, so this is the D5 bar, not a breach.
- failure: A three-member mode domain with no name, no `.is` guard and no `$match` dispatch; adding a fourth mode means editing five sites by hand.
- fix: `const OnUnreadable = LiteralKit(["fail", "skip", "record"])` and `const DescendErrorReason = LiteralKit(["unreadableDirectory", "depthExceeded"])` (from `@beep/schema`), with `DescendOptions.onUnreadable?: Exclude<typeof OnUnreadable.Type, "record">`, `DescendRecordOptions.onUnreadable: "record"` unchanged, `reason: DescendErrorReason` in the error, and `OnUnreadable.$match`/`.is` at the comparison sites.

### fable-1-6
- file: scratchpad/effected/walker/Descend.ts:156
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 20; standards/effect-first-development.md EF-13   evidence: `DescendError` carries `reason` plus an optional `limit` that is meaningful only for `"depthExceeded"` (getter at :160-162 falls back to "the depth cap" when it is absent); `S.decodeUnknownResult` accepts an `unreadableDirectory` payload with a `limit` and a `depthExceeded` payload without one. Law 20 keeps optional bags "at external boundaries only when compatibility requires them": the upstream tests (D9 contract) read `error.reason` and `error.limit` directly, so the bag is the compatibility boundary itself and restructuring it is a section-14 deviation, not a required fix.
- failure: Invalid payload combinations are representable and the case-specific message logic branches on an optional field.
- fix: Backlog under section 14: if the operator accepts a `law:20` deviation, model `reason` as a tagged union (`{ _tag: "unreadableDirectory" } | { _tag: "depthExceeded", limit: S.Finite }`) and adjust the upstream assertions that read `error.limit`; otherwise keep the bag and add a schema check that `limit` is present iff `reason === "depthExceeded"`.

### fable-1-7
- file: scratchpad/test/walker/fixtures.ts:32
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 6; EFFECTED_PORT_GOAL.md section 16 ("never use native Set/Map"); user rule (effect/HashSet, never regular Set & Map)   evidence: Native collections in the walker tests: `ReadonlySet<string>` (fixtures.ts:32, :44), `new Set<string>()` (:74, :75), `Object.entries` (:79, :80), `new Set([...])` (Descend.test.ts:397, :458, :481; Expand.test.ts:120), `Object.fromEntries` (Walker.test.ts:294, :301). The native-runtime gate never saw them: the check run over all eight walker files reported `scanned_files=4` (tests are excluded by the law's scope), so green here is scope, not compliance. Test-only, and the effect-laws scope excludes tests by default, hence backlog.
- failure: The lab's test fixtures teach the collection types the repo forbids, and the gap is invisible to every gate the runner executes.
- fix: `FileSystemOptions.unreadable/vanished: HashSet.HashSet<string>` with `HashSet.empty()` defaults and `HashSet.has`; iterate `HashSet.union(unreadable, vanished)` when seeding; `R.toEntries(tree)` / `R.fromEntries(...)` for the two `Object.*` sites; `HashSet.make("/proj/src/locked")` at the four test call sites. No assertion changes.

### fable-1-8
- file: scratchpad/test/walker/fixtures.ts:2
- class: tsgo   severity: backlog
- standard: EFFECTED_PORT_GOAL.md S1 gate ("zero tsgo diagnostics", every Effect rule at error); effect-tsgo README line 228 (`@effect-diagnostics-next-line` directive)   evidence: `// @effect-diagnostics missingPipeableSignature:skip-file` silences the rule for the whole file although only two exports trigger it (`fileSystem` and `platform`, both `(tree, options = {})`). The repo's Dual-Arity Inventory Contract excludes the `(input, options?)` shape, so the suppression is justified, but its scope is wider than its reason.
- failure: Any future exported fixed-arity helper added to the fixture file is silently exempt from the rule.
- fix: Replace the file directive with `// @effect-diagnostics-next-line missingPipeableSignature:off` immediately above each of the two exports, keeping the one-line reason comment.

### fable-1-9
- file: scratchpad/effected/walker/Walker.ts:77
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14 (`Effect.fn("Name.op")` for reusable/public effectful functions)   evidence: Span names are bare in Walker.ts (`"ascend"` :77, `"ascendWithin"` :122, `"ascendToPhysical"` :139, `"firstMatch"` :168, `"findUpward"` :184) but qualified in the other two files (`"Walker.descend"` Descend.ts:220, `"Walker.compileAndExpand"` Expand.ts:138, both upstream names). Upstream had no spans on the upward functions, so these names are new observable trace output.
- failure: Traces from one module mix two naming schemes; a `firstMatch` span is not attributable to walker in a consumer's tracer.
- fix: Rename the five spans to `"Walker.ascend"`, `"Walker.ascendWithin"`, `"Walker.ascendToPhysical"`, `"Walker.firstMatch"`, `"Walker.findUpward"`.

### fable-1-10
- file: scratchpad/effected/walker/Walker.ts:213
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (carrier policy, section order, category and @since); EFFECTED_PORT_GOAL.md section 10.1 (no upstream behaviour sentence deleted) and 10.2; operator deferral of S2   evidence: Partial conversion: `descend` already carries `**Details**`, `**Example** (...)`, `@category utilities`, `@since 0.0.0` (Descend.ts:410-469) while `@remarks` remains at Walker.ts:213, :249, :277, :294, :303, Descend.ts:81, :112, Expand.ts:38, :56, :94 and `@example` at Walker.ts:231, Expand.ts:117, with no category or version on any other export. The `firstMatch` prose at Walker.ts:284-286 still says the absorption is `Effect.catch` and warns against `catchCause`, but the body at :173 is `Effect.orElseSucceed` (which is `catch_` underneath, effect/dist/internal/effect.js:1484, so the warning still holds for the wrong combinator name). Merging the two upstream `descend` overload blocks dropped the sentences that the recorded failure is `readDirectory` or, under `followSymlinks`, `realPath`, "for a reason other than NotFound", and that the walk "never aborts and never discards the offending path or its cause" (upstream Descend.ts:390-398 vs lab :447-450).
- failure: Docgen will fail on the legacy carriers once S2 gates run, the `firstMatch` doc names a combinator the code no longer calls, and a behaviour sentence section 10.1 protects is gone.
- fix: In S2: convert the remaining carriers mechanically, add `@category`/`@since 0.0.0` to every export, name `Effect.orElseSucceed` (and keep the failures-not-defects warning) at Walker.ts:284-286, and restore the dropped record-mode sentences in the `descend` Details paragraph.

### fable-1-11
- file: scratchpad/effected/walker/README.md:49
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (README adaptation); standards/effect-laws-v1.md law 2 and AGENTS.md Code Laws (root `effect` barrel forbidden in Markdown code blocks); operator deferral of docs   evidence: README.md keeps the npm/License/Node/TypeScript badges (:3-6), the pre-1.0 stability block with the `pnpm-plugin-effect` link (:10-20), the Install section (:28-42), and three fences importing `@effected/walker` plus `{ Effect, Layer, Option, Path }` / `{ Effect, FileSystem, Path }` from `"effect"` (:49-51, :69-70, :88). Only the title and Port notes were adapted.
- failure: The lab README teaches the import style the repo forbids and still presents upstream release chrome.
- fix: Apply section 10.3: drop badges, stability block and Install; rewrite the fences to `../../effected/walker/index.ts` with `import * as Effect from "effect/Effect"` (and `Layer`, `O`, `Path`, `FileSystem` likewise); keep Why, Features and Quick start prose.

### fable-1-12
- file: scratchpad/test/walker/Descend.test.ts:1
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10 and section 11.4 (property floor); operator deferral of S3   evidence: `rg -n "Arbitrary|it.effect.prop|fcRuns" scratchpad/test/walker` finds nothing. The module exports two schemas, `DescendError` (Descend.ts:148) and `GlobExpansionError` (Expand.ts:69, whose `cause` is a union of `GlobPatternError` and `DescendError`), neither with an encode/decode round-trip property.
- failure: The S3 gate will fail on the property floor; the error schemas' encoded forms (including the nested cause union) are untested beyond example payloads.
- fix: In S3 add `it.effect.prop` round-trips with `Arbitrary.schema(DescendError)` and `Arbitrary.schema(GlobExpansionError)` asserting encode-then-decode identity under Effect equality, run counts via `fcRuns(n)` from `@beep/fc-runs`.

REQUIRED: 4
BACKLOG: 8
