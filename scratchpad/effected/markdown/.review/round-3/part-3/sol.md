### sol-3-1
- file: scratchpad/effected/markdown/internal/blocks/table.ts:513
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `Markdown.parseResult`’s Result boundary and shallow-input hardening contract.   evidence: A read-only Node v24.21.0 probe called `Markdown.parseResult("| " + "a\\|".repeat(150000) + " b |\n| --- |\n")`. The reviewed port threw `RangeError: Maximum call stack size exceeded`, with the first stack frame at `table.ts:513`. The pinned oracle reproduced the same failure at its corresponding `addRow` operation. Bun accepted this input, confirming that Bun-only verification misses the Node failure.
- failure: One valid, shallow table cell produces an unbounded segment array. Expanding that array into `push` arguments exceeds Node’s argument limit and throws outside the typed Result channel. This is independent of round 2’s closed definition-extraction spread finding.
- fix: Append `content.segments` iteratively. Apply the same bounded append to the table module’s other unbounded segment spreads at lines 396 and 586. Add a focused Node regression for the escaped-pipe cell and record the upstream bug under section 14.

### sol-3-2
- file: scratchpad/effected/markdown/internal/stringify.ts:556
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the render-equivalence contract in `Markdown.ts:508` and `scratchpad/test/markdown/e2e/stringify-roundtrip.e2e.test.ts`.   evidence: Read-only probes against both the reviewed port and pinned oracle parsed `[x](a&#10;b)` as a link with URL `"a\nb"`, then serialized it as `"[x](<a\nb>)\n"`. Reparsing produced text and an HTML node instead of a link. The same failure occurs for images and reference definitions. The adjacent `titleSuffix` helper at line 578 serializes `[x](u "a&#10;&#10;b")` with a physical blank line inside the title; reparsing produces two paragraphs and loses the link.
- failure: Destination and title escaping emits decoded line terminators as active markdown source. Angle brackets do not make a newline-containing destination valid, and decoded title newlines can terminate the surrounding paragraph. These are separate failures from round 2’s closed ampersand double-decoding finding.
- fix: After escaping literal ampersands, encode decoded CR and LF as numeric character references in both `destination` and `titleSuffix`. Retain the existing destination and quote escaping. Add render-equivalence regressions for links, images, definitions and blank-line titles, and record the upstream bug under section 14.

### sol-3-3
- file: scratchpad/effected/markdown/internal/stringify.ts:238
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `Markdown.stringifyResult`’s render-equivalence contract and the serializer’s block-opening protection.   evidence: Both implementations parse `a&#13;# heading` as one paragraph containing the text `"a\r# heading"`. Serialization returns `"a\r# heading\n"`. Using the existing HTML writer and normalizer, the round trip changes `<p>a # heading</p>` into `<p>a</p><h1>heading</h1>`. The analogous `a&#13;- item` introduces a list.
- failure: `escapeText` recognizes LF but lets decoded CR fall through to raw emission at line 340. The preprocessor subsequently treats that CR as a physical line boundary, while the serializer never applies its line-start escaping to the following characters. Literal paragraph content becomes new blocks.
- fix: Emit decoded CR as `&#13;` in canonical text escaping so it remains inline content rather than a source-line boundary. Add paragraph and image-alt regressions with block-opening characters after decoded CR, and record the upstream bug under section 14.

### sol-3-4
- file: scratchpad/effected/markdown/internal/stringify.ts:262
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the serializer’s explicit soft-break preservation contract at lines 239–253 and its render-equivalence property.   evidence: Read-only probes against the reviewed port and pinned oracle parsed `"a&#32;&#32;&#32;\nb"` into a paragraph containing one Text value, `"a  \nb"`. Serialization emitted `"a  \nb\n"`. Reparsing introduced a `Break` node with `breakStyle: "spaces"`; normalized rendering changed from `<p>a b</p>` to `<p>a<br>b</p>`.
- failure: A Text newline is emitted physically without checking whether the preceding emitted spaces form markdown’s hard-break marker. Decoded spaces followed by a soft newline acquire a visible hard break.
- fix: Emit `&#10;` instead of a physical newline when the preceding emitted text would make it a hard break. Account for adjoining Text siblings as well as spaces within one value. Add the decoded-space regression and record the upstream bug under section 14.

### sol-3-5
- file: scratchpad/effected/markdown/internal/blocks/table.ts:396
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; section 14 (`upstream-bug`); the table parser’s documented ability to reclaim preceding paragraph lines when promoting the final line into a header.   evidence: A read-only `tableHeaderStart.trigger` probe supplied `n` preceding paragraph source segments and a final header containing `n` escaped pipes. Instrumented segment-field reads were **762,528** for `n = 500`, **3,025,028** for `n = 1,000`, and **12,050,028** for `n = 2,000`; the pinned oracle produced identical counts. Each surviving interval calls `sliceWithSegments`, whose loop visits the entire source segment array. Thus an input of linear size performs Θ(n²) provenance work.
- failure: Promoting a long paragraph into a table repeatedly rescans all preceding lines for every escaped pipe in the header. Doubling both dimensions approximately quadruples the work, despite the output remaining one reclaimed paragraph and one shallow table cell.
- fix: Maintain a forward segment cursor while processing the ordered escape-drop intervals, visiting each source segment and drop once. Preserve the current source offsets and resulting segment boundaries. Add a segment-read bound regression and record the algorithmic upstream bug under section 14.

REQUIRED: 5
BACKLOG: 0