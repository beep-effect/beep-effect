---
title: Block-start markers sit at the line indent and collection indents at the indicator or key column
date: 2026-11-25
reversal: Emit block-map-start and block-seq-start at the indicator token's own column and track one indent per line.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/lexer.ts#compactKeyPrefix
enforcedBy: []
---

The zero-width `block-map-start` and `block-seq-start` markers carry the line indent as their column, so the parser can tell which block scope a mapping or sequence belongs to; a sequence already open at an indent is not switched to a map there. A compact explicit key (`- ? k`, `? ? k`, `: ? k`) is the exception: the line indent belongs to the enclosing collection, so the key's mapping opens at the `?` column, or its start marker is lost and it opens only at its first `:`, behind its own key.

`collectionIndents` records the open block collections in ascending order, keyed by the column of a `-` or `?`, or of the key an implicit `:` closes (`nodeStartCol`), so a compact `- a: x` mapping records column 2. Locking a dedented line drops the started-scope entries and open collections deeper than it, so the same indent can open a new scope later; a document marker clears both, so the next document gets fresh start markers.

Rejected: markers at the indicator column, and one indent per line, which mis-nest compact sequences and compact explicit keys.
