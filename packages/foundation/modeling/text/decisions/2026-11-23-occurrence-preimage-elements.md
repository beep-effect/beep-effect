---
title: The occurrence preimage is twelve fixed elements with a literal UTF-16 unit, decoded through the row schema
date: 2026-11-23
reversal: Widen the unit element to OffsetUnit and decode the elements into a plain struct instead of through Anchored.
governs:
  - src/Occurrence.ts#OccurrenceElements
  - src/Occurrence.ts#OccurrenceSchema
enforcedBy: []
---

The twelve elements after the `occurrence/v1` domain tag follow the order goal decision `p0-rq4-occurrence-id-confirmed-mention-id-derives-from-it` fixes.
The unit element is the literal `utf16-code-unit`: one range spelled in two units must not mint two ids (goal decision `p2-occurrence-id-minting-and-proof-gate`).
Decoding builds the `Anchored` row through its own schema, so a golden vector whose width disagrees with its quote fails as a schema issue; encoding reads the row's fields.
Rejected: an `OffsetUnit` element, which lets equal ranges hash apart by spelling.
