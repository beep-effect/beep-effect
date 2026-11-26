---
title: Structural punctuation, markers and the BOM are whitespace leaves in the CST
date: 2026-11-26
reversal: Add delimiter, indicator, marker and bom variants to CstNodeType, map each token kind to its own variant in leafNodeTypes, and match those variants in the CST visitor.
governs:
  - src/internal/cst-parser.ts#leafNodeTypes
  - src/internal/cst-parser.ts#parseFlowCollection
  - src/internal/cst-visitor.ts#isIndicatorNode
  - src/internal/cst-visitor.ts#walkFlowMapChild
enforcedBy: []
---

Every token that is punctuation rather than content becomes a `whitespace` leaf whose `source` keeps the raw text: the flow `,`, the `:`, `?` and `-` indicators when consumed as generic leaves (inside flow context), the `---` and `...` markers, the flow brackets (a collection's own delimiters and any consumed outside their parse path), the zero-width `block-map-start` and `block-seq-start` markers, and the byte-order mark. The CST keeps every source character without a node type per punctuation kind, and the visitor tells indicators apart by their source (`isIndicatorNode`), skipping the rest as trivia.

Rejected: dedicated `CstNodeType` variants for delimiters, indicators, markers and the BOM; they widen the fifteen-category vocabulary every consumer switches on and buy nothing the raw `source` does not already say.
