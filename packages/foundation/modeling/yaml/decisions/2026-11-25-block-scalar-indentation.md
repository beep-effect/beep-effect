---
title: An explicit block indentation indicator is relative to the parent found by looking back, and zero-indent bodies only exist at document level
date: 2026-11-25
reversal: Add the explicit indicator to the current line indent and accept zero-indent content inside block collections.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/composer/scalars.ts#findParentIndent
  - src/internal/composer/scalars.ts#resolveContentIndent
enforcedBy: []
---

An explicit indentation indicator m gives content indent n+m, where n (YAML 1.2 §8.1.1.1) is found by looking back from the indicator: the key's indentation after a same-line `:` (past a compact sequence's `- `), the column of a same-line `-`, else the highest started block indent (the scalar on its own line, after a tag or anchor). At offset 0 the look-back reads the empty string, which matches neither indicator.

The composer re-decodes the raw CST source, which holds the absolute indentation, so `findParentIndent` repeats the look-back over the full text: past blanks, line breaks, trailing comments (a `#` inside a quoted scalar is not one) and opaque tag or anchor tokens to the introducing `:` or `-`. Without the full text it falls back to m alone, which is right at the top level.

A body with no content lines, or content at indent 0 inside a block structure, is an empty block scalar: zero-indent content is valid only at document level.

Rejected: the line indent as n, which is wrong for compact sequences and scalars on their own line; zero-indent content inside mappings and sequences.
