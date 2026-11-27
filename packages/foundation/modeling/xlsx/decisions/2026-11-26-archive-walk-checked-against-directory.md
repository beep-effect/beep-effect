---
title: The archive is read by Effect's local-entry walk, checked against the central directory Excel opens by
date: 2026-11-26
reversal: Drop the DuplicatePart and DirectoryMismatch checks and trust the local walk alone, or replace it with a reader that opens the file by its central directory.
governs:
  - src/internal/container.ts#census
  - src/internal/container.ts#directoryMismatch
enforcedBy: []
---

`effect/encoding/Zip` reads in `internal/container.ts` and writes in `internal/writer.ts`; nothing else in `src` imports it. Its reader goes through the local entries in order and never reads the central directory, which is what Excel opens a file by, so a file could show the two readers two workbooks. Two checks close that: one part name met twice is refused (`DuplicatePart`), names compared by `partKey`; and when the file ends with a directory, that directory must name exactly the entries the walk read, each where the one before it ends, from the first byte to the directory itself, and by the name its local header gives it (`DirectoryMismatch`). An archive updated by appending, an entry the directory leaves out or renames, and a directory naming an entry the walk never reached are all refused.

Caps are counted as bytes are inflated, never taken from the sizes a file declares, a directory entry's body included.

Rejected: the local walk alone, and a hand-written central-directory reader in place of Effect's.
