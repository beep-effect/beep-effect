### fable-2-1
- file: scratchpad/effected/markdown/internal/carriers.ts:77
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 (extend S.TaggedError directly for typed errors); D5; round-1 req-14 (required, not closed); EF-12 identity annotations   evidence: carriers.ts:77 `RawMarkdownError extends Data.TaggedError("RawMarkdownError")` and :165 `GuardExceeded extends Data.TaggedError("GuardExceeded")` are unchanged since round 1. PORT_LEDGER.json w2-markdown tagged-errors entry: "RawMarkdownError/GuardExceeded use Data.TaggedError ... their required schema migration remains undone ... g1 explicitly LEFT req-14"; README Port notes repeat it. The carrier payload `RawDiagnostic` (:49) is a pure-data interface with no schema (the req-34 class), and `GuardReason` (:136, `"NestingDepthExceeded"`) hand-spells the code domain a second time next to the `MARKDOWN_PARSE_ERROR_CODES` tuple (:29) that MarkdownDiagnostic.ts:39 turns into the public LiteralKit. The four green beep laws scan native `new Error`, not Data.TaggedError, so the gate cannot see this.
- failure: The engine's cross-module error carriers (thrown at blockParser.ts:304 and inlineParser.ts:650, caught by the facade) have no executable schema, no $I identity and no field annotations; their diagnostic payload cannot be decoded, encoded or generated, and the error-code domain is spelled three ways (tuple, hand-rolled type, public kit).
- fix: In carriers.ts define `MarkdownParseErrorCodeRaw = LiteralKit(["NestingDepthExceeded"]).annotate($I.annote(...))` (reuse it from MarkdownDiagnostic.ts:39 the way FrontmatterSource.ts:40 reuses RawNewline), a `RawDiagnostic` S.Class/S.Struct with annotated `code/message/offset/length` keys, and derive RawMarkdownError and GuardExceeded from `S.TaggedError<...>($I`...`)` with annotated payloads, keeping the tags, `name = "Error"`, messages, the positional constructor spellings and the `isRawMarkdownError`/`isGuardExceeded` guards (per req-14's fix text); record it under the existing tagged-errors ledger entry.

### fable-2-2
- file: scratchpad/effected/markdown/internal/inlineNode.ts:19
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (`import * as P from "effect/Predicate"` only); round-1 req-24 (required, same class)   evidence: `rg -n 'import \{[^}]*\} from "effect/(Predicate|Array|Option|Record|Schema|String)"' scratchpad/effected/markdown` -> inlineNode.ts:19 `import { isString } from "effect/Predicate";` (used at :103), blockTypes.ts:20 and Markdown.ts:17 (outside this part's focus). The ledger effect-imports entry claims "req-24 also enforces the Predicate namespace alias" and "parser Predicate uses namespace P", so the round-1 fix wave missed these sites; the effect-imports gate only normalizes root-barrel imports (round-1 req-24 evidence) and let them through again.
- failure: The file bypasses the A/O/P/R/S alias law the rest of the module follows (blockParser.ts:39, inlineParser.ts:47 use `P.`).
- fix: `import * as P from "effect/Predicate";` and `P.isString(args[0])` at :103 (and the identical change at Markdown.ts:17/:275 for the group that owns that file).

### fable-2-3
- file: scratchpad/effected/markdown/internal/blockTypes.ts:20
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (namespace aliases only); round-1 req-24   evidence: blockTypes.ts:20 `import { isString } from "effect/Predicate";` consumed at :634 in the `makeBlockNode` dual discriminator; the same named-import shape req-24 removed from rawInline.ts and inlineParser.ts. No gate flags it (effect-imports normalizes root-barrel imports only).
- failure: Second missed law-1 site in the block-pass leaf; the ledger's effect-imports entry asserts the alias is enforced module-wide, which is false at this commit.
- fix: `import * as P from "effect/Predicate";` and `dual((args) => P.isString(args[0]), ...)` at :634.

### fable-2-4
- file: scratchpad/effected/markdown/internal/entityMap.ts:44
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Map in domain logic) and law 21 (tersest equivalent form); 2026-10-09 ruling rejecting shapes that "only evade the law"; round-1 req-23 (required, identical facade shape, fixed for inlineRegistry)   evidence: entityMap.ts:44-55 builds `ENTITY_MAP: ReadonlyMap<string, string>` as a 12-line object literal imitating the native ReadonlyMap interface (size/get/has/keys/values/entries/Symbol.iterator/forEach) over an Effect HashMap plus a parallel `entries` array. The only production reader is entities.ts:55 `ENTITY_MAP.get(body)`. The imitation methods exist for nothing but S3 coverage: scratchpad/test/markdown/internal/entityMap.coverage.test.ts:7-26 exercises entries/size/iterator/keys/values/forEach/has/get solely to cover the facade. Round 1 never raised this site (reject-4 proposed restoring native Map, which the ruling forbids); the ledger native-runtime entry records the facade as lab behaviour, not as a `law:`/`upstream-bug:` cause.
- failure: Law 6 is evaded rather than met: the engine's entity table is typed and used as a native ReadonlyMap behind a hand-rolled facade, every hit allocates an Option it immediately unwraps, and the module carries a coverage test for imitation methods no consumer calls.
- fix: `export const ENTITY_MAP: HashMap.HashMap<string, string> = HashMap.fromIterable(entries)`; read it with `HashMap.get(ENTITY_MAP, body)` in entities.ts (returning the Option, see fable-2-11); retarget entityMap.coverage.test.ts / inline-pass.test.ts:29-38 / entities.property.test.ts:21-22 to HashMap.size/get/keys and record the test change under the existing native-runtime entry.

### fable-2-5
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:58
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 and law 21; 2026-10-09 ruling ("only evades the law"); round-1 req-23 precedent   evidence: blockRegistry.ts:58-74 `constructTable` builds a HashMap and then returns a 12-line native-ReadonlyMap facade over it (comment: "Keep the scanner's ReadonlyMap boundary"), so blockTypes.ts:592 keeps `constructs: ReadonlyMap<BlockType, BlockConstruct>`. The only production reader is blockParser.ts:199 `this.dialect.constructs.get(type)`. Tests written against the facade: blockRegistry.coverage.test.ts:7-29 covers every imitation method; blockParser.coverage.test.ts:49-52, :82-84 and :149-151 reach the `constructOf` missing-construct branch by `Object.assign(table, { get: () => undefined })`, mutating the shared module-level dialect object between try/finally.
- failure: Same evasion as the retired inlineRegistry facade: a native collection contract preserved by imitation, Option allocation per lookup on every line of the block pass, and tests that monkeypatch shared registry state through the facade.
- fix: `constructs: HashMap.HashMap<BlockType, BlockConstruct>` in blockTypes.ts; `constructTable = (constructs) => HashMap.fromIterable(A.map(constructs, (c) => [c.type, c] as const))`; `constructOf` uses `HashMap.get` with `O.getOrThrowWith(() => BlockParserError.make(...))`; retarget blockRegistry.coverage.test.ts and the three blockParser.coverage.test.ts sites (drive the missing-construct branch without mutating module state, or simplify it per the module's section-11.3 practice) and record under native-runtime.

### fable-2-6
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:42
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; operator step 4 (annotations on schemas and fields); D5; round-1 req-22a/b (required, identical class)   evidence: blockRegistry.ts:42-44 `class UnknownBlockDialectError extends S.TaggedError<...>($I`UnknownBlockDialectError`)("UnknownBlockDialectError", { message: S.String }) {}` has neither an `$I.annote(...)` third argument nor an `annotateKey` on `message`. The sibling the fix wave repaired, inlineRegistry.ts:36-40 UnknownInlineDialectError, carries both; the ledger identity-annotations entry claims "g1/g2/g3/g8/g10 complete missed metadata sites".
- failure: The identity step is incomplete: this error has an identifier but no description or payload metadata, so catalog/docgen surfaces show it blank and it diverges from its inline-registry twin.
- fix: Mirror inlineRegistry.ts:36-40: `message: S.String.annotateKey({ description: "Diagnostic message naming the unsupported block dialect." })` and a third argument `$I.annote("UnknownBlockDialectError", { description: ... })`; tag and message unchanged.

### fable-2-7
- file: scratchpad/effected/markdown/internal/blockParser.ts:74
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; operator step 4; round-1 req-22a (message field lacks annotations -> required)   evidence: blockParser.ts:71-77 BlockParserError has the `$I.annote("BlockParserError", ...)` schema annotation but its only field is a bare `message: S.String` (:74). lineIndex.ts:30-31 (InvalidLineTableError, repaired by req-22a) annotates the same field with title/description; the identity-annotations ledger entry asserts the missed sites are complete.
- failure: The payload key of the block parser's invariant error escaped the annotation pass; schema metadata is inconsistent across the module's internal errors.
- fix: `message: S.String.annotateKey({ description: "Diagnostic message naming the violated block-parser invariant." })`.

### fable-2-8
- file: scratchpad/effected/markdown/internal/blockParser.ts:702
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (one named LiteralKit domain; S.Literals only for anonymous inline unions never referenced by name); round-1 req-26/req-27 (required: no duplicate spellings of one literal domain)   evidence: The dialect domain is spelled three times at this commit: Markdown.ts:56 `MarkdownDialect = LiteralKit(["commonmark", "gfm"])` (public kit), blockRegistry.ts:56 `export type MarkdownDialect = "commonmark" | "gfm"` (hand-rolled type that inlineRegistry.ts:50 now derives from per req-26), and blockParser.ts:702 `dialect: S.optionalKey(S.Literals(["commonmark", "gfm"]))` inside the exported BlockParseOptions schema. The cycle firewall forbids internal/ importing Markdown.ts, which is exactly the case req-27 solved by putting the kit in the internal leaf (blocks/frontmatter.ts:160 RawNewline) and re-annotating it publicly (FrontmatterSource.ts:40). The ledger schema-first entry claims "LiteralKit owns ... dialect ... domains".
- failure: Widening the public dialect union does not propagate to the engine's registry key or to BlockParseOptions; two of the three spellings are not schema-derived and a mismatch compiles.
- fix: Define `export const MarkdownDialect = LiteralKit(["commonmark", "gfm"]).annotate($I.annote("MarkdownDialect", ...))` and `export type MarkdownDialect = typeof MarkdownDialect.Type` in blockRegistry.ts (replacing :56); use `dialect: S.optionalKey(MarkdownDialect)` at blockParser.ts:702; make Markdown.ts:56 `MarkdownDialect = <internal kit>.annotate($I.annote("MarkdownDialect", {...}))` exactly as FrontmatterNewline reuses RawNewline; members, defaults and tests unchanged.

### fable-2-9
- file: scratchpad/effected/markdown/Mdast.ts:300
- class: schema   severity: required
- standard: AGENTS.md Code Laws (named LiteralKit domains and derived `S.is(...)` guards over ad-hoc predicate helpers); standards/effect-laws-v1.md law 17/19/21; round-1 req-8 (required: membership tables over a named literal domain)   evidence: Mdast.ts:300-304 `frontmatterTypes = HashMap.fromIterable<string, FrontmatterFormat>([["yaml","yaml"],["toml","toml"],["json","json"]])` is an identity map whose only reader is :380 `O.getOrUndefined(HashMap.get(frontmatterTypes, type))` followed by `!== undefined`; it restates the membership of `FrontmatterFormat` (MarkdownNode.ts:1723, a LiteralKit since req-16) with `string` keys, so a typo in the table compiles. Upstream used a native `new Map` (oracle Mdast.ts:262); the law pass swapped the constructor without replacing the table by the schema guard.
- failure: The frontmatter literal domain is spelled twice (kit + membership table) and the guard is a hand-rolled map lookup rather than the schema-derived guard, the shape req-8 required removing from MarkdownFormat.ts.
- fix: Import the `FrontmatterFormat` value, hoist `const isFrontmatterFormat = S.is(FrontmatterFormat);`, and in normalizeNode write `if (isFrontmatterFormat(type)) { return { type: "frontmatter", format: type, value: value.value, position: normalizePosition(value.position) }; }`; delete frontmatterTypes and the now-unused HashMap import if nothing else uses it.

### fable-2-10
- file: scratchpad/effected/markdown/MarkdownNode.ts:1466
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named or reused constraints are schemas first; prefer built-in schema constructors/checks before S.makeFilter); AGENTS.md Code Laws (named schema building blocks); D5   evidence: The non-empty JSX name constraint is written three times as an inline `S.makeFilter` over the whole struct: MarkdownNode.ts:1466-1470 (MdxJsxAttribute: `attribute.name.length === 0 ? "..." : undefined`), :1574-1583 and :1614-1623 (both elements: `element.name !== null && element.name.length === 0`). Effect 4.0.2 ships the built-in `S.NonEmptyString` (node_modules/effect/dist/Schema.d.ts:6761) and `S.isNonEmpty(annotations?)` (:6419). Tests assert only rejection, not the message text (mdx.test.ts:81 `assert.throws(() => MdxJsxAttribute.make({ name: "" }))`, :453 assertFailure on `name: ""`), and `rg 'requires a non-empty name|cannot carry attributes' scratchpad/test/markdown` is empty. The oracle has the same three filters (upstream MarkdownNode.ts:890/958/987), so this is a carried shape, not a lab regression; the S1 law gates do not check law 17.
- failure: A reused domain constraint lives in three ad-hoc filters instead of one named schema building block, so the constraint is not reflected in the `name` key's own schema (no derived arbitrary minLength, no key-level issue path) and the MdxJsxAttribute class needs a struct-level filter for a single-field rule.
- fix: Add `const MdxJsxName = S.NonEmptyString.annotate($I.annote("MdxJsxName", { description: "A non-empty JSX element or attribute name" }))`; use `name: MdxJsxName.annotateKey(...)` in MdxJsxAttribute and drop its makeFilter (plain fields object again); use `name: S.NullOr(MdxJsxName).annotateKey(...)` in MdxJsxFlowElement/MdxJsxTextElement and shrink their filters to the fragment-cannot-carry-attributes rule. Record the issue-path change as a `law:17` entry under the existing schema-first class; mdx.test.ts assertions stay as they are.

### fable-2-11
- file: scratchpad/effected/markdown/internal/entities.ts:46
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2 (inside domain code avoid `| undefined`; consume via O.getOrElse); round-1 req-35 (required: internally produced absence must be Option); the module's own ledger effect-first entry ("EF-2 models internal absence with Option")   evidence: entities.ts:46 `decodeEntity = (entity: string): string | undefined` returns `undefined` on three internal branches (:48, :55 via the facade's `.get`, :61) and its two domain consumers branch on the sentinel directly: internal/unescape.ts:67 `decodeEntity(source) ?? source` and internal/inlines/entity.ts:43 `decodeEntity(matched) ?? matched`. This is the engine's own decoder result, not external nullable input, i.e. the exact class req-35 made required for scanDelims. With fable-2-4 applied the named branch is already an Option (`HashMap.get`).
- failure: Absence of a decodable reference flows through parser domain logic as a nullish union rather than Option, leaving one EF-2 site standing after the module recorded EF-2 as a forcing cause.
- fix: Return `O.Option<string>`: `O.none()` for the three non-entity branches, `HashMap.get(ENTITY_MAP, body)` for names, `O.some(...)` for numeric forms; consumers become `O.getOrElse(decodeEntity(x), () => x)`; retarget inline-pass.test.ts:44-70 and internal/entities.*.test.ts from `undefined` to `O.none()`/`O.some` and cite them in the existing effect-first entry.

### fable-2-12
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:179
- class: perf   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); D11 (constant-factor perf without a measurement is backlog)   evidence: MarkdownVisitor.ts:179 `for (const [child, index] of A.map(children, (child, index) => [child, index] as const))` materializes one tuple per child plus a fresh array for every container node on every stream subscription, solely to carry the index the path needs; upstream (oracle MarkdownVisitor.ts:139) used an index loop with `as` casts that D15 rightly removed. No measurement taken.
- failure: Per-container allocation of N tuples in the walk's hot loop with no behavioural purpose; the lazy-stream design exists to avoid materializing, and this materializes each child list twice.
- fix: `let index = 0; for (const child of children) { const events = walkNode(child, [...path, index], depth + 1); ...; index += 1; }` (no cast, no tuple array).

### fable-2-13
- file: scratchpad/effected/markdown/internal/inlineParser.ts:682
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; neither here); law 21   evidence: inlineParser.ts:682 `this.materializeNode({ ...node, type: node.type }, depth)` shallow-copies all ten InlineNode fields for every non-text inline node purely to coerce the type to `MaterializableInlineNode` (TS does not narrow a non-union interface through `node.type !== "text"`); :690 then calls `materializeInlineNode(node)` which, per the req-17 shape, allocates a curried builder closure per node and dispatches through eleven `Match.when({ type: ... })` object-pattern arms rather than `Match.discriminator("type")` (the form Mdast.ts:145 uses). Upstream's switch allocated nothing per node (oracle inlineParser.ts:540). Constant-factor only; not measured.
- failure: Three avoidable per-node allocations/scans on the inline materialization path for identical output.
- fix: Add `const isMaterializable = (n: InlineNode): n is MaterializableInlineNode => n.type !== "text"` and branch on it instead of spreading; build the dispatcher with `Match.discriminator("type")` arms; pass position/materializeChildren as arguments (e.g. dispatch on a small `{ node, position, materializeChildren }` record) so no closure is created per node.

### fable-2-14
- file: scratchpad/effected/markdown/internal/blockParser.ts:373
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 7 intent (typed errors on production failure paths); the file's own convention (BlockParserError at :193, :201, :678); law 21   evidence: blockParser.ts:373 `this.oldtip = O.getOrThrow(O.fromUndefinedOr(parent))` and :429 `container = O.getOrThrow(O.fromUndefinedOr(container.parent))`, and inlineParser.ts:379 `O.getOrThrow(O.fromUndefinedOr(this.root.lastChild))`, replace upstream's `parent ?? this.doc` (oracle blockParser.ts:342, :399). `O.getOrThrow` throws Effect's anonymous native `Error` on the none branch while every other invariant in these files throws a tagged `BlockParserError`. The branches are unreachable (every matched container has a parent; unputText pre-checks availability), so no observable failure today.
- failure: An invariant trip would surface as an untagged native Error from inside effect/Option instead of the module's tagged invariant error, inconsistent with the sibling sites and with the tagged-errors deviation the module recorded.
- fix: `O.getOrThrowWith(O.fromUndefinedOr(parent), () => BlockParserError.make({ message: "block parser: a matched container has no parent" }))` (and the inlineParser twin), or restore upstream's `?? this.doc` fallback where that is the documented behaviour.

### fable-2-15
- file: scratchpad/effected/markdown/Mdast.ts:347
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form); round-1 back-5 (same predicate triple, classified backlog)   evidence: Mdast.ts:347-348 `isRecord = P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)`; `P.isObjectKeyword` admits functions (hence the subtraction) while `P.isObjectOrArray` (node_modules/effect/dist/Predicate.d.ts:1138) is exactly upstream's `typeof value === "object" && value !== null` (oracle Mdast.ts:309-310). Behaviour-identical.
- failure: Three predicates express a guard two express; same site class as the recorded back-5 in FrontmatterResolver.ts.
- fix: `const isRecord = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value) && !A.isArray(value);`

### fable-2-16
- file: scratchpad/effected/markdown/internal/blockTypes.ts:52
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains); precedent scratchpad/effected/jsonc/JsoncNode.ts JsoncNodeType = LiteralKit([...])   evidence: blockTypes.ts:52-66 `export type BlockType = "document" | ... | "tableCell"` (14 members, keys of every dialect's construct table and the argument of `addChild`/`makeBlockNode`) and inlineNode.ts:28-40 `export type InlineNodeType` (12 members) are named, reused, hand-rolled literal unions with no schema value. They are consumed only at the type level on mutable engine structures (no `.is`, `Enum`, `$match` or annotation use), which is why I classify this below D11's required bar rather than alongside req-8/req-16; round 1 reviewed both files without raising it.
- failure: Two named engine literal domains exist only as TypeScript unions; a future runtime guard or annotation over them would have to be hand-written.
- fix: If the integrator wants the law-19 end state here: `export const BlockType = LiteralKit([...14 members])` with `export type BlockType = typeof BlockType.Type` (same for InlineNodeType), keeping every construct's `type` literal unchanged; otherwise leave as a recorded backlog with this reason.

### fable-2-17
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:168
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md "Description and section grammar" (sections are distinct, ordered blocks); docgen passed, so cosmetic   evidence: blockRegistry.ts:165-169 runs the **Gotchas** prose straight into `**Example** (Inspect the CommonMark start order)` with no blank line; blockParser.ts:697-698 closes the Example fence and starts `@category schemas` on the next line; blockParser.ts:727-728 runs the **Details** paragraph into `**Example** (Parse a heading with the block engine)` without a separator. Every other block in the module separates sections with a blank ` *` line.
- failure: Three doc blocks render their section boundaries as one paragraph in editors that do not special-case bold markers; inconsistent with the module's own formatting.
- fix: Insert the missing ` *` separator line before `**Example**` at blockRegistry.ts:169 and blockParser.ts:728, and between the closing fence and `@category` at blockParser.ts:698.

REQUIRED: 11
BACKLOG: 6
