---
title: Tail windows find newlines with the typed-array natives on the raw bytes
date: 2026-11-22
reversal: Replace the Uint8Array indexOf and lastIndexOf scans with effect/Array helpers over the window.
governs:
  - src/internal/tail.ts#afterFirstNewlineOrEnd
  - src/internal/tail.ts#decodeLogicalWindow
enforcedBy: []
---

Both newline scans in a tail window call `Uint8Array#indexOf` and `Uint8Array#lastIndexOf`, as upstream does. They search the bytes in place; an `effect/Array` helper first copies the whole window into a Number array, which is the cost the bounded tail read exists to avoid.
`lastIndexOf` returns -1 for a window without a newline, so a complete-only window then ends at byte 0 and nothing of the unfinished line is decoded.
Rejected: the `effect/Array` helpers the repository otherwise prefers, which allocate a copy of every window they scan.
