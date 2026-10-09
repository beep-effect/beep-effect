### sol-1-1
- file: scratchpad/effected/markdown/internal/stringify.ts:1008
- class: bug   severity: required
- standard: D9, D11, and EFFECTED_PORT_GOAL.md §14 (`upstream-bug`, verified by reproduction)   evidence: A read-only Node probe constructed a schema-valid root containing a table with 150,000 repetitions of a constructed one-cell `TableRow`, then called `Markdown.stringifyResult(root)`. It threw `RangeError: Maximum call stack size exceeded`, with the first stack frame at `serializeTable:1008:27`. The same probe against the pinned oracle threw the same error at its `serializeTable:1018:27`. Bun returned `Success` for this input, so Bun execution does not expose the Node failure.
- failure: Computing the column count spreads one argument per table row into `Math.max`. A sufficiently tall, shallow table exceeds Node’s argument limit. Serialization throws outside the advertised `Result` failure channel even though the tree satisfies the schemas and stays below the nesting limit. This is an inherited upstream bug, with no recorded deviation covering it.
- fix: Replace the spread with a reduction, such as `A.reduce(table.children, 1, (maximum, row) => Math.max(maximum, row.children.length))`. Add a Node regression for a tall table and record the verified upstream bug through §14.

### sol-1-2
- file: scratchpad/effected/markdown/internal/segments.ts:31
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion   evidence: Every `sourceOffsetAt` call restarts traversal at the first segment. `InlineParser.position` calls this helper for both endpoints of each materialized inline node. For a paragraph containing `n` lines of `a *b*\n`, there are Θ(n) segments and Θ(n) positioned nodes, producing Θ(n²) segment visits. A read-only helper probe querying every segment start counted 32,040,000 visits for 8,000 segments, 128,008,000 for 16,000, and 512,016,000 for 32,000; observed times were 38.50 ms, 149.84 ms, and 593.78 ms. The pinned oracle shares this implementation; required severity rests on the available algorithmic-class improvement, not a claimed port regression.
- failure: Source-position bookkeeping becomes quadratic on ordinary long paragraphs containing inline markup. Increasing paragraph length slows parsing disproportionately despite the already available ordered segment index.
- fix: Binary-search the ordered segment table for the last segment whose `textOffset` is at or before the queried index, preserving the existing fallback, gap, and exclusive-end behavior. This reduces each lookup to O(log n) and the positioning work for this input family to O(n log n).

### sol-1-3
- file: scratchpad/effected/markdown/internal/stringify.ts:612
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion   evidence: For every text child, the loop revisits and concatenates all subsequent contiguous text siblings. A paragraph containing `n` one-character `Text("x")` children therefore performs exactly `n(n−1)/2` lookahead iterations, although these values need no following-text inspection to escape. A read-only serialization probe observed 48.59 ms for 4,000 siblings, 162.85 ms for 8,000, and 560.63 ms for 16,000, with successful output lengths of 4,001, 8,001, and 16,001. The pinned oracle contains the same unconditional suffix scan; required severity rests on the algorithmic-class improvement.
- failure: Serializing a valid synthesized paragraph with adjacent text nodes takes Θ(n²) work for Θ(n) output. Node boundaries introduced by editing or tree construction can make otherwise simple prose expensive to serialize.
- fix: Compute each contiguous text run’s endpoint and backing text once, then derive following-text views from per-node offsets. Preserve individual node boundaries and `escapeStyle` when emitting; merging text nodes directly would change the existing boundary-sensitive escaping rules.

### sol-1-4
- file: scratchpad/effected/markdown/internal/lineIndex.ts:12
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; the completed Identity step requires annotations on schemas and fields   evidence: The newly introduced `InvalidLineTableError` supplies a namespaced constructor identifier but no `$I.annote(...)` metadata or field annotation. A read-only runtime probe of `InvalidLineTableError.ast.annotations` showed the identifier and Effect’s generated metadata, with no `title` or `description`; `InvalidLineTableError.fields.message.ast.annotations` was `undefined`. The newly introduced `UnknownInlineDialectError` at `internal/inlineRegistry.ts:35` has the same omission.
- failure: These error schemas do not satisfy the required schema metadata contract. Runtime schema consumers receive no meaningful title or description for the errors or their message fields. Passing an IdentityComposer identifier alone does not supply those annotations.
- fix: Add meaningful `$I.annote("InvalidLineTableError", ...)` and `$I.annote("UnknownInlineDialectError", ...)` metadata to their declarations, and annotate each `message` field. This is schema annotation work from the Identity step, separate from the deferred S2 JSDoc conversion.

### sol-1-5
- file: scratchpad/effected/markdown/internal/lineIndex.ts:27
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements” and “Carrier policy”; S2 deferral in the review brief   evidence: `LineIndex` retains forbidden `@remarks` carriers at lines 27, 46, and 64. Its exported class documentation also lacks canonical `@category`, `@since`, and a titled Example. Exported value documentation elsewhere in the reviewed internal surface, including `sourceOffsetAt` and `stringifyTree`, likewise lacks the required tags and Examples.
- failure: The reviewed documentation is not ready for the S2 JSDoc/docgen contract. This is deferred documentation work and does not block the current round.
- fix: During S2, convert the `@remarks` bodies to `**Details**`, retain their substantive prose, and add canonical categories, `@since 0.0.0`, and meaningful compilable `**Example** (Title)` sections to the owning value declarations.

REQUIRED: 4
BACKLOG: 1