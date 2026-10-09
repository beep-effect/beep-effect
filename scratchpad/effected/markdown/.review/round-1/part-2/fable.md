### fable-1-1
- file: scratchpad/effected/markdown/internal/blockParser.ts:690
- class: bug   severity: required
- standard: D9 (upstream shape is the plain `parseBlocks(text, dialect?, frontmatter?)`), D11 bug. No law forces `dual`: the terse-effect `dual-overload` detector (packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:546-573) only flags hand-written overloads on exported `function` declarations.   evidence: The dual predicate `P.isString(args[0]) && !P.isBoolean(args[1])` cannot tell the one-argument data-last call `parseBlocks(dialect)` from the one-argument data-first call `parseBlocks(text)`: both are a single string. bun probe (read-only): `parseBlocks("gfm")` returns a BlockPassResult whose root holds one paragraph (the literal text "gfm" parsed as a document); `parseBlocks("gfm")("# hi\n")` throws `TypeError: parseBlocks("gfm") is not a function`; only `parseBlocks("gfm", false)("# hi\n")` reaches the data-last path. `rg` over the module and tests shows every caller is data-first (Markdown.ts:161 and all test sites).
- failure: The overload declared at :688 `(dialect?: MarkdownDialect, frontmatter?: boolean): (text: string) => BlockPassResult` is a type-level promise the runtime breaks: any consumer that omits `frontmatter` gets the dialect name parsed as markdown and then a "not a function" crash.
- fix: Drop `dual` and the data-last overload; restore the upstream arrow `export const parseBlocks = (text: string, dialect: MarkdownDialect = "commonmark", frontmatter = false): BlockPassResult => new BlockParser(...).parse()`.

### fable-1-2
- file: scratchpad/effected/markdown/MarkdownNode.ts:45
- class: schema   severity: required
- standard: D9 behaviour-preserving + section 14 ("a different accepted input" is a deviation; only `law:<id>` or `upstream-bug:<evidence>` allow one, recorded in the ledger and README Port notes first). README Port notes -> Deviations says "None" and the ledger row `w2-markdown.deviations` is `[]`. No beep standard or law prefers `S.Finite` over `S.Number` (`rg Finite` over standards/, .patterns/ and the Laws/SchemaDiagnostics source matches only "finite variants" prose; the patterns themselves use `S.Number`).   evidence: Upstream uses `Schema.Number` for `Point.line/column/offset`, `Code.fenceLength` and `List.start`; the port uses `S.Finite` at :45, :46, :47, :560, :662. bun probe: upstream `Point.make({ line: NaN, column: 1, offset: 0 })` -> ok (line NaN) and `List.make({ children: [], start: Infinity })` -> ok; the port throws `Schema validation failed` for both.
- failure: `Point.make`, `Mdast.fromMdast` and every decode of these five fields reject non-finite numbers that upstream accepts; the D10 `Arbitrary.schema` round-trip domain also changes. The deviation is unrecorded and has neither allowed cause.
- fix: Restore `S.Number` on the five fields (keep the `annotateKey` descriptions). If `Finite` is genuinely wanted, follow section 14 first: ledger `deviations` entry + README Port notes with a cause, which neither `law:` nor `upstream-bug:` currently supplies.

### fable-1-3
- file: scratchpad/effected/markdown/Mdast.ts:117
- class: perf   severity: required
- standard: D11: performance finding with a measured regression versus upstream.   evidence: `Match.value(node).pipe(Match.discriminator("type")(...) x 25, Match.exhaustive)` rebuilds the whole matcher chain on every `projectNode` call. bun bench on a 146 kB GFM document (31,601 nodes), same port-parsed tree fed to both, min of 7 runs over two rounds: port `Mdast.toMdast` 55.9-70.0 ms vs upstream 2.4-11.8 ms (ratio of mins 23.45x); outputs byte-identical (`JSON.stringify` equal).
- failure: `Mdast.toMdast` is roughly 20x slower than upstream for identical output; matcher allocation dominates projection.
- fix: Build the matcher once at module scope: `const projectNodeMatcher = Match.type<AnyNode>().pipe(...arms..., Match.exhaustive)` with each arm computing `projectPosition(node.position)` itself, and `const projectNode = (node: AnyNode): MdastNode => projectNodeMatcher(node)`; or restore the upstream `switch`.

### fable-1-4
- file: scratchpad/effected/markdown/internal/inlineNode.ts:68
- class: perf   severity: required
- standard: D11 measured regression versus upstream; D9 (upstream exports plain data-first arrows). No law forces `dual` (TerseEffect `dual-overload` flags only explicit overloads on `function` declarations).   evidence: `makeInlineNode` (:68), `appendChild` (:85), `insertAfter` (:102) and `makeBlockNode` (internal/blockTypes.ts:429) are wrapped in `dual` with an `arguments`-inspecting predicate. bun micro-bench, 2M calls, min of 5: port `makeInlineNode` 50.7 ms vs upstream 18.4 ms (2.76x); port `makeInlineNode`+`appendChild` 57.2 ms vs 29.0 ms (1.97x). End-to-end `parseBlocks(doc, "gfm")` on the 146 kB document: port min 107.9 ms vs upstream 88.6 ms (1.22x; first round 136.2 vs 88.6) - that figure also includes the law-forced HashMap lookups of fable-1-5. `rg` shows every call site is data-first; the data-last forms `makeInlineNode(start, end)(type)` etc. have no caller.
- failure: Every inline/block node construction and every sibling splice on the parser's hottest path pays a trampoline (`isString(args[0])` / `arguments.length >= 2`) plus a second call frame, for an API shape nothing uses.
- fix: Restore the four plain arrow functions as upstream wrote them (drop `dual` and the data-last overload types in inlineNode.ts and blockTypes.ts). While there, `parseInlines` at internal/inlineParser.ts:669 can lose its equally unused `dual` (its `!isFunction(args[1])` predicate happens to be sound).

### fable-1-5
- file: scratchpad/effected/markdown/internal/entityMap.ts:29
- class: perf   severity: backlog
- standard: D11 (measured) but law-forced: `beep-laws/no-native-runtime` MAP_SET_CTORS bans `new Map` (NoNativeRuntime.ts:69); section 14 cause `law:native-runtime`, so backlog.   evidence: bun micro-bench, 2M `ENTITY_MAP.get` lookups cycling the 2125 entity names: port facade (`O.getOrUndefined(HashMap.get(entities, key))`) 75.3 ms vs upstream native `Map.get` 14.4 ms (5.24x). `Hash.string` rehashes the key on every call and each hit allocates an `Option`.
- failure: Every `&name;` entity reference in inline parsing pays about 5x per lookup; it is part of the measured 1.2x end-to-end parse regression.
- fix: Add a `beep-laws/no-native-runtime` allowlist entry for internal/entityMap.ts (`kind: new-map-set`, reason: engine-constant 2125-entry table built once at module load; mirror of `EFFECTED-MD-REFMAP` in standards/effect-laws.allowlist.jsonc:357-364) and restore `new Map(entries)` behind the same `ReadonlyMap` type.

### fable-1-6
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:167
- class: docs   severity: backlog
- standard: D9 + section 14 procedure (ledger `deviations` entry first, then README Port notes -> Deviations); cause `law:native-runtime` (NoNativeRuntime.ts NATIVE_ERROR_CTORS: "Avoid native TypeError in production code. Use S.TaggedError").   evidence: Upstream throws `TypeError` at blockRegistry.ts:167 and blockParser.ts:180, :188, :666; the port throws `UnknownBlockDialectError` / `BlockParserError` (`S.TaggedError`). bun probe: `blockDialect("bogus")` -> `UnknownBlockDialectError`, `instanceof TypeError` false, `instanceof Error` true. README Port notes -> Deviations reads "None"; ledger row `w2-markdown.deviations: []`. No upstream test asserts `TypeError` at these sites.
- failure: An observable, law-forced deviation (different error tag on the programmer-error path) is unrecorded, so later rounds and the promotion review cannot distinguish it from an accident.
- fix: Record one `law:native-runtime` deviation entry in the ledger row and in README Port notes -> Deviations naming the four sites and their replacement tags; no upstream test needs adjusting.

### fable-1-7
- file: scratchpad/effected/markdown/internal/inlineParser.ts:545
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws: "Prefer match helpers over conditional chains"; D9 (upstream shape was a `switch`).   evidence: `materializeNode` replaced upstream's 12-case `switch (node.type)` with an 11-branch `if / else if` chain on the same string discriminant (:545-:608). No law names a `switch` on a string discriminant; the block constructs keep theirs and the gates are green.
- failure: The least idiomatic of the three forms: no exhaustiveness (`Match.exhaustive` or a `switch` default) as inline node kinds grow, and a diff against upstream that carries no behaviour.
- fix: Restore the upstream `switch`, or a module-scope `Match.type<InlineNode>()` matcher built once (never a per-call `Match.value`, see fable-1-3).

### fable-1-8
- file: scratchpad/effected/markdown/Mdast.ts:468
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md:22 (`@remarks` forbidden) and :56 (`**Example** (Title)` is the carrier, never `@example`); S2 has not run, so backlog by operator order.   evidence: `@remarks` / `@example` remain at MarkdownNode.ts:65, :250; MarkdownVisitor.ts:58, :87; Mdast.ts:32, :48, :448, :468, :486, :506; TomlFrontmatter.ts:9; YamlFrontmatter.ts:9; index.ts:4. The two `@example` bodies (MarkdownVisitor.ts:60, Mdast.ts:470) import from `"./index.ts"`, the mechanical S0 rewrite of `@effected/markdown`, which is not the import spelling the S2 docgen template compiles examples against.
- failure: S2 docgen with `enforceExamples` and the carrier rules will fail on these six files until the carriers are converted.
- fix: S2 carrier conversion per section 10.2 (`@remarks` -> **Details**/**Gotchas**, `@example` -> **Example** (Title)) and the S2 template's example import spelling.

### fable-1-9
- file: scratchpad/effected/markdown/MarkdownNode.ts:26
- class: docs   severity: backlog
- standard: D4 (carried prose must stay true after the port); D13 (`.js` -> `.ts` rewrite).   evidence: Header says "Leaf module: imports only `effect`." while the file now imports `@beep/identity/packages` (:28). internal/blockParser.ts:28 and internal/inlineParser.ts:38 still say "Imports node classes from `../MarkdownNode.js`" after the D13 rewrite (entityMap.ts:13 was updated).
- failure: Stale module-contract comments misdescribe the cycle firewall the comments exist to document.
- fix: "Leaf module: imports only `effect` and `@beep/identity`." at :26; `.js` -> `.ts` in the two parser headers.

### fable-1-10
- file: scratchpad/effected/markdown/internal/carriers.ts:28
- class: effect-idiom   severity: backlog
- standard: D5 end-state bar (`$ScratchpadId` identity on every exported error, errors per .patterns/error-handling.md, applied during S4); .patterns/error-handling.md:60 (tagged-error class pattern with `$I` identity).   evidence: `RawMarkdownError` (:28) and `GuardExceeded` (:50) are `Data.TaggedError` with positional constructors and `override readonly name = "Error"` - needed because v4 `Data.TaggedError` sets `Base.prototype.name = tag` (node_modules/effect/dist/internal/core.js:438) and upstream's `name` was "Error". No `$I` identity, while the sibling `BlockParserError` and `UnknownBlockDialectError` already use `S.TaggedError` + `$ScratchpadId`. The `name` override is an own enumerable field, so `toJSON()` and object spreads now carry it.
- failure: Two exported error classes miss the D5 identity/pattern bar the rest of the module already meets.
- fix: In the S4 identity pass, `S.TaggedError<GuardExceeded>($I`GuardExceeded`)("GuardExceeded", {...})` with constructors that keep the upstream test spellings `new GuardExceeded(reason, limit, actual, offset)` (diagnostic.test.ts:88) and `new RawMarkdownError(diagnostic)` (:81); keep `name = "Error"` only if a test pins it (none does).

REQUIRED: 4
BACKLOG: 6
