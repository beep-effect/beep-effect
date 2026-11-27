---
title: The admission replay captures each writer against the export narrowed to its cluster's file
date: 2026-11-26
reversal: Capture every writer's edit against the whole imported export instead of narrowedTo(base, cluster.path).
governs:
  - test/admission-replay.ts#narrowedTo
  - test/admission-replay.ts#prepareReplay
enforcedBy: []
---

prepareReplay hands captureBatchVerified the imported export narrowed to the one file a cluster edits.
Capture and status typing read only the files an edit names, and admission never reads a batch's base, so the captured batch is the same as against the whole export.
Narrowing keeps capture linear in the file rather than in the folder across every writer of the replay.
Rejected: capturing against the whole export, the obvious form, which gives the same batches at a cost that grows with the folder for every writer.
