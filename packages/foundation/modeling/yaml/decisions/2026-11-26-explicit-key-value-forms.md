---
title: Only an explicit key's value admits a same-line block sequence or compact mapping; the composer rejects the implicit forms
date: 2026-11-26
reversal: Emit an error CstNode from parseBlockValueEnd for a same-line block sequence or compact mapping after an implicit key, or admit both forms after any key.
governs:
  - src/internal/cst-parser.ts#hasOpenExplicitKey
  - src/internal/cst-parser.ts#startsCompactMappingKey
  - src/internal/cst-parser.ts#parseExplicitKeyIndicator
  - src/internal/cst-parser.ts#parseBlockMapToken
  - src/internal/cst-parser.ts#parseBlockMapNode
  - src/internal/cst-parser.ts#parseBlockValueEnd
  - src/internal/cst-parser.ts#parseImplicitMapIndicator
enforcedBy: []
---

The CST parser threads whether the entry being read has a `?` key with no `:` yet (`hasOpenExplicitKey`, or the `sawExplicitKey` flag of a block mapping loop); a mapping that opens with an implicit key can continue with explicit ones (`- a: 1\n  ? b\n  : - 2`). After an explicit key, YAML 1.2 §8.2.2 l-block-map-explicit-value admits s-l+block-indented, so a block sequence on the `:` line (`? key\n: - one`, parsed at its first entry's column) and a compact mapping there (`? key\n: dependencies:\n    x: 1`) are the value. A `?` whose line continues as a compact mapping (`? k: v`, `? : v`) takes that mapping as its key, so a later `:` at the mapping indent is the entry's value, not a sibling. After an implicit key the same tokens (`key: - a`, §8.2.1; `key: a: 1`) stay leaf tokens, the sequence keeps the token column, and the composer rejects them (5U3A, ZCZC).

Rejected: error nodes from the CST parser for the implicit forms, which replace the composer's positioned diagnostic and its recovery with a flat node; admitting both forms after any key, which accepts the invalid 5U3A and ZCZC cases.
