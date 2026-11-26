---
title: Disowned comments travel to the enclosing scope through one channel, and spans exclude them
date: 2026-11-25
reversal: Drop the trim and report the raw CST length, or re-derive the trimmed end from a column test instead of the disowned set.
governs:
  - src/internal/composer/block.ts#trimDisownedTrailingComments
  - src/internal/composer/block.ts#cutBeforeDisownedComments
  - src/internal/composer/block.ts#reinjectEscapedComments
  - src/internal/composer/block.ts#partitionEscapedComments
  - src/internal/composer/block.ts#pushSeqItem
enforcedBy: []
---

A terminal comment shallower than a collection's content (the first key's column in `buildPairs`, the sequence indent in the block-sequence walk) is disowned: `partitionEscapedComments` pushes it onto `state.escapedComments`. The enclosing level re-injects that queue into its own stream right after the nested node (`reinjectEscapedComments`, `pushSeqItem`), where its own partition may escape it further, and the document drains what is left.

The CST length of a block map or sequence runs to the last physical line the parser consumed, which can include such a comment, so a caller splicing text at the collection's end inserted after a comment the node does not own. `trimDisownedTrailingComments` ends the span before the first disowned comment line inside it: only entries inside the span count, because the channel is shared; a collection never shrinks past its own first line; blank lines right above a trimmed run go with the run, but only when something was trimmed. Composition is bottom-up, so a nested span is already trimmed when its parent reads it.

Rejected: re-deriving the trim from a column test, which lets the span and the comment model drift apart; leaving the span over comments the node does not own.
