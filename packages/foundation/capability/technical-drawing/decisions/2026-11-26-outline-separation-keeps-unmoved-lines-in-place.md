---
title: Outline separation keeps an unmoved line on its own line and slides the vertices that meet it along it
date: 2026-11-26
reversal: Re-solve every vertex of separateCloseOutlines as the intersection of the lines that now meet there, moved or not.
governs:
  - src/Outline.rules.ts#separateCloseOutlines
enforcedBy: []
---

When separateCloseOutlines moves lines apart, a line it did not move keeps its own line. A vertex where a moved line meets it slides along it, and a vertex where two moved lines meet an unmoved line stays on that unmoved line.
Reason: re-solving the vertices point by point dragged an unmoved anchor 0.18 toward a moved neighbour, closing that pair to 0.52 again. It also put a vertex on two moved lines at their new intersection, which leaned an unmoved vertical 0.32° and widened the crossing gap beside it.
Rejected: placing every vertex at the new intersection of the lines that meet there. That is simpler, but it bends unmoved geometry and reopens pairs the pass had already separated.
