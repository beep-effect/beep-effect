---
title: A stretch's room for a band is judged on the plan, never on what survived hidden-line removal
date: 2026-11-26
reversal: Judge hasRoom on the stretch's visible pieces in drawView instead of its planned strokes.
governs:
  - src/internal/kernel.ts#drawView
  - src/internal/shading.ts#hasBandRoom
enforcedBy: []
---

A stretch planned with room for fewer than two legible strokes (`legibleStrokeLength`: the minimum stroke plus a pitch of inset at each end, on the view plane before hidden-line removal) is a sliver glimpsed through a gap, such as a far wall seen through a star cell. It stays bare like a sliver face and is never counted lost; a face whose every stretch is a sliver counts as a sliver, not a shaded face.
Reason: a band planned with room and hidden all the same is the loss the coverage must report; judging room on survivors would relabel it a sliver.
The stroke pass asks the same `hasBandRoom` before it hands a stretch over, so a band its taper alone would empty arrives re-planned or untapered.
Rejected: measuring room from the pieces that survived the pass.
