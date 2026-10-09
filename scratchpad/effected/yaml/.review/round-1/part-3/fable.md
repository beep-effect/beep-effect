### fable-1-1
- file: scratchpad/effected/yaml/internal/stringifier.ts:447
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); D9 (fix must stay byte-identical); effect-laws-v1 §11 bans `switch`, not if/else chains   evidence: Read-only `bun -e` in-memory benchmark, lab vs the live checkout (its packages/yaml/src is `diff -rq` identical to the pinned oracle; both on effect 4.0.2), 7 runs, min: `stringifyValue` of a 40k-string record 44.7ms vs 12.2ms (3.66x), 40k-string array 14.3 vs 4.1ms (3.49x), 40k-number array 1.8 vs 1.7ms (1.06x: the only path that skips `renderString`); `stringifyDocument` on a 537KB/36k-line document 88.3 vs 25.5ms (3.46x); public `Yaml.stringifyResult` 30 vs 12ms, `YamlFormat.formatToString` 416 vs 262ms; every output byte-identical. Micro (1e6 iterations): `Match.value(style).pipe(Match.when x5, Match.exhaustive)` 72.3ns per dispatch vs 1.2ns for an if-chain; the port replaced upstream's `switch (style)` with a matcher that allocates five closures per scalar render.
- failure: Every string scalar and every mapping key (keys render through `renderPlainKey` -> `renderString`) pays ~70ns plus GC pressure for a five-way literal dispatch; the public stringify and format paths run 2.5-3.5x slower than upstream for identical output.
- fix: Replace the `Match.value(style).pipe(...)` chain with an `if (style === "plain") {...} if (style === "single-quoted") return ...; ...` chain ending in the `block-folded` return (law 11 only forbids `switch`; AGENTS.md's match preference yields to the measured 60x cost, record the trade-off in the ledger).

### fable-1-2
- file: scratchpad/effected/yaml/internal/stringifier.ts:243
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); effect-laws-v1 §6 must still hold (no native Set)   evidence: `HashSet.has(INDICATOR_CHARS, first)` runs once per plain scalar and per mapping key inside `requiresQuoting`; micro (1e6): 12.4ms vs 1.4ms for the native lookup upstream used (9x). End to end the key-only path shows it: `stringifyValue` of a 40k-number record (values skip `renderString`, keys do not) 21.9 vs 6.7ms (3.27x) while the 40k-number array is 1.06x; stacked with fable-1-1 on every key and string scalar.
- failure: Per-scalar indicator test is an order of magnitude slower than upstream on the hottest branch of the stringifier.
- fix: Store the 21 indicator characters as a string constant (`const INDICATOR_CHARS = ":#{}[],&*?|-<>=!%@`\"'";`) and test with `INDICATOR_CHARS.includes(first)` (or `Str.includes(first)(INDICATOR_CHARS)` from `effect/String`): no collection, law 6 kept, same membership.

### fable-1-3
- file: scratchpad/effected/yaml/internal/stringifier.ts:1073
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); AGENTS.md 'derived S.is(...) guards' is satisfied by a guard derived once at module level   evidence: Micro (1e6): `S.is(YamlScalar)(node)` built per call 64.3ns vs `node instanceof YamlScalar` 15.5ns vs a `_tag` test 2.6ns; the same guard hoisted once (`const isScalar = S.is(YamlScalar)`) 28ns. Semantics verified instanceof-based: `S.is(YamlScalar)({ _tag: "YamlScalar", value, style, offset, length })` is false and a `YamlMap` is false, so hoisting is byte-identical to upstream's `instanceof`. 37 per-call sites in stringifier.ts (`stringifyNodeLines` 1073-1082 up to four per node, `stringifyMapNodeLines` ~10 per pair, `normalizeNodeTags`/`stripNodeComments` 947-1041, `rendersAcrossLines` 1276, `isPlainMergeKey` 1176), 3 in block.ts (`keyIsSimple` 1151-1152, `checkDuplicateKeys` 1326), 3 in anchors.ts (`collectAnchors` 153-161). Contributes to `stringifyDocument` 3.46x and `composeFirstDocument` 1.67x (315 vs 189ms; lexer 1.08x, CST 1.08x).
- failure: A fresh guard closure (plus parser lookup) is created for every type test on every node of every walk.
- fix: Declare `const isScalar = S.is(YamlScalar)`, `isMap`, `isSeq`, `isAlias` once at module level in stringifier.ts, block.ts and anchors.ts and call those (or discriminate with `P.isTagged(node, "YamlScalar")` on the `_tag` the TaggedClass carries, 2.6ns).

### fable-1-4
- file: scratchpad/effected/yaml/YamlNode.ts:617
- class: perf   severity: required
- standard: D11 (measured regression versus upstream)   evidence: `getNodeValue(doc.contents, new Map())` (anchors.ts:179, the focus-file entry point, delegating to `YamlNode.toValue` -> `nodeToValue`) 24.4ms vs 2.1ms upstream (11.6x) on the 537KB document, identical values. `nodeToValue` (YamlNode.ts 614-640) builds `S.is(...)` guards up to four times per node and twice per pair key where upstream tests `instanceof` (upstream YamlNode.ts 605-631); `findByPath`/`pathToNode` (413-508) do the same. This is the value-extraction half of `Yaml.parseResult` 345 vs 216ms (1.6x).
- failure: `Yaml.parse*` value extraction and `YamlDocument#toValue` are an order of magnitude slower than upstream.
- fix: Same hoisting as fable-1-3 in YamlNode.ts: `const isScalar = S.is(YamlScalar)` etc. declared once next to the shared method implementations and used in `nodeToValue`, `findByPath` and `pathToNode` (outside this part's focus files; flagged so the YamlNode.ts seat does not miss the measurement).

### fable-1-5
- file: scratchpad/effected/yaml/internal/composer/anchors.ts:148
- class: law   severity: required
- standard: effect-laws-v1 §6 (no native Map/Set in domain logic) and its Allowlist Contract ('do not add entries for scanner misses'); 2026-10-09 grilling ruling: YAML anchors -> MutableHashMap, public API changes green-lit   evidence: `return anchors.backing` hands the `MutableHashMap`'s internal native `Map` out as `buildAnchorMap(): Map<string, YamlNode>`; state.ts:198/207 seed `ComposerState.anchors` and `tagMap` the same way (`MutableHashMap.empty<...>().backing`, comment 'Composer consumers share the native Map boundary'); `registerAnchor` (anchors.ts:71-79) and `makeAlias` (:44) call `.has`/`.set` on that Map; `getNodeValue` (:179) dispatches on `args[0] instanceof Map`. The native-runtime gate matches only `new Map`/`new Set` constructors (NoNativeRuntime.ts:69,397), so none of these sites is detected, and the allowlist's yaml `EFFECTED-YAML-ANCHOR-MAP` entries cover `new Map` in Yaml.ts/YamlDocument.ts only. The Effect collection is used purely as a native-Map factory.
- failure: Law 6 is circumvented rather than met and the native `Map` remains the `toValue(anchors)` contract, so the planned 79-site native-runtime replacement wave would not see these sites.
- fix: Type `ComposerState.anchors`/`tagMap`, `buildAnchorMap`'s return and the `anchors` parameter of `toValue`/`nodeToJsValue`/`getNodeValue` as `MutableHashMap.MutableHashMap<string, YamlNode>`; use `MutableHashMap.has/set/get`; make `getNodeValue`'s predicate `args[0] === null || (args[0] !== undefined && !MutableHashMap.isMutableHashMap(args[0]))`; switch the `new Map()` callers (Yaml.ts, YamlDocument.ts, scratchpad/test/yaml/e2e/support/engine.ts:75) to `MutableHashMap.empty()` and delete the two allowlist entries.

### fable-1-6
- file: scratchpad/effected/yaml/internal/stringifier.ts:731
- class: law   severity: required
- standard: effect-laws-v1 §10 (no native `Array.prototype.sort`; `A.sort` with an explicit `Order`)   evidence: `keys.sort()` at :731 and `items.sort((a, b) => ka < kb ? -1 : ka > kb ? 1 : 0)` at :1404. The gate's `native-sort` violation (NoNativeRuntime.ts:463) fires only when `inHotspotScope`, and `NoNativeRuntimeHotspots.ts` lists `packages/tooling/...` and `scratchpad/effect-ontology/` only, so `scratchpad/effected` is outside the gate's reach. `Order.String` (effect/Order) compares with `<`/`>` on UTF-16 code units, which is exactly what the default comparator and the hand-written comparator do, and both `Array.prototype.sort` and `A.sort` are stable: output stays byte-identical (D9).
- failure: A law-10 violation the gate cannot see; the sortKeys paths are the only native sorts in the module.
- fix: `import * as Order from "effect/Order"`; `const keys = ctx.sortKeys ? A.sort(R.keys(obj), Order.String) : R.keys(obj);` and `items = A.sort(items, Order.mapInput(Order.String, (p) => isScalar(p.key) ? String(p.key.value) : ""))`.

### fable-1-7
- file: scratchpad/effected/yaml/internal/stringifier.ts:47
- class: law   severity: required
- standard: effect-laws-v1 §7 ('extend S.TaggedError from effect/Schema directly for typed errors'); .patterns/error-handling.md (S.TaggedError + `$I` identity, `override get message()`); D5 (`$ScratchpadId` identity on every exported error, landing in S4)   evidence: `StringifyFailure` (:47-52) and `StringifyDepthExceeded` (:63-68) extend `Data.TaggedError` with imperative constructors that assign `this.name`; `StringifierInvariantFailure` (:39-41) in the same file already follows the law but omits the `$I.annote(...)` annotation the pattern requires. Consumers (Yaml.ts:281, YamlDocument.ts:188/206) use only `instanceof`, `.reason` and `.message`, all preserved by an `S.TaggedError` class; the errors never escape the facade, so `name` is unobservable (D9 safe).
- failure: Two exported errors sit outside the error law with no identity annotation, and one file mixes two error idioms.
- fix: `export class StringifyFailure extends S.TaggedError<StringifyFailure>($I`StringifyFailure`)("StringifyFailure", { reason: S.String }, $I.annote("StringifyFailure", { description: "..." })) { override get message(): string { return this.reason; } }` with call sites `new StringifyFailure({ reason: "Circular reference detected" })`; `StringifyDepthExceeded` likewise with `{}` fields and a message getter over `MAX_NESTING_DEPTH`; add `$I.annote` to `StringifierInvariantFailure`. Sibling site outside this part: YamlNode.ts:544 `AliasExpansionBudgetExceeded`.

### fable-1-8
- file: scratchpad/effected/yaml/internal/token.ts:6
- class: schema   severity: required
- standard: effect-laws-v1 §19 (LiteralKit for named internal literal domains; S.Literals only for anonymous unions never referenced by name); user coding rule 'never a hand-rolled union of literals'; D5 (kit substitutions land in S4)   evidence: `YamlTokenKind` is a 22-member hand-written `type` union consumed by name in lexer.ts:9 and cst-parser.ts:12; YamlToken.ts:25-48 writes the same 22 literals a second time as `S.Literals([...])` and names it `YamlTokenKind` (a named domain, so §19 asks for LiteralKit there too). The two lists are maintained independently; tsgo catches drift in only one direction (`promoteAll` assigning `token.kind`). Not covered by the four beep laws the S1 gate runs.
- failure: One literal domain, two copies, one of them outside the schema layer with no `.is`/`.Enum`/`$match` surface.
- fix: In internal/token.ts: `import { LiteralKit } from "@beep/schema"; export const YamlTokenKind = LiteralKit(["document-start", ..., "error"]); export type YamlTokenKind = typeof YamlTokenKind.Type;` and in YamlToken.ts derive the public schema from it (`export const YamlTokenKind = InternalKind.pipe($I.annoteSchema("YamlTokenKind", {...}))`) so the list exists once.

### fable-1-9
- file: scratchpad/effected/yaml/internal/composer/block.ts:1303
- class: perf   severity: backlog
- standard: D11 (small measured contributions, not required on their own)   evidence: `keyIdentity` dispatches through `Match.value(v).pipe(Match.when x4, Match.orElse)` per mapping key (72ns per dispatch, fable-1-1 micro) and `checkDuplicateKeys` (:1324) uses `MutableHashSet` (22.9 vs 10.3ms per 1M add/has on string keys, 2.2x). `composeFirstDocument` is 1.67x upstream overall (315 vs 189ms with lexer and CST both 1.08x), but block.ts's own rewrites (these two plus 32 `getSomesStruct` sites at roughly +11ns per scalar) account for only a few ms of the ~125ms delta; the remainder sits in scalars.ts/comments.ts/document.ts, outside this part's focus and worth a measurement by those seats.
- failure: Small per-key overhead in duplicate-key detection.
- fix: `keyIdentity`: `if (P.isBoolean(v)) return ...; if (P.isString(v)) ...; if (P.isBigInt(v)) ...; if (P.isNumber(v)) {...}; return ...` (keep `MutableHashSet`, law 6).

### fable-1-10
- file: scratchpad/effected/yaml/internal/stringifier.ts:1956
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 'Dual-Arity Inventory Contract': a callable shaped `(input, options?)` is excluded because its one-argument form is already complete   evidence: `stringifyValue` is wrapped in `dual((args) => args.length >= 1, ...)`: since `value: unknown` accepts any argument, both TypeScript overload resolution and the runtime predicate route every one-argument call to data-first, so the declared `(options?) => (value) => string` overload is reachable only with zero arguments; `stringifyDocument` (:1973) sniffs `"contents" in args[0]` to tell a document from an options bag. Micro (5e6 calls): predicate-form `dual` 11ns per call vs 0.4ns arity-form vs 0.2ns plain, negligible at per-document frequency but a misleading shape.
- failure: A vacuous overload and duck-typed dispatch on two functions the contract exempts from a data-last form.
- fix: Declare both as plain functions `(value: unknown, options?: StringifyOptionsInput)` / `(doc: RawYamlDocument, options?: StringifyOptionsInput)` (the e2e engine already re-wraps `stringifyDocument` itself).

### fable-1-11
- file: scratchpad/effected/yaml/internal/composer/block.ts:144
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 §21 (tersest equivalent helper form when behaviour is unchanged)   evidence: 32 sites in block.ts (144-2097) and 30 in stringifier.ts spell one optional field as `...O.getSomesStruct({ tag: O.fromUndefinedOr(meta?.tag) })`: an Option, a one-key record and an `R.getSomes` pass per field, on every composed node. Micro (1e6 two-field node builds): 44ms vs 33ms for the conditional spread upstream used (1.3x); semantics identical (`Some(false)` is kept exactly as `!== undefined` keeps `false`).
- failure: Verbosity and extra allocation on the composer hot path with no semantic gain.
- fix: Restore `...(v !== undefined ? { tag: v } : {})` at the single-key sites, or one shared helper, unless a lint lane mandates the Option form (then record it once in the ledger).

### fable-1-12
- file: scratchpad/effected/yaml/internal/token.ts:35
- class: schema   severity: backlog
- standard: standards/schema-first-development-prompt.md (schema data models over exported interfaces); effect-laws-v1 §20   evidence: `YamlToken` is an exported `interface` the lexer materialises per token (`lexAll` emits ~36k tokens for the 537KB document) and YamlToken.ts promotes into an `S.Class`. A validating class construction costs ~0.5us each (200k `YamlScalar.make` 99.8ms; `new` 88.5ms, v4 constructors call `struct.make` too), so a naive `.make` per token would add ~18ms to `lexAll`'s 14.7ms; S2/S3 have not run, so this is a design note for the schema pass.
- failure: An internal data model lives outside the schema layer.
- fix: Model it as `S.Struct({ kind: YamlTokenKind, value: S.String, offset: S.Finite, ... })` from the fable-1-8 kit with `type YamlToken = typeof YamlTokenStruct.Type`, constructing plain literals in the lexer (no `.make` on the hot path), or record the interface as a measured hot-path exception.

### fable-1-13
- file: scratchpad/effected/yaml/internal/composer/block.ts:926
- class: effect-idiom   severity: backlog
- standard: effect-laws-v1 §21 (tersest equivalent form)   evidence: `R.keys<string, unknown>({ ...leading }).length === 0` copies the `CommentFields` object only so that `R.keys` accepts an interface without an index signature; `CommentFields` has exactly `commentBefore` and `spaceBefore` (comments.ts), both known at the call site; runs once per pair in `buildPairs`.
- failure: One allocation per pair for an emptiness test.
- fix: `leading.commentBefore === undefined && leading.spaceBefore === undefined ? pair : YamlPair.make(...)`.

REQUIRED: 8
BACKLOG: 5
