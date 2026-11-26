---
title: The render reads its shading and outline tolerances from the validator's defaults
date: 2026-11-26
reversal: Give the render its own clearance, ladder reach, outline spacing and overlap constants.
governs:
  - src/FigureSet.service.ts#validationDefaults
  - src/FigureSet.service.ts#shadingClearanceMm
  - src/FigureSet.service.ts#shadingFor
  - src/FigureSet.service.ts#separatedOutline
enforcedBy: []
---

The shading clearance floor (`minShadingSpacingMm`), the ladder reach (`ladderReachMm`), the least outline spacing and its overlap are read from `ValidationOptions` defaults. Graded stroke ends stand half a pitch clear of the outlines and never less than that floor, and a band whose edge has drawn lines within the ladder reach starts behind a gutter.
Reason: the render then passes its own default check; the kernel's clearance and gutter and the checks cannot drift apart.
Rejected: render-side constants, which drift from the validator and let a default render fail validation.
