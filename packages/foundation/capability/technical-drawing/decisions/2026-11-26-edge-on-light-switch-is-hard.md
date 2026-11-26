---
title: A face lit edge-on to its lines takes its shadow side from the sheet at a hard threshold
date: 2026-11-26
reversal: Replace the hard 0.2 threshold with a ramp between the light-derived and the sheet-derived shadow side.
governs:
  - src/Shading.rules.ts#EDGE_ON_LIGHT
  - src/Shading.rules.ts#anchorOf
enforcedBy: []
---

Below a 0.2 share of the light along a face's step, the shadow side is read from the sheet (the lower right) instead of the light; otherwise a wall the sheet light runs straight across in an isometric flips sides on rounding. The switch is a hard edge: over the default camera sets no two views that light an upright face within 0.01 of each other put its band on different sides (the camera sweep in the tests, review loop 3, K-07).
Rejected: a ramp like the faint ramp the band recipes use; the sweep found no pair of near-alike default views that a ramp would keep on one side.
Accepted limit: within one view a face whose share sits near 0.2 can still change sides with a turn of under a degree.
