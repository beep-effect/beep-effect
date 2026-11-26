---
title: A property run a newline separates from later content belongs to the outer container
date: 2026-11-25
reversal: Keep one pending-property slot per walk and give every pending anchor and tag to the next node composed.
governs:
  - src/internal/composer/document.ts#commitMetaAcrossNewline
  - src/internal/composer/document.ts#splitKeyMeta
  - src/internal/composer/document.ts#splitFlowMeta
  - src/internal/composer/document.ts#combinedMeta
  - src/internal/composer/block.ts#commitOuterIfNewlineSeen
  - src/internal/composer/block.ts#flushValueMetaBeforeKey
  - src/internal/composer/block.ts#commitSeqOuterIfNewlineSeen
  - src/internal/composer/block.ts#composeSeqImplicitMap
enforcedBy: []
---

The document, block-map and block-sequence walks keep a pending and an outer property slot, and a newline followed by another property or by content moves the pending run to the outer slot (`commitMetaAcrossNewline`, `commitOuterIfNewlineSeen`, `commitSeqOuterIfNewlineSeen`). In `&a !!t1\n&b !!t2 key: v` and `top: &outer\n  &inner key: val` (7BMT, U3XV) the first run belongs to the map and the second to its first key. A double anchor or tag on one scalar is diagnosed before that commit, while both slots still hold their run (4JVG).

At document level with no outer run, a document with a `---` marker gives the pending run to the root map (the composer's earlier behaviour, which allows no key-level properties there) and a marker-less document gives it to the first key (`splitKeyMeta`); a root scalar takes both runs (`combinedMeta`), and a root flow collection that keys a block map keeps the pending run and hands the outer run to the map (`splitFlowMeta`). A property followed by a block-sequence `-` on the same line is rejected (SY6V).

In a block map a value-position run on a continuation line must sit past the parent key's column (G9HC, H7J7); a run still pending in value position when the next scalar proves to be a key with its `:` on the same line becomes the previous entry's empty value (`a: &anchor\nb:`); a block map opening with `:` gives the pending run to its empty first key and the outer run to the map, and an alias first key splits like a scalar one. In a block sequence a run before a further `-` belongs to the previous empty entry (`- &a\n- b`), a run a newline separates from an implicit map's first key tags the map (`- !!map\n key: value`), and `- &a : value` anchors the empty key.

Rejected: one property slot, which lets the second run silently overwrite the first; giving every pending property to the outer container, or every one to the first key.
