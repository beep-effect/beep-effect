---
title: The CST parser ends each block scope by comparing token columns with its indent
date: 2026-11-26
reversal: Emit block-end tokens from the lexer when it unwinds collectionIndents, and stop each block mapping and sequence at its end token instead of at a column comparison.
governs:
  - src/internal/cst-parser.ts#blockMapStops
  - src/internal/cst-parser.ts#blockMapSeqStops
  - src/internal/cst-parser.ts#lastNonTriviaIsValueSep
  - src/internal/cst-parser.ts#parseCompactSeqValue
  - src/internal/cst-parser.ts#parseBlockValue
  - src/internal/cst-parser.ts#parseBlockSequenceInner
  - src/internal/cst-parser.ts#implicitMapVerdict
  - src/internal/cst-parser.ts#hasImplicitMapAhead
  - src/internal/cst-parser.ts#seqEntryContentStops
  - src/internal/cst-parser.ts#implicitMapStops
enforcedBy: []
---

The lexer emits start markers only, so every block loop decides its own end. A block mapping at `indent` stops at a document boundary, at a `?`, `:` or content token left of `indent` (it belongs to an ancestor; without the check a nested mapping swallows the sibling `? key` and mis-nests what follows), at a shallower `block-map-start`, at a `block-seq-start` at or left of `indent`, and at a `block-seq-entry` left of `indent` or at it. Two exceptions keep a sequence inside: a dangling `:` (the last child that is not trivia, an anchor or a tag) makes a same-indent `- ` run the entry's compact sequence value (`parseCompactSeqValue`, YAML 1.2 l+block-sequence(n-1)), and an open `?` key keeps a `block-seq-start` the lexer placed at the line indent (KK5P, M5DY `? - a`). A same-line sequence after an explicit key's `:` is already taken by `parseBlockValue`, so the dangling-`:` case only meets later lines.

A block sequence takes entries at exactly its indent and hands anything else to its parent. A sequence entry's content stops at a boundary, at an entry, structure or content token at or left of the sequence indent unless it is a block scalar, and at any token it does not admit; an implicit mapping inside an entry stops only at tokens at or left of the sequence indent (the next `-`, a `?`, a `:` or `block-seq-start` once it has content, content once it has a key) and at a boundary.

The value after a block `:` consumes inline whitespace and content only, never `consumeTrivia`: swallowing a trailing comment and its newline carried the loop onto the next line with no column check, so a dedented sibling after `value # comment` joined the nested mapping. The implicit-mapping lookahead (`hasImplicitMapAhead`) is likewise bounded by the line: a newline or a block scalar (whose token swallows its body's line breaks) ends it, boundaries and sibling entries start lines so the newline before them stops it first, and flow depth is tracked so a `:` inside brackets is not a block value indicator.

Rejected: lexer block-end tokens (libyaml's BLOCK-END), which move the scope arithmetic into the scanner's hot path and still need the dangling-`:` and explicit-key exceptions there.
