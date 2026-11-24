---
title: The journal has one tail decoder and one range decoder, and only completed records move its cursor
date: 2026-11-22
reversal: Give the watcher's catch-up and the append's foreign-growth path their own decode loops, reimplement the walk-back in decodeWindow, or advance the cursor to the stat EOF.
governs:
  - src/Journal.ts#decodeWindow
  - src/Journal.ts#makeEngine
enforcedBy: []
---

`decodeWindow` does not reimplement the walk-back: `Envelope.lastValidResult` is the binding definition of the journal's current state (blank lines, walked-over failures, where it stops). It only rebases the window's offsets from `window.start` onto the journal.
`decodeRange` is the one loop that decodes `[from, to)` for every external-growth path: the watcher's catch-up and an append whose bytes landed past another writer's. Two copies of a loop that rebases offsets and tolerates a torn tail drift into a cursor bug on one path only. A line that fails to decode is skipped, so a foreign writer's unknown tag cannot blind this reader to later lines.
`consumed` is the logical-byte resume cursor. It advances only to where the last complete line ended: an unterminated final line holds it until its writer finishes. The seed resumes at the last completed seed record, never at a later stat EOF, so a torn suffix or unread growth stays pending for reconciliation. After a write whose post-write size is not the expected EOF, the append fails `JournalWriteConflict` and leaves `consumed` at the known boundary: a shared EOF cannot prove the line's position, so the next reconciliation reads the real file in its own order.
Rejected: per-path decode loops. Rejected: advancing the cursor to the observed file size.
