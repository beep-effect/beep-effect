### fable-1-1
- file: scratchpad/effected/yaml/internal/fold.ts:312
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form; direct helper refs over trivial wrapper lambdas); AGENTS.md Code Laws (tersest equivalent helper form)   evidence: fold.ts:312 and fold.ts:376 read `((value) => value === true)(firstContent?.startsWith(" "))` where upstream (oracle fold.ts:271, 332) read `firstContent?.startsWith(" ")`. The rewrite exists only to satisfy the tsgo `strict-boolean-expressions` rule (effect-tsgo docs/rules/strict-boolean-expressions.md: any boolean-typed expression passes), and the lane already used the terse form for the identical shape at cst-parser.ts:1075 (`(hasDocStart === true)`). The IIFE allocates and invokes a lambda per render call for a comparison.
- failure: An inline IIFE wrapping a `=== true` comparison is the opposite of the law-21 form (a trivial wrapper lambda invoked in place); it is unreadable, allocates per call in the block-scalar render path, and no gate catches it because the expression is boolean-typed.
- fix: Replace both sites with `firstContent?.startsWith(" ") === true` (same type, same truth table, satisfies strict-boolean-expressions).

### fable-1-2
- file: scratchpad/effected/yaml/internal/fold.ts:270
- class: law   severity: required
- standard: scratchpad/EFFECTED_PORT_GOAL.md Grilling 2026-10-09 ruling (lab changes no law, diagnostic or ruling forced: restore the upstream shape); standards/effect-laws-v1.md Dual-Arity Inventory Contract (scalar third parameters are not valid for dual; prefer options objects); D9   evidence: Eight plain upstream `export function` declarations were wrapped in `dual`: fold.ts:41 (foldScalarLine, dual 4), :98 (foldRenderedScalar, dual 3), :209 (renderSingleQuotedMultiline, dual 2), :270 (renderBlockLiteral, dual 6), :336 (renderBlockFolded, dual 4); diff.ts:32 (computeEdits); equal.ts:23 (deepEqual); requote.ts:79 (requoteScalarText). Nothing forced it: the lint gate is oxlint plus effect-fn, terse-effect, native-runtime and a mirrored effect-imports (scratchpad/effected/runner/Gates.ts:562-585), and terse-effect's only dual detector, `isExplicitDualOverloadCandidate` (packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:546-573), fires solely on exported functions that already carry hand-written data-first/data-last overloads; upstream had none. `dual` dispatches on `arguments.length >= arity` (node_modules/effect/dist/Function.js:94-104), so for renderBlockLiteral the upstream optional parameters (`explicitChomp?`, `parentPosition?`, `preserveKeep = false`, `explicitIndent?`) are dead: any call with fewer than six arguments now returns a closure, the default at fold.ts:275 can never apply, and the JSDoc `@param explicitChomp ... when known` (fold.ts:245) now contradicts the required positional in the data-first overload. Same for renderBlockFolded's two optional parameters. Every current caller (stringifier.ts:424,426,434,469,470,630; YamlFormat.ts:211,839,1019; rules/quoted-strings.ts:42) passes full arity, so no test fails today; the README Port notes record `Deviations: None` for this shape change.
- failure: Unforced API-shape divergence from the oracle that the ruling says to restore, carrying a latent trap: a future caller relying on renderBlockLiteral's or renderBlockFolded's documented optional parameters receives a function instead of a string, and the law's own contract says scalar trailing parameters should become an options object rather than a `dual`.
- fix: Restore the eight upstream `export function` declarations verbatim (drop the overload type literals and `dual` wrappers, keep the lawful `P.isString`/`P.isNumber`/`A.isArray`/`R.keys`/`R.has` substitutions inside). If a dual form is wanted later for promotion, do it per the contract with an options object (`renderBlockLiteral(s, { indent, explicitChomp, parentPosition, preserveKeep, explicitIndent })`, `dual(2)`), recorded as an added export.

### fable-1-3
- file: scratchpad/effected/yaml/internal/cst-parser.ts:150
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer match helpers over conditional chains); standards/effect-laws-v1.md law 11 (no native switch; use Match) and law 23 (prefer real seams: match helpers, schema/data-table dispatch)   evidence: cst-parser.ts:150-195 replaces upstream's 15-arm `switch (token.kind)` (oracle cst-parser.ts:138-190) with a 15-arm `if / else if` ladder on the single discriminant `token.kind`, every arm of which is `return makeLeafNode(<type>, token, state.text)`. The native-runtime law bans the switch (NoNativeRuntime.ts:497, message at :546-549 says to use effect/Match), but the chosen replacement is the conditional chain AGENTS.md tells us to avoid; the law's `--check` passes because it only detects `SwitchStatement` nodes.
- failure: A pure kind-to-node-type mapping is expressed as a 46-line else-if ladder in the parser hot path; the gate cannot see it, and the next reader has to re-derive the table by hand.
- fix: Make the mapping data: `const LEAF_NODE_TYPE: Record<YamlTokenKind, CstNodeType> = { whitespace: "whitespace", newline: "newline", comment: "comment", scalar: "flow-scalar", anchor: "anchor", alias: "alias", tag: "tag", directive: "directive", "flow-separator": "whitespace", ... , error: "error" }` (keep the upstream comments beside the entries) and `return makeLeafNode(LEAF_NODE_TYPE[token.kind], token, state.text)`; `Match.value(token.kind).pipe(Match.when(...), Match.orElse(...))` is the acceptable alternative if a table is rejected. Behaviour is pinned by the CST and token-fidelity suites.

### fable-1-4
- file: scratchpad/effected/yaml/internal/lexer.ts:448
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer match helpers over conditional chains); standards/effect-laws-v1.md law 11 and law 23 (data-table dispatch seam)   evidence: lexer.ts:447-548 replaces upstream's `switch (esc)` escape dispatch (oracle lexer.ts:446-575) with a 22-arm `if / else if` ladder. Seventeen arms are the same shape, `value += <char>; advance();`, keyed by one escape character (`\\`, `"`, `/`, `b`, `f`, `n`, `r`, `\t`/`t`, `0`, `a`, `e`, `v`, space, `N`, `_`, `L`, `P`); only `x`, `u`, `U`, `\n`, `\r` and the error fallback carry logic. `peek()` returns `""` at end of input (lexer.ts:85-88), so a table miss reaches the same error branch upstream's `default` reached.
- failure: The double-quoted-scalar escape table, the densest decision in the lexer, is now a 100-line conditional chain that neither the native-runtime law nor oxlint can see, in the per-character hot path.
- fix: Hoist the seventeen simple escapes into a module-level table (`const SIMPLE_ESCAPES = HashMap.make(["\\", "\\"], ['"', '"'], ..., ["P", " "])` or a `Record<string, string>` read with `R.get`), then `const simple = HashMap.get(SIMPLE_ESCAPES, esc); if (O.isSome(simple)) { value += simple.value; advance(); } else if (esc === "x") { ... } else if (esc === "u") { ... } else if (esc === "U") { ... } else if (esc === "\n") { ... } else if (esc === "\r") { ... } else { return makeToken("error", ...) }`. The yaml-test-suite and lexer.test.ts pin every escape.

### fable-1-5
- file: scratchpad/effected/yaml/internal/equal.ts:29
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 5 (no runtime `typeof ... === ...`; use effect/Predicate guards)   evidence: equal.ts:29 keeps upstream's `if (typeof a !== typeof b) return false;`. The native-runtime detector only matches a `typeof` compared against a string literal (NoNativeRuntime.ts:352-377, `getRuntimeTypeLiteral`), so this typeof-versus-typeof comparison passes `--check`; the same file's other typeof checks were converted (`P.isNumber`, `A.isArray`, `P.isObject`). The line is redundant: after the `a === b`, NaN and null guards, every mismatched-type pair already returns false through the array guards (lines 32-40), the `P.isObject(a) && P.isObject(b)` guard (line 42; 4.0.2's isObject excludes null, arrays and functions, node_modules/effect/dist/Predicate.js:719-721) or the final `return false`. Note the module has no importer in source or tests (`rg internal/equal` finds none; Yaml.ts carries its own deepEqualValues), so the law break is in dead code, which does not exempt it.
- failure: A runtime `typeof` comparison survives in module source in violation of law 5 because the detector's literal-only pattern missed it; the gate reports green while the law is broken.
- fix: Delete line 29 (behaviour is unchanged by the trace above); optionally drop the unused module in the same wave and record it under Port notes.

### fable-1-6
- file: scratchpad/effected/yaml/YamlVisitor.ts:188
- class: perf   severity: backlog
- standard: D11 (perf requires measurement or algorithmic-class argument; none here); standards/effect-laws-v1.md law 11 (Match.tagsExhaustive for _tag unions)   evidence: walkNode calls `S.is(YamlScalar)(node)`, `S.is(YamlAlias)(node)`, `S.is(YamlMap)(node)`, `S.is(YamlSeq)(node)` inline (lines 188, 203, 211, 229) and walkPair repeats `S.is(YamlScalar)` twice (251, 252). `Schema.is` is `_is(schema.ast)`, which builds a fresh lazy guard per call and compiles the parser on its first use (node_modules/effect/dist/SchemaParser.js:138-150, 172-181); nothing is cached across calls, so each visited node pays up to four guard constructions plus an Exit-wrapped parse where upstream paid an `instanceof`. The per-node cost is constant, so this is not an algorithmic-class regression. The nodes are `S.TaggedClass` values (YamlNode.ts:138, 200, 321, 366) carrying `_tag`.
- failure: Constant-factor overhead on every visited node in the public streaming visitor; no observable divergence.
- fix: Hoist module-level guards once (`const isYamlScalar = S.is(YamlScalar)` etc.) and use them, or dispatch on `node._tag` via `Match.valueTags` / `Match.tagsExhaustive` with generator-returning handlers delegated through `yield*`.

### fable-1-7
- file: scratchpad/effected/yaml/YamlVisitor.ts:200
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: Lines 200-201, 222-223 and 240-241 each spread two separate `O.getSomesStruct({ tag: ... })` and `O.getSomesStruct({ anchor: ... })` calls where one struct does the same work; `getSomesStruct` is `R.getSomes` over the whole struct (packages/foundation/modeling/utils/src/Option.ts:112).
- failure: Six redundant helper calls and two spreads per event where one of each suffices; no behavioural difference.
- fix: `...O.getSomesStruct({ tag: O.fromUndefinedOr(node.tag), anchor: O.fromUndefinedOr(node.anchor) })` at each of the three sites.

### fable-1-8
- file: scratchpad/effected/yaml/YamlVisitor.ts:92
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled **Example** sections, never @example); AGENTS.md Code Laws; brief: S2 not run, report as backlog   evidence: The YamlVisitor class doc keeps upstream's `@example` tag (line 92) with a rewritten import block; S2 carrier conversion has not run by operator order.
- failure: Will fail the S2 docgen/JSDoc gate when it runs.
- fix: Convert to `**Example** (Collect scalar events)` with the fenced block during S2; keep the body.

### fable-1-9
- file: scratchpad/effected/yaml/internal/cst-parser.ts:216
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest form); D9 (verbatim where no law forces change)   evidence: Codemod residue of doubled parentheses around guards: 22 sites in cst-parser.ts (`if ((open !== undefined))`, `if ((leaf !== undefined))`, `if ((t !== undefined) && ...)` at 1046, `if ((hasDocStart === true) || (hasContent === true) || ...)` at 1075), plus lexer.ts:1130 and :1134 (`if ((marker !== null))`). oxlint's enabled rule set (.oxlintrc.json: only beep/* rules) has no extra-parens rule, so the gate is blind to it.
- failure: Noise that reads as unfinished machine output and will churn every later diff; no behavioural difference.
- fix: Strip the redundant parentheses (`if (leaf !== undefined)`, `if (marker !== null)`, `if (hasDocStart === true || hasContent === true || documents.length === 0)`).

### fable-1-10
- file: scratchpad/effected/yaml/internal/fold.ts:70
- class: effect-idiom   severity: backlog
- standard: .patterns/error-handling.md (S.TaggedError pattern with $I.annote); standards/effect-laws-v1.md law 21; crispen (helper-wall deletion)   evidence: Six `throw *Failure.make(...)` guards exist only to discharge `noUncheckedIndexedAccess` on indices that are provably in range: fold.ts:70 (`folds[f]` inside `for f < folds.length`), :106 (`split` always yields one element), :110 and :422 (`lines[i]` / `valueLines[i]` inside bounded loops), cst-parser.ts:91 and :93 (`children[0]`, `children[length-1]` after a `length === 0` early return). The visitor already shows the guard-free form (`for (const [i, item] of node.items.entries())`, YamlVisitor.ts:243). The two defect classes (`FoldFailure` fold.ts:14, `CstParserFailure` cst-parser.ts:17) also omit the `$I.annote(...)` the error-handling pattern shows; siblings use the same shape (github-actions, markdown), so this is consistent with the lab but not with the pattern doc.
- failure: Unreachable defect branches that coverage (S3) cannot reach without a cast, plus two unannotated error schemas; no runtime divergence.
- fix: Iterate with `.entries()` (`for (const [f, fold] of folds.entries())`, `for (const [i, line] of valueLines.entries())`), take `A.head`/`A.last` as Options in makeContainerNode, and delete the guards and the now-unused Failure classes; if a defect class survives, annotate it with `$I.annote`.

### fable-1-11
- file: scratchpad/effected/yaml/internal/diagnostics.ts:128
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 17 (named domain constraints modeled as schemas first; derive guards with S.is) and law 19 (S.Literals for inline unions)   evidence: `FATAL_CODES` is a `HashSet<YamlErrorCode>` built from a literal list and `isFatalCode` is `HashSet.has(FATAL_CODES, code)` (lines 128-146); the error-code families above it are `as const` arrays with derived types (lines 13-104), not schemas. The HashSet satisfies law 6 but leaves the fatality domain outside the schema layer the file's own comment calls 'a property of the code, declared once'.
- failure: Fatality is not a schema, so it cannot be annotated, arbitrary-generated (D10) or reused by the public YamlDiagnostic schema; no behavioural divergence.
- fix: `export const FatalCode = S.Literals(["UndefinedAlias", "DuplicateAnchor", ...])` (or a LiteralKit if named members are wanted) and `export const isFatalCode = S.is(FatalCode)`; keep `FATAL_CODES` only if a set view is still needed.

### fable-1-12
- file: scratchpad/effected/yaml/internal/lexer.ts:117
- class: bug   severity: backlog
- standard: D9 (behaviour-preserving); effect/MutableHashMap documents no iteration-while-removing guarantee   evidence: Lines 117-121 remove entries from `blockStarted` while iterating `MutableHashMap.keys(blockStarted)` (upstream did the same on a native Map, whose iterator tolerates deletes). It is safe today only because 4.0.2's MutableHashMap stores simple keys in a native `Map` and `keys()` returns that Map's iterator (node_modules/effect/dist/MutableHashMap.js:238, 545-549); nothing in the MutableHashMap docs promises this, and the trie-backed HashMap path would not.
- failure: Latent: a future effect release that changes the backing store could skip or double-visit keys during dedent, dropping block-start tokens; no divergence on 4.0.2 (lexer and yaml-test-suite suites pass).
- fix: Snapshot before mutating: `for (const key of A.fromIterable(MutableHashMap.keys(blockStarted))) { if (key > lineIndent) MutableHashMap.remove(blockStarted, key) }` (or `A.filter` then `A.forEach`).

### fable-1-13
- file: scratchpad/effected/yaml/README.md:244
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (README adaptation) and D2 (Port notes record attribution, added exports, deviations)   evidence: Under `### Attribution` the fourth bullet is a pasted code comment, `scratchpad/effected/yaml/internal/rules/catalog.ts:4 // not a re-export barrel; rules are imported from their own modules.`, not an attribution fact; and `### Deviations` says `None` although the dual-arity rewrites (fable-1-2) and the FATAL_CODES/HashSet change are observable shape changes the ledger row (`deviations: []`) also omits.
- failure: Port notes misstate the module's state for the next reviewer and for the ledger verifier.
- fix: Delete the stray bullet (or move the catalog.ts remark to a `Notes` subsection) and, after the fix wave, record any surviving deviation per section 14 in both README and ledger.

REQUIRED: 5
BACKLOG: 8
