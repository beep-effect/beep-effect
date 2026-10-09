### fable-1-1
- file: scratchpad/effected/semver/VersionCache.ts:82
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (deviation protocol); D2 ("upstream tests and fixtures are the contract")   evidence: Upstream oracle packages/semver/src/VersionCache.ts declares `readonly versions: () => Effect.Effect<...>`, `latest: () => ...`, `oldest: () => ...` and documents "Every query is a thunk"; the port makes them bare Effect values (VersionCache.ts:82,84,86; impl :204-214 wraps them in `Effect.suspend`). The upstream test was rewritten from `cache.versions()` / `cache.latest()` / `cache.oldest()` to property access at scratchpad/test/semver/VersionCache.test.ts:27,38,47,55,63,66,75,76. README Port notes say "Deviations: None" and the ledger row `w1-semver` has `deviations: []`. No section-14 cause exists: law 22 is already satisfied by upstream's `Effect.fn("VersionCache.latest")(function* ...)` thunk and `() => Ref.get(ref)` returns no generator, so no beep law forces the shape change.
- failure: Any caller written against the upstream contract (`yield* cache.latest()`) dies with `TypeError: cache.latest is not a function`; the oracle suite no longer means what it meant, and the ledger/README claim behaviour parity.
- fix: Smallest: restore the upstream shape — interface `readonly versions: () => Effect.Effect<ReadonlyArray<SemVer>>` (same for latest/oldest), impl `versions: () => Ref.get(ref)`, `latest: Effect.fn("VersionCache.latest")(function* () {...})`, `oldest` likewise (this also removes the redundant `Effect.suspend` wrappers), restore the eight test lines and the "Every query is a thunk" doc sentence. If the orchestrator instead rules the value shape beep-idiomatic under D2, keep it only after writing the ledger `deviations` entry (test lines above, upstream vs lab behaviour, reason) and the README Port notes → Deviations entry.

### fable-1-2
- file: scratchpad/effected/semver/SemVer.ts:600
- class: law   severity: required
- standard: D2 (superset export rule: additions listed under Port notes → Added exports and ledger exportsAdded); section 14 (law:7 deviation must cite the adjusted test); precedent jsonc README "Added exports" + Deviation 3 (JsoncEditOverlapError)   evidence: `export class SemVerBumpOverflowError` (SemVer.ts:600-604) replaces upstream's `throw new Error(..., { cause })` (law 7 forces it), but index.ts:39 still exports only `InvalidVersionError, SemVer, SemVerBump`; README says "Added exports: None" and "Deviations: None"; ledger `exportsAdded: []`, `deviations: []`. The upstream test `assert.instanceOf(e, Error)` at __test__/SemVer.test.ts was rewritten to `assert.instanceOf(e, SemVerBumpOverflowError)` (scratchpad/test/semver/SemVer.test.ts:238) and the test imports it from module internals (SemVer.test.ts:9 `../../effected/semver/SemVer.ts`) because the index does not expose it. `audit -- parity` counts added names from index.ts, so it reports 0 added and cannot see this.
- failure: Consumers of the public surface cannot name or `catch` the error type that `bump.major/minor/patch/prerelease` throw; the ledger misstates the export census and omits a law:7 deviation that rewrote an oracle assertion.
- fix: Add `SemVerBumpOverflowError` to the index.ts export list; add a README "Added exports" row and a Deviations entry (reason `law:7`, cites scratchpad/test/semver/SemVer.test.ts:238 adjusting upstream __test__/SemVer.test.ts `instanceOf(e, Error)`); append the ledger `exportsAdded` ({name, kind: "both", entry: "."}) and `deviations` rows; switch the test import to `../../effected/semver/index.ts`.

### fable-1-3
- file: scratchpad/effected/semver/SemVer.ts:602
- class: schema   severity: required
- standard: .patterns/error-handling.md (structured fields, `cause` modelled as a Defect schema, `message` derived in a getter); README Errors contract ("The `message` getter is derived from those fields, never stored"; errors "fully serializable"); law 19 (LiteralKit for a named literal domain); precedent scratchpad/effected/jsonl/JsonlError.ts:409 `cause: S.Defect({ includeStack: true })`   evidence: The eighth error stores `{ message: S.String, cause: S.Unknown }` while `overflow()` (SemVer.ts:606) already knows the structured fact (`component: "major" | "minor" | "patch" | "prerelease"`) and bakes it into prose. The other seven errors in the module derive `message` from fields and carry schema-class payloads. `S.Unknown` for `cause` means `S.encode(SemVerBumpOverflowError)` emits the raw `SchemaError` object rather than JSON (installed effect exports `S.Defect(options)` — node_modules/effect/dist/Schema.js:5910).
- failure: The only way to learn which component overflowed is a regex over `message` (the port's own tests do exactly that); the error is not serializable like its siblings and breaks the module's documented error contract.
- fix: `const SemVerBumpComponent = LiteralKit(["major","minor","patch","prerelease"]).annotate($I.annote(...))`; fields `{ component: SemVerBumpComponent, cause: S.Defect({ includeStack: true }) }`; `override get message()` returning the existing `SemVerBump invariant violated: bumping "${this.component}" would exceed Number.MAX_SAFE_INTEGER (...)` string; `overflow(component, cause)` passes `{ component, cause }`. Existing message-regex tests keep passing.

### fable-1-4
- file: scratchpad/effected/semver/SemVer.ts:90
- class: law   severity: required
- standard: Section 14 (every observable difference is recorded with the adjusted upstream test; cause here is `law:D5`); precedent scratchpad/effected/jsonl/README.md:670 records identifier-driven changes as deviations   evidence: `S.Class<SemVer>($I`SemVer`)` changes the schema identifier from "SemVer" to "@beep/scratchpad/effected/semver/SemVer/SemVer", so `S.toJsonSchemaDocument(SemVer)` keys the definition differently; the upstream test `definitions.SemVerEncoded...` was rewritten to `definitions.@beep/scratchpad/effected/semver/SemVer/SemVerEncoded...` at scratchpad/test/semver/SemVer.test.ts:431 and :434. README "Deviations: None", ledger `deviations: []`.
- failure: An oracle assertion was rewritten with no record; the next session cannot distinguish the D5-mandated identity change from drift, and any consumer keyed on the upstream `$ref`/definition name silently diverges.
- fix: Add one ledger `deviations` entry and one README Port notes → Deviations entry: test SemVer.test.ts:431/:434 (adjusting upstream __test__/SemVer.test.ts JSON Schema export test), upstream key `definitions.SemVerEncoded`, lab key `definitions.@beep/scratchpad/effected/semver/SemVer/SemVerEncoded`, reason `law:D5` ($ScratchpadId identity on every exported schema). No code change.

### fable-1-5
- file: scratchpad/effected/semver/SemVer.ts:36
- class: law   severity: required
- standard: Section 14 ("a different accepted input" is a deviation; cause `law:` tsgo `schemaNumber` at error, tsconfig.base.json:208); precedent jsonc README Deviation 9 ("JsoncModificationError.offset is finite") records exactly this substitution   evidence: Upstream `Schema.optionalKey(Schema.Number)` / `Schema.Number` became `S.optionalKey(S.Finite)` at SemVer.ts:36, Range.ts:31, Comparator.ts:26 and `S.Finite` at VersionDiff.ts:54-58 and SemVer.ts:46 (`nonNegativeInteger` base). Decoding an encoded error with `position: Infinity` or a diff with a non-finite delta now fails where upstream accepted it. README "Deviations: None"; ledger `deviations: []`.
- failure: Unrecorded accepted-input change; the ledger row claims parity it does not have, and the law cause (`schemaNumber`) is not written down for the promotion re-grill.
- fix: One ledger `deviations` entry plus README entry listing the five sites, upstream `S.Number` vs lab `S.Finite`, reason `law:` the `schemaNumber` Effect rule is an error in tsconfig.base.json; note that no upstream test needed adjusting.

### fable-1-6
- file: scratchpad/effected/semver/SemVer.ts:393
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 ("No native Array.prototype.sort; use A.sort with explicit Order"); gate miss shown below   evidence: `[...versions].sort(SemVer.Order)` (SemVer.ts:393), `[...versions].sort((a, b) => b.compare(a))` (SemVer.ts:398) and `[...set].sort((a, b) => {...})` (internal/normalize.ts:20). The `native-runtime` law only flags `.sort` when `inHotspotScope` (packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:463), computed by `isNoNativeRuntimeExtraCheckHotspot`, whose patterns (repo-configs/src/eslint/NoNativeRuntimeHotspots.ts:50-51) cover only `scratchpad/effect-ontology/`; `scratchpad/effected/semver` is never a hotspot, so the gate could not report these. jsonc (JsoncEdit.ts:242, JsoncFingerprint.ts:259) already uses `A.sort`.
- failure: Three law-10 violations in domain code that the S1 gate structurally cannot see; the D5 end-state bar (beep laws green) is not actually met.
- fix: SemVer.sort: `A.sort(versions, SemVer.Order)`; rsort: `A.sort(versions, Order.flip(SemVer.Order))` (installed v4 exports `Order.flip`, Order.d.ts:247) or `Order.make((a, b) => b.compare(a))`; normalize.ts: build `const comparatorOrder = Order.combine(Order.mapInput(Order.Number, (c: ComparatorParts) => operatorWeight(c.operator)), Order.mapInput(Order.make(compareParts), (c) => c.version))` and `A.sort(set, comparatorOrder)`.

### fable-1-7
- file: scratchpad/effected/semver/SemVer.ts:2
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 ("Use A/O/P/R/S aliases only: import * as A from \"effect/Array\"")   evidence: `import * as Arr from "effect/Array"` at SemVer.ts:2, VersionCache.ts:2 and internal/order.ts:9, while the port correctly uses `O`, `P`, `S`. Census across scratchpad/effected: 113 files alias `A`, 5 alias `Arr` (3 of them this module); jsonl/jsonc use `A`. The `effect-imports` law excludes `scratchpad/` (runner Gates.ts:532) and its root-namespace map rewrites bindings without checking alias names, so the gate never evaluated this; the `native-runtime` `.sort` exemption keys on `objectName !== "A"` (NoNativeRuntime.ts:463), so the non-canonical alias also defeats future gate runs.
- failure: Law 1 violated in three files; `Arr.sort(...)` would additionally be mis-flagged as native sort once the module is in hotspot scope.
- fix: Rename the namespace import to `A` in SemVer.ts, VersionCache.ts and internal/order.ts and update the call sites.

### fable-1-8
- file: scratchpad/effected/semver/internal/order.ts:23
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains); D5 (LiteralKit for literal domains); AGENTS.md Code Laws (named LiteralKit domains over ad-hoc predicates); precedent jsonc JsoncNode.ts:111 `JsoncNodeType = LiteralKit([...]).annotate($I.annote(...))`   evidence: The operator domain is spelled three times: hand-written `export type ComparatorOperator = "=" | ">" | ">=" | "<" | "<="` (order.ts:23, referenced by name in desugar.ts, grammar.ts and order.ts), `S.Literals(["=", ">", ">=", "<", "<="])` on `Comparator.operator` (Comparator.ts:59), and `operatorWeight = Match.type<string>().pipe(...Match.orElse(() => 5))` (normalize.ts:10-16) whose `orElse` branch is unreachable for any `ComparatorOperator` and exists only because the domain is not a schema.
- failure: A named, reused literal domain modelled as a bare type alias plus an anonymous `S.Literals`; adding or renaming an operator cannot be caught exhaustively, and the sort weight carries dead code.
- fix: In internal/order.ts: `export const ComparatorOperator = LiteralKit(["=", ">", ">=", "<", "<="]).annotate($I.annote("ComparatorOperator", {...}))` and `export type ComparatorOperator = typeof ComparatorOperator.Type`; Comparator.ts:59 `operator: ComparatorOperator.annotateKey({...})`; normalize.ts: exhaustive match over `ComparatorOperator` (e.g. `ComparatorOperator.$match({...})` or `Match.value(op).pipe(Match.when(...)×5, Match.exhaustive)`) and delete the `orElse`.

### fable-1-9
- file: scratchpad/effected/semver/SemVer.ts:429
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Object in domain logic) and law 21 (tersest equivalent helper form); AGENTS.md Code Laws ("Prefer effect helper modules over native helpers") and Discovery & Reuse   evidence: `groupBy` hand-rolls a grouping loop over a mutable native record (`const grouped: Record<string, Array<SemVer>> = {}` … `grouped[key] = group`, SemVer.ts:429-441). Installed effect v4 exports `A.groupBy(self, f): Record<K, NonEmptyArray<A>>` (node_modules/effect/dist/Array.d.ts:6289), whose result is assignable to the declared `Record<string, ReadonlyArray<SemVer>>`; key insertion order (ascending, from `SemVer.sort`) is identical.
- failure: Twelve lines of native-object mutation reimplementing a stock Effect helper in domain code; the lab's D5 "full beep-native" bar is not met for this static.
- fix: `return A.groupBy(SemVer.sort(versions), (version) => Match.value(strategy).pipe(Match.when("major", () => `${version.major}`), Match.when("minor", () => `${version.major}.${version.minor}`), Match.when("patch", () => `${version.major}.${version.minor}.${version.patch}`), Match.exhaustive));`

### fable-1-10
- file: scratchpad/effected/semver/SemVer.ts:402
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form); AGENTS.md Discovery & Reuse   evidence: Hand-rolled extremum/dedupe loops where installed v4 helpers exist: `SemVer.max`/`min` (SemVer.ts:402-417), `Range.maxSatisfying`/`minSatisfying` (Range.ts:202-226, which also duplicate `SemVer.max/min` over `range.filter`), `dedupeSorted` (VersionCache.ts:121-124). Array.d.ts exports `max`/`min` over `NonEmptyReadonlyArray` with an `Order`, `isReadonlyArrayNonEmpty`, and `dedupeAdjacentWith`. Upstream-verbatim loops, behaviour unchanged, so backlog rather than required.
- failure: Five copies of the same max/min scan and a manual adjacent-dedupe; none wrong, all heavier than the helper form.
- fix: `static max(versions) { return A.isReadonlyArrayNonEmpty(versions) ? O.some(A.max(versions, SemVer.Order)) : O.none(); }` (min symmetric); `maxSatisfying = Fn.dual(2, (versions, range) => SemVer.max(range.filter(versions)))` (min symmetric); `dedupeSorted = (versions) => A.dedupeAdjacentWith(SemVer.sort(versions), (a, b) => a.equal(b))`.

### fable-1-11
- file: scratchpad/effected/semver/Range.ts:343
- class: bug   severity: backlog
- standard: Section 14 (`upstream-bug:<evidence>` deviation; a reviewer-proposed deviation is backlog, never required)   evidence: Read-only probe against the port: `Range.simplify(Range.parseResult("^1.0.0 || ^1.0.0"))` prints `>=1.0.0 <2.0.0-0 || >=1.0.0 <2.0.0-0` (2 sets) and `^1.0.0 || ^1.0.0 || ~1.2.0` keeps all 3 sets. Cause: the filter drops each set that is a subset of any other index, so two equivalent sets eliminate each other; `if (sets.length === 0) return range;` (Range.ts:347) then returns the un-simplified input, and in the three-set case the subset `~1.2.0` survives because the guard fires for the whole range. Upstream-verbatim, upstream tests do not cover equivalent sets.
- failure: `simplify` is not idempotent in intent: duplicate or mutually-equivalent comparator sets are never removed, and a genuinely redundant set survives whenever any equivalent pair is present.
- fix: Keep the first of an equivalent pair: drop `set` at `i` only when some `other` at `j` satisfies `isComparatorSetSubset(set, other) && (j < i || !isComparatorSetSubset(other, set))`, remove the `length === 0` guard (it can no longer fire), record as `upstream-bug` with a lab test, and list in README Port notes → Deviations.

### fable-1-12
- file: scratchpad/effected/semver/internal/order.ts:36
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); Dual-Arity Inventory Contract (dual applies to real public helper APIs)   evidence: Upstream's plain two-parameter internals were wrapped in `dual(2, ...)`: `comparePrereleaseIdentifier` (order.ts:36), `compareParts` (:50), `compareBuild` (:80), `desugarXRange` (desugar.ts:106), `desugarHyphen` (:176). Every call site is data-first (grammar.ts:379/406/450, normalize.ts:23, SemVer.ts:320/478, order.ts:66); none of the four lab laws requires dual on internal exports. `dual` adds an `arguments.length` dispatch per call in the precedence hot path, and the data-last form of a comparator (`compareParts(b)(a)`) reads backwards.
- failure: Extra indirection and an unused, confusing data-last surface on module-internal helpers; no observable behaviour change.
- fix: Restore the plain `(a, b) =>` function form for the five internals (or keep dual only if a gate added later demands it).

### fable-1-13
- file: scratchpad/effected/semver/VersionDiff.ts:48
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 19 / D5 (LiteralKit for literal domains); law 19 permits `S.Literals` only for anonymous unions never referenced by name   evidence: The diff-type domain is duplicated: `S.Literals(["major","minor","patch","prerelease","build","none"])` (VersionDiff.ts:48) and the inline return type of `classifyDiff` (:10). Same pattern for `groupBy` strategy `"major"|"minor"|"patch"` (SemVer.ts:427 overload + impl), `truncate` level `"prerelease"|"build"` (SemVer.ts:373-377) and the `overflow` component (SemVer.ts:606, covered by fable-1-3). These are not named upstream, so backlog rather than required.
- failure: Each domain is written twice and can drift; none has a schema value, guard or enum for consumers.
- fix: `export const VersionDiffType = LiteralKit([...]).annotate($I.annote(...))` with `type: VersionDiffType` and `classifyDiff(): VersionDiffType` (`typeof VersionDiffType.Type`); analogous `GroupByStrategy` and `TruncateLevel` kits used in the overloads.

### fable-1-14
- file: scratchpad/effected/semver/README.md:1
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (README adaptation, S2); D4 carried documentation must stay true   evidence: README "Errors" section lists seven tagged errors and states "The `message` getter is derived from those fields, never stored" and that failures are routable with `Effect.catchTag`; the port adds an eighth (`SemVerBumpOverflowError`, thrown synchronously, message stored as a field). The "Version cache" section and `VersionCacheShape` JSDoc ("Queries are lazy Effects") will be wrong again if fable-1-1 reverts the thunk shape. S2 has not run, so backlog; the Port-notes parts of these gaps are already required under fable-1-2/1-4/1-5.
- failure: Carried prose contradicts the shipped surface.
- fix: After the required fixes land: add the eighth row to the Errors table (raised by `SemVerBump.*`, carries `component`, `cause`), note that it is thrown rather than failed, and align the Version cache prose with whichever `VersionCacheShape` shape fable-1-1 settles on.

### fable-1-15
- file: scratchpad/effected/semver/SemVer.ts:584
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled `**Example**`, no `@example`/`@remarks`); EFFECTED_PORT_GOAL.md section 10.2 (carrier conversion is the S2 mechanical pass)   evidence: `SemVerBumpOverflowError` (SemVer.ts:584-599) is the only export already on beep carriers (`**Example** (Inspecting a bump overflow)`, `@category errors`, `@since 0.0.0`) while every other export in the module still carries upstream `@example`/`@remarks`/`@public`; its example constructs the error with `{ message: "Overflow", cause: undefined }`, which stops type-checking once fable-1-3 replaces the fields. S2 has not run, so backlog.
- failure: Mixed carrier styles inside one file and an example that will go stale with the required schema fix.
- fix: Let the S2 pass convert the remaining carriers; when fable-1-3 lands, rewrite the example to `SemVerBumpOverflowError.make({ component: "major", cause: ... })` and assert the derived `message`.

REQUIRED: 9
BACKLOG: 6
