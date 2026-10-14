# Markdown round-3 inventory

Read all 12 reports and four adjacent BRIEF.md files across part-1 through part-4. Seat ids below include their part because ids restart in each report. The fable reports identify their route as a separate grok-4.7 medium seat. part-2/fable, part-4/grok and part-4/fable report no findings.

31 seat records merge into 26 findings: **Required 25; Backlog 1; Handled by the deviation codemod 0; Rejected 0; Groups 6.** Five duplicate records were merged into req-1 and req-17, not rejected.

The briefs pin 3ad7b305790c7f0903f6d55766c55186745ba2d1. Merge-time checkout is @lab/effected-2 at 843c475bfdf0e57f6f5d813d956a92b06bd73cdc, rather than the requested @lab/effected. There is no source/test diff for markdown between the reviewed commit and this HEAD. Probe results below are seat evidence, not reruns by the inventory merger. No tests, compiler lanes, refreshes or gates were run.

Binding precedence is the complete operator revision block, D1-D20, sections 12.5 and 14, and the explicit instructions for this merge. The JSDoc finding remains backlog despite the briefs' S3/docgen claims. D11 admits concrete bugs, cited schema/law gaps and the two measured algorithmic improvements. None of these asks only to record a law-forced change. In particular, req-9 demonstrates an actual unfinished migration and a green-gate miss; its prior ledger entry does not waive the law. No finding calls a lab change unforced or assigns an upstream-shape restoration. Read-only git history was checked for the formatter, carriers and stringifier; no scratch-copy diagnostic was run.

The live standards/effect-laws.allowlist.jsonc contains **zero** entries for scratchpad/effected/markdown/**, so there are no allow-<n> findings to add. Do not recreate removed entries or assign edits to the allowlist.

Only the source and test files in the groups below are assigned. README Port notes, PORT_LEDGER.json, root manifests, lockfiles and repo configuration remain centrally owned. Section-14 recording mentioned in fixes is an orchestration obligation, not permission for these groups to edit central bookkeeping. Resulting law-forced per-class records and exportsAdded belong to the deviation codemod. Focused fix regressions are part of closing defects; module-wide coverage, documentation and vitest-canon work are not assigned. Any future vitest verification uses --maxWorkers=2, one vitest at a time; module-wide coverage requires beep-heavy --slot-only.

## Required

### req-1 - Flow replacements absorb an untouched following sibling
- file: scratchpad/effected/markdown/MarkdownFormat.ts:1046-1063
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and `MarkdownFormat.modify`’s node-replacement contract.   evidence: part-1/sol-3-1 reports read-only probes against the port and pinned oracle: replacing the heading in "# title\nbody\n" with "new" succeeds with "new\nbody\n", reparsing as one paragraph. The current guard checks only replacement type/start. part-1/grok-3-1 traces the same missing boundary check for adjacent same-marker lists, indented code and blockquotes. part-1/fable-3-2 also identifies a following line consumed as a table row or a definition title. Round-2 req-10 guarded preceding context; this following-context defect remains.
- failure: A successful edit absorbs a following paragraph, list, code block, blockquote, table row or definition-title line, changing structure outside the selected node.
- fix: Require each contextual replacement block to retain its standalone end offset as well as type/start. If the target has a following sibling, require that sibling in the same projected parent at its original start plus the splice length delta, preserving its boundary/type. Return existing UnsupportedTarget on absorption. Add immediate heading/paragraph and blank-separated list/code/blockquote regressions, plus table and definition continuation cases. Coordinate the dialect-aware reparse with req-7; record the verified upstream bug centrally under section 14.
- seats: part-1/sol-3-1, part-1/grok-3-1, part-1/fable-3-2

### req-2 - Phrasing replacement whitespace invalidates an enclosing delimiter
- file: scratchpad/effected/markdown/MarkdownFormat.ts:1023
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the modifier’s promise to splice literal text into the target’s existing content slot.   evidence: Read-only `bun -e` probes against both implementations parsed `"*old*\n"` and replaced its text child with `"new "`. Both succeeded with `"*new *\n"`. Reparsing yielded a plain text node containing `"*new *"`; the enclosing emphasis disappeared. The same failure occurs with strong emphasis and strikethrough. A separate probe confirmed that `"*new&#32;*\n"` preserves an emphasis node whose text is `"new "`.
- failure: Rendering replacement text as an isolated paragraph leaves trailing whitespace active beside the surrounding closing delimiter. Splicing that result into an emphasis, strong, or delete node invalidates the ancestor’s delimiter flanking and changes markup outside the target.
- fix: When the replacement reaches a delimiter-bearing ancestor’s closing boundary, encode its terminal whitespace as character references so the closing delimiter remains valid, or return typed `UnsupportedTarget` for that unsafe splice. Add regressions for emphasis, strong, and delete text children and record the upstream bug.
- seats: part-1/sol-3-2

### req-3 - Underscore formatting misclassifies combining and format characters
- file: scratchpad/effected/markdown/MarkdownFormat.ts:498
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the formatter’s documented conservative semantic-preservation policy.   evidence: Read-only `bun -e` probes against both implementations formatted `"\u0301*hi*\u0301\n"` with `{ emphasisChar: "_" }` into `"\u0301_hi_\u0301\n"`. Before formatting, the paragraph contained text, an emphasis node around `"hi"`, and text. After formatting, it contained only literal text. U+200C neighbors reproduce the same failure. The current guard recognizes only Unicode letters and numbers; combining marks and format characters also create unsafe underscore boundaries. This is distinct from round-2 req-4’s repaired surrogate-half classification.
- failure: Underscore normalization removes valid emphasis beside non-whitespace, non-punctuation characters outside `\p{L}` and `\p{N}`. Reading complete code points does not make the alphanumeric test equivalent to underscore delimiter-flanking rules.
- fix: Evaluate the proposed underscore delimiters using the parser’s actual whitespace, punctuation, and flanking rules, and skip unsafe rewrites. Add U+0301 and U+200C regressions, including one-sided and two-sided neighbors, and record the upstream bug.
- seats: part-1/sol-3-3

### req-4 - Nested-link precheck overflows before typed depth validation
- file: scratchpad/effected/markdown/MarkdownFormat.ts:987
- class: bug   severity: required
- standard: D9, D11, the existing nesting-depth hardening contract, and `MarkdownModificationErrorCode.FragmentUnrenderable`.   evidence: A read-only `bun -e` probe built a fragment through schema constructors: start with `Text.make({ value: "new" })`, then wrap it in 30,000 `Emphasis.make({ children: [fragment] })` nodes. Replacing the text inside `"[old](/a)\n"` in the port produced an `Exit` containing `Die(RangeError: Maximum call stack size exceeded)`, with the stack at `MarkdownFormat.ts:280–281`. The same port fragment in an ordinary paragraph returned typed `FragmentUnrenderable` with `NestingDepthExceeded`. The pinned oracle, using its own node constructors, returned that typed failure in both contexts.
- failure: The nested-link safeguard recursively walks the replacement before the guarded stringifier validates its depth. A validly constructed over-deep fragment therefore escapes the typed failure channel specifically when the target has a link ancestor. The recorded nested-link deviation does not authorize this hardening regression.
- fix: Run the descendant-link check after `Markdown.stringifyResult` has successfully validated the fragment’s depth, or make that check iterative and depth bounded with a typed `FragmentUnrenderable` result. Add a regression proving that an over-deep fragment inside a link fails through the typed channel.
- seats: part-1/sol-3-4

### req-5 - TaggedEdit needs an executable schema
- file: scratchpad/effected/markdown/MarkdownFormat.ts:354
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-33; D5 and D11.   evidence: The reviewed, gate-green source still defines `TaggedEdit` as a six-field interface. `FormatEmitter` constructs and accumulates these records, and the formatter repeatedly consumes their owner spans and bullet classification during range filtering and hazard suppression. No schema owns this named intermediate formatting model. This surviving interface demonstrates a schema-ownership gap beyond the green compiler and law gates.
- failure: The named, reused formatting payload has only a compile-time shape. Its edit fields, owning-node span, and bullet classification have no executable schema from which its type, validation, or property generators can derive.
- fix: Define an annotated module-local TaggedEdit schema and derive its same-name type, reusing existing edit field schemas. Keep plain-object records, all six fields and formatter behavior. Check the existing formatter regressions. The resulting law-forced recording belongs to the central per-class deviation codemod; do not edit Port notes or PORT_LEDGER.json.
- seats: part-1/sol-3-5

### req-6 - Setext heading conversion can become HTML or a reference definition
- file: scratchpad/effected/markdown/MarkdownFormat.ts:324
- class: bug   severity: required
- standard: D9 / D11 / section 14 cause 2 (upstream-bug). `MarkdownFormat.format` (MarkdownFormat.ts:743-746) skips a conversion that would not re-parse as the same construct. CommonMark 0.31.2 block-start order in `internal/blockRegistry.ts:94-99` tries an HTML block and a link-reference definition before a setext underline.   evidence: `SETEXT_CONTENT_HAZARD` does not cover `<` or `[`. `formatHeading` still emits at line 440. Flush `# <div>` with `{ headingStyle: "setext" }` becomes `<div>\n-----`, which `htmlBlockStart` keeps as one HTML block through the underline, so the heading is gone. Flush `# [foo]: /url` becomes a definition plus a paragraph of `=`, because `setextHeadingStart` (internal/blocks/setextHeading.ts:50-54) strips the definition and then refuses the underline. The pinned oracle `formatHeading` (upstream MarkdownFormat.ts:316-323) emits the same edit. Round-2 req-1 only guarded a non-blank previous line.
- failure: ATX-to-setext normalization rewrites a heading into an HTML block or a link-reference definition when the heading text is itself a block start. Marker normalization changes the document structure.
- fix: Before emitting a setext replacement, parse `` `${content}\n${underline}\n` `` with the same dialect `format` used. Emit only when that parse is a single setext heading of the same depth and text. Leave the ATX heading untouched otherwise.
- seats: part-1/fable-3-1

### req-7 - Flow safety reparse loses the original parse dialect
- file: scratchpad/effected/markdown/MarkdownFormat.ts:1046
- class: bug   severity: required
- standard: D9 / D11 / section 14 cause 2. `internal/blocks/table.ts:22-24` states that a GFM table interrupts a paragraph; that start is not in the commonmark registry (`internal/blockRegistry.ts:94-103`).   evidence: The safety reparse builds `MarkdownParseOptions` with only `frontmatter: document.frontmatter !== undefined`. `MarkdownDocument` stores source, root, diagnostics, and definitions, not the dialect `parseResult` used, so `dialectOf` falls through to `"gfm"`. For a commonmark document `# Title\n| a |\n| --- |\n| b |\n`, replacing the heading with `"Hello"` stays a heading plus a paragraph under commonmark, but the GFM reparse interrupts after `Hello` and the start/end check passes. The applied splice reparses under commonmark as one paragraph.
- failure: `modify` accepts a replacement that is stable only under GFM, then the commonmark document loses the following block.
- fix: Persist the resolved parse dialect on MarkdownDocument using the existing MarkdownDialect schema and a gfm default, populate it in MarkdownDocument.parseResult, and pass it into both standalone and contextual reparses in MarkdownFormat.modify. Combine with req-1 boundary validation. Add commonmark/GFM paired modification regressions. Record the verified parsing-contract bug centrally under section 14; keep changes within these two source files and their tests.
- seats: part-1/fable-3-3

### req-8 - One synthetic list position suppresses real item gaps
- file: scratchpad/effected/markdown/Mdast.ts:136
- class: bug   severity: required
- standard: D9 and the recorded `upstream-bug` for positionless lists (README Port notes; `PORT_LEDGER.json` `labBehaviour`: real item positions continue to determine between-item spacing). Oracle `listSpread` is only the gap loop (`packages/markdown/src/Mdast.ts:92-100`).   evidence: `listSpread` returns `node.spread ?? false` when `A.some` finds one child equivalent to `Position.synthetic` (line 1, column 1, offset 0 at both ends; `sentinelPosition` at `Mdast.ts:96-99`). A foreign list with `spread: false`, two items whose positions are lines 1–1 and 3–3, and one item with no position therefore projects `spread: false`. The oracle gap `3 - 1 >= 2` projects `true`. `mdast.test.ts:176` pins only the all-sentinel `spread: true` case. The inverse also fails the recorded contract: admitted `spread: true` with two tight real items plus one sentinel sibling projects `true` even though every real gap is 0.
- failure: One sentinel sibling suppresses real between-item gaps, and a sentinel at line 1 invents a gap before any later real item. Projection no longer matches the oracle on mixed lists, and it no longer matches the recorded lab behaviour on lists that still have real positions.
- fix: Treat the list as positionless only when fewer than two children have a non-synthetic position, and return `node.spread ?? false` in that case. Otherwise run the existing gap loop over the non-synthetic children in order. Keep the all-sentinel behaviour `mdast.test.ts:176` pins, and add the mixed line-1 / line-3 / omitted-position case.
- seats: part-2/grok-3-1

### req-9 - Engine errors still extend Data.TaggedError instead of S.TaggedError
- file: scratchpad/effected/markdown/internal/carriers.ts:117
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 7 (typed errors extend `S.TaggedError`); `.patterns/error-handling.md` structured-error pattern; D5. Round-2 req-12 is unfixed. The ledger `tagged-errors` row records the partial migration and says the schema migration remains undone. It does not waive law 7.   evidence: `RawMarkdownError` (`carriers.ts:117`) and `GuardExceeded` (`carriers.ts:205`) still extend `Data.TaggedError`. Constructors assign the payload without schema decode. `extendsNativeError` is `"error"` in `tsconfig.base.json` and only flags `extends Error`. `preferSchemaTaggedError` (TS377139), whose default severity is `off`, is absent from that `diagnosticSeverity` map. The beep law scan looks for native `new Error`, so the green gates do not see these two classes.
- failure: The engine carriers thrown by the block and inline parsers still have no `S.TaggedError` contract. A payload the diagnostic schema rejects, such as a non-finite offset, constructs successfully, and the carriers still have no schema identity.
- fix: Derive RawMarkdownError and GuardExceeded directly from annotated S.TaggedError schemas, reusing the existing schema-backed diagnostic and reason domain. Preserve tags, name = Error, messages, positional new constructors and instanceof guards. Retarget carrier tests only where the schema constructor requires it. This is the still-missing migration, not recording alone; the law-forced bookkeeping remains central.
- seats: part-2/grok-3-2

### req-10 - MDX fragment attribute checks lack shared filter metadata
- file: scratchpad/effected/markdown/MarkdownNode.ts:1574
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; `standards/schema-first-development-prompt.md` (“Reusable custom checks must have `identifier`, `title`, `description`, and a user-facing `message`”). Effect 4 `S.makeFilter` takes those as the second argument (`Schema.ts:6771-6775`). No effect-tsgo rule covers filter annotations, so the green tsgo and docgen gates do not see this.   evidence: The same fragment check is copied at `MarkdownNode.ts:1574-1578` (`MdxJsxFlowElement`) and `MarkdownNode.ts:1611-1615` (`MdxJsxTextElement`). Both calls pass only the predicate. Round-2 req-19 removed the empty-name filters via `MdxJsxName` and left these two checks in place.
- failure: Fragment-with-attributes failures carry no `identifier`, `title`, or `description`, and the two copies can drift. Callers cannot match this constraint by identity.
- fix: Declare one module-level filter, `S.makeFilter` with `identifier`, `title`, `description`, and the existing message `"an MDX JSX fragment cannot carry attributes"`, and pass that filter to both `S.check` calls.
- seats: part-2/grok-3-3

### req-11 - Setext promotion spreads an unbounded source-segment array
- file: scratchpad/effected/markdown/internal/blockParser.ts:325
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); standards/effect-first-development.md EF-31.   evidence: A read-only Node v24.20.0 probe calling `Markdown.parseResult("x\n".repeat(150000) + "---\n")` throws `RangeError: Maximum call stack size exceeded` at `replacement.segments.push(...block.segments)`. The Effect entry point returns a failure containing `Cause.Die`. The pinned oracle reproduces the same overflow in `BlockParser.replaceBlock`. This is a separate site from round-2 req-35’s repaired definition-extraction spread.
- failure: A valid, shallow multiline setext heading exceeds the runtime’s function-argument limit when paragraph promotion spreads every source segment into `push`. Parsing escapes the advertised Result/error channel even though nesting remains within the hardening limit.
- fix: Copy the segments with an iterative loop instead of argument spreading. Add a Node regression for the 150,000-line setext heading, asserting successful parsing and retained source positions, and record the verified upstream bug through section 14.
- seats: part-2/sol-3-1

### req-12 - Deep acyclic foreign mdast input overflows normalization
- file: scratchpad/effected/markdown/Mdast.ts:436
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-3 requires deliberately synchronous decoding paths to be non-throwing; EF-31 separates input failures from defects; D9, D11 and section 14 (`upstream-bug`).   evidence: A read-only probe builds a positionless paragraph wrapped in 16,000 distinct blockquotes, then calls `Mdast.fromMdastResult({ type: "root", children: [child] })`. Both the port and pinned oracle throw `RangeError: Maximum call stack size exceeded`. The port’s `Mdast.fromMdast` returns `Cause.Die`. The input is acyclic, so the recorded round-2 ancestor-cycle repair never rejects it.
- failure: Deep acyclic foreign input still exhausts the recursive normalization stack before a structured `MdastDecodeError` can be returned. The synchronous API throws, and its Effect twin defects.
- fix: Add an iterative admission preflight that checks a documented safe foreign-tree depth budget before recursive normalization and schema decoding. Return `MdastDecodeError` with a structured `SchemaIssue.InvalidValue` when that budget is exceeded. Preserve shared acyclic subtrees and supported foreign trees above the visitor’s separate depth limit; add regressions for both entry points and record the upstream-bug deviation.
- seats: part-2/sol-3-2

### req-13 - Link opener deactivation continues scanning after all active links clear
- file: scratchpad/effected/markdown/internal/inlineParser.ts:468
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; the parser’s documented protection against quadratic link processing; D9 and section 14 (`upstream-bug`).   evidence: Read-only, in-memory instrumentation counted the bracket visits performed by `deactivateLinkOpeners` while parsing `"![[[]()".repeat(n)` under CommonMark. For `n = 500, 1000, 2000, 4000`, the counts were **250,500; 1,001,000; 4,002,000; 16,004,000**, exactly `n(n + 1)`. The pinned oracle contains the same full-stack loop. An in-memory trial that stops once `activeLinkOpeners` reaches zero reduced those counts to **500; 1,000; 2,000; 4,000** and preserved the complete parse result for the 50-repetition control.
- failure: Each repetition leaves older image and inactive link openers on the stack while introducing another active opener. Deactivation clears that active opener, then unnecessarily scans the entire older stack, producing Θ(n²) work for Θ(n) input.
- fix: Include `this.activeLinkOpeners > 0` in the traversal’s continuation condition, or break immediately after the count reaches zero. Add a scaled bracket-visit regression and record the verified upstream performance bug.
- seats: part-2/sol-3-3

### req-14 - Four immutable parser payloads remain handwritten interfaces
- file: scratchpad/effected/markdown/internal/blockTypes.ts:155
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5 and D11.   evidence: `RawInlineSlice` at line 155, `PreparedInline` at line 168, `DefinitionData` at line 249 and `FootnoteData` at line 272 remain exported interfaces without corresponding schema values. They contain immutable payload fields and no methods or complex type-level machinery. Their shapes can be represented with `S.Struct`, existing node/content schemas and `RawInlineSegment`. The recorded schema migration covers neighboring source/provenance models but does not exempt these four records; the green gates accept these remaining type-only declarations.
- failure: These reusable engine payloads have no executable source of truth for their shapes and cannot supply schema-derived validation, equivalence or arbitraries. They remain outside the required schema-first model contract.
- fix: Define annotated S.Struct values for RawInlineSlice, PreparedInline, DefinitionData and FootnoteData and derive same-name types. Reuse existing node/content schemas and RawInlineSegment; retain plain-object construction and exact field optionality. Add focused schema acceptance/round-trip regressions to the existing blockTypes property test. Do not turn this into a module-wide S3 coverage or canon assignment; recording and added exports are central.
- seats: part-2/sol-3-4

### req-15 - Parser continue/start verdicts lack named literal schemas
- file: scratchpad/effected/markdown/internal/blockTypes.ts:338
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 requires `LiteralKit` for named internal literal domains; standards/effect-first-development.md EF-35; D5 and D11.   evidence: `BlockContinueResult` at line 338 and `BlockStartResult` at line 352 are still independently declared as `0 | 1 | 2`. These named verdict domains are reused by `BlockConstruct.continue` and `BlockStart.trigger`, respectively. Unlike the repaired `BlockType`, neither has an annotated runtime domain. Round-2 req-26 addressed the block and inline node-kind domains, rather than these verdict domains.
- failure: The two parser verdict vocabularies exist only as handwritten TypeScript unions, leaving their documented finite domains without the required schema ownership or derived runtime guards.
- fix: Define annotated `LiteralKit([0, 1, 2])` values for the two verdict domains and derive their same-name types. Retain the existing numeric codes and scanner behavior.
- seats: part-2/sol-3-5

### req-16 - Underscore serialization loses emphasis at unsafe neighboring code points
- file: scratchpad/effected/markdown/internal/stringify.ts:716
- class: bug   severity: required
- standard: D11; `Markdown.ts` render-equivalence contract (the output re-parses to a render-equivalent document, and representability wins); `internal/inlines/emphasis.ts` underscore `canOpen`/`canClose` (lines 110–133). The vitest gate misses it: `stringify.coverage.test.ts:21` pins only a BMP letter before the opener.   evidence: `run.lastChar` is `run.out[run.out.length - 1]` (line 805), one UTF-16 unit. `/[\p{L}\p{N}]/u` does not match the low surrogate of U+10400, so `Text("𐐀")` plus `Emphasis`/`Strong` with `markerChar: "_"` stays `_`. `emphasis-astral.test.ts:37` already parses `𐐀_a_` as a single text node. The same guard never reads the next sibling. For `_a_b`, `scanDelims` sets the closer’s `canOpen` and `canClose` both false (both sides are letters, so the underscore run is left- and right-flanking and the intraword rule rejects it). The opener can open; nothing can close. Default `*` is unaffected because `*` may flank inside a word.
- failure: A synthesized `_` emphasis or strong preceded by an astral letter, or followed by an alphanumeric, stringifies to source that re-parses as literal text. The rendered `<em>` / `<strong>` disappears. Parsed trees hide this because that source never becomes emphasis.
- fix: Before keeping `_`, classify the previous output code point (step back over a valid surrogate pair) and, when the next sibling is text, its first code point. If either is a Unicode letter or number, emit `*`. Add regressions for `𐐀_a_`, `_a_b`, and the strong forms.
- seats: part-3/grok-3-1

### req-17 - Destination and title line endings serialize as active block syntax
- file: scratchpad/effected/markdown/internal/stringify.ts:556-578
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the render-equivalence contract in `Markdown.ts:508` and `scratchpad/test/markdown/e2e/stringify-roundtrip.e2e.test.ts`.   evidence: Read-only probes against both the reviewed port and pinned oracle parsed `[x](a&#10;b)` as a link with URL `"a\nb"`, then serialized it as `"[x](<a\nb>)\n"`. Reparsing produced text and an HTML node instead of a link. The same failure occurs for images and reference definitions. The adjacent `titleSuffix` helper at line 578 serializes `[x](u "a&#10;&#10;b")` with a physical blank line inside the title; reparsing produces two paragraphs and loses the link.
- failure: Destination and title escaping emits decoded line terminators as active markdown source. Angle brackets do not make a newline-containing destination valid, and decoded title newlines can terminate the surrounding paragraph. These are separate failures from round 2’s closed ampersand double-decoding finding.
- fix: After escaping literal ampersands, encode CR/LF as &#13;/&#10; in the pointy destination spelling and in titleSuffix, preserving the existing quote/destination escapes. Add link, image and definition round-trips for both line endings and blank-line titles. Exclude unrepresentable NUL from this fix. Record the verified upstream bug centrally under section 14.
- seats: part-3/sol-3-2, part-3/grok-3-2, part-3/fable-3-2, part-3/fable-3-3

### req-18 - Metadata without language becomes a language class
- file: scratchpad/effected/markdown/internal/stringify.ts:1042
- class: bug   severity: required
- standard: D11; `Markdown.ts` render-equivalence contract; `htmlWriter.ts:455–464` (commonmark.js puts the first info word in `class="language-..."`). The recorded metadata fix (`stringify.test.ts:1014`) always sets `lang`, so the gate misses a metadata-only node.   evidence: `Code.make({ value: "x\n", meta: "tail", fenceChar: "`" })` has no `lang`, so `encodeCodeInfo("", true)` is empty and the info string is `" tail"`. `finalizeFenced` (`code.ts:56–72`) trims that space, finds no internal space, and stores `lang: "tail"` with no `meta`. The original node’s HTML is `<pre><code>x\n</code></pre>`. The re-parse is `<code class="language-tail">`.
- failure: Metadata without a language token is emitted as the language word. Re-parse adds a language class the original node does not render.
- fix: When `lang` is absent, emit an empty info string. No first word unescapes to `""`, so metadata cannot occupy that slot and keep the class absent. Add a regression that this node re-renders without `language-tail`.
- seats: part-3/grok-3-3

### req-19 - Metadata-only fenced blocks acquire loose-list separators
- file: scratchpad/effected/markdown/internal/stringify.ts:1192
- class: bug   severity: required
- standard: D11; `Markdown.ts` render-equivalence contract; CommonMark loose-list rule, applied by `htmlWriter.ts:379–386` and `:420–422` (a tight item’s paragraph is not wrapped in `<p>`).   evidence: `serializeCode` fences a node whenever `meta !== undefined` (`indentedRepresentable` requires `meta === undefined`). `interruptsParagraph` treats code as interrupting only when `fenceChar` or `lang` is set. `canJoinWithoutBlank` (line 1208) uses that same pair and, for a fenced predecessor, returns true only when `fenceChar` or `lang` is set. `serializeBlocks` (line 1324) inserts `\n\n` when the join fails and `tight` is true. A tight item `[paragraph("p"), Code({ value: "x\n", meta: "tail" })]` therefore emits a blank line before a fence. That blank line makes the list loose on re-parse. Two metadata-only code blocks in one tight item do the same, because line 1209 still classifies both as indented.
- failure: A tight list item that holds a metadata-only code block gains a blank line, re-parses as a loose list, and wraps its paragraph in `<p>`.
- fix: Treat `meta !== undefined` as a fence in `interruptsParagraph` and in both sides of the code clause of `canJoinWithoutBlank`, the same condition `serializeCode` already uses. Add a tight-list regression for a paragraph followed by metadata-only code.
- seats: part-3/grok-3-4

### req-20 - Table segment spreads exceed Node argument limits
- file: scratchpad/effected/markdown/internal/blocks/table.ts:513
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `Markdown.parseResult`’s Result boundary and shallow-input hardening contract.   evidence: A read-only Node v24.21.0 probe called `Markdown.parseResult("| " + "a\\|".repeat(150000) + " b |\n| --- |\n")`. The reviewed port threw `RangeError: Maximum call stack size exceeded`, with the first stack frame at `table.ts:513`. The pinned oracle reproduced the same failure at its corresponding `addRow` operation. Bun accepted this input, confirming that Bun-only verification misses the Node failure.
- failure: One valid, shallow table cell produces an unbounded segment array. Expanding that array into `push` arguments exceeds Node’s argument limit and throws outside the typed Result channel. This is independent of round 2’s closed definition-extraction spread finding.
- fix: Append `content.segments` iteratively. Apply the same bounded append to the table module’s other unbounded segment spreads at lines 396 and 586. Add a focused Node regression for the escaped-pipe cell and record the upstream bug under section 14.
- seats: part-3/sol-3-1

### req-21 - Decoded carriage returns become new block boundaries
- file: scratchpad/effected/markdown/internal/stringify.ts:238
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `Markdown.stringifyResult`’s render-equivalence contract and the serializer’s block-opening protection.   evidence: Both implementations parse `a&#13;# heading` as one paragraph containing the text `"a\r# heading"`. Serialization returns `"a\r# heading\n"`. Using the existing HTML writer and normalizer, the round trip changes `<p>a # heading</p>` into `<p>a</p><h1>heading</h1>`. The analogous `a&#13;- item` introduces a list.
- failure: `escapeText` recognizes LF but lets decoded CR fall through to raw emission at line 340. The preprocessor subsequently treats that CR as a physical line boundary, while the serializer never applies its line-start escaping to the following characters. Literal paragraph content becomes new blocks.
- fix: Emit decoded CR as `&#13;` in canonical text escaping so it remains inline content rather than a source-line boundary. Add paragraph and image-alt regressions with block-opening characters after decoded CR, and record the upstream bug under section 14.
- seats: part-3/sol-3-3

### req-22 - Decoded spaces turn a soft newline into a hard break
- file: scratchpad/effected/markdown/internal/stringify.ts:262
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the serializer’s explicit soft-break preservation contract at lines 239–253 and its render-equivalence property.   evidence: Read-only probes against the reviewed port and pinned oracle parsed `"a&#32;&#32;&#32;\nb"` into a paragraph containing one Text value, `"a  \nb"`. Serialization emitted `"a  \nb\n"`. Reparsing introduced a `Break` node with `breakStyle: "spaces"`; normalized rendering changed from `<p>a b</p>` to `<p>a<br>b</p>`.
- failure: A Text newline is emitted physically without checking whether the preceding emitted spaces form markdown’s hard-break marker. Decoded spaces followed by a soft newline acquire a visible hard break.
- fix: Emit `&#10;` instead of a physical newline when the preceding emitted text would make it a hard break. Account for adjoining Text siblings as well as spaces within one value. Add the decoded-space regression and record the upstream bug under section 14.
- seats: part-3/sol-3-4

### req-23 - Table header promotion rescans provenance quadratically
- file: scratchpad/effected/markdown/internal/blocks/table.ts:396
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; section 14 (`upstream-bug`); the table parser’s documented ability to reclaim preceding paragraph lines when promoting the final line into a header.   evidence: A read-only `tableHeaderStart.trigger` probe supplied `n` preceding paragraph source segments and a final header containing `n` escaped pipes. Instrumented segment-field reads were **762,528** for `n = 500`, **3,025,028** for `n = 1,000`, and **12,050,028** for `n = 2,000`; the pinned oracle produced identical counts. Each surviving interval calls `sliceWithSegments`, whose loop visits the entire source segment array. Thus an input of linear size performs Θ(n²) provenance work.
- failure: Promoting a long paragraph into a table repeatedly rescans all preceding lines for every escaped pipe in the header. Doubling both dimensions approximately quadruples the work, despite the output remaining one reclaimed paragraph and one shallow table cell.
- fix: Maintain a forward segment cursor while processing the ordered escape-drop intervals, visiting each source segment and drop once. Preserve the current source offsets and resulting segment boundaries. Add a segment-read bound regression and record the algorithmic upstream bug under section 14.
- seats: part-3/sol-3-5

### req-24 - Leading tilde language text lengthens a tilde fence
- file: scratchpad/effected/markdown/internal/stringify.ts:1013
- class: bug   severity: required
- standard: D9, D11, and §14 (`upstream-bug`); render-equivalence in `scratchpad/effected/markdown/Markdown.ts:508`; fenced opener `reCodeFence` in `scratchpad/effected/markdown/internal/blocks/fencedCode.ts:13` and closing rule in `scratchpad/effected/markdown/internal/blocks/code.ts:98`.   evidence: `encodeCodeInfo` encodes `&`, `\`, `` ` ``, and whitespace, then `serializeCode` concatenates that string onto the fence at line 1042. A tilde fence does not encode `~`. `Code` `{ fenceChar: "~", lang: "~", value: "x\n" }` therefore emits `~~~~\nx\n~~~`. `^~{3,}` takes all four opening tildes, so the info string is empty, and the three-tilde closer is shorter than the opener, so it stays content. Reparse has no language and value `x\n~~~\n`. `~~x` likewise becomes a five-tilde opener whose info is `x`. This is the remaining hole beside the recorded backtick repair (round-2 req-37); the ledger’s info-string deviation does not mention tildes. `&#126;` is a decimal reference `decodeEntity` accepts, and `finalizeFenced` unescapes after the fence match, so one encoded leading tilde is enough.
- failure: A tilde-fenced code node whose language starts with `~` does not reparse. The language is absorbed into the opening fence and, when that fence grows past the closer, the closing fence becomes code content.
- fix: After the existing replacements, encode one leading `~` as `&#126;` when the fence character is `~`. Add a round-trip for `lang: "~"` and `lang: "~~x"` with `fenceChar: "~"`.
- seats: part-3/fable-3-1

### req-25 - EmailMatch needs a schema-derived representation
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:334
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; AGENTS.md schema-first domain-model law; D5 and D11.   evidence: At `3ad7b305790c7f0903f6d55766c55186745ba2d1`, `EmailMatch` is a primitive-only interface containing `from`, `to`, and `url`. `scanEmails` returns `ReadonlyArray<EmailMatch>` at line 373 and constructs those records at line 466. This is parser domain data, rather than a service contract, overload surface, or type-level operation. The pinned upstream has the same interface, but the port’s schema-first requirement applies to this retained model. The four green beep laws do not enforce ownership of private pure-data interfaces.
- failure: The email scanner’s named result model has no executable schema. Its shape and offset invariants exist only in a handwritten TypeScript interface, leaving this domain model outside the required schema-derived representation.
- fix: Define a file-local, annotated `EmailMatch` schema and derive the same-name type from it. Use nonnegative integer schemas for the merged-text offsets and a string schema for the destination. Keep the existing plain-object records, matching algorithm, and export surface.
- seats: part-4/sol-3-1

Required write groups below match required.json. Every assigned source or test file belongs to exactly one group; multi-file req-7 is wholly owned by g1. Each group has at most six source files. Shared prerequisites may be read without transferring ownership.

### g1

- findings: req-1, req-2, req-3, req-4, req-5, req-6, req-7
- files: `scratchpad/effected/markdown/MarkdownFormat.ts`, `scratchpad/effected/markdown/MarkdownDocument.ts`
- tests: `scratchpad/test/markdown/format.test.ts`, `scratchpad/test/markdown/MarkdownFormat.property.test.ts`, `scratchpad/test/markdown/document.test.ts`

### g2

- findings: req-8, req-12
- files: `scratchpad/effected/markdown/Mdast.ts`
- tests: `scratchpad/test/markdown/mdast.test.ts`, `scratchpad/test/markdown/Mdast.coverage.test.ts`

### g3

- findings: req-9, req-10, req-14, req-15
- files: `scratchpad/effected/markdown/MarkdownNode.ts`, `scratchpad/effected/markdown/internal/carriers.ts`, `scratchpad/effected/markdown/internal/blockTypes.ts`
- tests: `scratchpad/test/markdown/mdx.test.ts`, `scratchpad/test/markdown/node.test.ts`, `scratchpad/test/markdown/internal/carriers.coverage.test.ts`, `scratchpad/test/markdown/internal/blockTypes.property.test.ts`

### g4

- findings: req-11, req-13, req-20, req-23
- files: `scratchpad/effected/markdown/internal/blockParser.ts`, `scratchpad/effected/markdown/internal/inlineParser.ts`, `scratchpad/effected/markdown/internal/blocks/table.ts`
- tests: `scratchpad/test/markdown/hardening.test.ts`, `scratchpad/test/markdown/gfm-tables.test.ts`, `scratchpad/test/markdown/internal/blockParser.coverage.test.ts`, `scratchpad/test/markdown/internal/inlineParser.coverage.test.ts`, `scratchpad/test/markdown/internal/blocks/table.property.test.ts`

### g5

- findings: req-16, req-17, req-18, req-19, req-21, req-22, req-24
- files: `scratchpad/effected/markdown/internal/stringify.ts`
- tests: `scratchpad/test/markdown/stringify.test.ts`, `scratchpad/test/markdown/stringify-literal.test.ts`, `scratchpad/test/markdown/e2e/stringify-roundtrip.e2e.test.ts`

### g6

- findings: req-25
- files: `scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts`
- tests: `scratchpad/test/markdown/internal/inlines/autolinkLiteral.property.test.ts`, `scratchpad/test/markdown/internal/inlines/autolinkLiteral.coverage.test.ts`

## Backlog

### back-1 - Eight inline JSDoc blocks have empty Details sections
- file: scratchpad/effected/markdown/internal/inlines/codeSpan.ts:22
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Description and section grammar”: sections must be non-empty; D11 includes JSDoc-law breaks.   evidence: Inspection of the pinned Git objects confirms eight `**Details**` headings followed immediately by an Example section or tags, without any section content: `codeSpan.ts:22`, `emphasis.ts:64`, `emphasis.ts:176`, `entity.ts:22`, `escape.ts:20`, `footnoteReference.ts:64`, `footnoteReference.ts:141`, and `lineBreak.ts:24`. Their presence in the supplied docgen-green commit demonstrates a gate miss. Round-2 `back-27` explicitly deferred this defect; it did not close it or accept a behavioral deviation. The current brief contains no JSDoc deferral.
- failure: Eight exported documentation blocks violate the binding section grammar and render empty Details headings in documentation and IDE hovers.
- fix: Remove the eight empty `**Details**` headings and their padding, preserving the lead descriptions, examples, and tags.
- seats: part-4/sol-3-2
- disposition: JSDoc is backlog under this merge request, even with a demonstrated docgen gate miss. Retains round-2 back-27; no documentation work is assigned in required.json. The BRIEF claim that S3/docgen are already complete does not override this task's explicit S2/S3 classification rule.

## Handled by the deviation codemod

None. No round-3 seat finding is a bookkeeping-only request. Law-forced recording after required fixes remains central and is not an additional required finding.

## Rejected

None. All 31 seat records supply evidence and a concrete fix; duplicates contribute to their merged records. The sole documentation record is reclassified to Backlog.
