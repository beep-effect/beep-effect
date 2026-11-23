---
title: The engine's hot paths are loops over one mutable read state, not Effect folds
date: 2026-11-22
reversal: Rewrite run, Machine, widthsWith and the byte helpers as A.reduce folds or recursion over immutable state, and accept the stack and cost regressions.
governs:
  - src/Csv.codec.ts#run
  - src/internal/machine.ts#Machine
  - src/internal/machine.ts#Completed
  - src/internal/machine.ts#plainRunEnd
  - src/internal/encoding.ts#firstInvalidUtf8
  - src/internal/sniff.ts#widthsWith
  - src/internal/stream.ts#concatBytes
  - src/internal/stream.ts#unfinishedSequenceTailLength
enforcedBy: []
---

The push machine keeps one read's state in one mutable `Machine`, mutated per character, and the drivers around it are `while`/`for` loops that stop early.

A loop stops at the first fatal finding (a fold visits every remaining piece), at ten preview records, or at the first invalid UTF-8 byte; recursion overflows on one-character pieces. One mutable record makes a chunk cost its own length, not the width of the record open across it, and `Completed` spans stay plain numbers so a whole read builds no position values (`takeSlices` builds them for channels). No Effect module validates UTF-8 with an offset, concatenates byte arrays or reads a partial UTF-8 tail.

Rejected: `A.reduce`/`Stream` folds, recursive steppers, and an immutable state copied per piece, which took about 16 s on a 40,001-cell record.
