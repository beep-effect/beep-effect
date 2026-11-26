---
title: A graded face is probed at nine interior rows plus one edge row a pitch inside each end
date: 2026-11-26
reversal: Return only the interior rows from probeRows and drop the nesting rule from seenArea.
governs:
  - src/internal/shading.ts#PROBE_HEIGHTS
  - src/internal/shading.ts#probeRows
  - src/internal/shading.ts#seenArea
enforcedBy: []
---

Probes cross a graded face at `PROBE_HEIGHTS` rows spread evenly over its reach along the lines, each standing for a cell; where those cells are more than two pitches tall, an edge row a pitch inside each end stands for a cell a pitch to either side.
Reason: a band is clipped to the cells of the probes that saw its area, so it can run on past the area by at most half a cell (a ninth of the face's extent); the edge rows measure a stretch glimpsed at a face's free edge under a part in front near its base, where it is widest.
An edge row's cell lies inside its interior neighbour's (`nestsIn`), so its piece adds only the run that neighbour did not see to the face's seen area.
Rejected: denser rows at every pitch in the end cells, which cost bands elsewhere.
