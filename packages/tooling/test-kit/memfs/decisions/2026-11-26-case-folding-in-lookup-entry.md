---
title: A case-insensitive volume folds names only in lookupEntry and keeps the stored or requested spelling per operation
date: 2026-11-26
reversal: Store folded keys, or fold at each call site, and canonicalize every spelling a caller sees to the stored one.
governs:
  - src/internal/volume.ts#lookupEntry
  - src/internal/volume.ts#renameDestination
  - src/internal/volume.ts#copyDirectoryChild
  - src/internal/volume.ts#copyEntryUnlocked
  - src/internal/volume.ts#publishWatchEvents
  - src/internal/volume.ts#matchesGlobToken
enforcedBy: []
---

`caseSensitive: false` models a case-insensitive, case-preserving volume; every rule was measured on APFS first. Folding lives in `lookupEntry` alone: the exact name, then a folded comparison, answering the STORED key with the inode, so every mutation of an existing entry (detach, rekey, replace) hits the real map entry. A walk over a directory's own keys already holds stored keys and uses an exact get.
Spellings a caller sees keep the queried component: `realPath` and watch paths keep it, as node's JS realpath never canonicalizes case, and only a link's target text supplies its own.
`rename` and `copyFile` onto a folded-equal entry keep the destination's stored spelling. A hit on the source entry itself is a case-only rename that rekeys it with its children; a byte-identical rename is a no-op, as XNU skips it, so `rename("dir", "dir")` over a stored `Dir` keeps `Dir`.
`copy` is async `fs.cp`, unlink then recreate: the folded-equal destination is detached by its stored key and the copy linked under the requested spelling, or the source child's spelling inside a tree.
Watch matching compares folded paths and delivers the event's own; glob compares literals folded, accepts either case in a class and returns stored names.
Accepted limit: `toLowerCase` per UTF-16 unit (`İ`, `ß`), and no NFC/NFD normalization.
Rejected: folded stored keys, which lose case preservation; folding at each call site, which lets one operation drift from the others.
