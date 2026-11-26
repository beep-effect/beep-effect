---
title: The byte-order mark advances the offset but occupies no column
date: 2026-11-25
reversal: Consume the BOM with advance() in scanByteOrderMark and count it as a column in replayChar.
governs:
  - src/internal/lexer.ts#createScanner
enforcedBy: []
---

The BOM (YAML 1.2 §5.2) is invisible, so `scanByteOrderMark` moves `pos` without `advance()` and `replayChar` (the `setPosition` replay) skips its column the same way. The token still spans its real offset, so node offsets stay indices into the original text.

Rejected: consuming it with `advance()`, which lexes the first line one column deeper than every line after it, so the composer opens a second collection at that indent (#694).
