### fable-1-1
- file: scratchpad/effected/toml/internal/stringifyValue.ts:144
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); effect-tsgo docs/rules/instance-of-schema.md (the rule that forced the substitution); AGENTS.md Code Laws 'prefer match helpers'   evidence: bun -e benchmark, lab vs oracle-identical upstream (diff -rq of the live checkout's packages/toml/src against the pinned oracle: IDENTICAL), 275,380-byte doc (400 tables x 25 keys + 400 array-tables), median of 7: Toml.parseResult lab 115.3 ms vs upstream 64.6 ms (1.79x); Toml.stringifyResult 13.8 vs 6.2 ms (2.24x); TomlFormat.formatToString 65.5 vs 46.4 ms (1.41x). Micro: S.is(TomlArray)(node) inline 157 ns vs instanceof 5.5 ns (29x); the four non-matching guards of isTomlDateTime 642 ns vs 9 ns (68x); a hoisted guard 69 ns (13x). Cause in node_modules/effect/dist/SchemaParser.js:138-180: every S.is(schema) call builds a fresh _is closure, calls SchemaAST.toType, runWithCompiler and Effect.runSyncExit, allocating an Exit (and a SchemaIssue on a miss); the class Declaration parser itself is just isClassValue (Schema.js:9228). Sites on hot paths: stringifyValue.ts:144-147 (run for every array/inline-table value because renderScalar probes date-times before renderInline tests containers), parser.ts:278-281 (per date-time token), semantic.ts:213,216,227,231,268,271,278,332,335 (2-3 per node), TomlFormat.ts:148,154,160,317,332,334,436,438,583,644,821, TomlVisitor.ts:91,146. Secondary contributors measured: MutableHashMap string-key set+get 9.0 vs Map 4.0 ms per 100k (2.3x), TomlKey.make 26.1 vs upstream new 18.8 ms per 100k (S.Finite check + SchemaParser.make path), classifyValueToken(datetime) 1.3x, dual-wrapped scanWhitespace 3.4 vs 1.9 ms per 1M (negligible absolute).
- failure: Every public entry point (parse, stringify, format, modify, visit) is 1.4x-2.2x slower than upstream on ordinary documents; the cost scales with node count, so large Cargo.lock/pyproject-style inputs regress proportionally.
- fix: Dispatch tagged nodes on their _tag instead of a per-call S.is: P.isTagged(node, "TomlArray") (narrows the TomlValueNode/TomlExpression unions, no allocation) or Match.tagsExhaustive in materialize/collectMultilineSpans/checkArrayItem/analyze/buildSemanticIndex; for the four S.Class date-time types hoist one module-level guard, const isTomlDateTime = S.is(S.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime])) (one call, compiled once; export the union from TomlDateTime.ts under exportsAdded if parser.ts and stringifyValue.ts share it), and in renderInline test A.isArray/isPlainObject before the date-time probe so containers never pay for it. Re-run the same benchmark; target parity within 1.1x of upstream.

### fable-1-2
- file: scratchpad/effected/toml/internal/parser.ts:47
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (A/O/P/R/S aliases only: import * as S from "effect/Schema")   evidence: parser.ts:47 reads `import * as Schema from "effect/Schema"` and parser.ts:278-281 call `Schema.is(...)`; every other module in the port uses `S`. The alias law is not covered by the four gated laws (the file passed the gate), so the gate missed it.
- failure: Law-1 alias violation; the module is inconsistent with the other 14 files and with repo-wide grep/codemod conventions keyed on `S.`.
- fix: Rename the import to `import * as S from "effect/Schema"` and the four call sites to `S.is(...)` (or to the hoisted guard from fable-1-1); move the import next to the other effect/* imports at the top of the file.

### fable-1-3
- file: scratchpad/effected/toml/internal/semantic.ts:102
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 11 (no native switch; use Match / Match.tagsExhaustive for tag unions); AGENTS.md Code Laws 'Prefer match helpers over conditional chains'; D9   evidence: Upstream navigateHeaderPrefix dispatched on the closed Provenance union with a 7-case switch; the lab replaced it with a six-branch if/else-if chain over existing.kind (semantic.ts:102-116) with no terminal else. The law prescribes Match for exactly this shape; the gate only bans the switch keyword, so it missed the prescribed replacement. The chain also drops exhaustiveness: a new Provenance member falls through every branch and the loop silently continues with `current` unchanged, whereas Match.exhaustive would be a compile error.
- failure: Law-11 prescribed form not used; exhaustiveness over a closed union silently lost (type-safety regression versus upstream).
- fix: Replace the chain with Match.value(existing.kind).pipe(Match.when("table-explicit", () => existing), Match.when("table-implicit", () => existing), Match.when("table-dotted", () => existing), Match.when("array-tables", () => lastElement(existing)), Match.when("inline", () => raise("InlineTableExtended", ...)), Match.when("static-array", () => raise("ArrayOfTablesConflict", ...)), Match.when("value", () => raise("TableRedefined", ...)), Match.exhaustive) assigned to current (or Match.withReturnType<SemNode>()); import * as Match from "effect/Match". Behaviour and error codes unchanged (upstream semantic.test.ts stays verbatim).

### fable-1-4
- file: scratchpad/effected/toml/internal/stringifyValue.ts:159
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 11; AGENTS.md Code Laws 'Prefer match helpers over conditional chains'   evidence: Upstream renderScalar was a switch on typeof; the lab turned it into a five-branch if-chain of P.isString/P.isBoolean/P.isNumber/P.isBigInt/isTomlDateTime (stringifyValue.ts:159-178). Same gate gap as fable-1-3: the switch keyword is gone but the law's prescribed Match form was not adopted.
- failure: Law-11 prescribed form not used on a public-path dispatcher; the predicate chain is the pattern the law and crispen rubric name as a helper wall.
- fix: Match.value(value).pipe(Match.when(P.isString, renderString), Match.when(P.isBoolean, (b) => (b ? "true" : "false")), Match.when(P.isNumber, renderNumber), Match.when(P.isBigInt, (b) => renderBigInt(b, path)), Match.when(isTomlDateTime, (d) => d.toString()), Match.orElse(() => undefined)); keep the IntegerOutOfRange raise inside renderBigInt. The scanner.ts:165-183 simpleEscape chain is tracked separately as backlog (fable-1-18) because a data table is the terser fix there.

### fable-1-5
- file: scratchpad/effected/toml/internal/stringifyValue.ts:181
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Set) and Allowlist Contract ('stale entries removed in the same change'); AGENTS.md 'never use native Set/Map'; operator grilling 2026-10-09 in scratchpad/EFFECTED_PORT_GOAL.md ('cycle detection uses an ancestor stack scanned with ===', 'the allowlist carries no scratchpad/effected entry at the end'); this run's user request green-lights removing all 79 entries   evidence: stringifyValue.ts:181 `checkCircular(value: object, ancestors: Set<object>, ...)`, :188 and :270 thread a `Set<object>`, :225 and :330 create `new Set()`; the only toml allowlist row is standards/effect-laws.allowlist.jsonc:453-460 (issue EFFECTED-TOML-CYCLE-DETECTION, kind new-map-set). The operator's later ruling supersedes the recorded exception and names the replacement. A.contains must not be used: it is Equal-structural (node_modules/effect/dist/Array.js:2208 containsWith(Equal.asEquivalence())) and would merge structurally equal siblings into a false CircularReference; the ruling says ===.
- failure: Native Set in domain logic, kept alive only by an allowlist row the operator ordered removed; the module cannot reach the ruled end state (no scratchpad/effected allowlist entries) without this change.
- fix: Type ancestors as ReadonlyArray<object>; checkCircular = A.some(ancestors, (a) => a === value) ? raise("CircularReference", ...) : undefined; in renderInline and emitTable pass [...ancestors, value] into the recursive calls instead of add/delete (depth is already capped at MAX_NESTING_DEPTH, so the scan is bounded); renderInlineValue and stringifyValue pass []. Delete the allowlist row in the same change. hostile.test.ts:142-164 and Toml.test.ts:227 (3-hop cycles) stay verbatim and must still report CircularReference.

### fable-1-6
- file: scratchpad/effected/toml/TomlNode.ts:42
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; S.Literals only for anonymous inline unions never referenced by name); D5 ('LiteralKit for literal domains ... kit substitutions land during S4'); AGENTS.md 'named LiteralKit internal domains'   evidence: Named, exported literal domains still built with S.Literals: TomlNode.ts:42 TomlKeyKind, :72 TomlStringStyle, TomlDiagnostic.ts:25 TomlLexErrorCode, :39 TomlParseErrorCode, :53 TomlSemanticErrorCode, :67 TomlStringifyErrorCode (all consumed by name: TomlKey.kind, TomlString.style, the TomlErrorCode union, TomlDiagnostic.code and the exported `typeof X.Type` aliases), plus the internal named NonFiniteSpelling at TomlNode.ts:18 (referenced three times). Precedent in the two modules that already reached the bar: scratchpad/effected/jsonc/internal/scanner.ts:44 `SyntaxKind = LiteralKit([...])`, scratchpad/effected/jsonl/JsonlError.ts:513 `JournalResyncReason = LiteralKit([...]).pipe(...)`.
- failure: Law-19/D5 end-state bar not met: consumers get no `.Enum`, `.is`, `$match` or `toTaggedUnion` surface and the diagnostic-code families cannot be matched exhaustively by kit; the S4 review cannot close while D5 kit substitutions are outstanding.
- fix: import { LiteralKit } from "@beep/schema/LiteralKit" and build each domain as LiteralKit([...]).pipe($I.annoteSchema(name, { description })) (the TOML_*_ERROR_CODES const tuples pass straight in; do not add `as const` to inline arrays). Keep every export name and `typeof X.Type` alias so the D2 superset rule holds; TomlErrorCode stays S.Union over the four kits. Fold NonFiniteSpelling into the same change and give the IeeeNumber declaration an identifier/title/description annotation (law 18 spirit) while touching it.

### fable-1-7
- file: scratchpad/effected/toml/README.md:158
- class: docs   severity: backlog
- standard: D9 and section 14 (deviation protocol: ledger entry first, then README Port notes -> Deviations, citing the adjusted test); operator ruling 2026-10-09 ('one ledger plus README deviation entry per module per systemic class ... generated by codemod')   evidence: README.md:158-160 says `### Deviations` / `None.` and PORT_LEDGER.json row w1-toml has `deviations: []`, yet the port carries law-forced observable deviations: S.Finite on every offset/length/line/character field (TomlDiagnostic.ts:109-112, TomlEdit.ts:47-48,64-65, every TomlNode class) so make/decode now reject NaN and +-Infinity where upstream Schema.Number accepted them; TomlFloat.value is the declared IeeeNumber (TomlNode.ts:29) with its own JSON/StringTree/Arbitrary links; RawTomlError and GuardExceeded became Data.TaggedError carriers with `name` pinned to "Error" (diagnostics.ts:70-76, limits.ts:25-36); assertCap throws TomlCapError instead of TypeError (limits.ts:49); every class and schema identifier now carries the $ScratchpadId prefix (visible in SchemaIssue messages and formatter output); the exported scanner/semantic/stringify functions gained dual data-last call shapes. None cites an adjusted upstream test.
- failure: The port notes assert parity the code no longer has; a reader or a promotion review cannot tell law-forced deviations from accidental ones, and the codemod the operator asked for has no toml rows to emit from.
- fix: Add one ledger `deviations` entry and one README bullet per systemic class (identity keys, S.Finite, declared IeeeNumber, tagged carriers, TomlCapError, dual overloads), each with cause `law:<rule>` or `tsgo:<diagnostic>`, the site list, and `test: none adjusted` where that is true; regenerate with the codemod once it exists.

### fable-1-8
- file: scratchpad/effected/DIAGNOSTIC_EXCEPTIONS.md:32
- class: docs   severity: backlog
- standard: PORT_LEDGER.json header note 2026-10-09 ('Every switched-off rule is listed in DIAGNOSTIC_EXCEPTIONS.md'); standards/effect-laws-v1.md Allowlist Contract (stale entries removed with the change)   evidence: Row 32 records `effected/toml/TomlNode.ts` line 90, next line, schemaNumber. rg "effect-diagnostics" over scratchpad/effected/toml finds no comment; TomlNode.ts:90 is TomlString.offset and TomlFloat.value now uses IeeeNumber (TomlNode.ts:29,112), so the rule is no longer switched off there. The test-side row 61 (oracle.property.test.ts:265) is still live.
- failure: The exceptions register claims a suppression that does not exist; an audit of switched-off rules over-counts toml.
- fix: Delete row 32 (or repoint it at the IeeeNumber declaration with the reason 'declared number carrying inf/nan; no schemaNumber suppression needed').

### fable-1-9
- file: scratchpad/effected/toml/TomlDiagnostic.ts:116
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (carrier conversion); section 10.2 of scratchpad/EFFECTED_PORT_GOAL.md (mechanical first, editorial second)   evidence: The $I.annote descriptions at TomlDiagnostic.ts:116 and TomlDocument.ts:88 contain the literal strings `(TomlErrorCode:type)` and `(TomlExpression:type)`: the TSDoc declaration-reference syntax from upstream `{@link (TomlExpression:type)}` (TomlDocument.ts:54, TomlDiagnostic.ts:97) copied into a plain-string annotation. No other annotation in packages/**/src uses that form (rg found none).
- failure: Schema descriptions surface a TSDoc artifact verbatim in SchemaIssue/formatter output and docs.
- fix: Write the plain name in the annotation strings ('its TomlErrorCode', 'the linear TomlExpression CST'); keep the `{@link (X:type)}` form only in the JSDoc blocks.

### fable-1-10
- file: scratchpad/effected/toml/Toml.ts:182
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled **Example** sections and **Details**/**Gotchas** prose; never @example/@remarks); AGENTS.md Code Laws JSDoc rule; packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts   evidence: rg counts of @example/@public/@param/@returns carriers still present: Toml.ts 23, TomlFormat.ts 23, TomlNode.ts 21, TomlDiagnostic.ts 14, TomlEdit.ts 7, TomlVisitor.ts 4, TomlDocument.ts 4, TomlDateTime.ts 4. The examples already import from "./index.ts" and effect/<Module>, so only the carrier conversion and @category/@since lines remain. S2 has not run by operator order.
- failure: Docgen to the beep JSDoc law would fail on every public module; reported as backlog only per the brief.
- fix: Run the S2 carrier conversion (@example -> **Example** (Title) fences, @param/@returns prose into **Details**, add @category/@since from JSDocCategories.ts, drop @public) and the docgen example typecheck.

### fable-1-11
- file: scratchpad/effected/toml/TomlDocument.ts:106
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form); .patterns/error-handling.md (Effect.try + Effect-native handling); crispen rubric   evidence: TomlDocument.ts:106-117 allocates a mutable `diagnostics: Array<TomlDiagnostic>`, runs Effect.try, then `.pipe(Effect.catch((d) => Effect.sync(() => { diagnostics.push(d); })))` purely to collect one optional failure. Effect.match exists in the installed build (node_modules/effect/dist/Effect.js:3885).
- failure: Mutation-through-closure where a single combinator expresses the intent; harder to read than the upstream try/catch it replaced.
- fix: const diagnostics = yield* Effect.try({ try: () => analyze(expressions), catch: ... }).pipe(Effect.match({ onFailure: (diagnostic) => [diagnostic], onSuccess: () => [] })); then TomlDocument.make({ source: text, expressions, diagnostics }).

### fable-1-12
- file: scratchpad/effected/toml/internal/diagnostics.ts:70
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 7 ('extend S.TaggedError from effect/Schema directly for typed errors'); .patterns/error-handling.md S.TaggedError pattern; D5   evidence: Three throw carriers use Data.TaggedError with positional constructors (diagnostics.ts:70-76 RawTomlError, limits.ts:25-36 GuardExceeded, TomlFormat.ts:532-543 ModifyFailure) while the six invariant errors and the public errors use S.TaggedError with $I identity. RawTomlError and GuardExceeded additionally pin `this.name = "Error"` so `_tag` and `name` disagree; no test asserts `name` (hostile.test.ts:256 only checks String(error) contains the code, which the message carries).
- failure: Two error idioms in one module; carriers lack schema identity and cannot be matched by S.is like every other error in the port.
- fix: Convert the three carriers to S.TaggedError<...>($I`RawTomlError`)("RawTomlError", { diagnostic: RawDiagnosticSchema, message: S.String }) with a `static of(diagnostic)` factory replacing the positional constructor; keep isRawTomlError/isGuardExceeded as S.is-derived guards; drop the `name = "Error"` pins.

### fable-1-13
- file: scratchpad/effected/toml/TomlFormat.ts:48
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Discovery & Reuse and 'prefer the tersest equivalent helper form'; standards/effect-laws-v1.md law 21; crispen rubric (helper walls)   evidence: Six near-identical private invariant classes (TomlEdit.ts:18, TomlFormat.ts:48, TomlVisitor.ts:39, semantic.ts:33, stringifyValue.ts:26, limits.ts:10) and about 25 `if (x === undefined) { throw X.make({ message: "missing TOML element" }); }` blocks added for noUncheckedIndexedAccess (e.g. TomlFormat.ts:315,338,360,415,455,472,485,623,680,690,699,715,721,733,751,760,839,964,972; semantic.ts:93,107,126,149,183,203,340,369,381; stringifyValue.ts:306). rg over packages/**/src found no shared invariant/unreachable helper, so a module-local one is the right home.
- failure: Repeated boilerplate obscures the engine logic and spreads six identically-shaped error types across the module.
- fix: Add internal/invariant.ts exporting one TomlInvariantError (S.TaggedError) and `expectDefined = <T>(value: T | undefined, what: string): T`; replace each block with `const key = expectDefined(keyPath[i], "TOML key")`, and use A.last(...).pipe(O.getOrThrowWith(...)) for the `arr[arr.length - 1]` sites.

### fable-1-14
- file: scratchpad/effected/toml/TomlFormat.ts:505
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest form, shared thunks already in scope); D11 perf evidence rule   evidence: Ten lookups spell `O.getOrUndefined(MutableHashMap.get(map, key))` (TomlFormat.ts x6, semantic.ts x4) while TomlFormat.ts:505 alone writes `current.entries.pipe(MutableHashMap.get(name), O.getOrUndefined, intoTable)`. Measured: MutableHashMap string-key set+get 9.0 ms vs Map 4.0 ms per 100k (2.3x, Hash.hash on every string key, MutableHashMap.js:202,356,426), a minor share of the fable-1-1 regression and acceptable under law 6.
- failure: Inconsistent spelling of the same lookup; the hashing overhead is paid ten times per key path with no shared helper.
- fix: One local `const lookup = <V>(map: MutableHashMap.MutableHashMap<string, V>, key: string) => O.getOrUndefined(MutableHashMap.get(map, key))` per file (or `flow(MutableHashMap.get, O.getOrUndefined)`), used at all ten sites.

### fable-1-15
- file: scratchpad/effected/toml/internal/scanner.ts:94
- class: tsgo   severity: backlog
- standard: effect-tsgo missingPipeableSignature (PORT_LEDGER.json note 2026-10-07: 'exported fixed-arity functions with 2+ params need a dual data-last overload'); operator ruling 2026-10-09 (restore the upstream shape where no law forces a change; diagnostic exceptions are recorded in DIAGNOSTIC_EXCEPTIONS.md)   evidence: Every exported engine function now carries a dual data-last overload that no caller uses and whose shape is meaningless for the signature: scanner.ts:94,107,130,150,224,269,329,408,498,604 (`scanWhitespace(pos)(source)`), limits.ts:44 (`assertCap(value)(name)`), semantic.ts:257 (predicate dual on A.isArray(args[0])), stringifyValue.ts:319. Measured wrapper cost 3.4 vs 1.9 ms per 1M scanWhitespace calls (1.8x, negligible in absolute terms). The rule exists for public pipeable APIs; these are internal/** modules consumed only inside the package.
- failure: Internal engine signatures diverge from upstream for a rule aimed at public surfaces, with curried overloads that invite misuse.
- fix: Record a per-file `// @effect-diagnostics missingPipeableSignature:skip-file` for scratchpad/effected/toml/internal/{scanner,semantic,stringifyValue,limits}.ts in DIAGNOSTIC_EXCEPTIONS.md with the reason 'internal engine seams, not pipeable API' and restore the upstream signatures; if the operator prefers to keep the duals, record them under the dual-overload deviation class from fable-1-7 instead.

### fable-1-16
- file: scratchpad/test/toml/Toml.test.ts:376
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5 (assertFailure/assertExitFailure helpers inside it.effect); standards/effect-laws-v1.md law 21   evidence: Eleven sites replace upstream `Effect.flip(x)` with `Effect.result(x).pipe(Effect.map((result) => result.pipe(Result.flip, Result.getOrThrow)))` (Toml.test.ts x7, hostile.test.ts x2, TomlDocument.test.ts x1, e2e/toml-test.e2e.test.ts x1) while Effect.flip is still used at TomlVisitor.test.ts and Toml.test.ts:430 and TomlDocument.test.ts:318. The chain throws a defect instead of failing the assertion when the effect unexpectedly succeeds. No assertion was weakened.
- failure: Non-canonical, inconsistent failure extraction in the upstream suites; S3 canon migration will have to redo these sites.
- fix: Use `yield* Effect.flip(x)` consistently now, and in S3 the canon form `const exit = yield* Effect.exit(x); assertExitFailure(exit, ...)` or `assertFailure(yield* Effect.result(x), ...)`.

### fable-1-17
- file: scratchpad/test/toml/e2e/taggedJson.ts:136
- class: test   severity: backlog
- standard: standards/effect-laws-v1.md law 21; effect-tsgo missingPipeableSignature   evidence: taggedJson.ts:136-144 declares two function overloads plus a body that branches on `args.length` only to forward to `assertMatchesTaggedDual` (line 146), which is already the dual(3, ...) value with the same two signatures.
- failure: A redundant dispatch layer around a dual; two places to keep the signature in sync.
- fix: `export const assertMatchesTagged = dual(3, function assertMatchesTagged(actual, expected, path) { ... })` and delete the overload wrapper.

### fable-1-18
- file: scratchpad/effected/toml/internal/scanner.ts:165
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 11 and law 23 ('schema/data-table dispatch'); AGENTS.md 'prefer match helpers over conditional chains'   evidence: simpleEscape (scanner.ts:165-183) replaced the upstream 8-case switch with an eight-branch `if (code === 0x62) ... else if` chain returning string | undefined; it is a pure code-point -> character table.
- failure: Conditional chain where a lookup table is the tersest form; same law-11 gap as fable-1-3/1-4 but on a cold path (only reached after a backslash).
- fix: `const SIMPLE_ESCAPES = HashMap.make([0x62, "\b"], [0x74, "\t"], [0x6e, "\n"], [0x66, "\f"], [0x72, "\r"], [0x65, "\u001b"], [QUOTE, '"'], [BACKSLASH, "\\"])` and `simpleEscape = (code) => O.getOrUndefined(HashMap.get(SIMPLE_ESCAPES, code))` (effect/HashMap).

### fable-1-19
- file: scratchpad/effected/toml/internal/semantic.ts:1
- class: effect-idiom   severity: backlog
- standard: .patterns/module-organization.md; standards/effect-laws-v1.md law 1/2 import conventions   evidence: Imports were inserted above the file header comments and split around them: scanner.ts:1 (dual) before the engine header, diagnostics.ts:1 (Data), limits.ts:1-4, semantic.ts:1-5 plus 23-25 (S, A, R after the header), stringifyValue.ts:1-3 plus 16-18, parser.ts:47-49 (effect/* and @beep imports after the relative imports), TomlFormat.ts:19-24 with `effect/Predicate` at line 43 after the TomlNode block and MutableHashMap/Option out of order; Toml.ts:41 and TomlFormat.ts:71 also duplicate the inline newline domain `S.Literals(["\n", "\r\n"])`.
- failure: Header comments no longer sit at the top of their files and import groups are scattered; the newline literal domain is defined twice.
- fix: Move every import block above-and-together under the header comment in the order effect/* , @beep/*, relative; introduce one shared `TomlNewline = LiteralKit(["\n", "\r\n"])` (TomlEdit.ts or a new internal/newline.ts) used by both options classes and dominantNewline.

REQUIRED: 6
BACKLOG: 13
