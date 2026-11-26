---
title: Block-start markers sit at the line indent and collection indents at the indicator or key column
date: 2026-11-25
reversal: Emit block-map-start and block-seq-start at the indicator token's own column and track one indent per line.
governs:
  - src/internal/lexer.ts#createScanner
  - src/internal/lexer.ts#compactKeyPrefix
  - src/internal/cst-parser.ts#findFirstSeqEntryColumn
  - src/internal/cst-parser.ts#skipScopeMarker
  - src/internal/cst-parser.ts#isDeeperValueMarker
  - src/internal/cst-parser.ts#parseBlockMapNode
  - src/internal/cst-parser.ts#parseBlockSequenceInner
  - src/internal/cst-parser.ts#entryIsImplicitMap
  - src/internal/cst-parser.ts#parseSequenceEntryContent
  - src/internal/cst-parser.ts#parseImplicitBlockMapping
  - src/internal/cst-parser.ts#parseImplicitMapNode
  - src/internal/cst-parser.ts#parseImplicitMapToken
enforcedBy: []
---

The zero-width `block-map-start` and `block-seq-start` markers carry the line indent as their column, so the parser can tell which block scope a mapping or sequence belongs to; a sequence already open at an indent is not switched to a map there. A compact explicit key (`- ? k`, `? ? k`, `: ? k`) is the exception: the line indent belongs to the enclosing collection, so the key's mapping opens at the `?` column, or its start marker is lost and it opens only at its first `:`, behind its own key.

`collectionIndents` records the open block collections in ascending order, keyed by the column of a `-` or `?`, or of the key an implicit `:` closes (`nodeStartCol`), so a compact `- a: x` mapping records column 2. Locking a dedented line drops the started-scope entries and open collections deeper than it, so the same indent can open a new scope later; a document marker clears both, so the next document gets fresh start markers.

The CST parser reads the markers as scope hints, not as one marker per collection. A start marker at or left of an open scope's indent is a re-emitted marker and is skipped with no node (`skipScopeMarker`); a block sequence's loop only ever meets such a marker, since entry parsing takes deeper ones. The lexer queues a sequence marker immediately before its entry, at the line indent, so a sequence opened by `? - a` is parsed at its first entry's column (KK5P, M5DY, M2N8); under `- ? - k` the line indent already opened a sequence, so no marker is queued and a deeper `-` after the `?` opens the key's sequence itself. A marker queued for a `:` deeper than its `?` (`? k\n : v`) is that entry's value once the key holds content; with no key yet (`?\n  : v`) it opens the key's mapping. A mapping inside a sequence entry (`- a: 1`) has no marker: `parseImplicitBlockMapping` wraps it, its entry indent is the first key's column (a marker at that column continues it, a deeper one nests), a same-indent `- ` after a dangling `:` is its compact sequence value because no new marker is queued once an earlier compact sequence opened that indent, and a deeper `-` with no marker opens a nested sequence. A marker right after an entry's `-` means the lexer already opened the entry's mapping at a compact `?` (`- ? k: v`); an entry whose next token is a deeper `-` parses that nested sequence before any implicit-mapping check, so it cannot absorb the nested `- key: value` pairs.

Rejected: markers at the indicator column, and one indent per line, which mis-nest compact sequences and compact explicit keys; a parser that opens a collection for every marker, which nests a re-emitted same-indent marker (`test/internal/cst-parser.round-2.test.ts`, the repeated same-indent scope marker case).
