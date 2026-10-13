### sol-2-1
- file: scratchpad/effected/markdown/MarkdownFormat.ts:429
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `MarkdownFormat.format` promises conservative marker normalization that preserves content.   evidence: A read-only Bun probe against the reviewed commit and pinned oracle formatted `"title #\n=======\n"` with `{ headingStyle: "atx" }`. Both returned `"# title #\n"`. Reparsing changed the heading’s text from `"title #"` to `"title"`.
- failure: Setext-to-ATX conversion copies the original content directly after the opening hashes. A literal trailing hash run preceded by whitespace becomes an ATX closing sequence, silently deleting heading content.
- fix: Skip conversion when the composed content would introduce an unescaped ATX closing sequence, consistent with the formatter’s conservative policy. Add a render-equivalence regression for trailing literal hashes and record the verified upstream bug through section 14.

### sol-2-2
- file: scratchpad/effected/markdown/MarkdownFormat.ts:406
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the formatter’s semantic-preservation contract, also asserted by `scratchpad/test/markdown/MarkdownDocument.property.test.ts`.   evidence: Read-only probes against both implementations formatted `"intro\n# Title\n"` with `{ headingStyle: "setext" }` into `"intro\nTitle\n=====\n"`. Before formatting, the document contained a paragraph `"intro"` followed by a heading `"Title"`; afterward, it contained one heading with text `"intro\nTitle"`.
- failure: ATX-to-setext conversion checks the heading’s content and indentation but does not protect the boundary with a preceding paragraph. Removing the interrupting ATX marker absorbs that paragraph into the new setext heading.
- fix: Require a safe preceding block boundary before converting to setext; the smallest conservative repair is to skip conversion unless the preceding physical line is blank or absent. Add the adjacent-paragraph regression and record the upstream bug.

### sol-2-3
- file: scratchpad/effected/markdown/MarkdownFormat.ts:295
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the explicit thematic-break safety guard at `MarkdownFormat.ts:380` and the regression contract in `scratchpad/test/markdown/format.test.ts`.   evidence: Read-only probes against both implementations formatted `"para\r***\r"` with `{ thematicBreakChar: "-" }` into `"para\r---\r"`. Reparsing changed a paragraph followed by a thematic break into a depth-two setext heading.
- failure: `lineStartOf` recognizes only LF. On a document using lone CR terminators, `previousLineBlank` incorrectly treats the thematic break’s line as the first line and permits the hazardous dash rewrite.
- fix: Make the line-boundary helpers recognize LF, lone CR and CRLF, consuming a pair only for an actual CRLF terminator. Retain the skip-on-hazard behavior and add the lone-CR regression.

### sol-2-4
- file: scratchpad/effected/markdown/MarkdownFormat.ts:483
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `formatEmphasis`’s explicit intraword-underscore guard.   evidence: Read-only probes against both implementations formatted `"𐐀*hi*𐐀\n"` with `{ emphasisChar: "_" }` into `"𐐀_hi_𐐀\n"`. The original parse contained an emphasis node around `"hi"`; the formatted parse contained only literal text. U+10400 is an astral letter. The recorded round-1 parser-flanking repair addresses delimiter parsing; this evidence exercises the formatter’s separate boundary check.
- failure: `charAt(start - 1)` and `charAt(end)` supply surrogate halves to the Unicode alphanumeric regex. The guard misses astral letters and introduces underscores at an intraword boundary, removing emphasis.
- fix: Classify complete code points immediately before and after the source span, stepping backward over a valid surrogate pair while retaining UTF-16 offsets. Add left-side, right-side and two-sided astral-letter regressions.

### sol-2-5
- file: scratchpad/effected/markdown/MarkdownFormat.ts:974
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `MarkdownFormat.modify` explicitly promises `UnsupportedTarget` for multiline replacements inside containers whose continuation prefixes cannot be reproduced.   evidence: In read-only probes against both implementations, parsing `"> before\n"`, selecting its text node and replacing it with `"one\r# ESCAPE"` succeeded with `"> one\r# ESCAPE\n"`. Reparsing produced a blockquote containing `"one"` followed by a root-level heading `"ESCAPE"`. Replacing a table cell with `"one\rtwo"` likewise succeeded and created two body rows.
- failure: The multiline check looks only for `"\n"`. A lone CR is also a markdown line terminator, so it bypasses the container guard and changes structure outside the intended replacement slot.
- fix: Detect both CR and LF in rendered replacement content before accepting a splice inside `NO_MULTILINE_ANCESTORS`. Add blockquote, heading and table regressions requiring the existing typed `UnsupportedTarget` failure.

### sol-2-6
- file: scratchpad/effected/markdown/MarkdownFormat.ts:947
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `modify`’s literal-string replacement contract and the existing heading closing-hash escape policy in `internal/stringify.ts`.   evidence: Read-only probes against both implementations parsed `"# before\n"`, selected its text node and called `modifyToString(document, target, "after #")`. Both succeeded with `"# after #\n"`. Reparsing yielded heading text `"after"`, losing the requested literal `#`.
- failure: Plain-string replacements always render inside a synthetic paragraph. That loses the destination heading context, so the stringifier omits the closing-hash protection it applies when rendering an actual heading.
- fix: Apply the existing heading closing-sequence escaping when the replacement occupies the end of an ATX heading, accounting for the surrounding source. Add a replacement-fidelity regression for `"after #"` and record this separate upstream context-escaping defect.

### sol-2-7
- file: scratchpad/effected/markdown/MarkdownFormat.ts:958
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `modify`’s context-compatible fragment replacement contract.   evidence: Read-only probes against both implementations parsed `"[outer](/a)\n"`, selected the `"outer"` text node and replaced it with a `Link` fragment whose URL was `"/b"` and whose text was `"inner"`. Both succeeded with `"[[inner](/b)](/a)\n"`. Reparsing retained only the `"/b"` link; the outer `"/a"` link disappeared.
- failure: Phrasing-category membership admits a link fragment inside an existing link. Rendering the fragment as an independent paragraph hides the nesting hazard, and the successful splice invalidates the surrounding link.
- fix: Before rendering, reject a replacement containing `Link` or `LinkReference` when its destination lies inside a `Link` or `LinkReference`, using the existing typed modification-error channel. Check nested replacement descendants as well as the replacement root, and add a regression proving the outer link survives or the operation fails typed.

REQUIRED: 7
BACKLOG: 0