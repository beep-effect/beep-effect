### fable-2-1
- file: scratchpad/effected/markdown/MarkdownFormat.ts:410
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); the module's own contract (MarkdownFormat.ts:7-16 'an edit is emitted only when the rewrite is provably safe against re-parse hazards'); D10 formatter idempotence/fidelity floor   evidence: Read-only `bun -e` probes from the repo root (port) and from the oracle `packages/markdown` (upstream af7566a) gave identical results. `MarkdownFormat.formatToString("para\n# Title\n", undefined, { headingStyle: "setext" })` → `"para\nTitle\n=====\n"`, which re-parses as ONE heading with text `"para\nTitle"` (the paragraph node is gone). `"- item\n# Title\n"` → `"- item\nTitle\n=====\n"` re-parses as a list item paragraph `"item\nTitle\n====="` (the heading is gone). `"> q\n# Title\n"` → blockquote paragraph `"q\nTitle\n====="`. `formatHeading` only checks that the heading starts a line (`start !== 0 && source.charCodeAt(start - 1) !== 0x0a`), never that the previous line is blank, although `previousLineBlank` (line 302) exists and guards the same hazard for `-` thematic breaks (line 380).
- failure: An ATX heading that directly follows a paragraph, list item or blockquote line (all legal, since ATX headings interrupt paragraphs) is rewritten to setext, and the underline then attaches to the preceding block: the heading merges into the paragraph or disappears into the container. `format` is documented as pure, total and hazard-skipping, and the formatter idempotence/semantic-retention property is false for these inputs.
- fix: In the `target === "setext"` branch extend the guard to `if (!previousLineBlank(source, start) || (start !== 0 && source.charCodeAt(start - 1) !== 0x0a)) return false;` (skip, never attempt). Add format.test.ts regressions asserting the three sources above are returned unchanged under `{ headingStyle: "setext" }`, and hand the upstream-bug receipt (probe + adjusted test refs) to the central ledger/Port-notes deviation entry.

### fable-2-2
- file: scratchpad/effected/markdown/MarkdownFormat.ts:483
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); CommonMark 0.31.2 §6.2 flanking rules are defined over Unicode code points; same defect class as round-1 req-31 (surrogate halves), which was accepted as required   evidence: Port and oracle probes agree: `formatToString("\u{1D49C}*foo*\n", undefined, { emphasisChar: "_" })` → `"\u{1D49C}_foo_\n"`, which re-parses as a single text node `"𝒜_foo_"` — the emphasis node is lost. Control: `"A*foo*\n"` is correctly left unchanged. Cause: `ALPHANUMERIC.test(source.charAt(start - 1))` / `source.charAt(end)` hand a lone UTF-16 surrogate to `/[\p{L}\p{N}]/u`, which never matches, so an astral letter/digit neighbour (U+1D49C is \p{L}) is not recognised as intraword. The parser side already handles this correctly (internal/inlines/emphasis.ts:113-120 reads the surrounding code point).
- failure: The `_` intraword guard misses every astral-plane letter or digit on either side of the emphasis, so `*…*` is rewritten to `_…_` in a position where `_` cannot open/close; the re-parsed document loses the emphasis. Violates the 'provably safe' contract and the semantic-retention property.
- fix: Test the neighbouring code point, not code unit: `/[\p{L}\p{N}]$/u.test(source.slice(Math.max(0, start - 2), start))` and `/^[\p{L}\p{N}]/u.test(source.slice(end, end + 2))` (or mirror the surrogate-aware lookup from internal/inlines/emphasis.ts:113-120 with `Str.codePointAt`). Add a regression with an astral letter before and an astral digit (U+1D7D9) after the emphasis; record the upstream-bug receipt centrally.

### fable-2-3
- file: scratchpad/effected/markdown/MarkdownFormat.ts:524
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); `MarkdownFormattingOptions` contract (MarkdownFormat.ts:124-125 'Content is never rewritten'); CommonMark 0.31.2 §4.5 (a closing fence is a line of its own; an unclosed fence runs to end of document)   evidence: Port and oracle probes agree: `formatToString("```\nfoo```", undefined, { fenceChar: "~" })` → `"~~~\nfoo~~~"`, and `"```\nfoo```\n"` → `"~~~\nfoo~~~\n"`. The source parses as an UNCLOSED fence whose value is `"foo```\n"`; the output re-parses with value `"foo~~~\n"` — code content was rewritten. Cause: the closing-fence scan `while (end - closeLength > start + openLength && source[end - closeLength - 1] === fidelity)` walks backwards over fidelity characters from the node end without checking that they form a fence LINE, so a trailing backtick run inside the last content line of an unclosed block is treated as the closing fence and replaced.
- failure: For an unclosed fenced block whose last content line ends with three or more fence characters, `fenceChar` normalisation rewrites code content (backticks become tildes), breaking the 'content is never rewritten' promise; the block's value changes on re-parse.
- fix: Identify the closing fence from the span's last line instead of scanning backwards: `const lastLineStart = lineStartOf(source, end); const close = /^[ \t>]*([`~]{3,})[ \t]*$/.exec(source.slice(lastLineStart, end));` and emit the closing edit only when `close` matches with the fidelity character; otherwise emit the opening edit alone. Regression: both probe inputs must yield `"~~~\nfoo```"` / `"~~~\nfoo```\n"` and re-parse with value `"foo```\n"`. Record the upstream-bug receipt centrally.

### fable-2-4
- file: scratchpad/effected/markdown/MarkdownFormat.ts:461
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); the module's hazard-skipping contract (MarkdownFormat.ts:7-16, which names the adjacent-list merge but not this case); CommonMark 0.31.2 §4.1 (three or more `-`/`*` separated by spaces is a thematic break)   evidence: Port and oracle probes agree: `formatToString("* - -\n", undefined, { bulletChar: "-" })` → `"- - -\n"` and `formatToString("- * *\n", undefined, { bulletChar: "*" })` → `"* * *\n"`. The inputs parse as three nested lists (outer item → inner list → innermost empty item); the outputs re-parse as a single `thematicBreak`. `formatList` emits one-character marker edits per item (`emit.push(node, item.position.start.offset, 1, target)`) with no check that the resulting line is a thematic break; the nested lists are separate nodes, so no single call sees the combined line.
- failure: Bullet normalisation turns a nested-list line consisting only of markers into a thematic break: the entire list structure is replaced by a horizontal rule on re-parse. The formatter idempotence/semantic-retention property is false for this input.
- fix: Before emitting an item's edit, take the item's source line, replace every bullet marker (`[-*+]`) with `target`, and skip the whole list when `/^ {0,3}([-*])(?:[ \t]*\1){2,}[ \t]*$/` matches (conservative: all three lists stay as written). Add regressions asserting both probe inputs are returned unchanged; record the upstream-bug receipt centrally.

### fable-2-5
- file: scratchpad/effected/markdown/MarkdownFormat.ts:973
- class: bug   severity: required
- standard: D9 / section 14 cause 2 (verified upstream bug); `MarkdownFormat.modify` contract (MarkdownFormat.ts:725-728 and 884-887: 'every replacement renders through the canonical stringifier, so a modified document re-parses cleanly by construction'); CommonMark 0.31.2 §4.8 lazy continuation and §5.2 list item continuation   evidence: Port and oracle `modifyToString` probes agree on every case. (B8) source `"- item\n\npara\n"`, target the root paragraph, replacement `Code.make({ value: "x" })` → `"- item\n\n    x\n"`, which re-parses as a second PARAGRAPH inside the list item (the canonical language-less code renders indented in isolation and is absorbed by the list). (B9) `"para\n# h\n"`, target the heading, replacement `Paragraph([Text("x")])` → `"para\nx\n"`, one paragraph `"para\nx"`. (B10) same target, replacement `Code({value:"x"})` → `"para\n    x\n"`, lazy continuation, one paragraph. (B11) same target, string `"x"` → merged paragraph. (B12) `"para\n- a\n"`, target the list, replacement a paragraph → `"para\nx\n"`, merged. `modify` renders the fragment in an isolated `Root` and splices it without consulting the previous sibling or the blank-line context, so the stringifier's own 'representability wins' rule (indented code after a list is emitted fenced) and paragraph-interruption rules never apply.
- failure: A flow replacement spliced at a block boundary changes category on re-parse: a paragraph merges into the preceding paragraph/list item, or a code block becomes list-item prose. The documented 'cleanly re-parses by construction' guarantee and the modify fidelity contract are broken, with no typed error.
- fix: After computing `content`, add two context guards for `slot === "flow"`: (a) when `!previousLineBlank(document.source, start)` and the first rendered line cannot interrupt a paragraph (ATX `#`, fence, `>`, thematic break, bullet, `1.`/`1)`), fail `UnsupportedTarget` with detail 'the target directly follows a non-blank line and the replacement would merge into the preceding block'; (b) when the previous root sibling is a `list` or `footnoteDefinition` and `content` starts with four spaces (a language-less `Code` rendered indented), render the fragment fenced (the stringifier's representability rule) or fail `UnsupportedTarget`. Add regressions for B8, B9/B11 and B12; record the upstream-bug receipt centrally.

### fable-2-6
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:470
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named or reused domain constraints are modeled as schemas first, guards derived with `S.is`), law 18 (reusable checks carry identifier/title/description), law 21 (shared helper over duplicated logic); AGENTS.md Code Laws 'named schema building blocks, derived S.is(...) guards over ad-hoc predicate helpers'; round-1 req-8 precedent   evidence: The committed `X[.Y[.Z]]` version grammar — documented on `SchemaDeclarationByName` (lines 142-145), `classify` (508-509) and `fromRegistry` (608-611) and reused at three call sites — is modelled as the ad-hoc predicate `parseVersionSegments` (470-475), a regex test returning `ReadonlyArray<string> | undefined`. Line 662 then re-implements the same canonicalisation inline (`A.join(A.map(Str.split(declaration.version, "."), Str.replace(/^0+(?=\d)/, "")), ".")`) because the helper's `undefined` sentinel cannot be reused after classification already validated the key (`rg -n 'replace\(/\^0\+' FrontmatterResolver.ts` → 474, 662). `S.isPattern` is available (used by the module's own property tests) and the gates do not check this.
- failure: The module's one reused domain constraint has no schema, no derived guard and no annotations, and its canonicalisation is duplicated in two places that can drift; this is below the D5 end-state bar the closed ports and round-1 req-8 established.
- fix: Declare `const VersionSegments = S.String.check(S.isPattern(/^\d+(\.\d+){0,2}$/, { identifier, title, description }))`, `const isVersion = S.is(VersionSegments)` and a total `const canonicalSegments = (version: string) => A.map(Str.split(version, "."), Str.replace(/^0+(?=\d)/, ""))`; use `isVersion` at lines 544 and 690, `canonicalSegments` at 662 and 694, delete `parseVersionSegments`. Keep `SchemaDeclarationByName.version` as `S.String` (D9: tightening the field is a separate section-14 deviation). Existing resolver tests stay green.

### fable-2-7
- file: scratchpad/effected/markdown/MarkdownDocument.ts:119
- class: schema   severity: backlog
- standard: standards/ARCHITECTURE.md principle 5 'Schemas Are Executable Contracts'; standards/schema-first-development-prompt.md 'Schema owns pure data'; section 14 (a proposed deviation without a law-forced cause is backlog)   evidence: `DocumentSection` is a plain class carrying six readonly data fields (heading, depth, range, children, text, bodyRange) plus a private `#documentSource` and two derived getters, constructed with `new DocumentSection({...})` at line 743. Its three sibling navigation payloads (`DocumentHeading`, `DocumentLink`, `SectionQueryOptions`) received schemas in round 1 (req-7); this one was left out, presumably because of the private source field, and the Port notes do not record a rationale.
- failure: The only navigation model without an executable schema: no `Arbitrary`, equivalence or encode/decode derivation, and the D10 round-trip floor cannot cover it. Converting changes construction (`.make`) and the `source` getter's relationship to a stored field, so it is not behaviour-preserving without a recorded deviation.
- fix: Either model it as `S.Class<DocumentSection>($I`DocumentSection`)({ heading: Heading, depth: HeadingDepth, range: MarkdownRange, children: S.Array(FlowContent), text: S.String, bodyRange: MarkdownRange, documentSource: S.String })` keeping the `source`/`body` getters and constructing via `.make`, recorded under the schema-first deviation entry; or record in Port notes → Deviations why this model stays a plain class.

### fable-2-8
- file: scratchpad/effected/markdown/Markdown.ts:236
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 13 (prefer schema defaults and transformations over ad-hoc fallback logic); AGENTS.md 'Apply schema defaults when safe'; D9 (changing `.make({})` output is a section-14 deviation)   evidence: The public parse defaults live in two `??` helpers, `dialectOf` (236) and `frontmatterOf` (244), while `MarkdownParseOptions` (98-101) declares both fields `S.optionalKey` with no default; `MarkdownFormattingOptions` re-spreads the same optional pair into a fresh `MarkdownParseOptions` at MarkdownFormat.ts:803-806. Upstream is identical, so no behaviour divergence exists today.
- failure: Defaults are enforced by call-site fallbacks rather than the schema, so a consumer decoding or constructing options cannot observe the `gfm`/`false` defaults through the schema; applying `withConstructorDefault` would change the encoded shape of `.make({})`, so this needs a law:13 deviation entry, not a silent change.
- fix: Introduce a resolved-options schema (`S.Struct({ dialect: MarkdownDialect, frontmatter: S.Boolean })` with `S.withDecodingDefault`s) that `MarkdownParseOptions` decodes into, derive `dialectOf`/`frontmatterOf` from it, and record the law:13 deviation if the constructor output changes; otherwise leave as is.

### fable-2-9
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:94
- class: docs   severity: backlog
- standard: standards/effect-first-development.md EF-12 / 'meaningful annotation metadata via `$I.annote`'; .patterns/jsdoc-documentation.md 'Described links' (TSDoc link syntax is a doc carrier, not prose)   evidence: The runtime description string reads `"One structured diagnostic: its (MarkdownParseErrorCode:type), a human-readable `message`…"` — the TSDoc declaration-reference `{@link (MarkdownParseErrorCode:type)}` from the class JSDoc was copied into the schema annotation with the braces stripped, leaving the bare `(MarkdownParseErrorCode:type)` token in catalog/docgen output.
- failure: The schema's description annotation contains TSDoc link syntax residue and reads as broken prose wherever annotations are rendered.
- fix: Change the annotation text to `"…its MarkdownParseErrorCode, a human-readable `message`…"`.

### fable-2-10
- file: scratchpad/effected/markdown/MarkdownDocument.ts:343
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md 'Category annotation' (categories describe an exported symbol's role) and 'Tag order' (tags are for exported symbols)   evidence: The `depth` field inside the `SectionQueryOptions` `S.Struct` carries a full export-style JSDoc block with `**Details**`, `@category type-level` and `@since 0.0.0` (343-354) although it is a runtime struct field, not an export, and `type-level` is the wrong role for a schema field; the same prose is already carried by the field's `annotateKey` description and belongs in the exported schema's Details.
- failure: Docgen/category tooling sees an export-style block on a non-export with a misleading category; readers get the field's semantics in three places.
- fix: Drop the `@category`/`@since` tags from the field block (keep a one-line comment or move the 'equality, not a maximum' prose into `SectionQueryOptions`'s **Details**).

### fable-2-11
- file: scratchpad/effected/markdown/MarkdownDocument.ts:832
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws 'Prefer effect helper modules over native helpers'; standards/effect-laws-v1.md law 5 (Predicate guards over native type tests, by extension)   evidence: `sectionByHeading` discriminates the matcher with `match instanceof RegExp`; `effect/Predicate` exports `isRegExp` (node_modules/effect/dist/Predicate.d.ts:1618) and the file already imports `P` (line 34) and uses `P.isString` on the previous branch. Upstream is identical; no runtime difference.
- failure: A native `instanceof` type test sits beside Effect predicate guards in the same expression; no observable behaviour difference.
- fix: Replace `match instanceof RegExp` with `P.isRegExp(match)`.

### fable-2-12
- file: scratchpad/effected/markdown/MarkdownFormat.ts:974
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form, shared helpers already in scope); AGENTS.md 'Prefer effect helper modules over native helpers'   evidence: Line 972 uses `A.some(ancestry, …)` while the next statement (974) uses the native `ancestry.some(…)` on the same array; `A` is imported at line 33. No runtime difference.
- failure: Mixed native/Effect collection helpers on adjacent lines over the same value; no observable failure.
- fix: Use `A.some(ancestry, (ancestor) => isNoMultilineAncestor(ancestor.type))`.

### fable-2-13
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:67
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md 'TSDoc grammar' / 'Tag order' (tags belong to exported symbols); formatting consistency with every other block in the module   evidence: The schema-field JSDoc blocks close with a `*/` indented one tab short of their opening (`\t*/` instead of `\t */`) at lines 67, 97, 130, 166, 172, 238, 244, 330, 381 and 387, and each carries `@since 0.0.0` on a non-exported struct field; every class-level block in the file is aligned correctly. No gate in the list formats JSDoc.
- failure: Cosmetic: misaligned comment terminators and export-only tags on fields; no behavioural or docgen failure.
- fix: Align the closing ` */` and drop `@since` from the field blocks (the `annotateKey` descriptions already carry the prose).

### fable-2-14
- file: scratchpad/effected/markdown/Frontmatter.ts:426
- class: docs   severity: backlog
- standard: `MarkdownFrontmatter.set` Details (lines 558-562) and the FrontmatterSource fidelity contract (FrontmatterSource.ts:67-70, 'newline is a fidelity field'); D9 (upstream identical, so a change needs a recorded deviation)   evidence: `renderBlock` always joins the fences and body with `\n` (`${open}\n${normalized}${close}`), so `set` on a CRLF document whose capture spans `---\r\n…\r\n---` replaces the block with LF-terminated lines, yielding mixed line endings inside the file, whereas `FrontmatterSource.join` reproduces the fence terminator the scanner recorded. Re-parse is still correct (the parser normalises terminators); upstream behaves identically.
- failure: Fidelity gap, not a correctness bug: a CRLF document gets an LF-terminated frontmatter block after `set`, and the `set` documentation does not say so.
- fix: Document the LF normalisation in `set`'s **Details**, or thread the capture's terminator (the scanner already records it for `FrontmatterSourceBlock.newline`) into `renderBlock` under a recorded deviation.

### fable-2-15
- file: scratchpad/test/markdown/MarkdownDocument.property.test.ts:46
- class: test   severity: backlog
- standard: D10 / section 11.4 (every formatter gets idempotence and fidelity properties); goals/effect-vitest-canon/SPEC.md property guidance   evidence: `sampleSource` (46-49) always separates blocks with blank lines, never nests a heading/emphasis/fence inside a container or next to another block, and uses only BMP neighbours, so the 'normalizing parsed documents is idempotent and retains their semantic tree' property (67) over `Arbitrary.schema(MarkdownFormattingOptions)` cannot reach any of the adjacency hazards fable-2-1 to fable-2-5 reproduce; those bugs survived S3 with the floor green.
- failure: The formatter property floor is satisfied in letter but too weak to detect block-boundary and code-point hazards; the regressions for the required findings will be example-based unless the sample gains an adjacency dimension.
- fix: After the required fixes land, extend `Sample` with an optional blank-line separator, a container prefix (`> ` / `- `) and an astral neighbour literal, and keep asserting semantic retention of `MarkdownFormat.formatToString` under arbitrary options.

REQUIRED: 6
BACKLOG: 9
