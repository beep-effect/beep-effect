---
title: The sheet re-clips and checks only graded shading strokes
date: 2026-11-26
reversal: Re-clip uniform strokes beside moved outlines and run the outline-clearance, lone-line and lost-face checks for every shading style.
governs:
  - src/FigureSet.service.ts#clippedShading
  - src/FigureSet.service.ts#makeService
enforcedBy: []
---

The re-clip beside separated outlines and the outline-clearance, lone-line and lost-face checks run only when the sheet's shading style is `graded`. Graded strokes are drawn back from the outlines and planned per visible stretch; uniform strokes end on the face outline by design and have no probe pass, and stay as the kernel planned them.
Rejected: applying the re-clip and those checks to uniform strokes, which would cut every uniform stroke at its own face edge and fail every default render.
