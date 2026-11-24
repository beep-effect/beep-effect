---
title: Base digests count runs the organizer covered in full
date: 2026-11-23
reversal: Count every source digest, including a run that still has an unorganized file.
governs:
  - src/PracticeKg.projections.ts#reconciliationSql
enforcedBy: []
---

`baseDigests` counts distinct source-file digests whose run has every source file in `corpus_organized`.

Reason: those are the runs the organizer covered in full. A run with any file still absent from `corpus_organized` is optional and stays out of the baseline.

Rejected: counting every source digest, including unfinished runs.
