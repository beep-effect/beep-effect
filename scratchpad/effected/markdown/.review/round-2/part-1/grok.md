I'll review this markdown slice against the port decisions, the round-1 inventory, and the pinned upstream oracle. First I'm loading the binding notes and the files in scope.Round 1 already classified this slice. I'll check what changed since that commit and read the binding decisions before looking for new defects.Round-1 items and recorded deviations stay closed. I'll scan the nine files for new defects the gates would miss.I'll finish the round-2 review by checking the diagnostic test and the formatter's line-break scan before writing findings.The diagnostic test and the formatter's line scanner are the two open questions. I'll read those next and compare them with the pinned upstream.Sol and Fable already filed part-1 findings. I'll verify those claims against the source before I report.### grok-2-1
- file: scratchpad/effected/markdown/MarkdownFormat.ts:410
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:7-16 and :721-724 (a hazardous conversion is skipped).   evidence: `formatHeading` allows setext when the previous byte is LF. `intro\n# Title\n` therefore becomes `intro\nTitle\n=====\n`. `setextHeadingStart` promotes the open paragraph, so the reparse is one heading whose text is `intro\nTitle`. The same removal of the interrupting `#` makes `> q\n# Title\n` a lazy blockquote paragraph (`blockParser.ts:479-485` continues a paragraph that no longer starts a block) and `- item\n# Title\n` a lazy list-item paragraph. Upstream `MarkdownFormat.ts:300-324` has the same guard. The pinned LF regression (`format.test.ts:118`) only covers a blockquote prefix.
- failure: ATX-to-setext on a heading that interrupts a paragraph, blockquote, or list item absorbs that heading into the preceding block.
- fix: Skip setext unless the heading is at a physical line start and `previousLineBlank` is true, using the CR/LF/CRLF boundaries from grok-2-3. Add regressions for `intro\n# Title\n`, `> q\n# Title\n`, and `- item\n# Title\n`. Record the upstream-bug receipt.

### grok-2-2
- file: scratchpad/effected/markdown/MarkdownFormat.ts:429
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:124-125 (content is never rewritten); CommonMark ATX closing-sequence rule implemented by `reClosingHashes` in `internal/blocks/atxHeading.ts:24`.   evidence: Setext content is copied verbatim. `title #\n=======\n` with `{ headingStyle: "atx" }` emits `# title #`. The ATX start then strips `/[ \t]+#+[ \t]*$/`, so the heading text becomes `title`. Upstream emits the same splice.
- failure: A literal trailing hash run in setext content becomes an ATX closing sequence and the heading text loses that run.
- fix: After composing `content`, skip the atx conversion when `reClosingHashes` or `reOnlyTrailingHashes` would strip it. Add a render-equivalence regression for `title #\n=======\n`. Record the upstream-bug receipt.

### grok-2-3
- file: scratchpad/effected/markdown/MarkdownFormat.ts:295
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the dash guard at MarkdownFormat.ts:380 and `format.test.ts:55-57`; `internal/preprocess.ts:70-72` (CR, LF, and CRLF all terminate lines).   evidence: `lineStartOf` stops only on LF. For `para\r***\r`, `previousLineBlank` hits `lineStart === 0` and returns true, so `thematicBreakChar: "-"` rewrites the break to `para\r---\r`. `setextHeadingStart` runs before `thematicBreakStart` (`blockRegistry.ts:94-95`) and promotes the paragraph to a depth-2 heading. The same scan returns true for `\nb\r***` because it treats the blank line before `b` as the previous line. Upstream `MarkdownFormat.ts:203-228` is the same function. A naive "also stop on CR" plus the existing backoff mis-classifies a blank bare-CR line (`a\r\r***`): the backoff assumes the byte at `lineStart - 1` is LF.
- failure: A `-` thematic-break rewrite is emitted after a non-blank CR-terminated line, and the result re-parses as a setext heading. The LF twin is pinned to stay unchanged.
- fix: Stop `lineStartOf` on `0x0a` or `0x0d`. In `previousLineBlank`, back up over a CR only when the byte at `lineStart - 1` is LF. Keep the skip. Add `para\r***\r` and `\n\nb\r***\r` regressions. Record the upstream-bug receipt.

### grok-2-4
- file: scratchpad/effected/markdown/MarkdownFormat.ts:483
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the intraword `_` guard named at MarkdownFormat.ts:12-13; CommonMark §6.2 flanking over code points, already implemented at `internal/inlines/emphasis.ts:110-133`.   evidence: `ALPHANUMERIC` is `/[\p{L}\p{N}]/u`, but the guard tests `source.charAt(start - 1)` and `source.charAt(end)`. A lone surrogate never matches that regex. `𝒜*foo*𝒜\n` (U+1D49C, `\p{L}`) is rewritten to `𝒜_foo_𝒜\n`. `scanDelims` classifies the full code point, and `_` then fails `canOpen`/`canClose` because it is intraword. `A*foo*\n` stays emphasized because the BMP letter matches. Upstream uses the same `charAt` test. This is the formatter check; the round-1 parser flanking repair does not cover it.
- failure: `_` normalization drops emphasis whenever an astral letter or digit sits immediately outside the span.
- fix: Test the neighbouring code point, stepping back over a valid surrogate pair and forward by 1 or 2 units, the way `emphasis.ts:113-121` does. Add left-side, right-side, and two-sided astral regressions. Record the upstream-bug receipt.

### grok-2-5
- file: scratchpad/effected/markdown/MarkdownFormat.ts:523
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:124-125 (content is never rewritten); a closing fence is a line of its own (`internal/blocks/code.ts:97-106`).   evidence: An unclosed fence runs to the end of its last content line (`blockParser.ts:505` sets `lastLineLength` to `currentLine.length`, terminator excluded). `formatFence` then walks backward over fidelity characters. ```` ```\nfoo``` ```` and ```` ```\nfoo```\n ```` therefore replace the content backticks as well as the opener, producing `~~~\nfoo~~~` and `~~~\nfoo~~~\n`. Those backticks are not a closing-fence line (`foo``` ` fails `reClosingCodeFence`), so the code value changes from `foo``` ` to `foo~~~`. Upstream has the same walk.
- failure: `fenceChar` normalization rewrites code content when an unclosed fence's last line ends in a run of the fence character.
- fix: Emit the closing edit only when the span's last line, from a CR-aware `lineStartOf(end)`, is optional indent plus a pure run of the fidelity character of length at least 3. Otherwise emit the opening edit alone. Regression: both inputs keep the content backticks and re-parse with value `foo``` `. Record the upstream-bug receipt.

### grok-2-6
- file: scratchpad/effected/markdown/MarkdownFormat.ts:461
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:7-16; `reThematicBreak` in `internal/blocks/thematicBreak.ts:13`, tried before list starts.   evidence: `listItemStart` returns 1 after `parseListMarker` advances past the marker, so `* - -\n` is three nested lists on one line and `- - -\n` is a thematic break. `formatList` replaces each item marker independently. `{ bulletChar: "-" }` turns `* - -\n` into `- - -\n`; `{ bulletChar: "*" }` turns `- * *\n` into `* * *\n`. Each list simulates only its own marker, so a per-list check on `* + +` with target `-` never sees the combined `- - -`. Upstream emits the same one-character edits.
- failure: Bullet normalization of a marker-only nested-list line produces a thematic break and the list structure disappears.
- fix: On each source line, project every unordered-list marker that this formatting pass would rewrite, and skip every bullet edit on that line when the projection matches `reThematicBreak` at indent under 4. Add regressions that leave `* - -\n`, `- * *\n`, and `* + +\n` unchanged under targets `-`, `*`, and `-`. Record the upstream-bug receipt.

### grok-2-7
- file: scratchpad/effected/markdown/MarkdownFormat.ts:974
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:23-26 and the `UnsupportedTarget` channel; `internal/preprocess.ts:70-72`.   evidence: The container guard rejects a replacement only when `content.includes("\n")`. `NO_MULTILINE_ANCESTORS` includes blockquote, list, list item, and table cell. Replacing the text of `> before\n` with `one\r# ESCAPE` succeeds and yields `> one\r# ESCAPE\n`. The second line has no `>` prefix, so the reparse is a blockquote paragraph `one` plus a root heading `ESCAPE`. Replacing a table cell with `one\rtwo` likewise succeeds and splits the row. Upstream checks only `\n`.
- failure: A bare CR is a line terminator, so a multiline replacement inside a prefixed or single-line container is applied and changes structure outside the target slot.
- fix: Treat both `0x0a` and `0x0d` in `content` as multiline and fail `UnsupportedTarget` with the existing detail. Add blockquote, heading, and table-cell regressions. Record the upstream-bug receipt.

### grok-2-8
- file: scratchpad/effected/markdown/MarkdownFormat.ts:947
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:725-728; heading closing-hash escape at `internal/stringify.ts:323` and `:498`, which runs only when `context.inHeading`.   evidence: A string replacement is rendered inside a synthetic paragraph (`inHeading: false`), then spliced into the target span. Replacing the text of `# before\n` with `after #` yields `# after #`. `reClosingHashes` then strips the trailing hash, so the heading text is `after`. The heading serializer would have emitted `\#`. Upstream uses the same paragraph scaffold.
- failure: A literal `#` at the end of an ATX heading text replacement is stored unescaped and disappears on reparse.
- fix: When the target's ancestry contains an ATX heading and the replacement occupies the end of that heading's content, apply the existing closing-sequence escape to the rendered text before splicing. Add a regression that `# before\n` plus `after #` re-parses as heading text `after #`. Record the upstream-bug receipt.

### grok-2-9
- file: scratchpad/effected/markdown/MarkdownFormat.ts:958
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:725-728; `internal/inlineTypes.ts:109` (links do not nest).   evidence: `PHRASING_TYPES` includes `link` and `linkReference`, and a phrasing replacement is stringified as its own paragraph. Replacing the text of `[outer](/a)\n` with a `Link` to `/b` yields `[[inner](/b)](/a)\n`. The inline parser keeps the inner link and drops the outer destination. Upstream admits the same fragment.
- failure: A link or link-reference fragment spliced inside an existing link removes the surrounding link on reparse, and `modify` succeeds.
- fix: Before rendering, fail `UnsupportedTarget` when the replacement root or any descendant is `link` or `linkReference` and an ancestor of the target is `link` or `linkReference`. Add a regression that the outer `/a` link survives or the effect fails with that code. Record the upstream-bug receipt.

### grok-2-10
- file: scratchpad/effected/markdown/MarkdownFormat.ts:971
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); MarkdownFormat.ts:18-22 and :725-728 (a replacement re-parses as the fragment that was requested).   evidence: `modify` stringifies the fragment in an isolated root and splices it without looking at the previous sibling. Replacing the heading in `para\n# h\n` with `Paragraph([Text("x")])` yields `para\nx\n`, one paragraph. Replacing the paragraph in `- item\n\npara\n` with `Code.make({ value: "x" })` stringifies as four-space indented code (`internal/stringify.ts:988-989`). That indent continues the list item and is short of a nested code block, so the reparse is a paragraph `x` inside the item. Upstream has no previous-sibling check.
- failure: A flow replacement merged onto the preceding block changes category: a separate paragraph disappears, or a code block becomes list-item prose. `modify` still succeeds.
- fix: For a flow slot, fail `UnsupportedTarget` when the previous line is non-blank and the replacement's first line cannot interrupt a paragraph, and when the previous root sibling is a list or footnote definition and the rendered body is an indented language-less code block (render that case fenced, matching `serializeCode`'s `forceFence` path, or fail). Add regressions for both sources. Record the upstream-bug receipt.

### grok-2-11
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:94
- class: docs   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (a described link is a doc carrier); effect-first-development EF-12 (annotation text is prose).   evidence: The schema description is `"One structured diagnostic: its (MarkdownParseErrorCode:type), a human-readable \`message\`…"`. That is the TSDoc declaration reference with the braces removed. Docgen stays green because it does not lint annotation prose.
- failure: Catalog and docgen render a broken `(MarkdownParseErrorCode:type)` token in the diagnostic's description.
- fix: Write the annotation as "its MarkdownParseErrorCode, a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`)."

### grok-2-12
- file: scratchpad/effected/markdown/MarkdownDocument.ts:119
- class: schema   severity: backlog
- standard: D5; law 17; round-1 req-7, which schema'd `DocumentHeading`, `DocumentLink`, and `SectionQueryOptions`.   evidence: `DocumentSection` is still a plain class constructed with `new` at line 743. It carries `heading`, `depth`, `range`, `children`, `text`, and `bodyRange` plus a private source used by the `source` and `body` getters. No Port-notes entry explains why this navigation model stayed a class.
- failure: The section model has no schema, so the D10 round-trip floor cannot derive an arbitrary or an equivalence for it.
- fix: Model it as an `S.Class` with those six fields plus `documentSource: S.String`, keep the getters, construct it with `.make`, and record the schema-first deviation. Leaving the class requires a Port-notes rationale instead.

### grok-2-13
- file: scratchpad/test/markdown/MarkdownDocument.property.test.ts:46
- class: test   severity: backlog
- standard: D10 (formatter idempotence and fidelity properties).   evidence: `sampleSource` always separates blocks with `\n\n`, uses only BMP words, and never builds a marker-only nested list, an unclosed fence, a CR terminator, a trailing setext hash, or an interrupting ATX heading. The property at line 67 can stay green while grok-2-1 through grok-2-6 change the tree.
- failure: The formatter fidelity property does not generate the block-boundary or code-point inputs those bugs need.
- fix: After those fixes land, extend `Sample` with an optional blank-line separator, a container prefix, a CR terminator, a trailing hash, and an astral neighbour, and keep the semantic-retention assertion.

REQUIRED: 10
BACKLOG: 3
