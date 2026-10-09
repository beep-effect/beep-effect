### fable-1-1
- file: scratchpad/effected/yaml/YamlNode.ts:614
- class: perf   severity: required
- standard: D11 (measured regression vs upstream); AGENTS.md Code Laws: 'derived S.is(...) guards' as named building blocks; tsgo instanceOfSchema (at error) forbids the instanceof form, so the guard must be hoisted, not reverted   evidence: Every hot-path site calls S.is(Class) inside the loop (lines 413,417,425,452,463,490,492,508,614,617,618,622,628,639,640). node_modules/effect/dist/SchemaParser.js: `is(schema)` -> `_is(ast)` returns a fresh lazy guard whose first call runs `makeIs` -> `asExit(run(ast))` -> `runWithCompiler` with its own `parser` cell, so each call re-resolves the compiler and runs `Effect.runSyncExit`. bun probe (3000-entry doc, 206 KB; upstream = live checkout, byte-identical to the oracle src): doc.contents.toValue() lab 19.3 ms vs upstream 1.49 ms (13x); findAtOffset 1.05 vs 0.065 ms (16x); pathOf(last) 18.4 vs 0.92 ms (20x); find([..]) 0.65 vs 0.40 ms; Yaml.parseResult 263 vs 149 ms. Micro over 3000 values: `S.is(YamlMap)(v)` per call 0.373 ms, hoisted `const isMap = S.is(YamlMap)` 0.121 ms, `instanceof` 0.030 ms. ~30k nodes x 5 guards x ~124 ns accounts for the whole toValue gap.
- failure: Value extraction, offset lookup and path search on every parsed document (Yaml.parse, YamlDocument#toValue, LSP-style findAtOffset/pathOf) run 13-20x slower than upstream for the same input; the cost is paid per guard call, not per schema.
- fix: After the four class declarations add module-level guards `const isYamlScalar = S.is(YamlScalar); const isYamlMap = S.is(YamlMap); const isYamlSeq = S.is(YamlSeq); const isYamlAlias = S.is(YamlAlias);` and use them at every listed site (3x faster, law-compliant). For upstream parity branch on the TaggedClass discriminator instead (`P.isTagged(node, "YamlMap")` or `Match.tagsExhaustive` in nodeToValue), which measures at instanceof speed.

### fable-1-2
- file: scratchpad/effected/yaml/YamlFormat.ts:442
- class: perf   severity: required
- standard: D11 (measured regression vs upstream); AGENTS.md 'derived S.is(...) guards'; same mechanism as fable-1-1   evidence: Per-item/per-node `S.is(...)` construction at lines 210,226,237 (requoteNode, recursive over the whole tree), 441,442,490 (modifyNode: `items.findIndex((pair) => S.is(YamlScalar)(pair.key) ...)` builds a guard per pair), 597,598,603 (findExistingTarget), 665,666,669,672,715. bun probe lab vs upstream: formatToString with requoteScalars:true 431 vs 280 ms; modifyToString insert key (full pipeline) 322 vs 160 ms (2x); modifyToString existing key (regional) 231 vs 152 ms. Micro cost per guard call 124 ns vs 40 ns hoisted vs 10 ns instanceof (fable-1-1).
- failure: modify/format paths on large documents run ~2x slower than upstream; findIndex/find over a 3000-pair mapping rebuilds a schema guard 3000 times per navigation step.
- fix: Import the hoisted guards from YamlNode.ts (export them as internal `isYamlScalar`/`isYamlMap`/`isYamlSeq`, or define module-level `const isYamlScalar = S.is(YamlScalar)` etc. in YamlFormat.ts) and use them at the 14 sites; never call `S.is(X)` inside a loop or callback.

### fable-1-3
- file: scratchpad/effected/yaml/YamlLint.ts:296
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10: no native Array.prototype.sort; use A.sort with an explicit Order   evidence: Native `.sort(` at YamlLint.ts:296 (`[...MutableHashMap.values(votes)].sort(...)`), :297, :444 (`[...tallies].sort((a, b) => b.count - a.count)`), :527 (`out.sort(byPosition)`, in place). Gate miss shown: packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:463 emits `native-sort` only when `inHotspotScope`, so the green `native-runtime --check` never saw these sites. node_modules/effect/dist/Array.js:1787 `sort` = copy + native sort with the Order, so the order produced is identical (same stable sort, same comparator).
- failure: Law 10 violation on four sites of a public lint facade; `out.sort` additionally mutates in place.
- fix: `A.sort(xs, order)` at each site with Orders built from the existing comparators: votes/floors `Order.combine(Order.mapInput(Order.String, (t) => t.rule), Order.mapInput(Order.String, (t) => t.dimension), Order.mapInput(Order.String, keyOf))`; candidates `Order.reverse(Order.mapInput(Order.Number, (t) => t.count))`; runRules `A.sort(out, Order.combine(Order.mapInput(Order.Number, (d) => d.offset), Order.mapInput(Order.Number, (d) => d.length), Order.mapInput(Order.String, (d) => d.rule)))`.

### fable-1-4
- file: scratchpad/effected/yaml/YamlEdit.ts:80
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10: no native Array.prototype.sort; use A.sort with an explicit Order   evidence: `const sorted = [...edits].sort((a, b) => b.offset - a.offset);` on the public `YamlEdit.applyAll`. Same gate miss as fable-1-3 (NoNativeRuntime.ts:463 hotspot-scoped). `A.sort` (Array.js:1787) copies then sorts with the Order, so `edits` stays unmutated and the reverse-offset order is unchanged.
- failure: Law 10 violation in the shared edit-application primitive every formatter/linter fix path goes through.
- fix: `const sorted = A.sort(edits, Order.reverse(Order.mapInput(Order.Number, (e: YamlEdit) => e.offset)));` with `import * as Order from "effect/Order"`.

### fable-1-5
- file: scratchpad/effected/yaml/Yaml.ts:936
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 5: no runtime `typeof ... === ...`; use effect/Predicate guards   evidence: `if (typeof a !== typeof b) return false;` survives in deepEqualValues while the sibling checks were converted to P.isNumber/A.isArray/P.isObject. Gate miss shown: NoNativeRuntime.ts:375-377 flags `typeof-runtime` only when the other operand is a string literal (`getRuntimeTypeLiteral`), so a typeof-vs-typeof comparison is invisible to the green gate. The line is dead: every `true` return below requires both sides arrays (A.isArray on both) or both P.isObject, which already share a typeof; every other pair falls to `return false` regardless.
- failure: Law 5 violation; removing the line changes no result of Yaml.equals/equalsValue (Yaml.test.ts equality block keeps passing).
- fix: Delete line 936.

### fable-1-6
- file: scratchpad/effected/yaml/YamlFormat.ts:142
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7: extend S.TaggedError from effect/Schema directly for typed errors; .patterns/error-handling.md (S.TaggedError pattern); PORT_LEDGER.json:598 records law:7 as 'extend S.TaggedError' for sibling modules   evidence: `class ModifyFailure extends Data.TaggedError("ModifyFailure")<{...}>` with a positional constructor and `this.name = ...`, while the same file's `YamlFormatInvariantFailure` (:50) and YamlEdit.ts `YamlEditFailure` use `S.TaggedError` with `$I` identity — two error idioms in one module. Gates are green with it, so the law is not enforced by a gate here. Thrown at :383,:392,:432,:472,:482,:493,:509,:519 and caught by `instanceof` at :1004.
- failure: Law 7 violation and an identity-less internal error (no `$I` identity, no schema fields), inconsistent with the module's other defects.
- fix: `class ModifyFailure extends S.TaggedError<ModifyFailure>($I`ModifyFailure`)("ModifyFailure", { code: S.Literals(["EmptyDocument","PathNotFound","InvalidIndex","NotNavigable","CircularReference","NestingDepthExceeded"]), message: S.String, offset: S.Finite, length: S.Finite }) {}`; replace the 8 `new ModifyFailure(code, message, offset, length)` sites with `ModifyFailure.make({ code, message, offset, length })` and the `instanceof` at :1004 with a hoisted `const isModifyFailure = S.is(ModifyFailure)` (tsgo instanceOfSchema would otherwise fire).

### fable-1-7
- file: scratchpad/effected/yaml/YamlNode.ts:544
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7: extend S.TaggedError from effect/Schema directly for typed errors; .patterns/error-handling.md   evidence: `export class AliasExpansionBudgetExceeded extends Data.TaggedError("AliasExpansionBudgetExceeded")<{ readonly message: string }>` with `constructor(limit)` and `this.name = ...`; thrown at :608 and matched by `instanceof` in Yaml.ts:335,:378,:919. Same inconsistency as fable-1-6 (YamlEditFailure/YamlFormatInvariantFailure use S.TaggedError). No test references the class (rg over scratchpad/test/yaml is empty), so the shape change is test-neutral.
- failure: Law 7 violation on an exported error class; the limit is flattened into the message instead of carried as a field.
- fix: `export class AliasExpansionBudgetExceeded extends S.TaggedError<AliasExpansionBudgetExceeded>($I`AliasExpansionBudgetExceeded`)("AliasExpansionBudgetExceeded", { limit: S.Finite }) { override get message() { return `Alias expansion exceeded budget of ${this.limit} nodes`; } }`; throw `AliasExpansionBudgetExceeded.make({ limit: budget.limit })` at :608; in Yaml.ts use a hoisted `const isAliasBudgetExceeded = S.is(AliasExpansionBudgetExceeded)` at the three catch sites.

### fable-1-8
- file: scratchpad/effected/yaml/YamlLint.ts:60
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21: prefer the tersest equivalent Effect helper form when behaviour is unchanged   evidence: `P.isObjectKeyword(entry) && !P.isFunction(entry)` repeated at :60, :65, :413, :496, :520. node_modules/effect/dist/Predicate.js:687 `isObjectOrArray = typeof input === "object" && input !== null`, i.e. exactly `isObjectKeyword && !isFunction` (Predicate.js:782-783), and its d.ts guard (`input is {[x: PropertyKey]: unknown} | Array<unknown>`, Predicate.d.ts:1138) narrows `YamlLintRuleSetting` to its record member so `entry.severity` still type-checks. The green `terse-effect --check` did not report it.
- failure: Five copies of a two-call idiom where one named guard exists; the same upstream `typeof entry === "object"` intent is obscured.
- fix: Replace each occurrence with `P.isObjectOrArray(entry)` (or a module-level `const isOptionsEntry = P.isObjectOrArray`).

### fable-1-9
- file: scratchpad/effected/yaml/README.md:252
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 (D9 deviation protocol: ledger entry, adjusted/added upstream test, README Port notes); 2026-10-09 ruling 'one ledger plus README deviation entry per module per systemic class (identity keys, S.Finite, tagged errors, ...)'; precedent scratchpad/effected/jsonc/README.md:258,294,318 and PORT_LEDGER.json:627,645   evidence: README Port notes say `Deviations: None` and the ledger row has `deviations: []`, but the code carries observable deviations: (a) S.Number -> S.Finite on every numeric field (YamlDiagnostic, YamlToken, YamlEdit, YamlRange, YamlNode, YamlLintRule, YamlLint, Yaml options) — bun probe: `YamlStringifyOptions.make({ lineWidth: Infinity })` and `YamlParseOptions.make({ maxAliasCount: Infinity })` throw `Schema validation failed` in the lab and succeed upstream (plain literals still pass through, so only the validated constructors changed); (b) native Error -> S.TaggedError in YamlEdit.applyAll — thrown error `name` is `@beep/scratchpad/effected/yaml/YamlEdit/YamlEditFailure` with `_tag` `YamlEditFailure` vs upstream `Error`, message identical; (c) identity-keyed names/`_tag` on every error. The Attribution list also carries a stray codemod line (`scratchpad/effected/yaml/internal/rules/catalog.ts:4 // not a re-export barrel...`).
- failure: Reviewers and the fix wave cannot tell accepted deviations from regressions; section 14's 'ledger entry first' order was not followed and no test pins the new non-finite rejection.
- fix: Add one README deviation entry and one ledger `deviations` row per systemic class (S.Finite, tagged errors, identity names) listing the sites, citing `law:` ids, and add the non-finite rejection test (jsonc precedent) when S3 runs; move or delete the stray catalog.ts line out of Attribution.

### fable-1-10
- file: scratchpad/effected/yaml/YamlToken.ts:109
- class: docs   severity: backlog
- standard: D4 (carried JSDoc/comments must stay true); .patterns/jsdoc-documentation.md (prose must match the code)   evidence: Comment at :109-111 says construction 'uses `new` (the engine's recorded hot-path exception) rather than the validating `make`', but :112 now calls `YamlToken.make(...)` (tsgo newSchemaClass at error). Measured: lab `YamlToken.make` 1.94 ms/3000 vs upstream `new YamlToken` 1.95 ms/3000, so there is no perf regression to report — only a comment that now states the opposite of the code.
- failure: A reader following the comment reintroduces `new` and trips the tsgo gate; the hot-path rationale is lost.
- fix: Reword: 'Hot path: thousands of instances; `make` measured at parity with upstream's `new` under effect 4.0.2, so the validating constructor is used.'

### fable-1-11
- file: scratchpad/effected/yaml/Yaml.ts:816
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (named spans carry the qualified API name; siblings use "Yaml.parse", "Yaml.stringify"); D9 (upstream encode had no span)   evidence: `encode: Effect.fn("encode")(function* (values) {...})` inside `Yaml.allFromString` — the only unqualified span name in the module; the effect-fn law forced an `Effect.fn` wrapper but the name was not chosen.
- failure: Traces show an anonymous `encode` span that cannot be attributed to the YAML codec.
- fix: `Effect.fn("Yaml.allFromString.encode")(...)`, or `Effect.fnUntraced` if the span is not wanted (restores upstream's untraced behaviour).

### fable-1-12
- file: scratchpad/effected/yaml/YamlLint.ts:105
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 18 (filters carry identifier/title/description); law 17 (named schema building blocks)   evidence: `S.Record(S.String, YamlLintRuleSetting).pipe(S.check(S.makeFilter(validateRulesMap)))` is an anonymous filter on an exported, identity-annotated class; its issue message surfaces to users through `YamlLintConfig.make` and `S.decodeResult(YamlLintConfig)` (YamlLint.test.ts:82-90 asserts on the message text). Single-use, so law 18's 'reusable' clause does not make it required.
- failure: Diagnostics and docgen show an unnamed filter on the public config schema.
- fix: `const validRulesMap = S.makeFilter(validateRulesMap, { identifier: "ValidRulesMap", title: "rule-aware rules map", description: "built-in options validated; parse-validity always on" })` and pipe it.

### fable-1-13
- file: scratchpad/effected/yaml/YamlFormat.ts:456
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); .patterns/error-handling.md (error messages describe the invariant)   evidence: `if (oldPair === undefined) throw YamlFormatInvariantFailure.make({ message: "Cannot read properties of undefined (reading 'key')" })` (:456, :480, :512) and YamlEdit.ts:83,85 (`"Missing upper"`/`"Missing lower"`) are unreachable noUncheckedIndexedAccess guards (`pairIndex >= 0` / `idx < items.length` / `i + 1 < sorted.length` hold) whose messages imitate V8's TypeError text instead of naming the invariant.
- failure: Dead branches with misleading messages; a future real failure would read like a JS crash rather than a YAML invariant.
- fix: Either read through a total helper (`A.get`/`O.getOrThrowWith`) or keep the guard with an honest message (`"modifyNode: pair index out of range"`); in YamlEdit.applyAll iterate pairs with `A.zip(sorted, A.drop(sorted, 1))` so no guard is needed.

REQUIRED: 8
BACKLOG: 5
