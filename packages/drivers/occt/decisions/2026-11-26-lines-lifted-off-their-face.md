---
title: Graded strokes, probes and overlay lines are lifted off the face they lie on
date: 2026-11-26
reversal: Return the edge unchanged in liftFor and drop the facing lift in overlayShape, then re-baseline the graded goldens.
governs:
  - src/internal/shading.ts#HATCH_LIFT
  - src/internal/shading.ts#liftFor
  - src/internal/kernel.ts#overlayShape
enforcedBy: []
---

Graded strokes and probes move `HATCH_LIFT` model units (a thousandth of a millimetre on the sheet) along their face's outward normal, and an overlay line moves its `lift` along its facing, before they enter the hidden-line pass.
Reason: a line lying exactly on a face leaves the pass to decide by rounding whether it is behind that face, so a re-made stroke can vanish or show at random.
Rejected: projecting the lines on the face itself, which makes visibility depend on floating-point noise.
Accepted limit: the uniform style keeps its legacy placement, unlifted, so its goldens stay byte-equal.
