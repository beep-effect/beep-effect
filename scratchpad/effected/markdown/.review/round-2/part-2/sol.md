### sol-2-1
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:179
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; `MarkdownVisitor.visit` promises demand-driven traversal and efficient early termination.   evidence: The loop eagerly evaluates `A.map(children, ...)`, allocating a pair and reading the child for every sibling before visiting the first child. A read-only `bun -e` probe constructed schema-valid roots with 10,000 and 50,000 paragraph children, instrumented child-array reads, and collected `Stream.take(MarkdownVisitor.visit(root), 2)`. The port read **10,000** and **50,000** children respectively; the pinned oracle read **1,024** in both cases because of stream chunking. For a fixed event prefix, the port adds Θ(n) work and allocation in sibling count where the oracle’s work remains bounded by the fixed stream chunk.
- failure: An outline or search consumer that stops after a few events still scans and allocates across an entire wide sibling array. The visitor loses upstream’s bounded cost for partial traversal, despite returning only the requested prefix.
- fix: Replace `A.map` with lazy `Iterable.map` from `effect/Iterable`, retaining the indexed pair callback and existing traversal order. Add a regression proving that fixed-prefix consumption does not read every sibling in a wide tree.

### sol-2-2
- file: scratchpad/effected/markdown/Mdast.ts:431
- class: bug   severity: required
- standard: `standards/effect-first-development.md` EF-3 requires synchronous decoding paths to be non-throwing; `Mdast.fromMdastResult` promises a `Result<Root, MdastDecodeError>`. D9 and section 14 permit a verified upstream-bug repair.   evidence: In a read-only `bun -e` probe, `const input = { type: "root", children: [] }; input.children.push(input); Mdast.fromMdastResult(input)` threw **`RangeError: Maximum call stack size exceeded.`** in both the port and the pinned oracle. Normalization recursively maps children before schema decoding can reject the invalid tree. The cycle is not covered by the previous inventory or recorded deviations.
- failure: Malformed foreign input escapes the synchronous API’s `Result` channel. The Effect twin also turns the normalization exception into a defect instead of failing with `MdastDecodeError`.
- fix: Track the current ancestor chain during normalization and return a structured `MdastDecodeError` when a child points back to an ancestor. Preserve repeated references to a shared, acyclic subtree. Add regressions for both the Result and Effect entry points, and record the verified upstream-bug deviation.

### sol-2-3
- file: scratchpad/effected/markdown/internal/inlineParser.ts:752
- class: bug   severity: required
- standard: The parser/visitor hardening contract at `MarkdownVisitor.ts:108` states that parser-produced trees cannot trip the visitor’s depth guard; the guard uses whole-tree depth and `MAX_NESTING_DEPTH = 256`. D9 and section 14 permit a verified upstream-bug repair.   evidence: A read-only `bun -e` probe parsed `"> ".repeat(254) + "***x***\n"`. In both the port and the pinned oracle, `Markdown.parseResult` returned **`Success`**, but visiting that tree produced a terminal **`NestingDepthExceeded`** event at depth **257**, and stringify failed with **`limit 256, actual 257`**. Block nesting and inline nesting are checked independently; this call restarts inline materialization at depth zero.
- failure: A successful parse can produce a tree that the package’s own visitor truncates and its stringifier rejects. Combined block and inline nesting bypasses the advertised document depth limit even though each pass individually stays within its cap.
- fix: Validate the complete materialized root against the existing depth limit before `blockParser` returns its result, throwing the existing `GuardExceeded` carrier so the facade reports a typed parse failure. Add combined block/inline boundary regressions and record the verified upstream-bug deviation.

### sol-2-4
- file: scratchpad/effected/markdown/Mdast.ts:134
- class: bug   severity: required
- standard: D10’s projection fidelity requirement; the mdast admission contract permits missing positions and admits the standard `list.spread` field. D9 and section 14 permit a verified upstream-bug repair.   evidence: A read-only `bun -e` probe admitted a positionless foreign root containing a list with `spread: true` and two ordinary list items. Both the port and the pinned oracle returned **`Success`**, with the decoded list retaining **`spread: true`**, but `Mdast.toMdast(decoded).children[0].spread` returned **`false`**. Admission synthesizes identical sentinel positions for the items, and `listSpread` then derives spread exclusively from their line-number gaps.
- failure: A valid foreign mdast list loses its explicit between-item spacing state during `fromMdastResult → toMdast`. Positionless constructed trees are a supported input, so their supplied semantic field cannot reliably be reconstructed from synthesized positions.
- fix: When item positions are synthetic, preserve the admitted list’s explicit `spread` value. Continue deriving between-item spread from real positions for parsed lists, preserving the existing distinction between item-internal looseness and blank lines between items. Add a positionless `spread: true` round-trip regression and record the verified upstream-bug deviation.

REQUIRED: 4
BACKLOG: 0