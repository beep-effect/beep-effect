---
title: Comments attach to key and value nodes, never to the pair
date: 2026-11-25
reversal: Add comment fields to YamlPair, attach key-line and trailing comments there, and materialise an absent value as a null scalar.
governs:
  - src/internal/composer/comments.ts#CommentFields
  - src/internal/composer/comments.ts#withCommentFields
  - src/internal/composer/comments.ts#rawCommentText
  - src/internal/composer/flow.ts#FlowSeqAttribution
  - src/internal/composer/flow.ts#isBlankBetweenItems
  - src/internal/composer/flow.ts#composeImplicitPairSegment
  - src/internal/composer/flow.ts#flowSeqTrailingComment
  - src/internal/composer/scalars.ts#scalarDecorations
  - src/internal/composer/block.ts#buildPairs
  - src/internal/composer/block.ts#finishPair
  - src/internal/composer/block.ts#keyIsSimple
  - src/internal/composer/block.ts#consumeValueNode
  - src/internal/composer/block.ts#acceptSeqComment
  - src/internal/stringifier.ts#pairLeading
  - src/internal/stringifier.ts#pairTrailing
  - src/internal/stringifier.ts#pairSpaceBefore
  - src/internal/stringifier.ts#entryTrailing
  - src/internal/stringifier.ts#rendersAcrossLines
  - src/internal/stringifier.ts#renderFlowCollectionLines
  - src/internal/stringifier.ts#pushSingleLineMapValue
  - src/internal/stringifier.ts#pushInlineScalarMapValue
  - src/internal/stringifier.ts#pushSeqItemLines
  - src/internal/stringifier.ts#withHeaderComment
  - src/internal/stringifier.ts#unescapeCommentLine
  - src/internal/stringifier.ts#commentBlockLines
enforcedBy: []
---

`YamlPair` carries no comment field. An own-line comment attaches forward to the next entry's key node as `commentBefore`; a comment on the line where an entry ends attaches to that entry's value node as `comment`; own-line comments after a collection's last entry become the collection's `comment` when at or past its content column, and escape to the outer scope when shallower. `spaceBefore` marks the key node when a blank line precedes the entry or its `commentBefore` block; blank lines inside or after a comment run embed as extra `\n` in the joined string, and comment text is the raw post-`#` slice (`rawCommentText`). A block scalar's header-line comment (`key: | # c`) is packed into the scalar's CST token, so it never reaches the sibling attribution pass and becomes the scalar's own trailing `comment` (as in `yaml`).

In a block mapping (`buildPairs`, applied once in `finishPair`) own-line versus trailing is decided from the comment's own line, never from spans, which over-extend after a block collection; an indicator-only prefix (`? # c`, `- # c`) leaves the comment own-line. Comments between a key and its `:` (`? key # c\n: value`) join the pair's trailing comment. Between the `:` and the value, same-line comments trail the pair and own-line ones lead the value node; when no value node follows they are rewound to the enclosing mapping (its terminal run or the next pair's `commentBefore`). The `:` line's comment slot belongs to the key only when the key renders in implicit form (a single-line scalar or an alias, `keyIsSimple`) and the value sits below it (`a: # kc`); a complex key renders `? key` / `: value`, so the comment stays with the value. A blank line between the last entry and a terminal run embeds as a leading empty line, and a blank inside a keep-chomped `|+` scalar's span is content, never `spaceBefore`. The block-sequence walk applies the same model with the sequence indent as the column yardstick.

A flow sequence hoists its attribution state (`FlowSeqAttribution`) across comma segments: an own-line comment belongs to the following item even when a comma splits the segment before that item arrives, and only a comment sharing a line with content trails the last pushed item, even across the comma (`a, # c`). A blank before the first comment of a run, or before a comment-free item, sets `spaceBefore`; a blank within a run embeds as an empty line, one between the run and its item as a trailing empty line, and one between the last item and a terminal run as a leading empty line. A blank counts as between items only after the previous item's end, and an implicit-pair segment anchors that check at its first token: an item sharing a line with earlier structure (`? [a, b]` after a blank line) must not take the blank above that line, which would re-emit it inside the collection and break format idempotence.

Two node slots per entry keep a key-line comment (`a: # kc`) and the value's trailing comment in separate fields, so neither relocates onto the other's line. The model follows the `yaml` npm package; storing comments on the pair caused four former divergences from it (pair-level placement, the alias drop, the multi-line complex-key drop, document field naming). The stringifier reads the same slots back: a key with its own comment keeps the value below it; a collection's `comment` trails the entry only when the collection renders on one line, and is otherwise its terminal run after the last entry; a flow collection whose entries carry comments or blank lines renders one entry per line, so a `#` cannot swallow the closing bracket; a value's leading comment, or a key comment contesting a block scalar's header line, moves the value below the key so every comment keeps its own line; the entry's trailing comment goes on a block scalar's header line or a multi-line quoted scalar's closing line. A stored spaces-only line carries one escape space that `unescapeCommentLine` drops, since `""` encodes an embedded blank line.

Rejected: comment fields on `YamlPair`; materialising an absent value as `Scalar(null)` for parity with `yaml`, which would break every consumer's `pair.value === null` check at runtime instead of at compile time.

Accepted limit: the trailing comment of a value-less entry lands on the key node (emitted bytes match `yaml`); spacing before a trailing `#` normalises to one space, which the post-`#` storage cannot carry (as in `yaml`); a comment after a `...` marker in a multi-document stream may attach to the next document's header instead of the previous trailer, depending on CST document splitting. Every case reparses to the same bytes.
