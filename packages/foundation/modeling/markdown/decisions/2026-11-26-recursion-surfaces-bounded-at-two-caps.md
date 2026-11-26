---
title: Parse recursion is capped at container nesting and inline materialization; every other walk is iterative or out of reach
date: 2026-11-26
reversal: Add a depth cap to each recursive walk instead, or drop a cap and accept a RangeError defect on deep input.
governs:
  - src/internal/blockParser.ts#BlockParser
  - src/internal/inlineParser.ts#InlineParser
  - src/internal/limits.ts#MAX_NESTING_DEPTH
  - src/internal/inlines/link.ts#plainTextOf
enforcedBy: []
---

House rule: malformed input yields a typed error or a diagnostic and never a defect, so an unbounded recursion reachable from parse input is a bug. `hardening.test.ts` names each self-recursive surface by number.

Guarded, because depth is input-controlled: (1) `blockParser.addChild` is not recursive but caps container nesting, so no deeper tree is ever built; (2) `materializeBlock` and (3) `collectReferences` walk that tree under the same bound, `collectReferences` indexing link reference and GFM footnote labels so `[^a]: [^b]: ...` nests like any container; (4) `inlineParser.materialize`/`materializeNode`, mutually recursive over an inline tree as deep as the balanced delimiters, carry their own depth counter against the same `MAX_NESTING_DEPTH`.

Iterative on purpose, with no cap wanted (the toml lesson: know what not to guard): (5) `incorporateLine`, one pass per line; (6) `inlineParser.parse`/`parseOne`, a forward-only cursor; (7) `processEmphasis`, whose delimiter stack is what keeps emphasis linear instead of markdown's quadratic DoS vector; (8) the bracket stack in `inlines/link.ts`; (9) `link.plainTextOf`, the image alt flattening, which was recursive and unguarded and died with a `RangeError` on ten thousand nested emphasis markers because it runs while brackets close, before materialization's guard sees the tree, and now uses an explicit stack; (10) `extractDefinitions`, a loop over one paragraph's leading definitions; (11) `LineIndex.positionAt`, a binary search.

Not a surface: (12) the `Schema.suspend` decode of `MarkdownNode`, whose depth on a hand-built or foreign tree is the consumer's to manage (the visitor and stringify surface such a tree typed); (13) the test HTML writer, recursive and deliberately uncapped because it only sees trees this parser built, test-only and in no artifact.

Rejected: a depth cap on every recursive walk, a cap on the delimiter or bracket stacks, and a recursive alt flattening behind materialization's guard.
