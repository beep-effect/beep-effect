# Markdown — round-2 merged inventory

Read all **12 seats** (`part-1` through `part-4`, each `grok.md`, `sol.md`, `fable.md`) and all **four adjacent briefs**: 127 submitted records. Part-qualified seat ids disambiguate repeated report-local ids. Counts after root-cause deduplication: **Required 46 · Backlog 31 · Codemod 0 · Rejected 0 · Groups 12**.

Authority: the complete operator revision block, including both 2026-10-09 rulings and later amendments, D1–D20, §§12.4–12.5 and §14, plus the current inventory request. Brief claims that S2/S3 gates are green do not override this request's docs/JSDoc/coverage/vitest-canon deferral. Gate-owned findings are admitted only with a demonstrated gate miss. Measurements below are seat evidence, not reruns by this merger.

Reviewed commit: `a12bef261998d2ad92153dada46373be06950692`. Oracle: cached markdown package pinned at `af7566a9da2eff169cb74955efcc5ede1e5de9f8` in each brief. Live inventory checkout: `@lab/effected-2`, rather than the requested spelling `@lab/effected`; no branch switch or source/test changes were made. Locations retain report evidence except req-24, whose repair home is explicitly identified.

The current `standards/effect-laws.allowlist.jsonc` has **zero** entries for `scratchpad/effected/markdown/**`; there are no synthetic `allow-<n>` findings. Do not recreate exceptions. The collection facades below are incorrect replacement shapes, not recording-only defects.

Read-only history attribution used `git log --all --format=%h:%s -- <file>` and diffs of `fff7ed559c`, `9d65f84ed2`, `03bf79d41b` (step 2/laws), `3f4355796d` (S1), `e962afbdc2` (round 1), and `cf2c19c76b` / `aab5a5da24` (S3). The fallback changes and three recording-only simplifications have §11.3 forcing evidence, so none qualifies as an unforced restore. Actual bugs in forced replacements remain required. No scratch-copy diagnostic runs, vitest or coverage runs were performed.

`required.json` defines exclusive source/test ownership, at most six source files per group. **g6 depends on the RawInlineSegment schema supplied by g3**; complete that shared schema before finalizing g6 scanner schemas. g3/g4 retain compatible existing carrier constructors. Ledger, exportsAdded and README Port-notes bookkeeping is central and is never a repair write surface. Recording clauses retained in seat fixes refer only to this central obligation. Focused bug regressions remain required; broad S2/S3 work is deferred.

## Required

### req-1 — ATX-to-setext conversion absorbs preceding blocks
- file: scratchpad/effected/markdown/MarkdownFormat.ts:406
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the formatter’s semantic-preservation contract, also asserted by `scratchpad/test/markdown/MarkdownDocument.property.test.ts`.   evidence: Read-only probes against both implementations formatted `"intro\n# Title\n"` with `{ headingStyle: "setext" }` into `"intro\nTitle\n=====\n"`. Before formatting, the document contained a paragraph `"intro"` followed by a heading `"Title"`; afterward, it contained one heading with text `"intro\nTitle"`.
- failure: ATX-to-setext conversion checks the heading’s content and indentation but does not protect the boundary with a preceding paragraph. Removing the interrupting ATX marker absorbs that paragraph into the new setext heading.
- fix: Skip setext conversion unless the heading begins a physical line and its previous physical line is blank or absent. Use CR/LF/CRLF-aware boundaries. Add format.test.ts regressions for an interrupting heading after a paragraph, blockquote and list item.
- seats: part-1/sol-2-2, part-1/grok-2-1, part-1/fable-2-1

### req-2 — Setext-to-ATX conversion loses literal trailing hashes
- file: scratchpad/effected/markdown/MarkdownFormat.ts:429
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `MarkdownFormat.format` promises conservative marker normalization that preserves content.   evidence: A read-only Bun probe against the reviewed commit and pinned oracle formatted `"title #\n=======\n"` with `{ headingStyle: "atx" }`. Both returned `"# title #\n"`. Reparsing changed the heading’s text from `"title #"` to `"title"`.
- failure: Setext-to-ATX conversion copies the original content directly after the opening hashes. A literal trailing hash run preceded by whitespace becomes an ATX closing sequence, silently deleting heading content.
- fix: Skip conversion when the composed content would introduce an unescaped ATX closing sequence, consistent with the formatter’s conservative policy. Add a render-equivalence regression for trailing literal hashes and record the verified upstream bug through section 14.
- seats: part-1/sol-2-1, part-1/grok-2-2

### req-3 — Line-boundary helpers mishandle bare CR
- file: scratchpad/effected/markdown/MarkdownFormat.ts:295
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the explicit thematic-break safety guard at `MarkdownFormat.ts:380` and the regression contract in `scratchpad/test/markdown/format.test.ts`.   evidence: Read-only probes against both implementations formatted `"para\r***\r"` with `{ thematicBreakChar: "-" }` into `"para\r---\r"`. Reparsing changed a paragraph followed by a thematic break into a depth-two setext heading. Grok also traces mixed LF/CR false blank-line detection; back over CR only for an actual preceding CRLF terminator.
- failure: `lineStartOf` recognizes only LF. On a document using lone CR terminators, `previousLineBlank` incorrectly treats the thematic break’s line as the first line and permits the hazardous dash rewrite.
- fix: Make the line-boundary helpers recognize LF, lone CR and CRLF, consuming a pair only for an actual CRLF terminator. Retain the skip-on-hazard behavior and add the lone-CR regression.
- seats: part-1/sol-2-3, part-1/grok-2-3

### req-4 — Emphasis normalization classifies surrogate halves
- file: scratchpad/effected/markdown/MarkdownFormat.ts:483
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `formatEmphasis`’s explicit intraword-underscore guard.   evidence: Read-only probes against both implementations formatted `"𐐀*hi*𐐀\n"` with `{ emphasisChar: "_" }` into `"𐐀_hi_𐐀\n"`. The original parse contained an emphasis node around `"hi"`; the formatted parse contained only literal text. U+10400 is an astral letter. The recorded round-1 parser-flanking repair addresses delimiter parsing; this evidence exercises the formatter’s separate boundary check.
- failure: `charAt(start - 1)` and `charAt(end)` supply surrogate halves to the Unicode alphanumeric regex. The guard misses astral letters and introduces underscores at an intraword boundary, removing emphasis.
- fix: Classify complete code points immediately before and after the source span, stepping backward over a valid surrogate pair while retaining UTF-16 offsets. Add left-side, right-side and two-sided astral-letter regressions.
- seats: part-1/sol-2-4, part-1/grok-2-4, part-1/fable-2-2

### req-5 — Fence normalization rewrites content of an unclosed block
- file: scratchpad/effected/markdown/MarkdownFormat.ts:524
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); `MarkdownFormattingOptions` contract (MarkdownFormat.ts:124-125 'Content is never rewritten'); CommonMark 0.31.2 §4.5 (a closing fence is a line of its own; an unclosed fence runs to end of document)   evidence: Port and oracle probes agree: `formatToString("```\nfoo```", undefined, { fenceChar: "~" })` → `"~~~\nfoo~~~"`, and `"```\nfoo```\n"` → `"~~~\nfoo~~~\n"`. The source parses as an UNCLOSED fence whose value is `"foo```\n"`; the output re-parses with value `"foo~~~\n"` — code content was rewritten. Cause: the closing-fence scan `while (end - closeLength > start + openLength && source[end - closeLength - 1] === fidelity)` walks backwards over fidelity characters from the node end without checking that they form a fence LINE, so a trailing backtick run inside the last content line of an unclosed block is treated as the closing fence and replaced.
- failure: For an unclosed fenced block whose last content line ends with three or more fence characters, `fenceChar` normalisation rewrites code content (backticks become tildes), breaking the 'content is never rewritten' promise; the block's value changes on re-parse.
- fix: Inspect the last physical line with CR-aware boundaries and actual container-prefix context; change a closing fence only if it is a genuine closing line of the fidelity character. Otherwise change the opening fence alone. Do not reinterpret trailing backticks inside code content as a fence. Add both unclosed foo``` regressions in format.test.ts.
- seats: part-1/fable-2-3, part-1/grok-2-5

### req-6 — Combined bullet edits turn nested lists into thematic breaks
- file: scratchpad/effected/markdown/MarkdownFormat.ts:461
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:7-16; `reThematicBreak` in `internal/blocks/thematicBreak.ts:13`, tried before list starts.   evidence: `listItemStart` returns 1 after `parseListMarker` advances past the marker, so `* - -\n` is three nested lists on one line and `- - -\n` is a thematic break. `formatList` replaces each item marker independently. `{ bulletChar: "-" }` turns `* - -\n` into `- - -\n`; `{ bulletChar: "*" }` turns `- * *\n` into `* * *\n`. Each list simulates only its own marker, so a per-list check on `* + +` with target `-` never sees the combined `- - -`. Upstream emits the same one-character edits.
- failure: Bullet normalization of a marker-only nested-list line produces a thematic break and the list structure disappears.
- fix: Project all unordered-list marker edits this pass plans on a physical line, respecting the requested range. If their combined result becomes a thematic break, suppress every bullet edit on that line. Add * - -, - * * and * + + regressions in format.test.ts; do not simulate one nested list in isolation.
- seats: part-1/grok-2-6, part-1/fable-2-4

### req-7 — Bare CR bypasses multiline replacement protection
- file: scratchpad/effected/markdown/MarkdownFormat.ts:974
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `MarkdownFormat.modify` explicitly promises `UnsupportedTarget` for multiline replacements inside containers whose continuation prefixes cannot be reproduced.   evidence: In read-only probes against both implementations, parsing `"> before\n"`, selecting its text node and replacing it with `"one\r# ESCAPE"` succeeded with `"> one\r# ESCAPE\n"`. Reparsing produced a blockquote containing `"one"` followed by a root-level heading `"ESCAPE"`. Replacing a table cell with `"one\rtwo"` likewise succeeded and created two body rows.
- failure: The multiline check looks only for `"\n"`. A lone CR is also a markdown line terminator, so it bypasses the container guard and changes structure outside the intended replacement slot.
- fix: Detect both CR and LF in rendered replacement content before accepting a splice inside `NO_MULTILINE_ANCESTORS`. Add blockquote, heading and table regressions requiring the existing typed `UnsupportedTarget` failure.
- seats: part-1/sol-2-5, part-1/grok-2-7

### req-8 — Heading text replacements lose a trailing literal hash
- file: scratchpad/effected/markdown/MarkdownFormat.ts:947
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `modify`’s literal-string replacement contract and the existing heading closing-hash escape policy in `internal/stringify.ts`.   evidence: Read-only probes against both implementations parsed `"# before\n"`, selected its text node and called `modifyToString(document, target, "after #")`. Both succeeded with `"# after #\n"`. Reparsing yielded heading text `"after"`, losing the requested literal `#`.
- failure: Plain-string replacements always render inside a synthetic paragraph. That loses the destination heading context, so the stringifier omits the closing-hash protection it applies when rendering an actual heading.
- fix: Apply the existing heading closing-sequence escaping when the replacement occupies the end of an ATX heading, accounting for the surrounding source. Add a replacement-fidelity regression for `"after #"` and record this separate upstream context-escaping defect.
- seats: part-1/sol-2-6, part-1/grok-2-8

### req-9 — Nested link replacements invalidate the surrounding link
- file: scratchpad/effected/markdown/MarkdownFormat.ts:958
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `modify`’s context-compatible fragment replacement contract.   evidence: Read-only probes against both implementations parsed `"[outer](/a)\n"`, selected the `"outer"` text node and replaced it with a `Link` fragment whose URL was `"/b"` and whose text was `"inner"`. Both succeeded with `"[[inner](/b)](/a)\n"`. Reparsing retained only the `"/b"` link; the outer `"/a"` link disappeared.
- failure: Phrasing-category membership admits a link fragment inside an existing link. Rendering the fragment as an independent paragraph hides the nesting hazard, and the successful splice invalidates the surrounding link.
- fix: Before rendering, reject a replacement containing `Link` or `LinkReference` when its destination lies inside a `Link` or `LinkReference`, using the existing typed modification-error channel. Check nested replacement descendants as well as the replacement root, and add a regression proving the outer link survives or the operation fails typed.
- seats: part-1/sol-2-7, part-1/grok-2-9

### req-10 — Flow replacements ignore the preceding block context
- file: scratchpad/effected/markdown/MarkdownFormat.ts:973
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); `MarkdownFormat.modify` contract (MarkdownFormat.ts:725-728 and 884-887: 'every replacement renders through the canonical stringifier, so a modified document re-parses cleanly by construction'); CommonMark 0.31.2 §4.8 lazy continuation and §5.2 list item continuation   evidence: Port and oracle `modifyToString` probes agree on every case. (B8) source `"- item\n\npara\n"`, target the root paragraph, replacement `Code.make({ value: "x" })` → `"- item\n\n    x\n"`, which re-parses as a second PARAGRAPH inside the list item (the canonical language-less code renders indented in isolation and is absorbed by the list). (B9) `"para\n# h\n"`, target the heading, replacement `Paragraph([Text("x")])` → `"para\nx\n"`, one paragraph `"para\nx"`. (B10) same target, replacement `Code({value:"x"})` → `"para\n    x\n"`, lazy continuation, one paragraph. (B11) same target, string `"x"` → merged paragraph. (B12) `"para\n- a\n"`, target the list, replacement a paragraph → `"para\nx\n"`, merged. `modify` renders the fragment in an isolated `Root` and splices it without consulting the previous sibling or the blank-line context, so the stringifier's own 'representability wins' rule (indented code after a list is emitted fenced) and paragraph-interruption rules never apply.
- failure: A flow replacement spliced at a block boundary changes category on re-parse: a paragraph merges into the preceding paragraph/list item, or a code block becomes list-item prose. The documented 'cleanly re-parses by construction' guarantee and the modify fidelity contract are broken, with no typed error.
- fix: For flow slots, reject with UnsupportedTarget when a non-blank preceding line would absorb the replacement, using the actual interruption grammar. Render an indented code replacement following a list/footnote definition fenced with the existing representability policy, or reject typed. Add paragraph/heading, paragraph/list and list/code regressions to format.test.ts.
- seats: part-1/fable-2-5, part-1/grok-2-10

### req-11 — Version classification repeats an unmodeled grammar and canonicalizer
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:470
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named or reused domain constraints are modeled as schemas first, guards derived with `S.is`), law 18 (reusable checks carry identifier/title/description), law 21 (shared helper over duplicated logic); AGENTS.md Code Laws 'named schema building blocks, derived S.is(...) guards over ad-hoc predicate helpers'; round-1 req-8 precedent   evidence: The committed `X[.Y[.Z]]` version grammar — documented on `SchemaDeclarationByName` (lines 142-145), `classify` (508-509) and `fromRegistry` (608-611) and reused at three call sites — is modelled as the ad-hoc predicate `parseVersionSegments` (470-475), a regex test returning `ReadonlyArray<string> | undefined`. Line 662 then re-implements the same canonicalisation inline (`A.join(A.map(Str.split(declaration.version, "."), Str.replace(/^0+(?=\d)/, "")), ".")`) because the helper's `undefined` sentinel cannot be reused after classification already validated the key (`rg -n 'replace\(/\^0\+' FrontmatterResolver.ts` → 474, 662). `S.isPattern` is available (used by the module's own property tests) and the gates do not check this.
- failure: The module's one reused domain constraint has no schema, no derived guard and no annotations, and its canonicalisation is duplicated in two places that can drift; this is below the D5 end-state bar the closed ports and round-1 req-8 established.
- fix: Define an annotated version-string schema for the existing X[.Y[.Z]] grammar and derive S.is; share one total canonicalSegments helper at the three classification/registry sites. Preserve SchemaDeclarationByName.version as S.String, leading-zero semantics and accepted inputs. Verify frontmatter-resolver.test.ts.
- seats: part-1/fable-2-6

### req-12 — Raw cross-module errors and diagnostic payload lack schemas
- file: scratchpad/effected/markdown/internal/carriers.ts:77
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 (extend S.TaggedError directly for typed errors); D5; round-1 req-14 (required, not closed); EF-12 identity annotations   evidence: carriers.ts:77 `RawMarkdownError extends Data.TaggedError("RawMarkdownError")` and :165 `GuardExceeded extends Data.TaggedError("GuardExceeded")` are unchanged since round 1. PORT_LEDGER.json w2-markdown tagged-errors entry: "RawMarkdownError/GuardExceeded use Data.TaggedError ... their required schema migration remains undone ... g1 explicitly LEFT req-14"; README Port notes repeat it. The carrier payload `RawDiagnostic` (:49) is a pure-data interface with no schema (the req-34 class), and `GuardReason` (:136, `"NestingDepthExceeded"`) hand-spells the code domain a second time next to the `MARKDOWN_PARSE_ERROR_CODES` tuple (:29) that MarkdownDiagnostic.ts:39 turns into the public LiteralKit. The four green beep laws scan native `new Error`, not Data.TaggedError, so the gate cannot see this.
- failure: The engine's cross-module error carriers (thrown at blockParser.ts:304 and inlineParser.ts:650, caught by the facade) have no executable schema, no $I identity and no field annotations; their diagnostic payload cannot be decoded, encoded or generated, and the error-code domain is spelled three ways (tuple, hand-rolled type, public kit).
- fix: In carriers.ts, define one annotated raw error-code LiteralKit, derive RawDiagnostic as an annotated schema/type, and derive RawMarkdownError and GuardExceeded directly from S.TaggedError with annotated payloads. Preserve tags, name = Error, messages, positional new constructors and guards. Reuse the raw kit from MarkdownDiagnostic.ts instead of defining a second domain. Retarget carrier assertions as needed; recording and added exports are central.
- seats: part-2/fable-2-1, part-2/grok-2-1

### req-13 — Predicate imports still bypass the required namespace alias
- file: scratchpad/effected/markdown/internal/inlineNode.ts:19
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (`import * as P from "effect/Predicate"` only); round-1 req-24 (required, same class)   evidence: `rg -n 'import \{[^}]*\} from "effect/(Predicate|Array|Option|Record|Schema|String)"' scratchpad/effected/markdown` -> inlineNode.ts:19 `import { isString } from "effect/Predicate";` (used at :103), blockTypes.ts:20 and Markdown.ts:17 (outside this part's focus). The ledger effect-imports entry claims "req-24 also enforces the Predicate namespace alias" and "parser Predicate uses namespace P", so the round-1 fix wave missed these sites; the effect-imports gate only normalizes root-barrel imports (round-1 req-24 evidence) and let them through again. Same root cause also occurs at blockTypes.ts:20/:634 and Markdown.ts:17/:275. The dedicated-module named import bypasses a root-barrel-only gate.
- failure: The file bypasses the A/O/P/R/S alias law the rest of the module follows (blockParser.ts:39, inlineParser.ts:47 use `P.`).
- fix: Use import * as P from effect/Predicate in inlineNode.ts, blockTypes.ts and Markdown.ts; use P.isString in their dual discriminators. Preserve all direct and pipeable signatures.
- seats: part-2/fable-2-2, part-2/grok-2-2, part-2/fable-2-3, part-2/grok-2-3

### req-14 — Entity lookup still imitates a native ReadonlyMap
- file: scratchpad/effected/markdown/internal/entityMap.ts:44
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Map in domain logic) and law 21 (tersest equivalent form); 2026-10-09 ruling rejecting shapes that "only evade the law"; round-1 req-23 (required, identical facade shape, fixed for inlineRegistry)   evidence: entityMap.ts:44-55 builds `ENTITY_MAP: ReadonlyMap<string, string>` as a 12-line object literal imitating the native ReadonlyMap interface (size/get/has/keys/values/entries/Symbol.iterator/forEach) over an Effect HashMap plus a parallel `entries` array. The only production reader is entities.ts:55 `ENTITY_MAP.get(body)`. The imitation methods exist for nothing but S3 coverage: scratchpad/test/markdown/internal/entityMap.coverage.test.ts:7-26 exercises entries/size/iterator/keys/values/forEach/has/get solely to cover the facade. Round 1 never raised this site (reject-4 proposed restoring native Map, which the ruling forbids); the ledger native-runtime entry records the facade as lab behaviour, not as a `law:`/`upstream-bug:` cause.
- failure: Law 6 is evaded rather than met: the engine's entity table is typed and used as a native ReadonlyMap behind a hand-rolled facade, every hit allocates an Option it immediately unwraps, and the module carries a coverage test for imitation methods no consumer calls.
- fix: Export ENTITY_MAP directly as HashMap.HashMap<string, string> and consume via HashMap.get in entities.ts. Retarget entityMap.coverage.test.ts, inline-pass.test.ts and entities.property.test.ts from facade methods to Effect operations. Coordinate with req-20 in this same group; do not restore native Map.
- seats: part-2/fable-2-4, part-2/grok-2-4

### req-15 — Block registry still imitates a native ReadonlyMap
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:58
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 and law 21; 2026-10-09 ruling ("only evades the law"); round-1 req-23 precedent   evidence: blockRegistry.ts:58-74 `constructTable` builds a HashMap and then returns a 12-line native-ReadonlyMap facade over it (comment: "Keep the scanner's ReadonlyMap boundary"), so blockTypes.ts:592 keeps `constructs: ReadonlyMap<BlockType, BlockConstruct>`. The only production reader is blockParser.ts:199 `this.dialect.constructs.get(type)`. Tests written against the facade: blockRegistry.coverage.test.ts:7-29 covers every imitation method; blockParser.coverage.test.ts:49-52, :82-84 and :149-151 reach the `constructOf` missing-construct branch by `Object.assign(table, { get: () => undefined })`, mutating the shared module-level dialect object between try/finally.
- failure: Same evasion as the retired inlineRegistry facade: a native collection contract preserved by imitation, Option allocation per lookup on every line of the block pass, and tests that monkeypatch shared registry state through the facade.
- fix: Type BlockDialect.constructs as HashMap.HashMap<BlockType, BlockConstruct>; constructTable returns the HashMap directly. blockParser uses HashMap.get and O.getOrThrowWith with BlockParserError. Retarget blockRegistry.coverage.test.ts and blockParser.coverage.test.ts to Effect collections and exercise missing constructs without shared-registry mutation. Preserve order/messages.
- seats: part-2/fable-2-5, part-2/grok-2-5

### req-16 — Block registry and parser errors have missing schema/field metadata
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:42
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; operator step 4 (annotations on schemas and fields); D5; round-1 req-22a/b (required, identical class)   evidence: blockRegistry.ts:42-44 `class UnknownBlockDialectError extends S.TaggedError<...>($I`UnknownBlockDialectError`)("UnknownBlockDialectError", { message: S.String }) {}` has neither an `$I.annote(...)` third argument nor an `annotateKey` on `message`. The sibling the fix wave repaired, inlineRegistry.ts:36-40 UnknownInlineDialectError, carries both; the ledger identity-annotations entry claims "g1/g2/g3/g8/g10 complete missed metadata sites". The same annotation miss leaves BlockParserError.message bare at blockParser.ts:74; its schema-level identity already exists.
- failure: The identity step is incomplete: this error has an identifier but no description or payload metadata, so catalog/docgen surfaces show it blank and it diverges from its inline-registry twin.
- fix: Annotate message fields on UnknownBlockDialectError and BlockParserError, and supply the missing schema-level $I.annote for UnknownBlockDialectError. Preserve tags and message bytes.
- seats: part-2/fable-2-6, part-2/grok-2-6, part-2/fable-2-7, part-2/grok-2-7

### req-17 — One dialect domain has three independent spellings
- file: scratchpad/effected/markdown/internal/blockParser.ts:702
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (one named LiteralKit domain; S.Literals only for anonymous inline unions never referenced by name); round-1 req-26/req-27 (required: no duplicate spellings of one literal domain)   evidence: The dialect domain is spelled three times at this commit: Markdown.ts:56 `MarkdownDialect = LiteralKit(["commonmark", "gfm"])` (public kit), blockRegistry.ts:56 `export type MarkdownDialect = "commonmark" | "gfm"` (hand-rolled type that inlineRegistry.ts:50 now derives from per req-26), and blockParser.ts:702 `dialect: S.optionalKey(S.Literals(["commonmark", "gfm"]))` inside the exported BlockParseOptions schema. The cycle firewall forbids internal/ importing Markdown.ts, which is exactly the case req-27 solved by putting the kit in the internal leaf (blocks/frontmatter.ts:160 RawNewline) and re-annotating it publicly (FrontmatterSource.ts:40). The ledger schema-first entry claims "LiteralKit owns ... dialect ... domains".
- failure: Widening the public dialect union does not propagate to the engine's registry key or to BlockParseOptions; two of the three spellings are not schema-derived and a mismatch compiles.
- fix: Define `export const MarkdownDialect = LiteralKit(["commonmark", "gfm"]).annotate($I.annote("MarkdownDialect", ...))` and `export type MarkdownDialect = typeof MarkdownDialect.Type` in blockRegistry.ts (replacing :56); use `dialect: S.optionalKey(MarkdownDialect)` at blockParser.ts:702; make Markdown.ts:56 `MarkdownDialect = <internal kit>.annotate($I.annote("MarkdownDialect", {...}))` exactly as FrontmatterNewline reuses RawNewline; members, defaults and tests unchanged.
- seats: part-2/fable-2-8, part-2/grok-2-8

### req-18 — Mdast frontmatter admission duplicates the schema vocabulary
- file: scratchpad/effected/markdown/Mdast.ts:300
- class: schema   severity: required
- standard: AGENTS.md Code Laws (named LiteralKit domains and derived `S.is(...)` guards over ad-hoc predicate helpers); standards/effect-laws-v1.md law 17/19/21; round-1 req-8 (required: membership tables over a named literal domain)   evidence: Mdast.ts:300-304 `frontmatterTypes = HashMap.fromIterable<string, FrontmatterFormat>([["yaml","yaml"],["toml","toml"],["json","json"]])` is an identity map whose only reader is :380 `O.getOrUndefined(HashMap.get(frontmatterTypes, type))` followed by `!== undefined`; it restates the membership of `FrontmatterFormat` (MarkdownNode.ts:1723, a LiteralKit since req-16) with `string` keys, so a typo in the table compiles. Upstream used a native `new Map` (oracle Mdast.ts:262); the law pass swapped the constructor without replacing the table by the schema guard.
- failure: The frontmatter literal domain is spelled twice (kit + membership table) and the guard is a hand-rolled map lookup rather than the schema-derived guard, the shape req-8 required removing from MarkdownFormat.ts.
- fix: Import the `FrontmatterFormat` value, hoist `const isFrontmatterFormat = S.is(FrontmatterFormat);`, and in normalizeNode write `if (isFrontmatterFormat(type)) { return { type: "frontmatter", format: type, value: value.value, position: normalizePosition(value.position) }; }`; delete frontmatterTypes and the now-unused HashMap import if nothing else uses it.
- seats: part-2/fable-2-9, part-2/grok-2-9

### req-19 — JSX name constraints use three ad-hoc struct filters
- file: scratchpad/effected/markdown/MarkdownNode.ts:1466
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named or reused constraints are schemas first; prefer built-in schema constructors/checks before S.makeFilter); AGENTS.md Code Laws (named schema building blocks); D5   evidence: The non-empty JSX name constraint is written three times as an inline `S.makeFilter` over the whole struct: MarkdownNode.ts:1466-1470 (MdxJsxAttribute: `attribute.name.length === 0 ? "..." : undefined`), :1574-1583 and :1614-1623 (both elements: `element.name !== null && element.name.length === 0`). Effect 4.0.2 ships the built-in `S.NonEmptyString` (node_modules/effect/dist/Schema.d.ts:6761) and `S.isNonEmpty(annotations?)` (:6419). Tests assert only rejection, not the message text (mdx.test.ts:81 `assert.throws(() => MdxJsxAttribute.make({ name: "" }))`, :453 assertFailure on `name: ""`), and `rg 'requires a non-empty name|cannot carry attributes' scratchpad/test/markdown` is empty. The oracle has the same three filters (upstream MarkdownNode.ts:890/958/987), so this is a carried shape, not a lab regression; the S1 law gates do not check law 17.
- failure: A reused domain constraint lives in three ad-hoc filters instead of one named schema building block, so the constraint is not reflected in the `name` key's own schema (no derived arbitrary minLength, no key-level issue path) and the MdxJsxAttribute class needs a struct-level filter for a single-field rule.
- fix: Define one annotated MdxJsxName from S.NonEmptyString. Use it for attribute.name and S.NullOr(MdxJsxName) for both element names. Remove the attribute-level filter and retain only fragment-with-attributes checks on elements. Preserve rejection semantics and verify mdx.test.ts; central codemod records changed issue paths.
- seats: part-2/fable-2-10, part-2/grok-2-10

### req-20 — Internal entity-decoder absence is a nullish union
- file: scratchpad/effected/markdown/internal/entities.ts:46
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2 (inside domain code avoid `| undefined`; consume via O.getOrElse); round-1 req-35 (required: internally produced absence must be Option); the module's own ledger effect-first entry ("EF-2 models internal absence with Option")   evidence: entities.ts:46 `decodeEntity = (entity: string): string | undefined` returns `undefined` on three internal branches (:48, :55 via the facade's `.get`, :61) and its two domain consumers branch on the sentinel directly: internal/unescape.ts:67 `decodeEntity(source) ?? source` and internal/inlines/entity.ts:43 `decodeEntity(matched) ?? matched`. This is the engine's own decoder result, not external nullable input, i.e. the exact class req-35 made required for scanDelims. With fable-2-4 applied the named branch is already an Option (`HashMap.get`).
- failure: Absence of a decodable reference flows through parser domain logic as a nullish union rather than Option, leaving one EF-2 site standing after the module recorded EF-2 as a forcing cause.
- fix: Return O.Option<string> from decodeEntity: O.none for invalid forms, HashMap.get for names and O.some for numeric forms. Consumers in unescape.ts and inlines/entity.ts use O.getOrElse. Retarget inline-pass.test.ts and internal/entities.coverage.test.ts / entities.property.test.ts to Option assertions. Preserve undecodable source bytes.
- seats: part-2/fable-2-11, part-2/grok-2-11

### req-21 — Visitor eagerly reads all siblings for a fixed event prefix
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:179
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; `MarkdownVisitor.visit` promises demand-driven traversal and efficient early termination.   evidence: The loop eagerly evaluates `A.map(children, ...)`, allocating a pair and reading the child for every sibling before visiting the first child. A read-only `bun -e` probe constructed schema-valid roots with 10,000 and 50,000 paragraph children, instrumented child-array reads, and collected `Stream.take(MarkdownVisitor.visit(root), 2)`. The port read **10,000** and **50,000** children respectively; the pinned oracle read **1,024** in both cases because of stream chunking. For a fixed event prefix, the port adds Θ(n) work and allocation in sibling count where the oracle’s work remains bounded by the fixed stream chunk. Grok/Fable identify the same eager A.map but supply no measurement; Sol’s bounded-prefix evidence makes the merged issue required.
- failure: An outline or search consumer that stops after a few events still scans and allocates across an entire wide sibling array. The visitor loses upstream’s bounded cost for partial traversal, despite returning only the requested prefix.
- fix: Use lazy Iterable.map from effect/Iterable or equivalent lazy indexed iteration in walkNode, preserving order/paths without pre-reading all siblings. Add a wide-tree fixed-prefix regression to visitor.test.ts proving bounded consumption relative to stream chunking.
- seats: part-2/sol-2-1, part-2/grok-2-13, part-2/fable-2-12

### req-22 — Foreign code admission adds a content CR that stringify does not strip
- file: scratchpad/effected/markdown/Mdast.ts:428
- class: bug   severity: required
- standard: D9; section 14. New evidence against the recorded code-newline deviation (`PORT_LEDGER.json` lab behaviour: append CRLF after a content-final CR; test `mdast.test.ts:124,138`). The original lost-newline bug stays fixed.   evidence: Reading only, no probe. Line 428 stores `` `${value}\r\n` `` when `value` ends in `\r`, so `"body\r"` is carried as `"body\r\r\n"` (`mdast.test.ts:130`). `stripFinalLineEnding` (`Mdast.ts:117-118`) removes that trailing `\r\n`, so `toMdast` returns `"body\r"`. `serializeCode` (`stringify.ts:978`) removes only one trailing `\n`, leaving content `"body\r\r"`. With no fence, lang, or meta, the indented path (`stringify.ts:980-989`) emits that extra CR. `preprocessLines` (`preprocess.ts:101-103`) treats every CR as a line break, and `addLine` only ever appends `\n`, so parser-produced code never contains `\r`. The other pinned rows end in `\n` or are empty, so they already take the `\n` branch.
- failure: `fromMdast` of a code value ending in CR stores a terminator `stringify` reads as content. Serializing that node emits one more CR than the foreign value had, and reparsing splits it into an extra line.
- fix: Append one LF to nonempty admitted code values; projection strips only that carried LF and preserves preceding content CR. Retarget the mdast.test.ts body\r row to body\r\n rather than body\r\r\n, retaining its round-trip assertion and all other rows. Add an admission/stringify regression in mdast.test.ts. Central codemod updates the existing code-newline record; no stringify.ts edit is required.
- seats: part-2/grok-2-12

### req-23 — Cyclic foreign input escapes the Mdast Result/error channel
- file: scratchpad/effected/markdown/Mdast.ts:431
- class: bug   severity: required
- standard: `standards/effect-first-development.md` EF-3 requires synchronous decoding paths to be non-throwing; `Mdast.fromMdastResult` promises a `Result<Root, MdastDecodeError>`. D9 and section 14 permit a verified upstream-bug repair.   evidence: In a read-only `bun -e` probe, `const input = { type: "root", children: [] }; input.children.push(input); Mdast.fromMdastResult(input)` threw **`RangeError: Maximum call stack size exceeded.`** in both the port and the pinned oracle. Normalization recursively maps children before schema decoding can reject the invalid tree. The cycle is not covered by the previous inventory or recorded deviations.
- failure: Malformed foreign input escapes the synchronous API’s `Result` channel. The Effect twin also turns the normalization exception into a defect instead of failing with `MdastDecodeError`.
- fix: Track the current ancestor stack by reference identity during normalization and return a structured MdastDecodeError on back-edges. Preserve shared acyclic subtrees. Keep both Result/Effect APIs in their typed failure channels; add both entry-point regressions and an acyclic-sharing control to mdast.test.ts. Do not use global by-reference marks or a native identity set.
- seats: part-2/sol-2-2

### req-24 — Independent parser depth budgets admit trees rejected by visitor/stringifier
- file: scratchpad/effected/markdown/internal/blockParser.ts:680
- class: bug   severity: required
- standard: The parser/visitor hardening contract at `MarkdownVisitor.ts:108` states that parser-produced trees cannot trip the visitor’s depth guard; the guard uses whole-tree depth and `MAX_NESTING_DEPTH = 256`. D9 and section 14 permit a verified upstream-bug repair.   evidence: A read-only `bun -e` probe parsed `"> ".repeat(254) + "***x***\n"`. In both the port and the pinned oracle, `Markdown.parseResult` returned **`Success`**, but visiting that tree produced a terminal **`NestingDepthExceeded`** event at depth **257**, and stringify failed with **`limit 256, actual 257`**. Block nesting and inline nesting are checked independently; this call restarts inline materialization at depth zero. The primary seat locates the reset at inlineParser.ts:752; the repair home is blockParser.ts before its root return. Part-3 Sol reproduces the same root cause with 200 blockquotes and nested emphasis. The merged fix chooses full-root validation rather than relaxing the serializer’s limit.
- failure: A successful parse can produce a tree that the package’s own visitor truncates and its stringifier rejects. Combined block and inline nesting bypasses the advertised document depth limit even though each pass individually stays within its cap.
- fix: Validate the complete materialized root against MAX_NESTING_DEPTH before blockParser returns, throwing the existing GuardExceeded carrier so the facade reports typed parse failure. Preserve the existing visitor/stringifier whole-tree budget. Add combined block/inline boundary and parse-to-visit/stringify regressions to hardening.test.ts. Do not relax stringify to separate budgets.
- seats: part-2/sol-2-3, part-3/sol-2-2

### req-25 — Positionless mdast lists lose their admitted spread flag
- file: scratchpad/effected/markdown/Mdast.ts:134
- class: bug   severity: required
- standard: D10’s projection fidelity requirement; the mdast admission contract permits missing positions and admits the standard `list.spread` field. D9 and section 14 permit a verified upstream-bug repair.   evidence: A read-only `bun -e` probe admitted a positionless foreign root containing a list with `spread: true` and two ordinary list items. Both the port and the pinned oracle returned **`Success`**, with the decoded list retaining **`spread: true`**, but `Mdast.toMdast(decoded).children[0].spread` returned **`false`**. Admission synthesizes identical sentinel positions for the items, and `listSpread` then derives spread exclusively from their line-number gaps.
- failure: A valid foreign mdast list loses its explicit between-item spacing state during `fromMdastResult → toMdast`. Positionless constructed trees are a supported input, so their supplied semantic field cannot reliably be reconstructed from synthesized positions.
- fix: When item positions are synthetic, preserve the admitted list’s explicit `spread` value. Continue deriving between-item spread from real positions for parsed lists, preserving the existing distinction between item-internal looseness and blank lines between items. Add a positionless `spread: true` round-trip regression and record the verified upstream-bug deviation.
- seats: part-2/sol-2-4

### req-26 — Engine node kinds remain named hand-written literal domains
- file: scratchpad/effected/markdown/internal/blockTypes.ts:52
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains); precedent scratchpad/effected/jsonc/JsoncNode.ts JsoncNodeType = LiteralKit([...])   evidence: blockTypes.ts:52-66 `export type BlockType = "document" | ... | "tableCell"` (14 members, keys of every dialect's construct table and the argument of `addChild`/`makeBlockNode`) and inlineNode.ts:28-40 `export type InlineNodeType` (12 members) are named, reused, hand-rolled literal unions with no schema value. They are consumed only at the type level on mutable engine structures (no `.is`, `Enum`, `$match` or annotation use), which is why I classify this below D11's required bar rather than alongside req-8/req-16; round 1 reviewed both files without raising it. Merger classification: law 19 requires named internal literal domains; especially is not an exemption for domains currently consumed only as types. These named, reused discriminators meet D11 despite both seats labeling them backlog.
- failure: Two named engine literal domains exist only as TypeScript unions; a future runtime guard or annotation over them would have to be hand-written.
- fix: Define annotated LiteralKit values for the existing BlockType members in blockTypes.ts and InlineNodeType members in inlineNode.ts; derive same-name types. Preserve discriminators and constructor signatures. No mutable engine-node schema migration is needed.
- seats: part-2/fable-2-16, part-2/grok-2-17

### req-27 — Serializer rebuilds full Match dispatchers per node
- file: scratchpad/effected/markdown/internal/stringify.ts:656
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); round-1 req-18 precedent (same mechanism in Mdast.ts); law 11 forbids restoring switch   evidence: Read-only Bun 1.4.2 probe: one lab-parsed gfm Root (645,000 bytes, 118,501 nodes) fed to both lab `stringifyTree` and the pinned oracle's (live checkout packages/markdown/src is byte-identical to the oracle, `diff -rq`), 5 warm-ups + 15 runs, two rounds: lab min/median 191.0/198.2 and 199.8/203.6 ms; upstream 58.7/69.4 and 79.0/81.7 ms (2.5-3.3x); outputs identical (`a === b`, 721,499 chars). Mechanism: `serializeInlines` builds `Match.value(child).pipe(Match.discriminator("type")(...) x14, Match.exhaustive)` for every inline child (:656-772) and `serializeBlocks` the same 15-arm chain per block (:1187-1259); `interruptsParagraph` (:1144) and `canJoinWithoutBlank` (:1158) rebuild theirs per call. Micro-timing, 1M dispatches over the 14 inline kinds: per-node chain 557 ns/node vs a module-level `Match.type` dispatcher 38 ns/node; 118k nodes x ~0.5 us is roughly half of the ~130 ms delta. Ruled out: per-character `HashSet.has` in escapeText (14.3 vs 12.8 ns/char for a regex class). Upstream dispatches with `switch` at its :611/:1085/:1109/:1146, which law 11 forbids; the regression comes from where the matcher is built, not from using Match. Sol’s independent 10,000 InlineCode benchmark has identical output: Node medians 12.25 ms lab / 6.33 ms oracle and Bun 20.60 / 9.58 ms. This confirms the same per-node dispatcher defect.
- failure: Serializing a document is 2.5-3.3x slower than upstream for byte-identical output; every node pays ~30 matcher/closure allocations on the module's hottest serialization path.
- fix: Hoist reusable Match.type dispatchers for inline/block serialization, interruptsParagraph and canJoinWithoutBlank, supplying explicit serializer state/context instead of rebuilding captured arms per call. Preserve arm order and output bytes; retain Match rather than switch. Add a bounded regression/benchmark in stringify-scalability.test.ts and recheck the recorded workloads.
- seats: part-3/fable-2-1, part-3/sol-2-8

### req-28 — Serializer restates TableAlign and EmphasisChar domains
- file: scratchpad/effected/markdown/internal/stringify.ts:512
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; round-1 req-28 precedent   evidence: `"*" | "_"` restates `EmphasisChar` (MarkdownNode.ts:350 LiteralKit, type :359) at :512 (`emphasisMarker` fidelity parameter and return), :606 (`JunctionGuard.marker`), :609 (`flipMarker`), :614-618 (`nestedMarker` fidelity and return) and :701 (`let marker: "*" | "_"`); the values flow from `child.markerChar`, which is typed `EmphasisChar | undefined`. The same type-vocabulary duplication occurs for TableAlign at stringify.ts:1046; all EmphasisChar sites and that parameter are merged.
- failure: Six hand-spelled copies of a named literal domain inside one file; the type system cannot tie them to the schema that defines the markers.
- fix: Import existing TableAlign and EmphasisChar types from MarkdownNode.ts; use them in alignCell, emphasisMarker, JunctionGuard, flipMarker, nestedMarker and the local marker binding, retaining null/undefined unions where needed. No runtime or test rewrite.
- seats: part-3/fable-2-3, part-3/fable-2-2

### req-29 — MDX presence classification is an untyped membership table
- file: scratchpad/effected/markdown/internal/stringify.ts:794
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19; AGENTS.md Code Laws (named LiteralKit internal domains and derived `S.is` guards over ad-hoc predicate helpers); round-1 req-8 precedent (MarkdownFormat.ts membership tables)   evidence: `const MDX_NODE_TYPES = HashSet.fromIterable<string>(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm"])` is a named literal domain over MarkdownNodeType members consumed only by `HashSet.has(MDX_NODE_TYPES, node.type)` (:816); the explicit `<string>` parameter widens the table so a misspelled member compiles. This is the exact shape req-8 required MarkdownFormat.ts to replace with LiteralKit domains; `rg -n LiteralKit scratchpad/effected/markdown/internal/stringify.ts` is empty.
- failure: The MDX-presence domain is an untyped membership table plus an ad-hoc `has` predicate rather than a named kit with a derived guard, below the D5 bar the rest of the module now meets.
- fix: Declare a module-local `const MdxNodeType = LiteralKit(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm"])` (annotated with a `$ScratchpadId` composer for this file) and `const isMdxNodeType = S.is(MdxNodeType)`; in `treeContainsMdx` test `isMdxNodeType(node.type)`; delete the HashSet.
- seats: part-3/fable-2-4, part-3/sol-2-15

### req-30 — Marker decoders hand-maintain copies of existing literal schemas
- file: scratchpad/effected/markdown/internal/blocks/list.ts:32
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (derive guards with `S.is(...)` from the schema that models the constraint); AGENTS.md Code Laws; round-1 req-8 precedent; the fix wave's own shape at blocks/atxHeading.ts:27   evidence: Four helpers narrow a matched character into a LiteralKit type by re-spelling its members in nested ternaries: list.ts:32 `bulletCharOf = (char) => char === "-" ? "-" : char === "*" ? "*" : "+"`, list.ts:35 `delimiterOf = (char) => char === "." ? "." : ")"`, fencedCode.ts:14 `fenceCharOf = (char) => char === "`" ? "`" : "~"`, thematicBreak.ts:15 `markerCharOf = (char) => char === "-" ? "-" : char === "_" ? "_" : "*"`. Upstream returned `| undefined` with a guard; the S3 coverage deviations (ledger list.ts:32,35 / thematicBreak.ts:15) made them total by hand instead of deriving from `BulletChar`/`ListDelimiter`/`FenceChar`/`ThematicBreakChar` (MarkdownNode.ts:269/296/242/323). atxHeading.ts:27 already derives `HeadingDepth` the schema way (`Result.getOrThrow(S.decodeUnknownResult(HeadingDepth)(hashes))`).
- failure: Each helper is a parallel, hand-maintained copy of a schema's literal set with a silent default arm; adding or renaming a member in the kit does not fail these sites.
- fix: Hoist S.decodeUnknownResult for BulletChar/ListDelimiter in list.ts, FenceChar in fencedCode.ts and ThematicBreakChar in thematicBreak.ts. Consume regex-guaranteed membership through Result.getOrThrow as atxHeading already does. Preserve grammar and output.
- seats: part-3/fable-2-5

### req-31 — SourceLine is a reusable pure-data interface without a schema
- file: scratchpad/effected/markdown/internal/preprocess.ts:60
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data" (plain interfaces only for service contracts, ports, overload surfaces, type-level machinery); EF-3/EF-12b; round-1 req-34 precedent (DelimiterRun, now `S.Struct` at inlines/emphasis.ts:53)   evidence: `export interface SourceLine { readonly text: string; readonly start: number }` is an exported pure-data record (no methods, no dependency inversion) constructed as object literals at :98/:102/:115 and consumed by frontmatter.ts, phrasing.ts and blockParser; it has no runtime schema, identity or arbitrary. The same class of exported pure-data interface was made required in req-34 and fixed with an annotated `S.Struct` plus same-name type.
- failure: The line-table model disappears at runtime: it cannot be validated, generated for the D10 property floor, or documented through the identity catalog, unlike its sibling DelimiterRun.
- fix: Define identity-annotated SourceLine S.Struct with described text and finite start fields; derive its type and retain literal preprocessing results, NUL normalization and offsets. Add focused schema assertions to internal/Preprocess.property.test.ts; defer broad coverage/canon work.
- seats: part-3/fable-2-6, part-3/sol-2-11

### req-32 — LineColumn result has no executable domain model
- file: scratchpad/effected/markdown/internal/lineIndex.ts:47
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data"; EF-12b; round-1 req-34 precedent   evidence: `export interface LineColumn { readonly line: number; readonly column: number }` is an exported pure-data result returned by `positionAt` (:191) and read by MarkdownNode's `Point` construction; the file already has a `$ScratchpadId` composer and `effect/Schema` imported (:7-10) for `InvalidLineTableError`, yet the data shape it returns stays a TypeScript-only interface.
- failure: The index's output model has no executable schema although the file is already schema-bearing; `Point` (MarkdownNode.ts) and `LineColumn` restate the same line/column fields without a shared building block.
- fix: Define annotated LineColumn S.Struct with described finite line/column fields and derive the same-name type. Preserve positionAt objects/behavior and keep the leaf import direction. Add focused shape/position assertions to line-index.test.ts.
- seats: part-3/fable-2-7, part-3/sol-2-10

### req-33 — ParsedReference result has no executable domain model
- file: scratchpad/effected/markdown/internal/references.ts:373
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data"; EF-2/EF-12b; round-1 req-34 precedent   evidence: `export interface ParsedReference { key; identifier; label; url; title?; length }` is an exported pure-data payload built as a literal at :469-476 (with `O.getSomesStruct` for `title`) and consumed by blocks/linkReferenceDefinition.ts; it is neither a service contract nor type-level machinery and has no schema, identity or arbitrary.
- failure: The parsed-definition model is TypeScript-only: it cannot be validated at the block seam or generated for the D10 property floor, unlike DelimiterRun after req-34.
- fix: Define annotated ParsedReference schema/type with the existing key/identifier/label/url strings, optional-key title and finite length; preserve plain parser results. Add focused result-shape assertions to internal/references.property.test.ts.
- seats: part-3/fable-2-8, part-3/sol-2-12

### req-34 — Frontmatter captures and fence rules lack schema ownership
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:61
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-12b and EF-33.   evidence: `FrontmatterCapture` and `RawFrontmatterCapture` at line 182 remain exported pure-data interfaces. The private `FenceRule` at line 44 is also interface-authored configuration. Adding the `RawNewline` kit did not give these surrounding models schemas.
- failure: The named capture results and fence configuration remain outside schema ownership. Their formats, offsets, line counts and newline-bearing shapes have no executable contracts; the green gates missed these declarations.
- fix: Define annotated schemas and derived types for FrontmatterCapture, RawFrontmatterCapture and FenceRule, preserving optionality, format/newline domains, counts/offsets, object results and null-on-no-capture. Move the existing FrontmatterFormat kit into the internal frontmatter leaf and re-annotate from MarkdownNode.ts to preserve the public export and import direction. Reuse RawNewline. Add focused capture assertions to internal/blocks/frontmatter.property.test.ts.
- seats: part-3/sol-2-13, part-3/fable-2-9

### req-35 — Definition extraction spreads an unbounded segment suffix into arguments
- file: scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:107
- class: bug   severity: required
- standard: D9, D11 and §14 (`upstream-bug`); the facade’s valid-input/no-defect contract.   evidence: A read-only Node v24.20.0 probe called `parseBlocks("[a]: /b\n" + "x\n".repeat(150000))`. The port throws `RangeError: Maximum call stack size exceeded` at this line. Loading the pinned oracle through an in-memory TypeScript loader reproduces the same failure in its `extractDefinitions`.
- failure: One definition followed by a long, shallow paragraph expands approximately 150,000 remaining source segments into native call arguments. Valid Markdown escapes parsing as a defect instead of producing a document. The nesting guard cannot prevent this argument-count overflow.
- fix: Clear the existing segment array and append remaining segments iteratively without unbounded spread, preserving array identity and order. Coordinate with req-40 so suffix rebasing happens once. Add a Node regression in internal/blocks/linkReferenceDefinition.property.test.ts with one definition then a long shallow paragraph.
- seats: part-3/sol-2-1

### req-36 — Serializer double-decodes entity-shaped destinations and titles
- file: scratchpad/effected/markdown/internal/stringify.ts:549
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); the render-equivalence contract in `scratchpad/test/markdown/e2e/stringify-roundtrip.e2e.test.ts`.   evidence: Read-only probes against both implementations parse `[x](a&amp;amp;b "t&amp;amp;")` into URL `a&amp;b` and title `t&amp;`. Serialization emits `[x](a&amp;b "t&amp;")`; reparsing changes them to `a&b` and `t&`. The retained HTML writer and normalizer confirm unequal rendered output.
- failure: `destination` emits decoded ampersands directly, and `titleSuffix` at line 568 protects only backslashes and quotes. Entity-shaped text in decoded destinations or titles is decoded a second time, changing link targets, image sources and titles.
- fix: Encode decoded destinations and titles back into source spelling before applying their surrounding syntax. Protect literal ampersands in both helpers, retain the existing quoting rules, and add link/image/definition regressions.
- seats: part-3/sol-2-3

### req-37 — Decoded code info is interpolated as active fence syntax
- file: scratchpad/effected/markdown/internal/stringify.ts:997
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); fenced-code content and info-string fidelity.   evidence: Both implementations parse `"```&#96;\nx\n```\n"` with language `` ` `` and value `"x\n"`, then serialize it as `"````\nx\n```\n"`. Reparsing produces an unterminated four-backtick block with no language and value `"x\n```\n"`. Separately, language `a&amp;` becomes `a&`, and language `a b` produced by `a&#32;b` becomes language `a` plus metadata `b`.
- failure: Decoded `lang` and `meta` are interpolated directly into fence syntax. Backticks can alter the opening fence, entity-shaped values are decoded again, and decoded whitespace can change the language/metadata boundary.
- fix: Encode decoded language and metadata into valid info-string source, protecting ampersands, backslashes, backticks, line endings and whitespace inside the language token. Add the demonstrated round-trip regressions.
- seats: part-3/sol-2-4

### req-38 — Image alt serialization activates literal inline markup/entities
- file: scratchpad/effected/markdown/internal/stringify.ts:727
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); image-alt render fidelity.   evidence: Both implementations parse `![\*x\* &amp;amp;](u)` with alt text `*x* &amp;`, serialize it as `![*x* &amp;](u)`, and reparse alt text `x &`. The retained HTML writer confirms that the rendered `alt` attribute changes.
- failure: Image-alt serialization escapes only backslashes and brackets. Literal emphasis, code, HTML and entity syntax can become active inline syntax when reparsed, losing characters from the decoded alt text. The full `imageReference` arm repeats the same escaping at line 750. This is distinct from round-1’s repaired alt-flattening defects.
- fix: Serialize decoded alt text with appropriate inline-text escaping in both image arms. Preserve literal markup and entity-shaped text, and add direct-image and full-reference regressions.
- seats: part-3/sol-2-5

### req-39 — Balanced bare destinations can exceed the parser parenthesis cap
- file: scratchpad/effected/markdown/internal/stringify.ts:556
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); `ReferenceScanner.parseLinkDestination`’s explicit 32-level parenthesis limit.   evidence: In both implementations, `[x](<${"(".repeat(33)}x${")".repeat(33)}>)` parses as a link. Serialization removes the angle brackets because `balancedParens` returns true. Reparsing the emitted bare destination produces plain text rather than a link; the retained render-equivalence comparison fails.
- failure: Balanced parentheses are insufficient to make a destination representable in bare form. The serializer ignores the parser’s maximum nesting depth and emits syntax its own parser rejects.
- fix: Keep the angle-bracket form when parenthesis nesting exceeds 32, even when balanced. Add round trips at the 32/33 boundary.
- seats: part-3/sol-2-6

### req-40 — Definition extraction repeatedly copies suffixes and rescans its prefix
- file: scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:105
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: For a paragraph containing `n` consecutive one-line definitions, each extraction calls `sliceWithSegments` over every remaining segment and recreates that suffix. The segment visits sum to Θ(n²). `parent.children.indexOf(block)` also rescans the growing definition prefix. A read-only port probe took approximately 160 ms for 4,000 definitions and 646 ms for 8,000; required severity rests on the algorithmic-class argument, not those timings.
- failure: Definition extraction repeatedly copies and searches progressively smaller/larger arrays for Θ(n) input and output. Large definition sections therefore perform quadratic bookkeeping even after round-1’s `sourceOffsetAt` binary-search repair.
- fix: Track consumed text and the insertion index during extraction; rebase the surviving segment suffix once and avoid repeated paragraph-index searches. Preserve definition order, precedence and positions. Add scaled extraction/position regressions in internal/blocks/linkReferenceDefinition.property.test.ts and source-offsets.test.ts; append iteratively without unbounded argument spreads.
- seats: part-3/sol-2-7

### req-41 — InlineSource remains a pure-data interface without an executable model
- file: scratchpad/effected/markdown/internal/inlineTypes.ts:32
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33; schema-first prompt, “Schema owns pure data.”   evidence: `InlineSource` remains an exported interface containing only text, an offset and source segments. It is the runtime payload passed into inline parsing, but has no corresponding schema or schema-derived type. The recorded schema-first deviation covers other migrated models and grants no exception for this carrier.
- failure: This reusable parser data contract has no executable model, annotations, derived validation or arbitrary generation. The green gates missed the remaining interface-only payload.
- fix: Define an annotated RawInlineSegment schema/type at its existing home in blockTypes.ts. Define InlineSource schema/type in inlineTypes.ts using described text, finite startOffset and an array of that shared schema. Preserve plain parser payloads. Add focused schema assertions in internal/blockTypes.property.test.ts and internal/inlineParser.property.test.ts. g6 reuses this schema without writing either shared file.
- seats: part-3/sol-2-9

### req-42 — Named table-scanner intermediate models lack schemas
- file: scratchpad/effected/markdown/internal/blocks/table.ts:78
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md` EF-12b and EF-33; schema-first prompt, “Schema owns pure data.”   evidence: `RowSource`, `RawCell` at line 85, `ScannedRow` at line 95 and `CellContent` at line 280 are named, reused pure-data interfaces. They carry text, provenance segments, cell offsets and scan results; none has a schema.
- failure: The table scanner’s intermediate data models remain ad-hoc TypeScript shapes despite the explicit requirement to model named and reused intermediate concepts with schemas. These are data carriers rather than scanner service contracts.
- fix: Define annotated schemas/types for RowSource, RawCell, ScannedRow and CellContent in table.ts; reuse the RawInlineSegment schema provided by g3. Preserve optional fields, scanner objects, text/segment provenance, offsets and cell boundaries. Add focused model assertions to internal/blocks/table.property.test.ts; no shared-file edits.
- seats: part-3/sol-2-14

### req-43 — Literal block-opening grammar dispatch remains a conditional ladder
- file: scratchpad/effected/markdown/internal/stringify.ts:379
- class: effect-idiom   severity: required
- standard: AGENTS.md, “Prefer match helpers over conditional chains”; `standards/effect-first-development.md` EF-7; D11.   evidence: `literalLineOpensBlock` replaces the oracle’s character switch with a multi-arm `if`/`else if` dispatch over finite marker cases. The green switch/law gates accept this conditional ladder. Round-1’s corresponding finding concerned `inlineParser.materializeNode`, not this function.
- failure: Clearing the native-switch prohibition left finite grammar dispatch in the conditional-chain form rejected by the binding Effect idiom.
- fix: Express the marker cases with a reusable Match dispatcher and a false fallback. Preserve the current predicates and escaping behavior.
- seats: part-3/sol-2-16

### req-44 — Invalid declaration prefixes trigger quadratic closer searches
- file: scratchpad/effected/markdown/internal/inlines/rawHtml.ts:60
- class: perf   severity: required
- standard: D11’s measured-regression and algorithmic-class criteria; D9 and section 14 permit correcting this port-introduced regression.   evidence: The added `["<!", ">"]` precheck calls `scanner.hasAhead(">")` for every `<!` prefix, including invalid declarations such as `<!0`. `hasAhead` caches only unsuccessful searches, so a distant `>` causes every invalid opener to search the remaining suffix again. A read-only probe of the pinned lab and oracle constructs on `"x " + "<!0".repeat(n) + ">"`, using an equivalent instrumented forward search, counted **6,304 / 24,896 / 98,944** examined characters for **64 / 128 / 256** lab openers; the oracle made **zero** closer searches and rejected each opener directly through the regex. Full `parseBlocks` probes confirmed identical output. After one warm-up, median times over five calls were **21.94 / 3.55 ms** at 4,000 openers, **79.76 / 8.99 ms** at 16,000, and **139.01 / 12.68 ms** at 32,000, for lab/oracle respectively.
- failure: A paragraph containing invalid declaration prefixes and one final `>` gains Θ(n²) closer-search work where the oracle rejects those prefixes in Θ(n) total work. The recorded missing-declaration-closer optimization does not cover this case: the existing regression tests use valid `<!A` prefixes with no closer.
- fix: Apply the declaration closer precheck only when the opener matches the declaration grammar’s `<![A-Za-z]` prefix. Retain the separate comment, processing-instruction, and CDATA checks. Add an invalid-prefix regression with a distant `>` that verifies no declaration closer searches occur and preserves the parsed text.
- seats: part-4/sol-2-1, part-4/grok-2-1

### req-45 — Link parser independently spells the ReferenceType domain
- file: scratchpad/effected/markdown/internal/inlines/link.ts:297
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; `S.Literals` only for anonymous unions never referenced by name); AGENTS.md Code Laws ("Prefer named schema building blocks ... named LiteralKit internal domains"); round-1 precedent req-28 (table.ts restating `TableAlign` inline was required). D11 law violation with a cited standard.   evidence: link.ts:297 `let referenceType: "shortcut" | "collapsed" | "full" = "shortcut";` restates by hand the named domain `ReferenceType = LiteralKit(["shortcut", "collapsed", "full"])` exported from MarkdownNode.ts:159 with its same-name type at :168; the value is assigned to `node.data.referenceType` whose declared type is already `ReferenceType` (inlineNode.ts:53). The same file's sibling emphasis.ts:139 already does this correctly (`markerCharOf = (cc): EmphasisChar => ...`). `rg '"shortcut" \| "collapsed" \| "full"' scratchpad/effected/markdown` finds link.ts:297 as the only hand-rolled copy. None of the four beep laws run by `lint` detects an inline type-level union, so the gate cannot catch it.
- failure: A second, unlinked spelling of the reference-type domain lives in parser logic: adding or renaming a member in `ReferenceType` leaves this annotation stale, and the restated union bypasses the kit's identity and annotations.
- fix: Add `import type { ReferenceType } from "../../MarkdownNode.ts";` next to the existing imports (mirrors emphasis.ts:19) and change :297 to `let referenceType: ReferenceType = "shortcut";`. No runtime change; no test adjustment.
- seats: part-4/fable-2-7

### req-46 — DelimiterRun admits impossible zero, fractional and negative lengths
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:54
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Precision carries invariants" ("Replace broad primitives with the real domain where the domain is narrower: ... finite or integral numbers, ranges"; "Prefer built-in schemas and checks before custom filters"); standards/effect-laws-v1.md law 17 (named domain constraints modeled as schemas with built-in checks); crispen at ultra (invariants absorbed into schemas, §12.1). D11 schema-idiom violation with a cited standard.   evidence: `numdelims: S.Finite.annotateKey({ description: "Length of the delimiter run in UTF-16 code units." })` admits `-3`, `0` and `2.5`, none of which is a run length. The producer makes the invariant explicit: scanDelims returns `O.none()` at :105-108 when `numdelims === 0` and otherwise counts whole UTF-16 units, so every `O.some` carries an integer >= 1; the consumer `handleDelim` adds it to `scanner.pos` (:149). The only test of the domain, scratchpad/test/markdown/delimiter-run.test.ts:62-68, proves string/boolean/Infinity rejection but cannot prove `0` or `1.5` rejection because the schema accepts them, and the D10 round-trip property at scratchpad/test/markdown/internal/inlines/emphasis.property.test.ts:85 therefore generates impossible runs. This does not conflict with the schemaNumber/S.Finite ruling (round-1 reject-1): the rule's own preview (~/YeeBois/references/effect/effect-tsgo/docs/rules/schema-number.md, `integer: Schema.Number.check(Schema.isInt())`) is accepted, and the installed effect exports `S.Int` (Schema.d.ts:6123) and `S.isGreaterThanOrEqualTo` (:5998).
- failure: The schema that round 1 introduced as the source of truth for the measurement (req-34) is wider than the measurement: `DelimiterRun.make({ numdelims: 0, canOpen: true, canClose: false })` and fractional or negative lengths decode successfully although no scan can produce them, so the runtime validator and derived arbitrary do not describe the domain.
- fix: Constrain numdelims to S.Int.check(S.isGreaterThanOrEqualTo(1)), preserving meaningful field metadata. Add zero, negative and fractional rejection cases to delimiter-run.test.ts. Preserve scanDelims behavior; existing Arbitrary-derived tests follow the new checks. Central codemod records numeric-domain tightening.
- seats: part-4/fable-2-8

## Backlog

### back-1 — DocumentSection schema migration needs a concrete compatibility design
- file: scratchpad/effected/markdown/MarkdownDocument.ts:119
- class: schema   severity: backlog
- standard: standards/ARCHITECTURE.md principle 5 'Schemas Are Executable Contracts'; standards/schema-first-development-prompt.md 'Schema owns pure data'; section 14 (a proposed deviation without a law-forced cause is backlog)   evidence: `DocumentSection` is a plain class carrying six readonly data fields (heading, depth, range, children, text, bodyRange) plus a private `#documentSource` and two derived getters, constructed with `new DocumentSection({...})` at line 743. Its three sibling navigation payloads (`DocumentHeading`, `DocumentLink`, `SectionQueryOptions`) received schemas in round 1 (req-7); this one was left out, presumably because of the private source field, and the Port notes do not record a rationale.
- failure: The only navigation model without an executable schema: no `Arbitrary`, equivalence or encode/decode derivation, and the D10 round-trip floor cannot cover it. Converting changes construction (`.make`) and the `source` getter's relationship to a stored field, so it is not behaviour-preserving without a recorded deviation.
- fix: Either model it as `S.Class<DocumentSection>($I`DocumentSection`)({ heading: Heading, depth: HeadingDepth, range: MarkdownRange, children: S.Array(FlowContent), text: S.String, bodyRange: MarkdownRange, documentSource: S.String })` keeping the `source`/`body` getters and constructing via `.make`, recorded under the schema-first deviation entry; or record in Port notes → Deviations why this model stays a plain class.
- seats: part-1/fable-2-7, part-1/grok-2-12
- disposition: Private source state and navigation getters require a representation/constructor compatibility design; the reports propose a public-shape deviation without proving it necessary. Retain as the seats’ schema-design backlog under section 14.

### back-2 — Parse option defaults live in call-site fallbacks
- file: scratchpad/effected/markdown/Markdown.ts:236
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 13 (prefer schema defaults and transformations over ad-hoc fallback logic); AGENTS.md 'Apply schema defaults when safe'; D9 (changing `.make({})` output is a section-14 deviation)   evidence: The public parse defaults live in two `??` helpers, `dialectOf` (236) and `frontmatterOf` (244), while `MarkdownParseOptions` (98-101) declares both fields `S.optionalKey` with no default; `MarkdownFormattingOptions` re-spreads the same optional pair into a fresh `MarkdownParseOptions` at MarkdownFormat.ts:803-806. Upstream is identical, so no behaviour divergence exists today.
- failure: Defaults are enforced by call-site fallbacks rather than the schema, so a consumer decoding or constructing options cannot observe the `gfm`/`false` defaults through the schema; applying `withConstructorDefault` would change the encoded shape of `.make({})`, so this needs a law:13 deviation entry, not a silent change.
- fix: Introduce a resolved-options schema (`S.Struct({ dialect: MarkdownDialect, frontmatter: S.Boolean })` with `S.withDecodingDefault`s) that `MarkdownParseOptions` decodes into, derive `dialectOf`/`frontmatterOf` from it, and record the law:13 deviation if the constructor output changes; otherwise leave as is.
- seats: part-1/fable-2-8
- disposition: Optional-field construction/encoding would change; the preference does not establish that the proposed public transformation is safe or forced (D9/section 14).

### back-3 — Diagnostic annotation contains TSDoc reference residue
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:94
- class: docs   severity: backlog
- standard: standards/effect-first-development.md EF-12 / 'meaningful annotation metadata via `$I.annote`'; .patterns/jsdoc-documentation.md 'Described links' (TSDoc link syntax is a doc carrier, not prose)   evidence: The runtime description string reads `"One structured diagnostic: its (MarkdownParseErrorCode:type), a human-readable `message`…"` — the TSDoc declaration-reference `{@link (MarkdownParseErrorCode:type)}` from the class JSDoc was copied into the schema annotation with the braces stripped, leaving the bare `(MarkdownParseErrorCode:type)` token in catalog/docgen output.
- failure: The schema's description annotation contains TSDoc link syntax residue and reads as broken prose wherever annotations are rendered.
- fix: Change the annotation text to `"…its MarkdownParseErrorCode, a human-readable `message`…"`.
- seats: part-1/fable-2-9, part-1/grok-2-11
- disposition: Documentation/annotation prose is deferred; no executable schema defect.

### back-4 — SectionQueryOptions field uses export-style documentation tags
- file: scratchpad/effected/markdown/MarkdownDocument.ts:343
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md 'Category annotation' (categories describe an exported symbol's role) and 'Tag order' (tags are for exported symbols)   evidence: The `depth` field inside the `SectionQueryOptions` `S.Struct` carries a full export-style JSDoc block with `**Details**`, `@category type-level` and `@since 0.0.0` (343-354) although it is a runtime struct field, not an export, and `type-level` is the wrong role for a schema field; the same prose is already carried by the field's `annotateKey` description and belongs in the exported schema's Details.
- failure: Docgen/category tooling sees an export-style block on a non-export with a misleading category; readers get the field's semantics in three places.
- fix: Drop the `@category`/`@since` tags from the field block (keep a one-line comment or move the 'equality, not a maximum' prose into `SectionQueryOptions`'s **Details**).
- seats: part-1/fable-2-10
- disposition: Documentation/JSDoc work is deferred.

### back-5 — RegExp matcher uses instanceof rather than Predicate.isRegExp
- file: scratchpad/effected/markdown/MarkdownDocument.ts:832
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws 'Prefer effect helper modules over native helpers'; standards/effect-laws-v1.md law 5 (Predicate guards over native type tests, by extension)   evidence: `sectionByHeading` discriminates the matcher with `match instanceof RegExp`; `effect/Predicate` exports `isRegExp` (node_modules/effect/dist/Predicate.d.ts:1618) and the file already imports `P` (line 34) and uses `P.isString` on the previous branch. Upstream is identical; no runtime difference.
- failure: A native `instanceof` type test sits beside Effect predicate guards in the same expression; no observable behaviour difference.
- fix: Replace `match instanceof RegExp` with `P.isRegExp(match)`.
- seats: part-1/fable-2-11
- disposition: The cited typeof law does not ban instanceof; behavior-identical stylistic preference outside D11.

### back-6 — Adjacent array checks mix native and Effect helpers
- file: scratchpad/effected/markdown/MarkdownFormat.ts:974
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form, shared helpers already in scope); AGENTS.md 'Prefer effect helper modules over native helpers'   evidence: Line 972 uses `A.some(ancestry, …)` while the next statement (974) uses the native `ancestry.some(…)` on the same array; `A` is imported at line 33. No runtime difference.
- failure: Mixed native/Effect collection helpers on adjacent lines over the same value; no observable failure.
- fix: Use `A.some(ancestry, (ancestor) => isNoMultilineAncestor(ancestor.type))`.
- seats: part-1/fable-2-12
- disposition: Behavior-identical helper consistency without a demonstrated hard-law or semantic violation; outside D11.

### back-7 — Resolver field comment formatting and non-export tags are inconsistent
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:67
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md 'TSDoc grammar' / 'Tag order' (tags belong to exported symbols); formatting consistency with every other block in the module   evidence: The schema-field JSDoc blocks close with a `*/` indented one tab short of their opening (`\t*/` instead of `\t */`) at lines 67, 97, 130, 166, 172, 238, 244, 330, 381 and 387, and each carries `@since 0.0.0` on a non-exported struct field; every class-level block in the file is aligned correctly. No gate in the list formats JSDoc.
- failure: Cosmetic: misaligned comment terminators and export-only tags on fields; no behavioural or docgen failure.
- fix: Align the closing ` */` and drop `@since` from the field blocks (the `annotateKey` descriptions already carry the prose).
- seats: part-1/fable-2-13
- disposition: Documentation/JSDoc work is deferred.

### back-8 — Frontmatter set normalizes a CRLF block to LF
- file: scratchpad/effected/markdown/Frontmatter.ts:426
- class: docs   severity: backlog
- standard: `MarkdownFrontmatter.set` Details (lines 558-562) and the FrontmatterSource fidelity contract (FrontmatterSource.ts:67-70, 'newline is a fidelity field'); D9 (upstream identical, so a change needs a recorded deviation)   evidence: `renderBlock` always joins the fences and body with `\n` (`${open}\n${normalized}${close}`), so `set` on a CRLF document whose capture spans `---\r\n…\r\n---` replaces the block with LF-terminated lines, yielding mixed line endings inside the file, whereas `FrontmatterSource.join` reproduces the fence terminator the scanner recorded. Re-parse is still correct (the parser normalises terminators); upstream behaves identically.
- failure: Fidelity gap, not a correctness bug: a CRLF document gets an LF-terminated frontmatter block after `set`, and the `set` documentation does not say so.
- fix: Document the LF normalisation in `set`'s **Details**, or thread the capture's terminator (the scanner already records it for `FrontmatterSourceBlock.newline`) into `renderBlock` under a recorded deviation.
- seats: part-1/fable-2-14
- disposition: Documentation clarification is deferred; source matches upstream and no verified bug or mandatory law cause is shown.

### back-9 — Formatter property inputs omit adjacency/code-point hazards
- file: scratchpad/test/markdown/MarkdownDocument.property.test.ts:46
- class: test   severity: backlog
- standard: D10 (formatter idempotence and fidelity properties).   evidence: `sampleSource` always separates blocks with `\n\n`, uses only BMP words, and never builds a marker-only nested list, an unclosed fence, a CR terminator, a trailing setext hash, or an interrupting ATX heading. The property at line 67 can stay green while grok-2-1 through grok-2-6 change the tree.
- failure: The formatter fidelity property does not generate the block-boundary or code-point inputs those bugs need.
- fix: After those fixes land, extend `Sample` with an optional blank-line separator, a container prefix, a CR terminator, a trailing hash, and an astral neighbour, and keep the semantic-retention assertion.
- seats: part-1/grok-2-13, part-1/fable-2-15
- disposition: Coverage/property-floor work is deferred; required bugs still own focused regressions.

### back-10 — Inline materialization still has unmeasured constant-factor allocation
- file: scratchpad/effected/markdown/internal/inlineParser.ts:682
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; neither here); law 21   evidence: inlineParser.ts:682 `this.materializeNode({ ...node, type: node.type }, depth)` shallow-copies all ten InlineNode fields for every non-text inline node purely to coerce the type to `MaterializableInlineNode` (TS does not narrow a non-union interface through `node.type !== "text"`); :690 then calls `materializeInlineNode(node)` which, per the req-17 shape, allocates a curried builder closure per node and dispatches through eleven `Match.when({ type: ... })` object-pattern arms rather than `Match.discriminator("type")` (the form Mdast.ts:145 uses). Upstream's switch allocated nothing per node (oracle inlineParser.ts:540). Constant-factor only; not measured.
- failure: Three avoidable per-node allocations/scans on the inline materialization path for identical output.
- fix: Add `const isMaterializable = (n: InlineNode): n is MaterializableInlineNode => n.type !== "text"` and branch on it instead of spreading; build the dispatcher with `Match.discriminator("type")` arms; pass position/materializeChildren as arguments (e.g. dispatch on a small `{ node, position, materializeChildren }` record) so no closure is created per node.
- seats: part-2/fable-2-13, part-2/grok-2-14
- disposition: No measurement or algorithmic-class improvement; D11 performance threshold is not met.

### back-11 — Parent/tail invariants use untyped Option defects
- file: scratchpad/effected/markdown/internal/blockParser.ts:373
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 7 intent (typed errors on production failure paths); the file's own convention (BlockParserError at :193, :201, :678); law 21   evidence: blockParser.ts:373 `this.oldtip = O.getOrThrow(O.fromUndefinedOr(parent))` and :429 `container = O.getOrThrow(O.fromUndefinedOr(container.parent))`, and inlineParser.ts:379 `O.getOrThrow(O.fromUndefinedOr(this.root.lastChild))`, replace upstream's `parent ?? this.doc` (oracle blockParser.ts:342, :399). `O.getOrThrow` throws Effect's anonymous native `Error` on the none branch while every other invariant in these files throws a tagged `BlockParserError`. The branches are unreachable (every matched container has a parent; unputText pre-checks availability), so no observable failure today. Read-only history locates the parent/tail getOrThrow replacements in cf2c19c76b (S3); its diff replaces parent ?? this.doc and the pre-checked lastChild false return. fff7ed559c, 9d65f84ed2 and 3f4355796d did not introduce those replacements. Section 11.3 forces simplifying branches unreachable by construction.
- failure: An invariant trip would surface as an untagged native Error from inside effect/Option instead of the module's tagged invariant error, inconsistent with the sibling sites and with the tagged-errors deviation the module recorded.
- fix: Retain the contract-forced simplification. If a reachable failure is demonstrated later, use an appropriate tagged error without altering the valid-tree path. Any deviation recording remains central; do not call this an unforced upstream restoration.
- seats: part-2/fable-2-14, part-2/grok-2-15
- disposition: Neither seat demonstrates a reachable failure. The S3 simplification is forced by section 11.3, so the unforced-restore rule does not apply; typed-invariant consistency is backlog.

### back-12 — Mdast foreign-record predicate has a behavior-identical simplification
- file: scratchpad/effected/markdown/Mdast.ts:347
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form); round-1 back-5 (same predicate triple, classified backlog)   evidence: Mdast.ts:347-348 `isRecord = P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)`; `P.isObjectKeyword` admits functions (hence the subtraction) while `P.isObjectOrArray` (node_modules/effect/dist/Predicate.d.ts:1138) is exactly upstream's `typeof value === "object" && value !== null` (oracle Mdast.ts:309-310). Behaviour-identical.
- failure: Three predicates express a guard two express; same site class as the recorded back-5 in FrontmatterResolver.ts.
- fix: `const isRecord = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value) && !A.isArray(value);`
- seats: part-2/fable-2-15, part-2/grok-2-16
- disposition: Helper terseness only, without semantic or hard-law defect.

### back-13 — Registry/parser JSDoc section spacing is inconsistent
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:168
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md "Description and section grammar" (sections are distinct, ordered blocks); docgen passed, so cosmetic   evidence: blockRegistry.ts:165-169 runs the **Gotchas** prose straight into `**Example** (Inspect the CommonMark start order)` with no blank line; blockParser.ts:697-698 closes the Example fence and starts `@category schemas` on the next line; blockParser.ts:727-728 runs the **Details** paragraph into `**Example** (Parse a heading with the block engine)` without a separator. Every other block in the module separates sections with a blank ` *` line.
- failure: Three doc blocks render their section boundaries as one paragraph in editors that do not special-case bold markers; inconsistent with the module's own formatting.
- fix: Insert the missing ` *` separator line before `**Example**` at blockRegistry.ts:169 and blockParser.ts:728, and between the closing fence and `@category` at blockParser.ts:698.
- seats: part-2/fable-2-17
- disposition: Documentation/JSDoc work is deferred.

### back-14 — Record removal of the unreachable fence-character refusal
- file: scratchpad/effected/markdown/internal/blocks/fencedCode.ts:42
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream `fenceCharOf` returns `undefined` for any char other than `` ` `` or `~`, and the trigger returns 0. The port maps every other char to `"~"` and drops that return. `reCodeFence` only matches those two characters, so the branch is unreachable and opening behaviour is unchanged. `w2-markdown.deviations` records the same class of simplification for `list.ts`, `table.ts`, `thematicBreak.ts`, `lineIndex.ts`, and `phrasing.ts`, and has no `fencedCode.ts` row. Read-only history: cf2c19c76b makes fenceCharOf total and deletes its unreachable refusal after reCodeFence. Section 11.3 forces the unreachable-source simplification.
- failure: The unreachable fence-character refusal was removed and not recorded, so the ledger does not show that this control-flow deletion preserves behaviour.
- fix: Central bookkeeping may record this section-11.3 simplification; no repair group may write PORT_LEDGER.json or README Port notes. Retain the forced source change.
- seats: part-3/grok-2-1
- disposition: outside the port's write surface; documentation/coverage bookkeeping is deferred, not one of the enumerated law-forced systemic recording classes.

### back-15 — Record removal of the unreachable empty-meta guard
- file: scratchpad/effected/markdown/internal/blocks/code.ts:72
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream sets `meta` only when `meta.length > 0`. The port always assigns `unescapeString(meta)`. `firstLine` is already `trim`med, and `wordEnd` is the first `[ \t]`, so the suffix cannot be only whitespace. No `code.ts` coverage row exists in `w2-markdown.deviations`. Read-only history: cf2c19c76b removes the meta.length guard; the trimmed-firstLine/wordEnd checks guarantee the suffix exists on this branch. Section 11.3 forces the unreachable-source simplification.
- failure: The empty-meta guard was removed and not recorded. An empty `meta` key is not emitted for any reachable info string, but the ledger does not say so.
- fix: Central bookkeeping may record this section-11.3 simplification; no repair group may write PORT_LEDGER.json or README Port notes. Retain the forced source change.
- seats: part-3/grok-2-2
- disposition: outside the port's write surface; documentation/coverage bookkeeping is deferred, not a required restoration.

### back-16 — Record collapse of the redundant destination end check
- file: scratchpad/effected/markdown/internal/references.ts:266
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream advances one, then advances again only when `peek() !== -1`. The port always does `this.pos += 2`. The branch is entered only after `reEscapable.test(charAt(pos + 1))`, and `ESCAPABLE` is a one-character class, so a following BMP punctuation character exists and the second advance always happens. No `references.ts` coverage row exists in `w2-markdown.deviations`. Read-only history: aab5a5da24 replaces guarded destination advances with pos += 2; the escapable-character precondition proves the next character exists. Section 11.3 forces the unreachable-source simplification.
- failure: The unreachable end-of-subject check was collapsed and not recorded, so the ledger does not show that destination scanning is unchanged.
- fix: Central bookkeeping may record this section-11.3 simplification; no repair group may write PORT_LEDGER.json or README Port notes. Retain the forced source change.
- seats: part-3/grok-2-3
- disposition: outside the port's write surface; documentation/coverage bookkeeping is deferred, not a required restoration.

### back-17 — Inline dialect lookup could use getOrThrowWith directly
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:147
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent Effect helper form); round-1 back-5 classification for law-21 items   evidence: `const found = O.getOrUndefined(HashMap.get(dialects, dialect)); if (found === undefined) { throw UnknownInlineDialectError.make({...}); } return found;` reimplements `O.getOrThrowWith` (installed node_modules/effect/dist/Option.d.ts:1259, dual) with an undefined sentinel.
- failure: No runtime difference; four lines and a nullish sentinel express what one helper call expresses.
- fix: `export const inlineDialect = (dialect: InlineDialectName): InlineDialect => O.getOrThrowWith(HashMap.get(dialects, dialect), () => UnknownInlineDialectError.make({ message: `unknown markdown dialect: ${dialect}` }));`
- seats: part-3/fable-2-10
- disposition: Equivalent helper shortening without observable defect; outside D11.

### back-18 — Total list-marker values still pass through Option spreads
- file: scratchpad/effected/markdown/internal/blocks/list.ts:62
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21; EF-2 (Option only where absence exists)   evidence: `...O.getSomesStruct({ bulletChar: O.fromUndefinedOr(bulletChar) })` where `bulletChar` is `BulletChar` (never undefined since `bulletCharOf` became total under the S3 coverage deviation at list.ts:32); the same at :73 for `delimiter` (`delimiterOf` is total). Upstream wrapped these because its helpers returned `| undefined`; the lab kept the wrapper after removing the absence.
- failure: An Option round trip on a value that is always present; `getSomesStruct` always yields `{ bulletChar }`.
- fix: Write `bulletChar,` at :62 and `delimiter,` at :73 (ListData's keys are optional, so the literal types are unchanged); drop the two spreads.
- seats: part-3/fable-2-11
- disposition: Equivalent helper shortening without observable defect; outside D11.

### back-19 — Segment binary search retains an unreachable undefined guard
- file: scratchpad/effected/markdown/internal/segments.ts:56
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3 (an unreachable branch is a finding against the source); the lab's own lineIndex.ts:182 fix (`A.getUnsafe`) for the same shape   evidence: `const segment = segments[mid]; if (segment !== undefined && !(textIndex < segment.textOffset))` with `0 <= low <= mid < high <= segments.length` on a dense array: `segment` is never undefined, so the false outcome of the first operand cannot occur. The coverage gate reports 100% branches because v8/istanbul counts a `&&` operand as covered when it is evaluated, not when both outcomes occur; the gate cannot see this.
- failure: A guard that never fires survives per-file 100% coverage, contradicting the section 11.3 clean-up applied to lineIndex.ts in the same wave.
- fix: `const segment = A.getUnsafe(segments, mid); if (!(textIndex < segment.textOffset)) {` (import `* as A from "effect/Array"`); the NaN comment and the `segments[low - 1]` fallback at :62-63 stay (that one is reachable).
- seats: part-3/fable-2-12
- disposition: Coverage-stage source cleanup is deferred.

### back-20 — Frontmatter line loops retain unreachable undefined checks
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:117
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3; lineIndex.ts:182 precedent   evidence: :116-118 `const line = lines[index]; if (line === undefined || line.text !== rule.close) continue;` with `1 <= index < lines.length`, and :123-127 `const current = lines[inner]; const next = lines[inner + 1]; if (current === undefined || next === undefined) break;` with `1 <= inner < index < lines.length` (so `inner + 1 <= index`): neither undefined outcome is reachable on the preprocessor's dense array. Evaluation-based branch counting hides both.
- failure: Two never-taken guards remain after the S3 unreachable-branch pass.
- fix: Use `A.getUnsafe(lines, index)`, `A.getUnsafe(lines, inner)` and `A.getUnsafe(lines, inner + 1)` and delete the undefined checks.
- seats: part-3/fable-2-13
- disposition: Coverage-stage source cleanup is deferred.

### back-21 — Mandatory footnote capture retains a redundant undefined check
- file: scratchpad/effected/markdown/internal/blocks/footnoteDefinition.ts:143
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3   evidence: `const rawLabel = found?.[1]; if (found === null || rawLabel === undefined) return 0;` — `reFootnoteDefinition` (:56) has one mandatory capture `([^\]\0\t\n\r ]+)`, so whenever `found !== null`, `found[1]` is a non-empty string; the `rawLabel === undefined` outcome is unreachable, and the optional chain's short-circuit only mirrors the `found === null` test.
- failure: A fixed-outcome guard survives the 100% gate (operand evaluated, outcome never true).
- fix: `if (found === null) return 0; const rawLabel = A.getUnsafe(found, 1);` (RegExpExecArray is an Array<string>).
- seats: part-3/fable-2-14
- disposition: Coverage-stage source cleanup is deferred.

### back-22 — HTML block-close lookup retains dead fallbacks
- file: scratchpad/effected/markdown/internal/blocks/htmlBlock.ts:68
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3   evidence: `return reHtmlBlockClose[type]?.test(rest) ?? false;` after :65 has established `1 <= type <= 5` against a six-entry table (:34), so the `?.` short-circuit and the `?? false` arm cannot occur; branch coverage counts them as covered because they are evaluated.
- failure: Two dead fallback arms on the block-close test.
- fix: `return A.getUnsafe(reHtmlBlockClose, type).test(rest);`
- seats: part-3/fable-2-15
- disposition: Coverage-stage source cleanup is deferred.

### back-23 — Reference header still describes a native Map
- file: scratchpad/effected/markdown/internal/references.ts:23
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.1 (carried prose must stay true after a law-driven change); round-1 back-8/back-10/back-11 classification for stale headers   evidence: Port note 2 (:21-23) still says "the map is keyed through a real `Map`" while the definition index is now `HashMap`/`S.HashMap` with `definitionOrder` (ledger native-runtime deviation; inlineTypes.ts:154 `refmap: HashMap.HashMap<string, Definition>`).
- failure: The header documents a representation the port no longer has.
- fix: Reword to "...the caller decides what to do with the result, and the index is an Effect `HashMap` keyed by the normalized label (plus an explicit document order)."
- seats: part-3/fable-2-16
- disposition: Documentation work is deferred; the actual recorded collection replacement is not shown wrong here.

### back-24 — Reference scanner duplicates ESCAPABLE
- file: scratchpad/effected/markdown/internal/references.ts:29
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Discovery & Reuse (search live source before recreating a shared constant); law 21   evidence: `const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";` is byte-identical to the exported `ESCAPABLE` in unescape.ts:31, which this file already imports from (:26 `unescapeString`) and which blocks/table.ts:55 imports for the same purpose. Upstream carries the same duplication; D9 does not require keeping a duplicated constant.
- failure: Two definitions of the spec's escapable set that can drift silently.
- fix: `import { ESCAPABLE, unescapeString } from "./unescape.ts";` and delete the local constant (no cycle: unescape.ts imports only entities.ts).
- seats: part-3/fable-2-17
- disposition: Behavior-identical reuse cleanup without demonstrated defect; outside D11.

### back-25 — LineIndex Gotchas contradict actual constructor checks
- file: scratchpad/effected/markdown/internal/lineIndex.ts:129
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (Gotchas hold accurate, non-obvious information); section 10.1 carried prose stays true   evidence: The `fromLineStarts` Gotchas say "`starts` must be ascending and begin at 0; a table that is neither is a wiring bug and dies as a defect." and immediately after "The constructor checks that the table is non-empty and begins at zero; the caller is responsible for ensuring ascending order." The two sentences contradict each other on ascending order, and "dies as a defect"/"wiring bug" predates the tagged `InvalidLineTableError` the code throws (:149) and the `@throws` tag that already names it.
- failure: A reader cannot tell from the block whether a non-ascending table throws (it does not).
- fix: Replace both sentences with one: "`starts` must be non-empty and begin at 0 (checked; `InvalidLineTableError` otherwise) and ascending (not checked; the caller's responsibility)."
- seats: part-3/fable-2-18
- disposition: Documentation/JSDoc work is deferred.

### back-26 — Depth-limit prose incorrectly promises guarded schema decoding
- file: scratchpad/effected/markdown/internal/limits.ts:11
- class: docs   severity: backlog
- standard: D11’s backlog classification for documentation improvements; evidence from the actual schema implementation.   evidence: The Details section says recursive `MarkdownNode` schema decoding trips this guard. `MarkdownNode.ts` contains no reference to `MAX_NESTING_DEPTH` or a depth check. A read-only `S.decodeUnknownResult(MarkdownNode)` probe successfully decoded 300 nested plain blockquote objects, exceeding the documented limit of 256.
- failure: The documentation gives callers a depth-safety guarantee that schema decoding does not provide. Parser and serializer guards do not establish that guarantee for direct schema admission.
- fix: Describe the actual parser and serializer guard sites and remove the claim about guarded schema decoding.
- seats: part-3/sol-2-17
- disposition: Documentation is deferred; evidence disproves the prose, not an executable admission contract requiring a new guard.

### back-27 — Eight exported inline doc blocks contain empty Details sections
- file: scratchpad/effected/markdown/internal/inlines/codeSpan.ts:22
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Description and section grammar”: every section must be non-empty, and empty sections must not be added merely to fill out the shape; D11 includes JSDoc-law breaks as required.   evidence: Inspection of Git objects at `a12bef261998d2ad92153dada46373be06950692` found `**Details**` immediately followed by an Example section or tags, with no intervening content, at `codeSpan.ts:22`, `emphasis.ts:64`, `emphasis.ts:176`, `entity.ts:21`, `escape.ts:20`, `footnoteReference.ts:64`, `footnoteReference.ts:141`, and `lineBreak.ts:24`. These concrete grammar violations remain in the supplied docgen-green commit, demonstrating that the gate missed them. They are distinct from round one’s closed missing-example/category/since findings.
- failure: Eight exported documentation blocks contain empty Details sections, violating the binding grammar and leaving empty headings in documentation and IDE hovers.
- fix: Remove the eight empty `**Details**` headings and their padding. Preserve the lead descriptions, examples, and tags.
- seats: part-4/sol-2-2, part-4/grok-2-2, part-4/fable-2-1, part-4/fable-2-2, part-4/fable-2-3, part-4/fable-2-4, part-4/fable-2-5, part-4/fable-2-6
- disposition: All eight sites share the empty-section conversion defect. Documentation/JSDoc is backlog under this merge request even when it demonstrates a docgen gate miss.

### back-28 — Link-close domain results still use undefined sentinels
- file: scratchpad/effected/markdown/internal/inlines/link.ts:261
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-2 "Absence is Option" ("Inside domain code, avoid `| null` and `| undefined`"); round-1 req-35 applied the same rule to scanDelims.   evidence: Inside `makeLinkCloseConstruct.parse`: `let title: string | undefined` (:261), `let identifier: string | undefined` (:295), and the inline-link grammar closure passed to `withReferenceScanner` returns `undefined` on failure (:271, :280) so `inline` is `{...} | undefined` and is branched on at :286. These are internally produced domain results, not boundary input. Backlog rather than required because the sentinel originates in the `references.ts` contracts this part does not own (`parseLinkDestination(): string | undefined` at references.ts:250, `parseLinkTitle()` at :312), round 1 reviewed this file and accepted the method-local shape, and no observable failure follows.
- failure: Absence inside the close-bracket handler is modelled with `undefined` sentinels and `=== undefined` branches rather than `Option`, inconsistent with the Option-returning `scanDelims` the same module now exposes.
- fix: Have the `withReferenceScanner` callback return `O.Option<{ destination: string; parsedTitle: O.Option<string> }>` (`O.none()` at :271/:280, `O.some(...)` at :283, wrapping `parseLinkTitle()` with `O.fromUndefinedOr`), then `O.match` at :286; type `title`/`identifier` as `O.Option<string>` and set `node.data.title` via `O.map`/`O.getOrUndefined` at :360. Coordinate with the owner of references.ts if those contracts move to Option later.
- seats: part-4/fable-2-9
- disposition: Method-local Option refactor crosses retained reference-scanner boundary contracts; no observable failure or new evidence against a closed contract. Retain coordinated idiom backlog as the seat classified it.

### back-29 — Data-last inline overloads lack behavior tests
- file: scratchpad/test/markdown/internal/inlines/FootnoteReference.property.test.ts:26
- class: test   severity: backlog
- standard: §11.3 (coverage closed with tests that assert behaviour); round-1 precedent at INVENTORY.md:121 where a hand-written data-last overload (`parseBlocks("gfm")`) did not match its `dual` arity and was a required bug; EF-18.   evidence: `rg 'footnoteReferenceFallback|gfmLinkCloseConstruct|insertStrikethrough\(' scratchpad/test/markdown` returns nothing: no test calls the data-last overloads `footnoteReferenceFallback(opener, bracketPos, afterBracket)` (footnoteReference.ts:95) or `insertStrikethrough(opener, closer)` (strikethrough.ts:135). Per-file 100% coverage cannot see this gap because `dual`'s arity branch lives in effect/Function, not in the module file; the only exercise is each docgen Example printing `typeof ... // function`. scanDelims' curried form, by contrast, is asserted in delimiter-run.test.ts:48. I verified by reading that the arities (4 and 3) match the overload lists, so this is a test gap, not a bug.
- failure: A future drift between the hand-written overload signature and the `dual` arity (exactly the class of bug round 1 found in Markdown.ts) would pass tsgo, coverage and docgen for these two exports.
- fix: In FootnoteReference.property.test.ts (or a new footnote coverage test) assert `footnoteReferenceFallback(opener, bracketPos, afterBracket)(scanner)` and `footnoteReferenceFallback(scanner, opener, bracketPos, afterBracket)` produce the same node list on a `[^a]` subject with a matching label; in Strikethrough.coverage.test.ts assert `insertStrikethrough(opener, closer)(scanner)` equals the data-first result (same `resume` delimiter and `delete` node) on a two-delimiter stack.
- seats: part-4/fable-2-10
- disposition: Coverage/test-floor work is deferred; the seat verified matching arities and demonstrated no bug.

### back-30 — Inline property floors duplicate test templates
- file: scratchpad/test/markdown/internal/inlines/codeSpan.property.test.ts:18
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md / canon SPEC D1 (canonical idioms, shared support modules under `test/**`); §11.1 permits local helpers; no law broken, so backlog under D11.   evidence: `diff <(sed -n 1,55p codeSpan.property.test.ts) <(sed -n 1,55p entity.property.test.ts)` differs only in the `Sample`/`sources` lines (12-13) and the describe title (18): the four properties ("parse(stringify(parse(x))) preserves inline meaning", "canonical inline formatting is idempotent", "marker normalization is idempotent...", "README surgical-edit guarantee preserves surrounding bytes") plus the `meaning` JSON-stripping helper are pasted verbatim into 5 files (autolinkLiteral, autolink, codeSpan, emphasis, entity `.property.test.ts`). A second template ("surgical heading edits keep unrelated inline spelling...", "canonical formatting is idempotent", "parse(stringify(parse(x))) preserves every semantic mdast field" with the `semantic` helper) is pasted into 7 more (`diff Text.property.test.ts LineBreak.property.test.ts` differs only at lines 25-26). In both templates the surgical-edit property modifies the `# Target`/`# Original` heading, so the construct under test only has to survive as untouched bytes; the inline-specific signal is the first three properties.
- failure: Twelve files carry two 30-40 line property bodies by copy; a fix to the `meaning`/`semantic` key list or to the surgical-edit assertion has to be applied twelve times, and drift between copies is invisible to the gates.
- fix: Add `scratchpad/test/markdown/support/inlinePropertyFloor.ts` exporting `inlineParserPropertyFloor(name, sources)` and `inlineMdastPropertyFloor(name, sources, word)` that register the shared `it.effect.prop` cases; each inline property file keeps only its `Sample`/`sources` definition and any construct-specific property (e.g. autolinkLiteral.property.test.ts:57-77, emphasis.property.test.ts:85-103).
- seats: part-4/fable-2-11
- disposition: Vitest-canon/test consolidation is deferred; no law violation or failed behavior shown.

### back-31 — Footnote overload parameter types are unnecessarily indirect
- file: scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:94
- class: type-safety   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form) by analogy; readability of the exported overload list. Does not reopen round-1 reject-8: the `dual` shape stays (missingPipeableSignature), only the parameter spelling changes.   evidence: footnoteReference.ts:94-96 spell every parameter as `Parameters<LinkCloseFallback>[0]` / `Parameters<LinkCloseFallback>[1]` three times each, although `LinkCloseFallback` is declared at link.ts:209-216 directly over the importable `InlineScanner` and `Bracket` from `../inlineTypes.ts` (already imported by link.ts:28). The indirection adds nothing the type checker needs and hides the real types from hover and from the docgen signature.
- failure: The public overload list of `footnoteReferenceFallback` reads as an indexed-tuple puzzle instead of `(scanner: InlineScanner, opener: Bracket, bracketPos: number, afterBracket: number)`; a reader must open link.ts to learn what `[0]` and `[1]` are.
- fix: Import `type { Bracket, InlineScanner } from "../inlineTypes.ts"` and replace the six `Parameters<LinkCloseFallback>[n]` occurrences at :94-96 with `InlineScanner` / `Bracket`; keep `dual(4, ...)` and the `LinkCloseFallback` type import for the `makeLinkCloseConstruct` seam.
- seats: part-4/fable-2-12
- disposition: Indexed Parameters types are sound, without unsafe assertions; signature readability is outside D11.

## Handled by the deviation codemod

None. No submitted finding solely requests recording one of the enumerated law-forced systemic classes. Recording clauses attached to actual source defects are central obligations, not additional required findings; documentation/coverage-only bookkeeping is explicitly deferred in Backlog.

## Rejected

None. Every submitted record has evidence and a concrete proposal. Weaker duplicates were merged with stronger evidence, not counted as rejections; conflicting alternative repairs were resolved within the merged finding.
