---
title: A tapered band emptied by hidden-line removal is redrawn on its whole clipped chords
date: 2026-11-26
reversal: Drop the emptied redraw pass in drawView and the whole-chord fallback in shadeFace, counting such stretches lost.
governs:
  - src/internal/kernel.ts#drawView
  - src/internal/kernel.ts#matchedRuns
  - src/internal/kernel.ts#retapered
  - src/internal/shading.ts#shadeFace
enforcedBy: []
---

The taper may shorten a band but never empty it. The planner judges a tapered band's room on its rows' cells, but a part in front can cut a cell anywhere between the probe that saw the face and the row beyond, leaving each stroke only its near end for the legibility pass to drop.
A plan without tapered room is re-planned from a later row of the area, nearest first; failing that its strokes go whole (`relaxed` by the planner). A stretch planned with room that drew nothing is drawn again on whole clipped chords through one more pass, run only when such a stretch exists (`redrawn` by the kernel).
Each legible run is matched to the planned stroke whose view-plane line is nearest its middle (a band's strokes are parallel and at least a pitch apart), then cut back to that stroke's taper against the band's longest run (`bandRunLengths`), centred and never below the minimum stroke, so the band keeps its taper and order of lengths.
Rejected: counting such a stretch lost, or drawing it untapered. Room still comes from the plan, so whole chords that draw nothing leave a lost stretch.
