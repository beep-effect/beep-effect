---
title: A band keeps to the visible area it was planned for
date: 2026-11-26
reversal: Group probe pieces by overlapping range alone in regionsOf and keep every piece of a stretch's shape in drawView.
governs:
  - src/internal/kernel.ts#regionsOf
  - src/internal/kernel.ts#crosses
  - src/internal/kernel.ts#drawView
  - src/internal/shading.ts#clipTo
  - src/internal/shading.ts#strokesOf
  - src/internal/shading.ts#shadeFace
enforcedBy: []
---

Pieces of neighbouring probe rows form one visible area only when their ranges overlap and the link between them, at the middle of the overlap, crosses no drawn outline (touching does not count).
Each stroke is clipped to the cells of the run of rows that saw the area at its offset, and a stretch keeps only the pieces its own probes cross.
Reason: a slanting wall in front of a face makes the pieces on its two sides overlap in range from row to row, and only the link test keeps them apart; the hidden-line pass splits a stroke only where something stands in front of it, so an unclipped chord runs on into another area at the same offsets.
A stroke planned for one cell of a lattice is cut across the whole face and shows in the neighbouring cells, where it would read as a band on the wrong side.
Rejected: one band per face over whole chords, and areas grouped by range overlap alone.
Accepted limit: a stretch planned over the whole face (no probes) keeps all its pieces.
